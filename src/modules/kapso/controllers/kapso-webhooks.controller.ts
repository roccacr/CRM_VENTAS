/**
 * Recepción de webhooks Kapso/Meta bajo `/{apiPrefix}/webhooks/kapso/*`.
 *
 * Seguridad:
 * - `@Public`: Kapso/Meta no envían JWT del CRM.
 * - HMAC sobre `rawBody` (requiere `rawBody: true` en `main.ts`).
 * - Throttle alto (300/min) para absorber ráfagas legítimas sin abrir flood infinito.
 *
 * Idempotencia: reserva por `x-idempotency-key` o hash del payload; duplicados
 * responden 200 sin reprocesar. Mismatch de payload con misma key → 409.
 */

import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Headers,
  HttpCode,
  Logger,
  Post,
  RawBodyRequest,
  Req,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Throttle } from "@nestjs/throttler";
import { createHash } from "crypto";
import { Request } from "express";

import { Public } from "../../../common/auth/auth.decorators";
import { KapsoWebhookScope } from "../entities/kapso-phone-number.entity";
import {
  asRecord,
  firstNonNullString,
  getNestedValue,
  isKapsoPhoneNumberAvailabilityError,
} from "../common/kapso.helpers";
import { JsonRecord } from "../common/kapso.types";

import { KapsoRepository } from "../repositories/kapso.repository";
import { KapsoSignatureService } from "../services/kapso-signature.service";
import { KapsoSyncService } from "../services/kapso-sync.service";

type DuplicateWebhookResponse = {
  ok: true;
  duplicate: true;
  phoneNumberId: string;
  status: string | null;
};

/**
 * Handlers de webhooks de plataforma, eventos Kapso y reenvío Meta.
 * Orquesta firma → idempotencia → procesamiento → cierre del receipt.
 */
@Controller("webhooks/kapso")
@Public()
export class KapsoWebhooksController {
  private readonly logger = new Logger(KapsoWebhooksController.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly kapsoSignatureService: KapsoSignatureService,
    private readonly kapsoRepository: KapsoRepository,
    private readonly kapsoSyncService: KapsoSyncService,
  ) {}

  /**
   * Webhook de plataforma (creación/borrado de números, etc.).
   * Usa el secreto `kapso.platformWebhookSecret`.
   *
   * Errores de disponibilidad remota en `phone_number.created` se tratan como
   * `pending_remote_sync` (200) para que Kapso no reintente indefinidamente
   * mientras el worker local completa el detalle.
   */
  @Post("platform")
  @HttpCode(200)
  @Throttle({ default: { limit: 300, ttl: 60_000 } })
  async handlePlatformWebhook(
    @Req() request: RawBodyRequest<Request>,
    @Body() body: Record<string, unknown>,
    @Headers("x-webhook-signature") signature: string | undefined,
    @Headers("x-idempotency-key") idempotencyKey: string | undefined,
    @Headers("x-webhook-event") webhookEventHeader: string | undefined,
  ) {
    const payload = asRecord(body);
    const phoneNumberId = this.extractPhoneNumberId(payload);
    const receiptKey = this.resolveReceiptKey(request, payload, idempotencyKey);

    this.assertSignedWebhook(
      request,
      payload,
      signature,
      this.configService.getOrThrow<string>("kapso.platformWebhookSecret"),
      "Firma de webhook de plataforma invalida.",
    );

    const duplicatedResponse = await this.reserveWebhookReceipt("platform", request, payload, phoneNumberId, receiptKey);

    if (duplicatedResponse) {
      this.logDuplicateIgnored("platform", receiptKey, duplicatedResponse);
      return duplicatedResponse;
    }

    const eventName = firstNonNullString(payload.event, webhookEventHeader);
    this.logWebhookReceived("Platform", eventName, phoneNumberId, receiptKey, payload);

    if (phoneNumberId) {
      await this.persistWebhookTouch("platform", payload, phoneNumberId, receiptKey, eventName, true, "received");
    }

    try {
      await this.processPlatformEvent(eventName, payload, phoneNumberId);
      await this.completeWebhookReceipt("platform", receiptKey, "processed");

      this.logger.log(`Platform webhook processed phoneNumberId=${phoneNumberId ?? "n/a"} event=${eventName ?? "unknown"}`);
      return { ok: true };
    } catch (error) {
      try {
        const response = await this.handlePlatformWebhookError(error, phoneNumberId, eventName);
        await this.completeWebhookReceipt("platform", receiptKey, "processed");
        return response;
      } catch (handledError) {
        await this.completeWebhookReceipt("platform", receiptKey, "failed", handledError);
        throw handledError;
      }
    }
  }

  /**
   * Webhook de eventos WhatsApp vía Kapso (mensajes entrantes normalizados).
   * Usa `kapso.whatsappWebhookSecret` y delega a automatización de leads.
   */
  @Post("events")
  @HttpCode(200)
  @Throttle({ default: { limit: 300, ttl: 60_000 } })
  async handleKapsoEventsWebhook(
    @Req() request: RawBodyRequest<Request>,
    @Body() body: Record<string, unknown>,
    @Headers("x-webhook-signature") signature: string | undefined,
    @Headers("x-idempotency-key") idempotencyKey: string | undefined,
    @Headers("x-webhook-event") webhookEventHeader: string | undefined,
  ) {
    const payload = asRecord(body);
    const phoneNumberId = this.extractPhoneNumberId(payload);
    const receiptKey = this.resolveReceiptKey(request, payload, idempotencyKey);

    this.assertSignedWebhook(
      request,
      payload,
      signature,
      this.configService.getOrThrow<string>("kapso.whatsappWebhookSecret"),
      "Firma de webhook de WhatsApp invalida.",
    );

    const duplicatedResponse = await this.reserveWebhookReceipt("kapso", request, payload, phoneNumberId, receiptKey);

    if (duplicatedResponse) {
      this.logDuplicateIgnored("Kapso events", receiptKey, duplicatedResponse);
      return duplicatedResponse;
    }

    const eventName = firstNonNullString(payload.event, webhookEventHeader);
    this.logWebhookReceived("Kapso events", eventName, phoneNumberId, receiptKey, payload);

    try {
      if (phoneNumberId) {
        await this.persistWebhookTouch("kapso", payload, phoneNumberId, receiptKey, eventName, true, "processed");
      }

      await this.kapsoSyncService.processInboundMessageWebhook(payload);
      await this.completeWebhookReceipt("kapso", receiptKey, "processed");
      return { ok: true };
    } catch (error) {
      await this.completeWebhookReceipt("kapso", receiptKey, "failed", error);
      throw error;
    }
  }

  /**
   * Webhook estilo Meta (payload anidado `entry.changes.value`).
   * Usa `kapso.metaWebhookSecret` y extrae `metadata.phone_number_id`.
   */
  @Post("meta")
  @HttpCode(200)
  @Throttle({ default: { limit: 300, ttl: 60_000 } })
  async handleMetaWebhook(
    @Req() request: RawBodyRequest<Request>,
    @Body() body: Record<string, unknown>,
    @Headers("x-webhook-signature") signature: string | undefined,
    @Headers("x-idempotency-key") idempotencyKey: string | undefined,
  ) {
    const payload = asRecord(body);
    const phoneNumberId = this.extractPhoneNumberId(payload, getNestedValue(payload, "metadata", "phone_number_id"));
    const receiptKey = this.resolveReceiptKey(request, payload, idempotencyKey);

    this.assertSignedWebhook(
      request,
      payload,
      signature,
      this.configService.getOrThrow<string>("kapso.metaWebhookSecret"),
      "Firma de webhook Meta invalida.",
    );

    const duplicatedResponse = await this.reserveWebhookReceipt("meta", request, payload, phoneNumberId, receiptKey);

    if (duplicatedResponse) {
      this.logDuplicateIgnored("Meta", receiptKey, duplicatedResponse);
      return duplicatedResponse;
    }

    this.logWebhookReceived("Meta", "meta.forwarded", phoneNumberId, receiptKey, payload);

    try {
      if (phoneNumberId) {
        await this.persistWebhookTouch("meta", payload, phoneNumberId, receiptKey, "meta.forwarded", true, "processed");
      }

      await this.kapsoSyncService.processInboundMessageWebhook(payload);
      await this.completeWebhookReceipt("meta", receiptKey, "processed");
      return { ok: true };
    } catch (error) {
      await this.completeWebhookReceipt("meta", receiptKey, "failed", error);
      throw error;
    }
  }

  /** Enruta eventos de plataforma a sync create/delete y marca touch si aplica. */
  private async processPlatformEvent(eventName: string | null, payload: JsonRecord, phoneNumberId: string | null) {
    if (eventName === "whatsapp.phone_number.created") {
      await this.kapsoSyncService.handlePhoneNumberCreatedEvent(payload);
      return;
    }

    if (eventName === "whatsapp.phone_number.deleted") {
      await this.kapsoSyncService.handlePhoneNumberDeletedEvent(payload);
    }

    if (phoneNumberId && eventName !== "whatsapp.phone_number.created") {
      await this.kapsoRepository.recordWebhookSyncResult(phoneNumberId, "processed");
    }
  }

  /**
   * Distingue el caso transitorio `pending_remote_sync` de errores terminales.
   * Solo el primero responde 200 con advertencia para no marcar el webhook como fallido.
   */
  private async handlePlatformWebhookError(error: unknown, phoneNumberId: string | null, eventName: string | null) {
    const message = error instanceof Error ? error.message : "Unknown platform webhook error";

    if (phoneNumberId && eventName === "whatsapp.phone_number.created" && isKapsoPhoneNumberAvailabilityError(message)) {
      await this.kapsoRepository.recordWebhookSyncResult(phoneNumberId, "pending_remote_sync", message);
      this.logger.warn(`Platform webhook pending sync phoneNumberId=${phoneNumberId} event=${eventName} reason=${message}`);
      return { ok: true, pendingSync: true };
    }

    this.logger.error(message);

    if (phoneNumberId) {
      await this.kapsoRepository.recordWebhookSyncResult(phoneNumberId, "failed", message);
    }

    throw error;
  }

  private extractPhoneNumberId(payload: JsonRecord, ...extraCandidates: unknown[]): string | null {
    return firstNonNullString(payload.phone_number_id, payload.phoneNumberId, ...extraCandidates);
  }

  /** Usa `rawBody` cuando existe para validar HMAC exactamente sobre el payload recibido. */
  private getRawBody(request: RawBodyRequest<Request>, payload: JsonRecord): Buffer {
    return request.rawBody ?? Buffer.from(JSON.stringify(payload));
  }

  /** Valida la firma HMAC y corta la ejecución con 401 si no coincide. */
  private assertSignedWebhook(
    request: RawBodyRequest<Request>,
    payload: JsonRecord,
    signature: string | undefined,
    secret: string,
    invalidMessage: string,
  ): void {
    const rawBody = this.getRawBody(request, payload);
    const signatureValid = this.kapsoSignatureService.verifySignature(rawBody, signature, secret);

    if (!signatureValid) {
      throw new UnauthorizedException(invalidMessage);
    }
  }

  /** Persiste un “touch” de auditoría del webhook sobre el número afectado. */
  private async persistWebhookTouch(
    scope: KapsoWebhookScope,
    payload: JsonRecord,
    phoneNumberId: string,
    idempotencyKey: string | undefined,
    eventName: string | null,
    signatureValid: boolean,
    processingStatus: string,
  ) {
    await this.kapsoRepository.touchPhoneNumberWebhookEvent({
      scope,
      eventName,
      phoneNumberId,
      projectExternalId: firstNonNullString(payload.project_id, getNestedValue(payload, "project", "id")),
      projectPayload: asRecord(getNestedValue(payload, "project")),
      kapsoCustomerId: firstNonNullString(payload.customer_id, getNestedValue(payload, "customer", "id")),
      customerPayload: asRecord(getNestedValue(payload, "customer")),
      idempotencyKey: idempotencyKey ?? null,
      signatureValid,
      processingStatus,
      processingError: null,
      payloadJson: payload,
    });
  }

  private logWebhookReceived(
    label: string,
    eventName: string | null,
    phoneNumberId: string | null,
    idempotencyKey: string | undefined,
    payload: JsonRecord,
  ) {
    this.logger.log(
      `${label} webhook received event=${eventName ?? "unknown"} phoneNumberId=${phoneNumberId ?? "n/a"} idempotencyKey=${idempotencyKey ?? "none"}`,
    );
    this.logger.verbose(`${label} payload keys=${Object.keys(payload).join(", ") || "[empty]"}`);
  }

  private logDuplicateIgnored(label: string, idempotencyKey: string | undefined, response: DuplicateWebhookResponse) {
    this.logger.warn(`Duplicate ${label} webhook ignored idempotencyKey=${idempotencyKey ?? "none"} status=${response.status}`);
  }

  /**
   * Reserva el receipt de idempotencia.
   * Si la misma key llegó con otro hash de payload → Conflict (posible replay malicioso o bug del emisor).
   */
  private async reserveWebhookReceipt(
    scope: KapsoWebhookScope,
    request: RawBodyRequest<Request>,
    payload: JsonRecord,
    phoneNumberId: string | null,
    idempotencyKey: string,
  ): Promise<DuplicateWebhookResponse | null> {
    const payloadHash = createHash("sha256").update(this.getRawBody(request, payload)).digest("hex");
    const reservation = await this.kapsoRepository.reserveWebhookReceipt(scope, idempotencyKey, phoneNumberId, payloadHash);

    if (reservation.payloadMismatch) {
      throw new ConflictException("La llave de idempotencia ya fue usada con un payload diferente.");
    }

    if (reservation.acquired) {
      return null;
    }

    return {
      ok: true,
      duplicate: true,
      phoneNumberId: reservation.phoneNumberId ?? phoneNumberId ?? "unknown",
      status: reservation.status,
    };
  }

  private async completeWebhookReceipt(
    scope: KapsoWebhookScope,
    idempotencyKey: string,
    status: "processed" | "failed",
    error?: unknown,
  ): Promise<void> {
    const processingError = error instanceof Error ? error.message : error ? String(error) : undefined;
    await this.kapsoRepository.completeWebhookReceipt(scope, idempotencyKey, status, processingError);
  }

  /**
   * Resuelve la clave de idempotencia: header tipado o hash estable del raw body.
   * Limita longitud del header para evitar abuse de storage en receipts.
   */
  private resolveReceiptKey(request: RawBodyRequest<Request>, payload: JsonRecord, providedKey: string | undefined): string {
    const normalized = providedKey?.trim();

    if (normalized) {
      if (normalized.length > 120) {
        throw new BadRequestException("La llave de idempotencia excede el tamaño permitido.");
      }

      return normalized;
    }

    const digest = createHash("sha256").update(this.getRawBody(request, payload)).digest("hex");
    return `payload:${digest}`;
  }
}
