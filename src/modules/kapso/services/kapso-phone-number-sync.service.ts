/**
 * Sincronización de números WhatsApp Kapso ↔ BD local y webhooks por número.
 *
 * Cubriendo onboarding: bootstrap masivo, eventos create/delete, sync puntual
 * y worker de `pending_remote_sync` cuando Kapso aún no expone el detalle remoto.
 * Los fallos de webhook por número se acumulan como warnings para no abortar el upsert.
 */

import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

import { KAPSO_DEFAULT_EVENTS } from "../common/kapso.constants";
import {
  firstNonNullString,
  getNestedValue,
  isKapsoPhoneNumberAvailabilityError,
  summarizePayload,
  toKapsoApiOptions,
} from "../common/kapso.helpers";
import {
  BootstrapSyncSummary,
  EnsurePerNumberWebhooksResult,
  JsonRecord,
  KapsoApiRequestOptions,
  KapsoPhoneNumberDetail,
  KapsoProjectContext,
  PendingRemoteSyncSummary,
} from "../common/kapso.types";
import { KapsoRepository } from "../repositories/kapso.repository";
import { KapsoPlatformApiService } from "./kapso-platform-api.service";

const DEFAULT_PENDING_SYNC_BATCH_SIZE = 10;

/**
 * Orquestador de sync de phone numbers: API Kapso → upsert local → ensure webhooks.
 */
@Injectable()
export class KapsoPhoneNumberSyncService {
  private readonly logger = new Logger(KapsoPhoneNumberSyncService.name);
  /** Lock en memoria: evita dos corridas del worker en la misma instancia. */
  private pendingSyncWorkerRunning = false;

  constructor(
    private readonly configService: ConfigService,
    private readonly kapsoPlatformApiService: KapsoPlatformApiService,
    private readonly kapsoRepository: KapsoRepository,
  ) {}

  /**
   * Bootstrap inicial/operativo: opcionalmente asegura webhook de proyecto y
   * sincroniza todos los números remotos (incluye creación de webhooks Kapso+Meta).
   *
   * @param ensureProjectWebhook - Si debe garantizar el webhook de plataforma.
   * @returns Resumen de conteos del bootstrap.
   */
  async bootstrapSync(ensureProjectWebhook = true): Promise<BootstrapSyncSummary> {
    this.logger.log(`Bootstrap sync started ensureProjectWebhook=${ensureProjectWebhook}`);

    const summary: BootstrapSyncSummary = {
      projectWebhookEnsured: false,
      phoneNumbersSynced: 0,
      perNumberWebhooksEnsured: 0,
    };

    if (ensureProjectWebhook) {
      await this.kapsoPlatformApiService.ensureProjectWebhook();
      summary.projectWebhookEnsured = true;
    }

    const phoneNumbers = await this.kapsoPlatformApiService.listPhoneNumbers();

    for (const phoneNumber of phoneNumbers) {
      await this.syncPhoneNumberById(phoneNumber.phoneNumberId, phoneNumber.projectId);
      summary.phoneNumbersSynced += 1;
      summary.perNumberWebhooksEnsured += 2;
    }

    this.logger.log(`Bootstrap sync finished ${JSON.stringify(summary)}`);
    return summary;
  }

  /**
   * Sincroniza un número: obtiene detalle remoto, hace upsert y asegura webhooks.
   * Kapso puede tardar en exponer el detalle; mientras tanto la fila queda en `pending_remote_sync`.
   *
   * @param phoneNumberId - Id externo Kapso/Meta.
   * @param explicitProjectId - Project id para elegir API key correcta (prioridad máxima).
   */
  async syncPhoneNumberById(phoneNumberId: string, explicitProjectId?: string | null) {
    this.logger.log(`Syncing phone number phoneNumberId=${phoneNumberId}`);
    const projectContext = await this.resolveProjectContext(phoneNumberId, explicitProjectId);

    try {
      const phoneNumberDetail = await this.kapsoPlatformApiService.getPhoneNumber(phoneNumberId, toKapsoApiOptions(projectContext));
      this.logPhoneNumberDetail(phoneNumberDetail);

      const storedPhoneNumber = await this.kapsoRepository.upsertPhoneNumber({
        phoneNumberId: phoneNumberDetail.phoneNumberId,
        phoneNumberName: phoneNumberDetail.name,
        displayPhoneNumber: phoneNumberDetail.displayPhoneNumber,
        verifiedName: phoneNumberDetail.verifiedName,
        businessAccountId: phoneNumberDetail.businessAccountId,
        status: phoneNumberDetail.status,
        qualityRating: phoneNumberDetail.qualityRating,
        throughputTier: phoneNumberDetail.throughputTier,
        connectionType: phoneNumberDetail.connectionType,
        rawPayload: phoneNumberDetail.raw,
        projectExternalId: phoneNumberDetail.projectId,
        projectName: phoneNumberDetail.projectName,
        projectPayload: phoneNumberDetail.projectPayload,
        kapsoCustomerId: phoneNumberDetail.customerId,
        customerName: phoneNumberDetail.customerName,
        customerExternalId: phoneNumberDetail.customerExternalId,
        customerPayload: phoneNumberDetail.customerPayload,
      });

      return this.finalizePhoneNumberSync(storedPhoneNumber.phoneNumberId, {
        projectId: storedPhoneNumber.projectExternalId ?? projectContext.projectId,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown sync error";

      if (!isKapsoPhoneNumberAvailabilityError(message)) {
        throw error;
      }

      return this.handlePendingRemoteSync(phoneNumberId, message, projectContext);
    }
  }

  /**
   * Reacciona a `whatsapp.phone_number.created`: sync inmediato del número nuevo.
   *
   * @param payload - Body del webhook de plataforma.
   */
  async handlePhoneNumberCreatedEvent(payload: JsonRecord) {
    const phoneNumberId = firstNonNullString(payload.phone_number_id, payload.phoneNumberId);

    if (!phoneNumberId) {
      this.logger.warn("Evento whatsapp.phone_number.created sin phone_number_id");
      return null;
    }

    this.logger.log(`Processing created event for phoneNumberId=${phoneNumberId}`);
    this.logger.verbose(`Created event payload: ${summarizePayload(payload)}`);
    return this.syncPhoneNumberById(phoneNumberId, this.extractProjectIdFromPayload(payload));
  }

  /**
   * Reacciona a `whatsapp.phone_number.deleted`: elimina la fila local del número.
   *
   * @param payload - Body del webhook de plataforma.
   */
  async handlePhoneNumberDeletedEvent(payload: JsonRecord) {
    const phoneNumberId = firstNonNullString(payload.phone_number_id, payload.phoneNumberId);

    if (!phoneNumberId) {
      this.logger.warn("Evento whatsapp.phone_number.deleted sin phone_number_id");
      return null;
    }

    this.logger.log(`Processing deleted event for phoneNumberId=${phoneNumberId}`);
    this.logger.verbose(`Deleted event payload: ${summarizePayload(payload)}`);
    return this.kapsoRepository.deletePhoneNumber(phoneNumberId);
  }

  /**
   * Worker BullMQ: reintenta números en `pending_remote_sync`.
   * El lock en memoria evita dos corridas superpuestas dentro de esta instancia.
   * La reserva persistida en repositorio protege efectos cuando existen varias instancias.
   *
   * @returns Resumen scanned/recovered/stillPending/failed.
   */
  async processPendingRemoteSyncs(): Promise<PendingRemoteSyncSummary> {
    if (this.pendingSyncWorkerRunning) {
      this.logger.verbose("Pending remote sync worker skipped because another run is already active");
      return { scanned: 0, recovered: 0, stillPending: 0, failed: 0 };
    }

    this.pendingSyncWorkerRunning = true;

    try {
      const batchSize = this.configService.get<number>("kapso.pendingSyncBatchSize") ?? DEFAULT_PENDING_SYNC_BATCH_SIZE;
      const pendingPhoneNumbers = await this.kapsoRepository.listPendingRemoteSyncPhoneNumbers(batchSize);

      if (pendingPhoneNumbers.length === 0) {
        return { scanned: 0, recovered: 0, stillPending: 0, failed: 0 };
      }

      this.logger.log(`Pending remote sync worker found ${pendingPhoneNumbers.length} phone number(s) to retry`);

      let recovered = 0;
      let stillPending = 0;
      let failed = 0;

      for (const phoneNumber of pendingPhoneNumbers) {
        try {
          const syncResult = await this.syncPhoneNumberById(phoneNumber.phoneNumberId, phoneNumber.projectExternalId ?? null);

          if (this.isPendingRemoteSync(syncResult)) {
            stillPending += 1;
            continue;
          }

          recovered += 1;
        } catch (error) {
          const message = error instanceof Error ? error.message : "Unknown pending sync error";

          if (isKapsoPhoneNumberAvailabilityError(message)) {
            await this.kapsoRepository.recordWebhookSyncResult(phoneNumber.phoneNumberId, "pending_remote_sync", message);
            stillPending += 1;
            continue;
          }

          await this.kapsoRepository.recordWebhookSyncResult(phoneNumber.phoneNumberId, "failed", message);
          failed += 1;
          this.logger.error(`Pending remote sync failed phoneNumberId=${phoneNumber.phoneNumberId} reason=${message}`);
        }
      }

      const summary: PendingRemoteSyncSummary = {
        scanned: pendingPhoneNumbers.length,
        recovered,
        stillPending,
        failed,
      };

      this.logger.log(`Pending remote sync worker finished ${JSON.stringify(summary)}`);
      return summary;
    } finally {
      this.pendingSyncWorkerRunning = false;
    }
  }

  /**
   * Determina el `projectId` para usar la API key correcta.
   * Prioridad:
   * 1. parametro explicito;
   * 2. fila local ya conocida;
   * 3. null para caer en la API key por defecto.
   */
  private async resolveProjectContext(phoneNumberId: string, explicitProjectId?: string | null): Promise<KapsoProjectContext> {
    if (explicitProjectId) {
      return { projectId: explicitProjectId };
    }

    const existing = await this.kapsoRepository.findPhoneNumberByExternalId(phoneNumberId);

    if (existing?.projectExternalId) {
      return { projectId: existing.projectExternalId };
    }

    return { projectId: null };
  }

  private extractProjectIdFromPayload(payload: JsonRecord): string | null {
    return firstNonNullString(payload.project_id, getNestedValue(payload, "project", "id"));
  }

  private async finalizePhoneNumberSync(phoneNumberId: string, projectContext: KapsoProjectContext) {
    const webhookSync = await this.ensurePerNumberWebhooks(phoneNumberId, projectContext);
    this.logRemoteWebhooksSnapshot(phoneNumberId, webhookSync, "sync");

    const { processingStatus, processingError } = this.resolveWebhookSyncStatus(webhookSync);
    const finalizedPhoneNumber = await this.kapsoRepository.recordWebhookSyncResult(
      phoneNumberId,
      processingStatus,
      processingError,
      webhookSync.webhooks.map((webhook) => webhook.raw),
    );

    this.logger.log(
      `Phone number persisted phoneNumberId=${phoneNumberId} webhooksDetected=${webhookSync.webhooks.length} warnings=${webhookSync.warnings.length}`,
    );
    this.logWebhookWarnings(phoneNumberId, webhookSync.warnings, "sync");

    return finalizedPhoneNumber ?? (await this.kapsoRepository.findPhoneNumberByExternalId(phoneNumberId));
  }

  /**
   * Maneja el escenario transitorio donde Kapso acepto el onboarding pero todavia
   * no devuelve el detalle del numero. Se persiste el estado pendiente y se sigue
   * intentando asegurar webhooks en paralelo.
   */
  private async handlePendingRemoteSync(phoneNumberId: string, availabilityMessage: string, projectContext: KapsoProjectContext) {
    this.logger.warn(`Phone number detail still unavailable for phoneNumberId=${phoneNumberId}. Ensuring webhooks with partial sync.`);

    const webhookSync = await this.ensurePerNumberWebhooks(phoneNumberId, projectContext);
    this.logRemoteWebhooksSnapshot(phoneNumberId, webhookSync, "pending sync");

    const syncError = [availabilityMessage, ...webhookSync.warnings].filter(Boolean).join(" | ");
    const pendingPhoneNumber = await this.kapsoRepository.recordWebhookSyncResult(
      phoneNumberId,
      "pending_remote_sync",
      syncError,
      webhookSync.webhooks.map((webhook) => webhook.raw),
    );

    this.logger.log(
      `Phone number left in pending_remote_sync phoneNumberId=${phoneNumberId} webhooksDetected=${webhookSync.webhooks.length} warnings=${webhookSync.warnings.length}`,
    );
    this.logWebhookWarnings(phoneNumberId, webhookSync.warnings, "pending sync");

    return pendingPhoneNumber ?? (await this.kapsoRepository.findPhoneNumberByExternalId(phoneNumberId));
  }

  private resolveWebhookSyncStatus(webhookSync: EnsurePerNumberWebhooksResult) {
    if (webhookSync.warnings.length === 0) {
      return { processingStatus: "processed", processingError: null };
    }

    return {
      processingStatus: "processed_with_warnings",
      processingError: webhookSync.warnings.join(" | "),
    };
  }

  private isPendingRemoteSync(
    syncResult:
      | {
          setupSyncStatus?: string | null;
          lastProcessingStatus?: string | null;
        }
      | null
      | undefined,
  ) {
    return syncResult?.setupSyncStatus === "pending_remote_sync" || syncResult?.lastProcessingStatus === "pending_remote_sync";
  }

  /**
   * Verifica webhooks Kapso y Meta por numero; crea los faltantes.
   * Los errores se acumulan como warnings para no bloquear el sync principal.
   */
  private async ensurePerNumberWebhooks(
    phoneNumberId: string,
    projectContext?: KapsoProjectContext,
  ): Promise<EnsurePerNumberWebhooksResult> {
    const apiOptions = toKapsoApiOptions(projectContext);
    const warnings: string[] = [];
    const existingWebhooks = await this.listRemoteWebhooksSafely(phoneNumberId, warnings, apiOptions);
    const ensuredWebhooks = [...existingWebhooks];

    if (!this.hasKapsoEventsWebhook(existingWebhooks)) {
      await this.createWebhookSafely(
        phoneNumberId,
        "kapso",
        () => this.kapsoPlatformApiService.createKapsoPhoneNumberWebhook(phoneNumberId, apiOptions),
        ensuredWebhooks,
        warnings,
      );
    }

    if (!existingWebhooks.some((webhook) => webhook.kind === "meta")) {
      await this.createWebhookSafely(
        phoneNumberId,
        "meta",
        () => this.kapsoPlatformApiService.createMetaPhoneNumberWebhook(phoneNumberId, apiOptions),
        ensuredWebhooks,
        warnings,
      );
    }

    return { webhooks: ensuredWebhooks, warnings };
  }

  /**
   * Intenta leer el snapshot remoto actual de webhooks.
   * Si falla, el sync continua y se intenta crear "a ciegas" lo necesario.
   */
  private async listRemoteWebhooksSafely(phoneNumberId: string, warnings: string[], apiOptions?: KapsoApiRequestOptions) {
    try {
      return await this.kapsoPlatformApiService.listPhoneNumberWebhooks(phoneNumberId, apiOptions);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown webhook listing error";
      warnings.push(`No se pudo listar webhooks remotos: ${message}`);
      this.logger.warn(
        `Unable to list remote webhooks for phoneNumberId=${phoneNumberId}. Continuing with blind create. reason=${message}`,
      );
      return [];
    }
  }

  private hasKapsoEventsWebhook(webhooks: EnsurePerNumberWebhooksResult["webhooks"]) {
    return webhooks.some(
      (webhook) =>
        webhook.kind === "kapso" &&
        webhook.events.length === KAPSO_DEFAULT_EVENTS.length &&
        webhook.events.every((eventName) => KAPSO_DEFAULT_EVENTS.includes(eventName as never)),
    );
  }

  /** Intenta crear un webhook puntual sin abortar el sync completo si falla. */
  private async createWebhookSafely(
    phoneNumberId: string,
    kind: "kapso" | "meta",
    createFn: () => Promise<EnsurePerNumberWebhooksResult["webhooks"][number]>,
    ensuredWebhooks: EnsurePerNumberWebhooksResult["webhooks"],
    warnings: string[],
  ) {
    this.logger.log(`${kind} webhook missing for phoneNumberId=${phoneNumberId}. Creating it now.`);

    try {
      const createdWebhook = await createFn();
      ensuredWebhooks.push(createdWebhook);
      this.logger.log(
        `${kind} webhook created phoneNumberId=${phoneNumberId} webhookId=${createdWebhook.webhookId || "n/a"} url=${createdWebhook.url || "n/a"}`,
      );
      this.logger.verbose(
        `${kind} webhook creation response phoneNumberId=${phoneNumberId} payload=${summarizePayload(createdWebhook.raw)}`,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : `Unknown ${kind} webhook creation error`;
      warnings.push(`No se pudo crear webhook ${kind === "kapso" ? "Kapso" : "Meta"}: ${message}`);
      this.logger.warn(`${kind} webhook creation failed phoneNumberId=${phoneNumberId} reason=${message}`);
    }
  }

  private logPhoneNumberDetail(phoneNumberDetail: KapsoPhoneNumberDetail) {
    this.logger.verbose(`Phone number detail: ${summarizePayload(phoneNumberDetail.raw)}`);
    this.logger.verbose(
      `Phone number detail normalized=${summarizePayload({
        phoneNumberId: phoneNumberDetail.phoneNumberId,
        phoneNumberName: phoneNumberDetail.name,
        displayPhoneNumber: phoneNumberDetail.displayPhoneNumber,
        verifiedName: phoneNumberDetail.verifiedName,
        businessAccountId: phoneNumberDetail.businessAccountId,
        status: phoneNumberDetail.status,
        qualityRating: phoneNumberDetail.qualityRating,
        throughputTier: phoneNumberDetail.throughputTier,
        connectionType: phoneNumberDetail.connectionType,
        projectId: phoneNumberDetail.projectId,
        projectName: phoneNumberDetail.projectName,
        customerId: phoneNumberDetail.customerId,
        customerName: phoneNumberDetail.customerName,
        customerExternalId: phoneNumberDetail.customerExternalId,
      })}`,
    );
  }

  private logRemoteWebhooksSnapshot(phoneNumberId: string, webhookSync: EnsurePerNumberWebhooksResult, context: string) {
    this.logger.verbose(
      `Kapso remote webhooks snapshot during ${context} phoneNumberId=${phoneNumberId} payload=${summarizePayload(
        webhookSync.webhooks.map((webhook) => webhook.raw),
      )}`,
    );
  }

  private logWebhookWarnings(phoneNumberId: string, warnings: string[], context: string) {
    if (warnings.length === 0) {
      return;
    }

    this.logger.warn(
      `Phone number ${context} completed with webhook warnings phoneNumberId=${phoneNumberId} warnings=${warnings.join(" | ")}`,
    );
  }
}
