// ============================================================================
// IMPORTS
// ============================================================================

// Decoradores y tipos HTTP usados para recibir webhooks firmados y rawBody.
import { Body, Controller, Headers, HttpCode, Logger, Post, RawBodyRequest, Req, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Request } from "express";

// Tipos y helpers del dominio Kapso.
import { KapsoWebhookScope } from "../entities/kapso-phone-number.entity";
import {
  asRecord,
  firstNonNullString,
  getNestedValue,
  isKapsoPhoneNumberAvailabilityError,
  summarizePayload,
} from "../common/kapso.helpers";
import { JsonRecord } from "../common/kapso.types";

// Persistencia, verificación HMAC y orquestación del sync.
import { KapsoRepository } from "../repositories/kapso.repository";
import { KapsoSignatureService } from "../services/kapso-signature.service";
import { KapsoSyncService } from "../services/kapso-sync.service";

// ============================================================================
// TIPOS LOCALES
// ============================================================================

/** Respuesta idempotente devuelta cuando Kapso reentrega exactamente el mismo webhook. */
type DuplicateWebhookResponse = {
  ok: true;
  duplicate: true;
  phoneNumberId: string;
  status: string | null;
};

// ============================================================================
// CONTROLADOR
// ============================================================================

/**
 * Recepción de webhooks de Kapso y Meta.
 * Rutas bajo `/{apiPrefix}/webhooks/kapso/*`.
 *
 * Requiere `rawBody: true` en `main.ts` para validar firmas HMAC.
 */
@Controller("webhooks/kapso")
export class KapsoWebhooksController {
  private readonly logger = new Logger(KapsoWebhooksController.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly kapsoSignatureService: KapsoSignatureService,
    private readonly kapsoRepository: KapsoRepository,
    private readonly kapsoSyncService: KapsoSyncService,
  ) {}

  // --------------------------------------------------------------------------
  // WEBHOOKS DE PLATAFORMA
  // --------------------------------------------------------------------------

  /**
   * POST /webhooks/kapso/platform
   * Eventos de ciclo de vida del número (`created` / `deleted`) enviados por Kapso.
   */
  @Post("platform")
  @HttpCode(200)
  async handlePlatformWebhook(
    @Req() request: RawBodyRequest<Request>,
    @Body() body: Record<string, unknown>,
    @Headers("x-webhook-signature") signature: string | undefined,
    @Headers("x-idempotency-key") idempotencyKey: string | undefined,
    @Headers("x-webhook-event") webhookEventHeader: string | undefined,
  ) {
    const payload = asRecord(body);
    const phoneNumberId = this.extractPhoneNumberId(payload);
    const duplicatedResponse = await this.findDuplicateWebhook("platform", phoneNumberId, idempotencyKey);

    if (duplicatedResponse) {
      this.logDuplicateIgnored("platform", idempotencyKey, duplicatedResponse);
      return duplicatedResponse;
    }

    this.assertSignedWebhook(
      request,
      payload,
      signature,
      this.configService.getOrThrow<string>("kapso.platformWebhookSecret"),
      "Firma de webhook de plataforma invalida.",
    );

    const eventName = firstNonNullString(payload.event, webhookEventHeader);
    this.logWebhookReceived("Platform", eventName, phoneNumberId, idempotencyKey, payload);

    if (phoneNumberId) {
      await this.persistWebhookTouch("platform", payload, phoneNumberId, idempotencyKey, eventName, true, "received");
    }

    try {
      await this.processPlatformEvent(eventName, payload, phoneNumberId);

      this.logger.log(`Platform webhook processed phoneNumberId=${phoneNumberId ?? "n/a"} event=${eventName ?? "unknown"}`);
      return { ok: true };
    } catch (error) {
      return this.handlePlatformWebhookError(error, phoneNumberId, eventName);
    }
  }

  // --------------------------------------------------------------------------
  // WEBHOOKS KAPSO POR NUMERO
  // --------------------------------------------------------------------------

  /**
   * POST /webhooks/kapso/events
   * Eventos de mensajería WhatsApp (`kind: kapso`) enviados por Kapso.
   */
  @Post("events")
  @HttpCode(200)
  async handleKapsoEventsWebhook(
    @Req() request: RawBodyRequest<Request>,
    @Body() body: Record<string, unknown>,
    @Headers("x-webhook-signature") signature: string | undefined,
    @Headers("x-idempotency-key") idempotencyKey: string | undefined,
    @Headers("x-webhook-event") webhookEventHeader: string | undefined,
  ) {
    const payload = asRecord(body);
    const phoneNumberId = this.extractPhoneNumberId(payload);
    const duplicatedResponse = await this.findDuplicateWebhook("kapso", phoneNumberId, idempotencyKey);

    if (duplicatedResponse) {
      this.logDuplicateIgnored("Kapso events", idempotencyKey, duplicatedResponse);
      return duplicatedResponse;
    }

    this.assertSignedWebhook(
      request,
      payload,
      signature,
      this.configService.getOrThrow<string>("kapso.whatsappWebhookSecret"),
      "Firma de webhook de WhatsApp invalida.",
    );

    const eventName = firstNonNullString(payload.event, webhookEventHeader);
    this.logWebhookReceived("Kapso events", eventName, phoneNumberId, idempotencyKey, payload);

    if (phoneNumberId) {
      await this.persistWebhookTouch("kapso", payload, phoneNumberId, idempotencyKey, eventName, true, "processed");
    }

    await this.kapsoSyncService.processInboundMessageWebhook(payload);

    return { ok: true };
  }

  // --------------------------------------------------------------------------
  // REENVIO META
  // --------------------------------------------------------------------------

  /**
   * POST /webhooks/kapso/meta
   * Reenvío de eventos Meta desde Kapso. No valida firma Kapso porque su origen
   * puede ser Meta o un relay proxy del lado de Kapso.
   */
  @Post("meta")
  @HttpCode(200)
  async handleMetaWebhook(@Body() body: Record<string, unknown>, @Headers("x-idempotency-key") idempotencyKey: string | undefined) {
    const payload = asRecord(body);
    const phoneNumberId = this.extractPhoneNumberId(payload, getNestedValue(payload, "metadata", "phone_number_id"));
    const duplicatedResponse = await this.findDuplicateWebhook("meta", phoneNumberId, idempotencyKey);

    if (duplicatedResponse) {
      this.logDuplicateIgnored("Meta", idempotencyKey, duplicatedResponse);
      return duplicatedResponse;
    }

    this.logger.log(`Meta webhook received idempotencyKey=${idempotencyKey ?? "none"}`);
    this.logger.verbose(`Meta payload keys=${Object.keys(payload).join(", ") || "[empty]"}`);
    this.logger.verbose(`Meta payload=${summarizePayload(payload)}`);

    if (phoneNumberId) {
      await this.persistWebhookTouch("meta", payload, phoneNumberId, idempotencyKey, "meta.forwarded", true, "processed");
    }

    await this.kapsoSyncService.processInboundMessageWebhook(payload);

    return { ok: true };
  }

  // --------------------------------------------------------------------------
  // ORQUESTACION DE EVENTOS
  // --------------------------------------------------------------------------

  /**
   * Enruta solo los eventos de plataforma con impacto directo sobre la fila local.
   * El evento `created` delega completamente el estado final a `KapsoSyncService`.
   */
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

  // --------------------------------------------------------------------------
  // HELPERS DE EXTRACCION Y SEGURIDAD
  // --------------------------------------------------------------------------

  /** Obtiene `phone_number_id` tolerando nombres alternos y candidatos extra. */
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

  // --------------------------------------------------------------------------
  // AUDITORIA E IDEMPOTENCIA
  // --------------------------------------------------------------------------

  /** Actualiza la auditoría local del último webhook visto para ese número. */
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

  /** Log estructurado común para platform y Kapso events. */
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
    this.logger.verbose(`${label} payload=${summarizePayload(payload)}`);
  }

  /** Explica por log cuándo una reentrega fue ignorada por idempotencia. */
  private logDuplicateIgnored(label: string, idempotencyKey: string | undefined, response: DuplicateWebhookResponse) {
    this.logger.warn(`Duplicate ${label} webhook ignored idempotencyKey=${idempotencyKey ?? "none"} status=${response.status}`);
  }

  /** Busca duplicados solo cuando Kapso envía idempotency key y el número ya fue identificado. */
  private async findDuplicateWebhook(
    scope: KapsoWebhookScope,
    phoneNumberId?: string | null,
    idempotencyKey?: string,
  ): Promise<DuplicateWebhookResponse | null> {
    if (!idempotencyKey || !phoneNumberId) {
      return null;
    }

    const existingPhoneNumber = await this.kapsoRepository.findProcessedWebhookDuplicate(scope, phoneNumberId, idempotencyKey);
    if (!existingPhoneNumber) {
      return null;
    }

    return {
      ok: true,
      duplicate: true,
      phoneNumberId: existingPhoneNumber.phoneNumberId,
      status: existingPhoneNumber.lastProcessingStatus,
    };
  }
}
