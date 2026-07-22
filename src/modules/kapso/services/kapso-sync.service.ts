// ============================================================================
// IMPORTS
// ============================================================================

// Ciclo de vida de Nest y acceso a configuracion para el worker periodico.
import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

// Constantes, helpers y tipos de dominio usados por la orquestacion del sync.
import { KAPSO_DEFAULT_EVENTS } from "../common/kapso.constants";
import {
  asArray,
  asRecord,
  firstNonNullString,
  getNestedValue,
  isKapsoPhoneNumberAvailabilityError,
  pickString,
  summarizePayload,
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

// Dependencias principales del modulo para leer Kapso y persistir el estado local.
import { KapsoPlatformApiService } from "./kapso-platform-api.service";
import { KapsoRepository } from "../repositories/kapso.repository";
import {
  AdminKapsoIntegrationsRepository,
  FlowProjectMediaRecord,
  LeadFlowAnsweredYesContext,
} from "../repositories/admin-kapso-integrations.repository";

// ============================================================================
// CONSTANTES DEL WORKER
// ============================================================================

/** Intervalo por defecto del worker de reintentos (`kapso.pendingSyncIntervalMs`). */
const DEFAULT_PENDING_SYNC_INTERVAL_MS = 30_000;

/** Tamano de lote por defecto del worker (`kapso.pendingSyncBatchSize`). */
const DEFAULT_PENDING_SYNC_BATCH_SIZE = 10;

/** Intervalo por defecto del diagnostico de leads nuevos. */
const DEFAULT_LEAD_TEMPLATE_INTERVAL_MS = 60_000;

/** Tamano de lote por defecto del diagnostico de leads nuevos. */
const DEFAULT_LEAD_TEMPLATE_BATCH_SIZE = 100;

/** Flujo operativo actual definido para saludo inicial y seguimiento de leads. */
const LEAD_INITIAL_CONTACT_FLOW_UUID = "94d5c3b8-4b43-4c28-8c76-3d9eaf70ad01";

// ============================================================================
// TIPOS LOCALES
// ============================================================================

type InboundMessageCandidate = {
  phoneNumberId: string | null;
  leadPhoneNumber: string | null;
  messageId: string | null;
  timestamp: string | null;
  replyText: string | null;
  replySource: "button" | "interactive_button" | "text" | "unsupported";
  message: JsonRecord;
};

type InboundWebhookProcessingSummary = {
  processed: number;
  answeredNo: number;
  answeredYes: number;
  introSent: number;
  introFailed: number;
  ignored: number;
};

// ============================================================================
// SERVICIO DE ORQUESTACION
// ============================================================================

/**
 * Orquesta la sincronizacion entre Kapso Platform API y la base local.
 *
 * Responsabilidades:
 * - bootstrap y sincronizacion manual por numero;
 * - procesamiento de eventos `created` y `deleted`;
 * - worker periodico para filas `pending_remote_sync`;
 * - validacion y creacion defensiva de webhooks por numero.
 */
@Injectable()
export class KapsoSyncService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(KapsoSyncService.name);
  private pendingSyncTimer: NodeJS.Timeout | null = null;
  private pendingSyncWorkerRunning = false;
  private leadTemplateTimer: NodeJS.Timeout | null = null;
  private leadTemplateWorkerRunning = false;

  constructor(
    private readonly configService: ConfigService,
    private readonly kapsoPlatformApiService: KapsoPlatformApiService,
    private readonly kapsoRepository: KapsoRepository,
    private readonly adminKapsoIntegrationsRepository: AdminKapsoIntegrationsRepository,
  ) {}

  // --------------------------------------------------------------------------
  // CICLO DE VIDA DEL WORKER
  // --------------------------------------------------------------------------

  /** Arranca el worker que reintenta numeros pendientes de detalle remoto. */
  onModuleInit() {
    const intervalMs = this.configService.get<number>("kapso.pendingSyncIntervalMs") ?? DEFAULT_PENDING_SYNC_INTERVAL_MS;

    if (intervalMs <= 0) {
      this.logger.warn("Pending remote sync worker disabled because interval <= 0");
    } else {
      this.pendingSyncTimer = setInterval(() => {
        void this.processPendingRemoteSyncs();
      }, intervalMs);

      this.logger.log(`Pending remote sync worker started intervalMs=${intervalMs}`);
    }

    const leadTemplateIntervalMs = this.configService.get<number>("kapso.leadTemplateIntervalMs") ?? DEFAULT_LEAD_TEMPLATE_INTERVAL_MS;

    if (leadTemplateIntervalMs > 0) {
      this.leadTemplateTimer = setInterval(() => {
        void this.processLeadTemplateCandidates();
      }, leadTemplateIntervalMs);

      this.logger.log(`Lead template diagnostic worker started intervalMs=${leadTemplateIntervalMs}`);
    } else {
      this.logger.warn("Lead template diagnostic worker disabled because interval <= 0");
    }
  }

  /** Detiene el worker al apagar la app. */
  onModuleDestroy() {
    if (this.pendingSyncTimer) {
      clearInterval(this.pendingSyncTimer);
      this.pendingSyncTimer = null;
    }

    if (this.leadTemplateTimer) {
      clearInterval(this.leadTemplateTimer);
      this.leadTemplateTimer = null;
    }
  }

  // --------------------------------------------------------------------------
  // ENTRADAS PUBLICAS PRINCIPALES
  // --------------------------------------------------------------------------

  /**
   * Hidrata la vista local completa: opcionalmente asegura el webhook de proyecto
   * y luego sincroniza todos los numeros visibles para esa API key.
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
   * Obtiene detalle remoto, lo persiste localmente y asegura webhooks por numero.
   * Si Kapso aun no expone el detalle, deja la fila en `pending_remote_sync`.
   */
  async syncPhoneNumberById(phoneNumberId: string, explicitProjectId?: string | null) {
    this.logger.log(`Syncing phone number phoneNumberId=${phoneNumberId}`);
    const projectContext = await this.resolveProjectContext(phoneNumberId, explicitProjectId);

    try {
      const phoneNumberDetail = await this.kapsoPlatformApiService.getPhoneNumber(phoneNumberId, this.toApiOptions(projectContext));
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

  /** Handler de `whatsapp.phone_number.created` enviado por el webhook de plataforma. */
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

  /** Handler de `whatsapp.phone_number.deleted` enviado por el webhook de plataforma. */
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
   * Procesa respuestas entrantes de WhatsApp reenviadas por Kapso o Meta.
   * Por seguridad de negocio, solo botones o textos exactos equivalentes cambian el flujo.
   * Textos largos o ambiguos quedan fuera para evitar falsos avances o falsos perdidos.
   */
  async processInboundMessageWebhook(payload: JsonRecord): Promise<InboundWebhookProcessingSummary> {
    const messages = this.extractInboundMessageCandidates(payload);
    const summary: InboundWebhookProcessingSummary = {
      processed: messages.length,
      answeredNo: 0,
      answeredYes: 0,
      introSent: 0,
      introFailed: 0,
      ignored: 0,
    };

    for (const message of messages) {
      if (!message.phoneNumberId || !message.leadPhoneNumber) {
        summary.ignored += 1;
        continue;
      }

      if (this.isExplicitNoThanksReply(message)) {
        const updated = await this.adminKapsoIntegrationsRepository.markLeadFlowAnsweredNo({
          phoneNumberId: message.phoneNumberId,
          leadPhoneNumber: message.leadPhoneNumber,
          responsePayload: this.buildInboundResponsePayload(message),
        });

        if (updated) {
          summary.answeredNo += 1;
          this.logger.log(
            `Lead flow answered_no registered phoneNumberId=${message.phoneNumberId} leadPhoneNumber=${message.leadPhoneNumber}`,
          );
          continue;
        }

        summary.ignored += 1;
        this.logger.warn(
          `No active lead flow found for No response phoneNumberId=${message.phoneNumberId} leadPhoneNumber=${message.leadPhoneNumber}`,
        );
        continue;
      }

      if (this.isExplicitYesSendInformationReply(message)) {
        const executionContext = await this.adminKapsoIntegrationsRepository.markLeadFlowAnsweredYes({
          phoneNumberId: message.phoneNumberId,
          leadPhoneNumber: message.leadPhoneNumber,
          responsePayload: this.buildInboundResponsePayload(message),
        });

        if (executionContext) {
          summary.answeredYes += 1;
          const introWasSent = await this.sendIntroMessageForAcceptedLead(executionContext);

          if (introWasSent) {
            summary.introSent += 1;
          } else {
            summary.introFailed += 1;
          }

          this.logger.log(
            `Lead flow answered_yes registered phoneNumberId=${message.phoneNumberId} leadPhoneNumber=${message.leadPhoneNumber}`,
          );
          continue;
        }

        summary.ignored += 1;
        this.logger.warn(
          `No active lead flow found for Yes response phoneNumberId=${message.phoneNumberId} leadPhoneNumber=${message.leadPhoneNumber}`,
        );
        continue;
      }

      summary.ignored += 1;
    }

    if (summary.processed > 0) {
      this.logger.log(`Inbound message webhook processed ${JSON.stringify(summary)}`);
    }

    return summary;
  }

  // --------------------------------------------------------------------------
  // WORKER DE REINTENTOS
  // --------------------------------------------------------------------------

  /**
   * Recorre integraciones en `pending_remote_sync` y reintenta completar el sync.
   * Mantiene un lock en memoria para evitar dos corridas superpuestas.
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
   * Diagnostica leads nuevos y valida la asignacion Admin-Kapso sin enviar mensajes.
   * Los leads sin asesor o sin numero activo se descartan una sola vez mediante
   * la actualizacion condicional y la bitacora atomica del repositorio.
   */
  async processLeadTemplateCandidates() {
    const emptySummary = { scanned: 0, configured: 0, skipped: 0, failed: 0 };

    if (this.leadTemplateWorkerRunning) {
      this.logger.verbose("Lead template diagnostic worker skipped because another run is already active");
      return emptySummary;
    }

    this.leadTemplateWorkerRunning = true;

    try {
      const batchSize = this.configService.get<number>("kapso.leadTemplateBatchSize") ?? DEFAULT_LEAD_TEMPLATE_BATCH_SIZE;
      const candidates = await this.adminKapsoIntegrationsRepository.listLeadTemplateCandidates(batchSize);

      if (candidates.length === 0) {
        return emptySummary;
      }

      let configured = 0;
      let skipped = 0;
      let failed = 0;

      for (const candidate of candidates) {
        this.logger.verbose(`Lead template candidate payload=${summarizePayload(candidate)}`);

        const hasAdvisor = candidate.idEmpleadoLead !== null && String(candidate.idEmpleadoLead).trim() !== "";
        const hasKapsoAssignment = candidate.kapsoRelationId !== null && candidate.phoneNumberId !== null;

        if (hasAdvisor && hasKapsoAssignment) {
          configured += 1;
          this.logger.log(
            `Lead template candidate ready leadId=${candidate.leadId} internalLeadId=${candidate.internalLeadId} idEmpleadoLead=${candidate.idEmpleadoLead} phoneNumberId=${candidate.phoneNumberId}`,
          );
          continue;
        }

        if (candidate.internalLeadId === null) {
          failed += 1;
          this.logger.error(`Lead template candidate cannot be logged because internalLeadId is null leadId=${candidate.leadId}`);
          continue;
        }

        try {
          const skippedLead = await this.adminKapsoIntegrationsRepository.markLeadTemplateCandidateSkipped(
            candidate.leadId,
            candidate.internalLeadId,
            candidate.idEmpleadoLead ?? 0,
            Number(candidate.estado_lead ?? 1),
          );

          if (skippedLead) {
            skipped += 1;
            this.logger.warn(`Lead template candidate skipped leadId=${candidate.leadId} reason=advisor_without_active_kapso_assignment`);
          }
        } catch (error) {
          failed += 1;
          const message = error instanceof Error ? error.message : "Unknown lead template diagnostic error";
          this.logger.error(`Lead template candidate failed leadId=${candidate.leadId} reason=${message}`);
        }
      }

      const summary = { scanned: candidates.length, configured, skipped, failed };
      this.logger.log(`Lead template diagnostic worker finished ${JSON.stringify(summary)}`);
      return summary;
    } finally {
      this.leadTemplateWorkerRunning = false;
    }
  }

  // --------------------------------------------------------------------------
  // RESOLUCION DE CONTEXTO DE PROYECTO
  // --------------------------------------------------------------------------

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

  /** Convierte el contexto de proyecto al shape esperado por el API client. */
  private toApiOptions(projectContext?: KapsoProjectContext): KapsoApiRequestOptions | undefined {
    if (!projectContext?.projectId) {
      return undefined;
    }

    return { projectId: projectContext.projectId };
  }

  /** Extrae `project.id` del payload de plataforma para GETs project-scoped. */
  private extractProjectIdFromPayload(payload: JsonRecord): string | null {
    return firstNonNullString(payload.project_id, getNestedValue(payload, "project", "id"));
  }

  // --------------------------------------------------------------------------
  // RESPUESTAS ENTRANTES DE WHATSAPP
  // --------------------------------------------------------------------------

  /** Extrae mensajes tanto del shape Meta (`entry[].changes[].value`) como del shape directo de Kapso. */
  private extractInboundMessageCandidates(payload: JsonRecord): InboundMessageCandidate[] {
    const rootPhoneNumberId = this.extractPayloadPhoneNumberId(payload);
    const directMessages = this.mapInboundMessages(asArray<JsonRecord>(payload.messages), rootPhoneNumberId);
    const metaMessages = asArray<JsonRecord>(payload.entry).flatMap((entry) =>
      asArray<JsonRecord>(entry.changes).flatMap((change) => {
        const value = asRecord(change.value);
        const phoneNumberId = this.extractPayloadPhoneNumberId(value) ?? rootPhoneNumberId;
        return this.mapInboundMessages(asArray<JsonRecord>(value.messages), phoneNumberId);
      }),
    );

    return [...directMessages, ...metaMessages];
  }

  /** Convierte cada mensaje crudo a un candidato normalizado para reglas de negocio. */
  private mapInboundMessages(messages: JsonRecord[], phoneNumberId: string | null): InboundMessageCandidate[] {
    return messages.map((message) => {
      const reply = this.extractReplyText(message);

      return {
        phoneNumberId,
        leadPhoneNumber: firstNonNullString(message.from),
        messageId: firstNonNullString(message.id),
        timestamp: firstNonNullString(message.timestamp),
        replyText: reply.replyText,
        replySource: reply.replySource,
        message,
      };
    });
  }

  /** Obtiene el `phone_number_id` desde metadata o campos planos. */
  private extractPayloadPhoneNumberId(payload: JsonRecord): string | null {
    return firstNonNullString(payload.phone_number_id, payload.phoneNumberId, getNestedValue(payload, "metadata", "phone_number_id"));
  }

  /** Lee botones quick reply, interactive button_reply o texto exacto enviado por el cliente. */
  private extractReplyText(message: JsonRecord): Pick<InboundMessageCandidate, "replyText" | "replySource"> {
    if (pickString(message.type) === "button") {
      const button = asRecord(message.button);
      return {
        replyText: firstNonNullString(button.text, button.payload),
        replySource: "button",
      };
    }

    const interactive = asRecord(message.interactive);
    if (pickString(message.type) === "interactive" && pickString(interactive.type) === "button_reply") {
      const buttonReply = asRecord(interactive.button_reply);
      return {
        replyText: firstNonNullString(buttonReply.title, buttonReply.id),
        replySource: "interactive_button",
      };
    }

    if (pickString(message.type) === "text") {
      const text = asRecord(message.text);
      return {
        replyText: firstNonNullString(text.body),
        replySource: "text",
      };
    }

    return {
      replyText: null,
      replySource: "unsupported",
    };
  }

  /** Arma el snapshot de respuesta para auditoria y diagnostico del flujo. */
  private buildInboundResponsePayload(message: InboundMessageCandidate) {
    return {
      messageId: message.messageId,
      timestamp: message.timestamp,
      replyText: message.replyText,
      replySource: message.replySource,
      phoneNumberId: message.phoneNumberId,
      leadPhoneNumber: message.leadPhoneNumber,
      rawMessage: message.message,
    };
  }

  /** Regla terminal actual: solo `No, gracias` exacto detiene el flujo. */
  private isExplicitNoThanksReply(message: InboundMessageCandidate): boolean {
    if (message.replySource === "unsupported") {
      return false;
    }

    return this.normalizeReplyText(message.replyText) === "no gracias";
  }

  /** Regla de avance: solo `Si, enviar informacion` exacto habilita el siguiente paso. */
  private isExplicitYesSendInformationReply(message: InboundMessageCandidate): boolean {
    if (message.replySource === "unsupported") {
      return false;
    }

    return this.normalizeReplyText(message.replyText) === "si enviar informacion";
  }

  /** Normaliza acentos y puntuacion para comparar textos de botones aprobados. */
  private normalizeReplyText(value: string | null): string {
    return (value ?? "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^\p{L}\p{N}]+/gu, " ")
      .trim()
      .toLowerCase();
  }

  // --------------------------------------------------------------------------
  // INTRO NORMAL POST-ACEPTACION
  // --------------------------------------------------------------------------

  /**
   * Envia la intro como mensaje normal porque el cliente ya abrio ventana de 24h.
   * Los adjuntos son opcionales y dependen del proyecto permitido para el flujo.
   */
  private async sendIntroMessageForAcceptedLead(context: LeadFlowAnsweredYesContext): Promise<boolean> {
    if (!context.idProyectoNetsuite) {
      await this.markIntroFailed(context.executionId, "El flujo no tiene proyecto CRM asociado para resolver adjuntos.");
      return false;
    }

    try {
      const mediaItems = await this.adminKapsoIntegrationsRepository.listActiveFlowProjectMedia(
        LEAD_INITIAL_CONTACT_FLOW_UUID,
        context.idProyectoNetsuite,
        "intro",
      );
      const apiOptions = this.toApiOptions({ projectId: context.projectExternalId });

      for (const mediaItem of mediaItems) {
        await this.kapsoPlatformApiService.sendWhatsappMessage(
          context.phoneNumberId,
          this.buildIntroMediaPayload(context, mediaItem),
          apiOptions,
        );
      }

      await this.kapsoPlatformApiService.sendWhatsappMessage(
        context.phoneNumberId,
        this.buildIntroInteractivePayload(context, mediaItems),
        apiOptions,
      );
      await this.adminKapsoIntegrationsRepository.markLeadFlowIntroSent({
        executionId: context.executionId,
      });

      this.logger.log(
        `Intro message sent executionId=${context.executionId} phoneNumberId=${context.phoneNumberId} leadPhoneNumber=${context.leadPhoneNumber} mediaCount=${mediaItems.length}`,
      );
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown intro send error";
      await this.markIntroFailed(context.executionId, message);
      this.logger.error(`Intro message failed executionId=${context.executionId} reason=${message}`);
      return false;
    }
  }

  /** Payload de imagen/video/documento para el relay Meta de Kapso. */
  private buildIntroMediaPayload(context: LeadFlowAnsweredYesContext, media: FlowProjectMediaRecord): JsonRecord {
    const basePayload = {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: context.leadPhoneNumber,
      type: media.mediaType,
    };

    if (media.mediaType === "document") {
      return {
        ...basePayload,
        document: {
          link: media.publicUrl,
          filename: media.originalName,
        },
      };
    }

    return {
      ...basePayload,
      [media.mediaType]: {
        link: media.publicUrl,
      },
    };
  }

  /** Payload interactivo de intro: conserva el texto del PDF y agrega botones para reducir ambiguedad. */
  private buildIntroInteractivePayload(context: LeadFlowAnsweredYesContext, mediaItems: FlowProjectMediaRecord[]): JsonRecord {
    const leadName = context.leadName?.trim() || "cliente";
    const projectName = context.projectName?.trim() || "este proyecto";
    const introText =
      mediaItems.length > 0
        ? `Perfecto ${leadName}, te comparto un video introductorio de ${projectName} y algunas fotos.\n\n¿Podrias contarme un poco sobre lo que estas buscando?`
        : `Perfecto ${leadName}, te comparto informacion introductoria de ${projectName}.\n\n¿Podrias contarme un poco sobre lo que estas buscando?`;

    return {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: context.leadPhoneNumber,
      type: "interactive",
      interactive: {
        type: "button",
        body: {
          text: introText,
        },
        action: {
          buttons: [
            { type: "reply", reply: { id: "intro_ver_precios", title: "Ver precios" } },
            { type: "reply", reply: { id: "intro_agendar", title: "Agendar visita" } },
            { type: "reply", reply: { id: "intro_asesor", title: "Hablar con asesor" } },
          ],
        },
      },
    };
  }

  private async markIntroFailed(executionId: number, failureReason: string) {
    await this.adminKapsoIntegrationsRepository.markLeadFlowIntroFailed({
      executionId,
      failureReason,
    });
  }

  // --------------------------------------------------------------------------
  // FLUJOS DE SINCRONIZACION
  // --------------------------------------------------------------------------

  /**
   * Persiste el resultado final cuando el detalle remoto ya esta disponible.
   * Tambien guarda el snapshot remoto de webhooks para soporte y diagnostico.
   */
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

  /** Traduce warnings de webhooks a un estado persistible de la fila local. */
  private resolveWebhookSyncStatus(webhookSync: EnsurePerNumberWebhooksResult) {
    if (webhookSync.warnings.length === 0) {
      return { processingStatus: "processed", processingError: null };
    }

    return {
      processingStatus: "processed_with_warnings",
      processingError: webhookSync.warnings.join(" | "),
    };
  }

  /** Detecta si una operacion anterior devolvio un estado aun pendiente. */
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

  // --------------------------------------------------------------------------
  // VALIDACION Y CREACION DE WEBHOOKS
  // --------------------------------------------------------------------------

  /**
   * Verifica webhooks Kapso y Meta por numero; crea los faltantes.
   * Los errores se acumulan como warnings para no bloquear el sync principal.
   */
  private async ensurePerNumberWebhooks(
    phoneNumberId: string,
    projectContext?: KapsoProjectContext,
  ): Promise<EnsurePerNumberWebhooksResult> {
    const apiOptions = this.toApiOptions(projectContext);
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

  /** Valida si ya existe el webhook Kapso esperado con todos los eventos default. */
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
      ensuredWebhooks.push(await createFn());
    } catch (error) {
      const message = error instanceof Error ? error.message : `Unknown ${kind} webhook creation error`;
      warnings.push(`No se pudo crear webhook ${kind === "kapso" ? "Kapso" : "Meta"}: ${message}`);
      this.logger.warn(`${kind} webhook creation failed phoneNumberId=${phoneNumberId} reason=${message}`);
    }
  }

  // --------------------------------------------------------------------------
  // LOGGING DIAGNOSTICO
  // --------------------------------------------------------------------------

  /** Log rico del detalle remoto crudo y de su shape normalizado. */
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

  /** Guarda en logs la foto remota de webhooks detectada durante sync o reintento. */
  private logRemoteWebhooksSnapshot(phoneNumberId: string, webhookSync: EnsurePerNumberWebhooksResult, context: string) {
    this.logger.verbose(
      `Kapso remote webhooks snapshot during ${context} phoneNumberId=${phoneNumberId} payload=${summarizePayload(
        webhookSync.webhooks.map((webhook) => webhook.raw),
      )}`,
    );
  }

  /** Expone advertencias acumuladas sin bloquear el flujo principal. */
  private logWebhookWarnings(phoneNumberId: string, warnings: string[], context: string) {
    if (warnings.length === 0) {
      return;
    }

    this.logger.warn(
      `Phone number ${context} completed with webhook warnings phoneNumberId=${phoneNumberId} warnings=${warnings.join(" | ")}`,
    );
  }
}
