/**
 * =============================================================================
 * KapsoLeadAutomationService — Automatización de contacto inicial WhatsApp
 * =============================================================================
 *
 * Responsabilidad:
 * Orquesta el ciclo de vida del primer contacto a un lead por WhatsApp vía Kapso/Meta:
 *   1) Envío de plantilla inicial (fuera de ventana 24h, template aprobado por Meta).
 *   2) Procesamiento de webhooks entrantes (respuestas Sí/No, statuses delivered/failed).
 *   3) Tras un “Sí” explícito: envío de media intro + mensaje interactivo (ventana 24h abierta).
 *
 * Flujo de negocio (happy path):
 *   Lead candidato → reserva BD (idempotente) → envía template → webhook delivered
 *   → cliente pulsa “Sí, enviar información” → marca answered_yes → envía media (si hay)
 *   → espera delivered de media → envía interactive (botones Ver precios / Agendar / Asesor).
 *
 * Invariantes importantes:
 * - Idempotencia: reserva por `flow_uuid + idinterno_lead` antes de enviar plantillas.
 * - Lock en memoria (`leadTemplateWorkerRunning`): evita solapes en la misma instancia.
 * - Solo respuestas con intención clara (Sí/No) mutan el estado del flujo; texto ambiguo
 *   se bitacorea como unidentified sin avanzar ni cerrar el lead.
 * - Media se envía primero; el interactive queda pendiente hasta confirmación de entrega
 *   (o fallo terminal de todos los adjuntos), para no preguntar antes de que el cliente vea el material.
 *
 * Emisores de webhook soportados: shape directo Kapso y shape Cloud API Meta (`entry.changes`).
 */

import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
/** Parseo E.164; 8 dígitos se asumen Costa Rica (CR) por defecto de negocio. */
import { parsePhoneNumberFromString } from "libphonenumber-js";

import {
  asArray,
  asRecord,
  firstNonNullString,
  getNestedValue,
  pickString,
  summarizePayload,
  toKapsoApiOptions,
} from "../common/kapso.helpers";
import { JsonRecord } from "../common/kapso.types";
import { FlowProjectMediaRecord, KapsoFlowProjectMediaRepository } from "../repositories/kapso-flow-project-media.repository";
import {
  KapsoLeadAutomationRepository,
  LeadFlowAnsweredYesContext,
  LeadFlowIntroInteractiveContext,
} from "../repositories/kapso-lead-automation.repository";
import { KapsoMediaUrlSignerService } from "./kapso-media-url-signer.service";
import { KapsoPlatformApiService } from "./kapso-platform-api.service";

/** Tamaño de lote por defecto si `kapso.leadTemplateBatchSize` no está configurado. */
const DEFAULT_LEAD_TEMPLATE_BATCH_SIZE = 100;
const WHATSAPP_VIDEO_MAX_FILE_SIZE_BYTES = 16 * 1024 * 1024;
const DEFAULT_INTRO_MESSAGE_TEMPLATE =
  "Perfecto {{nombre_lead}}, te comparto un video introductorio de {{proyecto_lead}} y algunas fotos.\n\n" +
  "¿Podrias contarme un poco sobre lo que estas buscando?";
type IntroReplyOption = {
  id: string;
  label: string;
  messageTemplate: string;
};

const DEFAULT_INTRO_REPLY_OPTIONS: IntroReplyOption[] = [
  {
    id: "intro_ver_precios",
    label: "Ver precios",
    messageTemplate: "Claro {{nombre_lead}}, te comparto la informacion de precios de {{proyecto_lead}}.",
  },
  {
    id: "intro_agendar",
    label: "Agendar visita",
    messageTemplate: "Perfecto {{nombre_lead}}, coordinemos una visita para que conozcas {{proyecto_lead}}.",
  },
  {
    id: "intro_asesor",
    label: "Hablar con asesor",
    messageTemplate: "Con gusto {{nombre_lead}}, un asesor continuara la conversacion contigo.",
  },
];

/**
 * UUID del flujo de “primer contacto”. Filtra candidatos y media de etapa `intro`.
 * Debe coincidir con el registro de flujo en BD / Kapso.
 */
const LEAD_INITIAL_CONTACT_FLOW_UUID = "94d5c3b8-4b43-4c28-8c76-3d9eaf70ad01";

/**
 * Mensaje entrante normalizado (botón template, interactive o texto libre).
 * Se construye desde ambos shapes de webhook (Kapso directo / Meta).
 */
type InboundMessageCandidate = {
  /** WABA phone_number_id que recibió/envió; necesario para correlacionar el flujo en BD. */
  phoneNumberId: string | null;
  /** Teléfono del lead en dígitos E.164 sin `+` (Meta/Kapso). */
  leadPhoneNumber: string | null;
  /** wamid del mensaje entrante. */
  messageId: string | null;
  /** wamid del mensaje al que responde (útil para amarrar a la plantilla enviada). */
  contextMessageId: string | null;
  timestamp: string | null;
  /** Texto o payload del botón / body del texto, ya extraído. */
  replyText: string | null;
  /**
   * Origen del reply:
   * - button: respuesta a quick-reply de template
   * - interactive_button: button_reply de mensaje interactive
   * - text: texto libre
   * - unsupported: tipo no manejado (audio, sticker, etc.)
   */
  replySource: "button" | "interactive_button" | "text" | "unsupported";
  /** Payload crudo para bitácora / auditoría. */
  message: JsonRecord;
};

/** Status asíncrono `failed` de un mensaje saliente (plantilla o media intro). */
type WhatsappIntroMediaType = "image" | "video" | "audio" | "document";

type SendableIntroMediaItem = {
  mediaItem: FlowProjectMediaRecord;
  whatsappMediaType: WhatsappIntroMediaType;
};

type DeliveryFailureCandidate = {
  phoneNumberId: string | null;
  leadPhoneNumber: string | null;
  messageId: string | null;
  failureReason: string;
  payload: JsonRecord;
};

/** Status asíncrono `delivered` | `read` de un mensaje saliente. */
type DeliverySuccessCandidate = {
  phoneNumberId: string | null;
  leadPhoneNumber: string | null;
  messageId: string | null;
  deliveryStatus: "delivered" | "read";
  payload: JsonRecord;
};

/**
 * Body Cloud API para enviar la plantilla inicial.
 * Body params esperados por el template aprobado: nombre lead, asesor, proyecto.
 */
type InitialTemplatePayload = JsonRecord & {
  to: string;
  type: "template";
  template: {
    name: string;
    language: {
      code: string;
    };
    components: Array<{
      type: string;
      parameters: Array<{
        type: string;
        text: string;
      }>;
    }>;
  };
};

/**
 * Contadores del procesamiento de un webhook entrante.
 * Útil para telemetría y para el caller HTTP (ack con detalle).
 */
export type InboundWebhookProcessingSummary = {
  /** Total de candidatos (mensajes + failures + successes) vistos en el payload. */
  processed: number;
  answeredNo: number;
  answeredYes: number;
  /** Interactive intro enviado (inmediato o tras media ready). */
  introSent: number;
  /** Media enviada; interactive aún espera delivered/failed terminal. */
  introPending: number;
  introFailed: number;
  /** Plantilla inicial marcada como delivery failed. */
  deliveryFailed: number;
  /** Plantilla inicial confirmada delivered/read. */
  deliveryConfirmed: number;
  /** Texto/botón con flujo activo pero sin Sí/No explícito → bitácora asesor. */
  unidentifiedReplies: number;
  /** Sin contexto de teléfono, flujo inexistente, o reply no accionable. */
  ignored: number;
};

/** Resultado del envío de intro tras answered_yes. */
type IntroSendOutcome = "sent" | "pending" | "failed";

/**
 * Orquestador de contactos iniciales y avance de flujo según respuestas entrantes.
 *
 * Dependencias:
 * - ConfigService: batch size y flags Kapso
 * - KapsoPlatformApiService: envío WhatsApp (templates / media / interactive)
 * - KapsoLeadAutomationRepository: estado durable del flujo en MySQL
 * - KapsoFlowProjectMediaRepository: adjuntos activos por flujo+proyecto+etapa
 * - KapsoMediaUrlSignerService: URLs firmadas temporales para adjuntos
 */
@Injectable()
export class KapsoLeadAutomationService {
  private readonly logger = new Logger(KapsoLeadAutomationService.name);

  /**
   * Mutex en proceso: el worker de plantillas no debe correr en paralelo en la misma instancia.
   * Complementa (no reemplaza) la reserva durable en BD para multi-instancia.
   */
  private leadTemplateWorkerRunning = false;

  constructor(
    private readonly configService: ConfigService,
    private readonly kapsoPlatformApiService: KapsoPlatformApiService,
    private readonly leadAutomationRepository: KapsoLeadAutomationRepository,
    private readonly flowProjectMediaRepository: KapsoFlowProjectMediaRepository,
    private readonly mediaUrlSigner: KapsoMediaUrlSignerService,
  ) {}

  /**
   * Punto de entrada HTTP/webhook: procesa un payload Kapso o Meta.
   *
   * Orden de procesamiento (intencional):
   *   1) Fallos de entrega  → pueden marcar plantilla o media como failed y, si media
   *      llega a estado terminal “ready” (parcial), aún así disparan el interactive.
   *   2) Éxitos de entrega  → confirman plantilla o avanzan media hacia “ready” → interactive.
   *   3) Mensajes entrantes → Sí / No / unidentified / ignore.
   *
   * Seguridad de negocio: solo botones o textos con intención clara mutan el flujo.
   * Textos ambiguos generan bitácora para el asesor, pero no cambian el lead.
   *
   * @param payload - JSON crudo del webhook (no se asume un único shape).
   * @returns Resumen de contadores para el caller / logs.
   */
  async processInboundMessageWebhook(payload: JsonRecord): Promise<InboundWebhookProcessingSummary> {
    // Normaliza el payload heterogéneo a tres listas homogéneas de candidatos.
    const messages = this.extractInboundMessageCandidates(payload);
    const deliveryFailures = this.extractDeliveryFailureCandidates(payload);
    const deliverySuccesses = this.extractDeliverySuccessCandidates(payload);

    const summary: InboundWebhookProcessingSummary = {
      processed: messages.length + deliveryFailures.length + deliverySuccesses.length,
      answeredNo: 0,
      answeredYes: 0,
      introSent: 0,
      introPending: 0,
      introFailed: 0,
      deliveryFailed: 0,
      deliveryConfirmed: 0,
      unidentifiedReplies: 0,
      ignored: 0,
    };

    if (messages.length > 0) {
      this.logger.verbose(`Inbound message candidates extracted count=${messages.length}`);
    }

    if (deliveryFailures.length > 0) {
      this.logger.verbose(`Delivery failure candidates extracted count=${deliveryFailures.length}`);
    }

    if (deliverySuccesses.length > 0) {
      this.logger.verbose(`Delivery success candidates extracted count=${deliverySuccesses.length}`);
    }

    // -------------------------------------------------------------------------
    // FASE 1 — Delivery failures (plantilla inicial O media intro pendiente)
    // -------------------------------------------------------------------------
    for (const deliveryFailure of deliveryFailures) {
      this.logger.verbose(
        `Delivery failure candidate=${summarizePayload({
          phoneNumberId: deliveryFailure.phoneNumberId,
          leadPhoneNumber: deliveryFailure.leadPhoneNumber,
          messageId: deliveryFailure.messageId,
          failureReason: deliveryFailure.failureReason,
        })}`,
      );

      // Sin phone_number_id + teléfono no hay forma segura de correlacionar el execution.
      if (!deliveryFailure.phoneNumberId || !deliveryFailure.leadPhoneNumber) {
        summary.ignored += 1;
        this.logger.warn(
          `Delivery failure ignored reason=missing_phone_context phoneNumberId=${deliveryFailure.phoneNumberId ?? "n/a"} messageId=${
            deliveryFailure.messageId ?? "n/a"
          }`,
        );
        continue;
      }

      // Primero intenta asociar el fallo a la plantilla inicial pendiente de delivery.
      const updated = await this.leadAutomationRepository.markInitialTemplateDeliveryFailed({
        phoneNumberId: deliveryFailure.phoneNumberId,
        leadPhoneNumber: deliveryFailure.leadPhoneNumber,
        messageId: deliveryFailure.messageId,
        failureReason: deliveryFailure.failureReason,
        responsePayload: deliveryFailure.payload,
      });

      if (updated) {
        summary.deliveryFailed += 1;
        this.logger.warn(
          `Initial template delivery failed registered phoneNumberId=${deliveryFailure.phoneNumberId} messageId=${
            deliveryFailure.messageId ?? "n/a"
          } reason=${deliveryFailure.failureReason}`,
        );
        continue;
      }

      // Si no era plantilla, puede ser un adjunto de intro en estado pending.
      const introMediaFailed = await this.leadAutomationRepository.markLeadFlowIntroMediaFailed({
        phoneNumberId: deliveryFailure.phoneNumberId,
        leadPhoneNumber: deliveryFailure.leadPhoneNumber,
        messageId: deliveryFailure.messageId,
        failureReason: deliveryFailure.failureReason,
        responsePayload: deliveryFailure.payload,
      });

      // Aún quedan otros media por confirmar/fallar → no enviar interactive todavía.
      if (introMediaFailed?.state === "updated_pending") {
        summary.introPending += 1;
        this.logger.warn(
          `Intro media delivery failed pending_more_media phoneNumberId=${deliveryFailure.phoneNumberId} messageId=${
            deliveryFailure.messageId ?? "n/a"
          } reason=${deliveryFailure.failureReason}`,
        );
        continue;
      }

      // Al menos un media falló pero el conjunto llegó a terminal “ready” (hubo éxitos suficientes
      // o la política del repo decide avanzar): se envía el interactive igualmente.
      if (introMediaFailed?.state === "ready") {
        const introWasSent = await this.sendIntroInteractiveMessage(introMediaFailed.context);

        if (introWasSent) {
          summary.introSent += 1;
        } else {
          summary.introFailed += 1;
        }

        this.logger.warn(
          `Intro media partially failed but terminal; interactive intro processed phoneNumberId=${deliveryFailure.phoneNumberId} messageId=${
            deliveryFailure.messageId ?? "n/a"
          } reason=${deliveryFailure.failureReason}`,
        );
        continue;
      }

      // Todos los media fallaron → intro failed, no hay interactive.
      if (introMediaFailed?.state === "failed") {
        summary.introFailed += 1;
        this.logger.warn(
          `Intro media delivery failed all_media_failed phoneNumberId=${deliveryFailure.phoneNumberId} messageId=${
            deliveryFailure.messageId ?? "n/a"
          } reason=${deliveryFailure.failureReason}`,
        );
        continue;
      }

      // No hubo fila activa (ya terminal, otro flujo, o messageId no coincide).
      summary.ignored += 1;
      this.logger.verbose(
        `Delivery failure ignored reason=already_terminal_or_missing_flow phoneNumberId=${deliveryFailure.phoneNumberId} messageId=${
          deliveryFailure.messageId ?? "n/a"
        }`,
      );
    }

    // -------------------------------------------------------------------------
    // FASE 2 — Delivery successes (plantilla inicial O media intro pendiente)
    // -------------------------------------------------------------------------
    for (const deliverySuccess of deliverySuccesses) {
      this.logger.verbose(
        `Delivery success candidate=${summarizePayload({
          phoneNumberId: deliverySuccess.phoneNumberId,
          leadPhoneNumber: deliverySuccess.leadPhoneNumber,
          messageId: deliverySuccess.messageId,
          deliveryStatus: deliverySuccess.deliveryStatus,
        })}`,
      );

      if (!deliverySuccess.phoneNumberId || !deliverySuccess.leadPhoneNumber) {
        summary.ignored += 1;
        this.logger.warn(
          `Delivery success ignored reason=missing_phone_context phoneNumberId=${deliverySuccess.phoneNumberId ?? "n/a"} messageId=${
            deliverySuccess.messageId ?? "n/a"
          }`,
        );
        continue;
      }

      // Confirma entrega de la plantilla inicial (delivered/read).
      const updated = await this.leadAutomationRepository.markInitialTemplateDeliverySucceeded({
        phoneNumberId: deliverySuccess.phoneNumberId,
        leadPhoneNumber: deliverySuccess.leadPhoneNumber,
        messageId: deliverySuccess.messageId,
        deliveryStatus: deliverySuccess.deliveryStatus,
        responsePayload: deliverySuccess.payload,
      });

      if (updated) {
        summary.deliveryConfirmed += 1;
        this.logger.log(
          `Initial template delivery confirmed phoneNumberId=${deliverySuccess.phoneNumberId} messageId=${
            deliverySuccess.messageId ?? "n/a"
          } status=${deliverySuccess.deliveryStatus}`,
        );
        continue;
      }

      // Si no era plantilla, marca un media intro como delivered y evalúa si ya están todos.
      const introMediaDelivery = await this.leadAutomationRepository.markLeadFlowIntroMediaDelivered({
        phoneNumberId: deliverySuccess.phoneNumberId,
        leadPhoneNumber: deliverySuccess.leadPhoneNumber,
        messageId: deliverySuccess.messageId,
        deliveryStatus: deliverySuccess.deliveryStatus,
        responsePayload: deliverySuccess.payload,
      });

      if (introMediaDelivery?.state === "updated_pending") {
        summary.introPending += 1;
        this.logger.log(
          `Intro media delivery confirmed pending_more_media phoneNumberId=${deliverySuccess.phoneNumberId} messageId=${
            deliverySuccess.messageId ?? "n/a"
          } status=${deliverySuccess.deliveryStatus}`,
        );
        continue;
      }

      // Todos los media confirmados → dispara el mensaje interactive con CTAs.
      if (introMediaDelivery?.state === "ready") {
        const introWasSent = await this.sendIntroInteractiveMessage(introMediaDelivery.context);

        if (introWasSent) {
          summary.introSent += 1;
        } else {
          summary.introFailed += 1;
        }

        this.logger.log(
          `Intro media fully delivered; interactive intro processed phoneNumberId=${deliverySuccess.phoneNumberId} messageId=${
            deliverySuccess.messageId ?? "n/a"
          }`,
        );
        continue;
      }

      summary.ignored += 1;
      this.logger.verbose(
        `Delivery success ignored reason=already_confirmed_or_missing_flow phoneNumberId=${deliverySuccess.phoneNumberId} messageId=${
          deliverySuccess.messageId ?? "n/a"
        }`,
      );
    }

    // -------------------------------------------------------------------------
    // FASE 3 — Mensajes entrantes del lead (Sí / No / unidentified)
    // -------------------------------------------------------------------------
    for (const message of messages) {
      this.logger.verbose(
        `Inbound message candidate=${summarizePayload({
          phoneNumberId: message.phoneNumberId,
          leadPhoneNumber: message.leadPhoneNumber,
          messageId: message.messageId,
          timestamp: message.timestamp,
          replyText: message.replyText,
          replySource: message.replySource,
        })}`,
      );

      if (!message.phoneNumberId || !message.leadPhoneNumber) {
        summary.ignored += 1;
        this.logger.warn(
          `Inbound message ignored reason=missing_phone_context phoneNumberId=${message.phoneNumberId ?? "n/a"} messageId=${
            message.messageId ?? "n/a"
          }`,
        );
        continue;
      }

      // --- Rama NO: cierra el flujo sin enviar intro ---
      if (this.isExplicitNoThanksReply(message)) {
        const updated = await this.leadAutomationRepository.markLeadFlowAnsweredNo({
          phoneNumberId: message.phoneNumberId,
          leadPhoneNumber: message.leadPhoneNumber,
          contextMessageId: message.contextMessageId,
          responsePayload: this.buildInboundResponsePayload(message),
        });

        if (updated) {
          summary.answeredNo += 1;
          this.logger.log(
            `Lead flow answered_no registered phoneNumberId=${message.phoneNumberId} messageId=${message.messageId ?? "n/a"}`,
          );
          continue;
        }

        // Había un “No” claro pero no hay execution activa correlacionable.
        summary.ignored += 1;
        this.logger.warn(
          `No active lead flow found for No response phoneNumberId=${message.phoneNumberId} messageId=${message.messageId ?? "n/a"}`,
        );
        continue;
      }

      // --- Rama SÍ: abre ventana 24h y dispara intro (media + interactive) ---
      if (this.isExplicitYesSendInformationReply(message)) {
        const executionContext = await this.leadAutomationRepository.markLeadFlowAnsweredYes({
          phoneNumberId: message.phoneNumberId,
          leadPhoneNumber: message.leadPhoneNumber,
          contextMessageId: message.contextMessageId,
          responsePayload: this.buildInboundResponsePayload(message),
        });

        if (executionContext) {
          summary.answeredYes += 1;
          // Puede devolver sent (sin media o interactive ok), pending (media en tránsito) o failed.
          const introOutcome = await this.sendIntroMessageForAcceptedLead(executionContext);

          if (introOutcome === "sent") {
            summary.introSent += 1;
          } else if (introOutcome === "pending") {
            summary.introPending += 1;
          } else {
            summary.introFailed += 1;
          }

          this.logger.log(
            `Lead flow answered_yes registered phoneNumberId=${message.phoneNumberId} messageId=${message.messageId ?? "n/a"}`,
          );
          continue;
        }

        summary.ignored += 1;
        this.logger.warn(
          `No active lead flow found for Yes response phoneNumberId=${message.phoneNumberId} messageId=${message.messageId ?? "n/a"}`,
        );
        continue;
      }

      // --- Rama unidentified: hay texto/botón usable pero no es Sí/No exacto ---
      // Se bitacorea para que el asesor vea la respuesta; el estado del flujo NO avanza.
      const handledIntroOption = await this.processIntroOptionReply(message);

      if (handledIntroOption) {
        summary.introSent += 1;
        continue;
      }

      if (message.replySource !== "unsupported" && message.replyText) {
        const registered = await this.leadAutomationRepository.registerUnidentifiedInitialReply({
          phoneNumberId: message.phoneNumberId,
          leadPhoneNumber: message.leadPhoneNumber,
          contextMessageId: message.contextMessageId,
          replyText: message.replyText,
          responsePayload: this.buildInboundResponsePayload(message),
        });

        if (registered) {
          summary.unidentifiedReplies += 1;
          this.logger.log(
            `Lead flow unidentified reply registered phoneNumberId=${message.phoneNumberId} messageId=${
              message.messageId ?? "n/a"
            }`,
          );
          continue;
        }
      }

      // unsupported, sin texto, o sin flujo activo para unidentified.
      summary.ignored += 1;
      this.logger.verbose(
        `Inbound message ignored reason=unsupported_or_ambiguous_reply phoneNumberId=${message.phoneNumberId} messageId=${
          message.messageId ?? "n/a"
        } replySource=${message.replySource}`,
      );
    }

    if (summary.processed > 0) {
      this.logger.log(`Inbound message webhook processed ${JSON.stringify(summary)}`);
    }

    return summary;
  }

  /**
   * Worker periódico (scheduler / BullMQ / cron local): contacta leads candidatos.
   *
   * Pipeline por candidato:
   *   1) Validar asesor + asignación Kapso (phone_number_id).
   *   2) Validar template aprobado y flow UUID correcto.
   *   3) Normalizar teléfono; si inválido → marcar skipped (invalid_phone).
   *   4) Reservar execution en BD (idempotente). Si ya reservado → skip.
   *   5) Enviar template vía Kapso; marcar sent o failed según resultado.
   *   6) Si falta asesor/asignación → markLeadTemplateCandidateSkipped.
   *
   * @returns Resumen { scanned, configured, sent, skipped, failed }.
   */
  async processLeadTemplateCandidates() {
    const emptySummary = { scanned: 0, configured: 0, sent: 0, skipped: 0, failed: 0 };

    // Lock en memoria: reentradas del mismo proceso se abortan early.
    if (this.leadTemplateWorkerRunning) {
      this.logger.verbose("Lead template automation worker skipped because another run is already active");
      return emptySummary;
    }

    this.leadTemplateWorkerRunning = true;

    try {
      const batchSize = this.configService.get<number>("kapso.leadTemplateBatchSize") ?? DEFAULT_LEAD_TEMPLATE_BATCH_SIZE;
      // Solo leads elegibles para el flujo de primer contacto.
      const candidates = await this.leadAutomationRepository.listLeadTemplateCandidates(batchSize, LEAD_INITIAL_CONTACT_FLOW_UUID);

      if (candidates.length === 0) {
        return emptySummary;
      }

      let configured = 0; // Pasaron reserva y están listos / fueron enviados o fallaron en el send.
      let sent = 0;
      let skipped = 0;
      let failed = 0;

      for (const candidate of candidates) {
        this.logger.verbose(
          `Lead template candidate=${summarizePayload({
            leadId: candidate.leadId,
            internalLeadId: candidate.internalLeadId,
            idEmpleadoLead: candidate.idEmpleadoLead,
            idProyectoNetsuite: candidate.idProyectoNetsuite ?? candidate.idproyecto_lead,
            projectName: candidate.projectName ?? candidate.proyecto_lead,
            phoneNumberId: candidate.phoneNumberId,
            flowUuid: candidate.flowUuid,
            templateName: candidate.templateName,
            templateLanguage: candidate.templateLanguage,
            templateStatus: candidate.templateStatus,
            templateParameterCount: candidate.templateParameterCount,
          })}`,
        );

        // Gate de negocio: hace falta asesor asignado Y línea WhatsApp Kapso activa.
        const hasAdvisor = candidate.idEmpleadoLead !== null && String(candidate.idEmpleadoLead).trim() !== "";
        const hasKapsoAssignment = candidate.kapsoRelationId !== null && candidate.phoneNumberId !== null;

        // Sin internalLeadId no se puede persistir bitácora/reserva de forma confiable.
        if (candidate.internalLeadId === null) {
          failed += 1;
          this.logger.error(`Lead template candidate cannot be logged because internalLeadId is null leadId=${candidate.leadId}`);
          continue;
        }

        try {
          if (hasAdvisor && hasKapsoAssignment) {
            // Template debe existir, estar approved y pertenecer al flow UUID esperado.
            const templateReady = this.isInitialTemplateReady(candidate);

            if (!templateReady) {
              skipped += 1;
              this.logger.warn(`Lead template candidate skipped leadId=${candidate.leadId} reason=flow_project_or_template_not_ready`);
              continue;
            }

            const leadPhoneNumber = this.normalizeLeadPhoneNumber(candidate.leadPhoneNumberRaw ?? candidate.telefono_lead);

            if (!leadPhoneNumber) {
              // Persiste el skip para no reintentar infinitamente el mismo teléfono basura.
              const invalidPhoneMarked = await this.leadAutomationRepository.markLeadTemplateCandidateInvalidPhone({
                flowUuid: LEAD_INITIAL_CONTACT_FLOW_UUID,
                leadId: candidate.leadId,
                internalLeadId: candidate.internalLeadId,
                idnetsuiteAdmin: candidate.adminId ?? candidate.idEmpleadoLead ?? 0,
                idProyectoNetsuite: Number(candidate.idProyectoNetsuite ?? candidate.idproyecto_lead ?? 0) || null,
                phoneNumberId: candidate.phoneNumberId ?? "",
                leadPhoneNumber: String(candidate.leadPhoneNumberRaw ?? candidate.telefono_lead ?? "").trim() || "invalid",
                leadStatus: Number(candidate.estado_lead ?? 1),
              });

              if (invalidPhoneMarked) {
                skipped += 1;
              }

              this.logger.warn(`Lead template candidate skipped leadId=${candidate.leadId} reason=invalid_phone`);
              continue;
            }

            // Reserva atómica: si otro worker ya tomó el lead, reservation = null.
            const reservation = await this.leadAutomationRepository.reserveInitialTemplateSend({
              flowUuid: LEAD_INITIAL_CONTACT_FLOW_UUID,
              leadId: candidate.leadId,
              internalLeadId: candidate.internalLeadId,
              idnetsuiteAdmin: candidate.adminId ?? candidate.idEmpleadoLead ?? 0,
              idProyectoNetsuite: Number(candidate.idProyectoNetsuite ?? candidate.idproyecto_lead ?? 0) || null,
              phoneNumberId: candidate.phoneNumberId ?? "",
              leadPhoneNumber,
            });

            if (!reservation) {
              skipped += 1;
              this.logger.verbose(`Lead template candidate skipped leadId=${candidate.leadId} reason=already_reserved_or_not_current`);
              continue;
            }

            configured += 1;

            try {
              const initialTemplatePayload = this.buildInitialTemplatePayload(candidate, leadPhoneNumber);

              this.logger.log(
                `Initial template send started leadId=${candidate.leadId} internalLeadId=${candidate.internalLeadId} executionId=${reservation.executionId} phoneNumberId=${candidate.phoneNumberId} template=${candidate.templateName}`,
              );
              this.logger.verbose(
                `Initial template request=${summarizePayload({
                  to: initialTemplatePayload.to,
                  type: initialTemplatePayload.type,
                  templateName: initialTemplatePayload.template?.name,
                  templateLanguage: initialTemplatePayload.template?.language,
                  parameterCount: initialTemplatePayload.template?.components?.[0]?.parameters?.length ?? 0,
                })}`,
              );

              // projectId opcional: scope Kapso multi-proyecto si aplica.
              const responsePayload = await this.kapsoPlatformApiService.sendWhatsappMessage(
                candidate.phoneNumberId ?? "",
                initialTemplatePayload,
                toKapsoApiOptions({ projectId: candidate.projectExternalId }),
              );

              this.logger.verbose(
                `Initial template Kapso response leadId=${candidate.leadId} executionId=${reservation.executionId} payload=${summarizePayload(
                  responsePayload,
                )}`,
              );

              // wamid para correlacionar webhooks delivered/failed posteriores.
              const initialTemplateMessageId = this.extractOutboundMessageId(responsePayload);

              await this.leadAutomationRepository.markInitialTemplateSent({
                executionId: reservation.executionId,
                messageId: initialTemplateMessageId,
                responsePayload: this.toJsonRecord(responsePayload),
              });

              sent += 1;
              this.logger.log(
                `Initial template sent leadId=${candidate.leadId} internalLeadId=${candidate.internalLeadId} phoneNumberId=${candidate.phoneNumberId} messageId=${initialTemplateMessageId ?? "not_provided"}`,
              );
            } catch (error) {
              // Fallo de red/API: marca failed para reintento o revisión operativa.
              failed += 1;
              const message = error instanceof Error ? error.message : "Unknown initial template send error";
              await this.leadAutomationRepository.markInitialTemplateFailed({
                executionId: reservation.executionId,
                failureReason: message,
              });
              this.logger.error(`Initial template send failed leadId=${candidate.leadId} reason=${message}`);
            }

            continue;
          }

          // Asesor sin línea Kapso (o sin asesor): se marca skipped para no re-escanear en loop.
          const skippedLead = await this.leadAutomationRepository.markLeadTemplateCandidateSkipped(
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
          const message = error instanceof Error ? error.message : "Unknown lead template automation error";
          this.logger.error(`Lead template candidate failed leadId=${candidate.leadId} reason=${message}`);
        }
      }

      const summary = { scanned: candidates.length, configured, sent, skipped, failed };
      this.logger.log(`Lead template automation worker finished ${JSON.stringify(summary)}`);
      return summary;
    } finally {
      // Siempre libera el lock, incluso si el batch lanza.
      this.leadTemplateWorkerRunning = false;
    }
  }

  // ===========================================================================
  // Extractores de webhook — unifican shape Kapso directo y Cloud API Meta
  // ===========================================================================

  /**
   * Extrae mensajes entrantes admitiendo:
   * - Kapso directo: `payload.messages[]`
   * - Meta Cloud API: `payload.entry[].changes[].value.messages[]`
   */
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

  /**
   * Extrae fallos asíncronos de entrega (status=failed) de Kapso y Meta.
   */
  private extractDeliveryFailureCandidates(payload: JsonRecord): DeliveryFailureCandidate[] {
    const rootPhoneNumberId = this.extractPayloadPhoneNumberId(payload);
    const directFailures = this.mapKapsoDeliveryFailure(payload, rootPhoneNumberId);
    const metaFailures = asArray<JsonRecord>(payload.entry).flatMap((entry) =>
      asArray<JsonRecord>(entry.changes).flatMap((change) => {
        const value = asRecord(change.value);
        const phoneNumberId = this.extractPayloadPhoneNumberId(value) ?? rootPhoneNumberId;
        return this.mapDeliveryStatuses(asArray<JsonRecord>(value.statuses), phoneNumberId);
      }),
    );

    return [...directFailures, ...metaFailures];
  }

  /**
   * Extrae confirmaciones asíncronas (delivered/read) de Kapso y Meta.
   */
  private extractDeliverySuccessCandidates(payload: JsonRecord): DeliverySuccessCandidate[] {
    const rootPhoneNumberId = this.extractPayloadPhoneNumberId(payload);
    const directSuccesses = this.mapKapsoDeliverySuccess(payload, rootPhoneNumberId);
    const metaSuccesses = asArray<JsonRecord>(payload.entry).flatMap((entry) =>
      asArray<JsonRecord>(entry.changes).flatMap((change) => {
        const value = asRecord(change.value);
        const phoneNumberId = this.extractPayloadPhoneNumberId(value) ?? rootPhoneNumberId;
        return this.mapDeliverySuccessStatuses(asArray<JsonRecord>(value.statuses), phoneNumberId);
      }),
    );

    return [...directSuccesses, ...metaSuccesses];
  }

  /** Mapea cada mensaje crudo a InboundMessageCandidate (teléfono normalizado + reply). */
  private mapInboundMessages(messages: JsonRecord[], phoneNumberId: string | null): InboundMessageCandidate[] {
    return messages.map((message) => {
      const reply = this.extractReplyText(message);

      return {
        phoneNumberId,
        leadPhoneNumber: this.normalizeLeadPhoneNumber(message.from),
        contextMessageId: this.extractInboundContextMessageId(message),
        messageId: firstNonNullString(message.id),
        timestamp: firstNonNullString(message.timestamp),
        replyText: reply.replyText,
        replySource: reply.replySource,
        message,
      };
    });
  }

  /**
   * Shape Kapso: a veces el status viene en `payload.message.kapso`,
   * otras veces en `payload.statuses[]` plano. Ambos se soportan.
   */
  private mapKapsoDeliveryFailure(payload: JsonRecord, phoneNumberId: string | null): DeliveryFailureCandidate[] {
    const message = asRecord(payload.message);

    // Sin objeto message → cae al path de statuses estilo Meta.
    if (Object.keys(message).length === 0) {
      return this.mapDeliveryStatuses(asArray<JsonRecord>(payload.statuses), phoneNumberId);
    }

    const kapso = asRecord(message.kapso);
    const statuses = asArray<JsonRecord>(kapso.statuses);
    const failedStatus = statuses.find((status) => this.normalizeReplyText(firstNonNullString(status.status)) === "failed");
    const messageStatus = firstNonNullString(kapso.status, message.status);

    if (this.normalizeReplyText(messageStatus) !== "failed" && !failedStatus) {
      return [];
    }

    return [
      {
        phoneNumberId,
        leadPhoneNumber: this.normalizeLeadPhoneNumber(firstNonNullString(message.to, getNestedValue(payload, "conversation", "phone_number"))),
        messageId: firstNonNullString(message.id, failedStatus?.id),
        failureReason: this.extractDeliveryFailureReason(failedStatus ?? message),
        payload,
      },
    ];
  }

  /** Filtra statuses Meta con status === "failed". */
  private mapDeliveryStatuses(statuses: JsonRecord[], phoneNumberId: string | null): DeliveryFailureCandidate[] {
    return statuses
      .filter((status) => this.normalizeReplyText(firstNonNullString(status.status)) === "failed")
      .map((status) => ({
        phoneNumberId,
        leadPhoneNumber: this.normalizeLeadPhoneNumber(firstNonNullString(status.recipient_id, status.to)),
        messageId: firstNonNullString(status.id),
        failureReason: this.extractDeliveryFailureReason(status),
        payload: status,
      }));
  }

  /** Análogo a mapKapsoDeliveryFailure pero para delivered/read. */
  private mapKapsoDeliverySuccess(payload: JsonRecord, phoneNumberId: string | null): DeliverySuccessCandidate[] {
    const message = asRecord(payload.message);

    if (Object.keys(message).length === 0) {
      return this.mapDeliverySuccessStatuses(asArray<JsonRecord>(payload.statuses), phoneNumberId);
    }

    const kapso = asRecord(message.kapso);
    const statuses = asArray<JsonRecord>(kapso.statuses);
    const confirmedStatus = statuses.find((status) =>
      this.isConfirmedDeliveryStatus(this.normalizeReplyText(firstNonNullString(status.status))),
    );
    const messageStatus = this.normalizeReplyText(firstNonNullString(kapso.status, message.status));

    if (!this.isConfirmedDeliveryStatus(messageStatus) && !confirmedStatus) {
      return [];
    }

    return [
      {
        phoneNumberId,
        leadPhoneNumber: this.normalizeLeadPhoneNumber(firstNonNullString(message.to, getNestedValue(payload, "conversation", "phone_number"))),
        messageId: firstNonNullString(message.id, confirmedStatus?.id),
        deliveryStatus: confirmedStatus
          ? (this.normalizeReplyText(firstNonNullString(confirmedStatus.status)) as "delivered" | "read")
          : (messageStatus as "delivered" | "read"),
        payload,
      },
    ];
  }

  /** Filtra statuses Meta delivered/read. */
  private mapDeliverySuccessStatuses(statuses: JsonRecord[], phoneNumberId: string | null): DeliverySuccessCandidate[] {
    return statuses
      .filter((status) => this.isConfirmedDeliveryStatus(this.normalizeReplyText(firstNonNullString(status.status))))
      .map((status) => ({
        phoneNumberId,
        leadPhoneNumber: this.normalizeLeadPhoneNumber(firstNonNullString(status.recipient_id, status.to)),
        messageId: firstNonNullString(status.id),
        deliveryStatus: this.normalizeReplyText(firstNonNullString(status.status)) as "delivered" | "read",
        payload: status,
      }));
  }

  /** `sent` / `accepted` no cuentan: el negocio espera llegada al dispositivo (delivered) o lectura. */
  private isConfirmedDeliveryStatus(status: string | null): status is "delivered" | "read" {
    return status === "delivered" || status === "read";
  }

  /** Prioriza message / error_data.details / title; fallback genérico. */
  private extractDeliveryFailureReason(payload: JsonRecord): string {
    const firstError = asRecord(asArray<JsonRecord>(payload.errors)[0]);
    return (
      firstNonNullString(firstError.message, getNestedValue(firstError, "error_data", "details"), firstError.title) ??
      firstNonNullString(payload.status) ??
      "WhatsApp delivery failed"
    );
  }

  /** phone_number_id puede venir camelCase, snake_case o en metadata Meta. */
  private extractPayloadPhoneNumberId(payload: JsonRecord): string | null {
    return firstNonNullString(payload.phone_number_id, payload.phoneNumberId, getNestedValue(payload, "metadata", "phone_number_id"));
  }

  /**
   * Extrae el texto accionable según tipo de mensaje WhatsApp.
   * Prioridad: button (template) → interactive button_reply → text → unsupported.
   */
  private extractReplyText(message: JsonRecord): Pick<InboundMessageCandidate, "replyText" | "replySource"> {
    // Quick-reply de plantilla (type=button).
    if (pickString(message.type) === "button") {
      const button = asRecord(message.button);
      return {
        replyText: firstNonNullString(button.text, button.payload),
        replySource: "button",
      };
    }

    // Respuesta a mensaje interactive de tipo botón.
    const interactive = asRecord(message.interactive);
    if (pickString(message.type) === "interactive" && pickString(interactive.type) === "button_reply") {
      const buttonReply = asRecord(interactive.button_reply);
      return {
        replyText: firstNonNullString(buttonReply.title, buttonReply.id),
        replySource: "interactive_button",
      };
    }

    // Texto libre del usuario.
    if (pickString(message.type) === "text") {
      const text = asRecord(message.text);
      return {
        replyText: firstNonNullString(text.body),
        replySource: "text",
      };
    }

    // Imagen, audio, sticker, location, etc. → no accionables para este flujo.
    return {
      replyText: null,
      replySource: "unsupported",
    };
  }

  /**
   * wamid del mensaje al que responde el usuario (context Meta o context Kapso).
   * Sirve para correlacionar la respuesta con la plantilla enviada.
   */
  private extractInboundContextMessageId(message: JsonRecord): string | null {
    const context = asRecord(message.context);
    const kapso = asRecord(message.kapso);
    const kapsoContext = asRecord(kapso.context);

    return firstNonNullString(context.id, context.message_id, context.messageId, kapsoContext.id, kapsoContext.message_id, kapsoContext.messageId);
  }

  /** Snapshot serializable del inbound para bitácora en BD. */
  private buildInboundResponsePayload(message: InboundMessageCandidate) {
    return {
      messageId: message.messageId,
      contextMessageId: message.contextMessageId,
      timestamp: message.timestamp,
      replyText: message.replyText,
      replySource: message.replySource,
      phoneNumberId: message.phoneNumberId,
      leadPhoneNumber: message.leadPhoneNumber,
      rawMessage: message.message,
    };
  }

  // ===========================================================================
  // Reglas de intención (Sí / No) — conservadoras a propósito
  // ===========================================================================

  /**
   * Regla terminal de rechazo.
   * - Exacto: “No, gracias” (botón o texto, post-normalización).
   * - Solo en texto libre: frases claras de rechazo / número equivocado.
   * Botones que no sean “No, gracias” no se interpretan como No por similitud.
   */
  private isExplicitNoThanksReply(message: InboundMessageCandidate): boolean {
    if (message.replySource === "unsupported") {
      return false;
    }

    const normalizedText = this.normalizeReplyText(message.replyText);

    if (normalizedText === "no gracias") {
      return true;
    }

    // Frases amplias solo aplican a texto libre (evita falsos positivos en botones).
    if (message.replySource !== "text") {
      return false;
    }

    const clearNegativePhrases = [
      "no quiero",
      "no deseo",
      "no necesito",
      "no me interesa",
      "esta equivocado",
      "numero equivocado",
      "equivocado",
    ];

    return (
      normalizedText === "no" ||
      normalizedText === "hola no" ||
      clearNegativePhrases.some((phrase) => normalizedText.includes(phrase))
    );
  }

  /**
   * Regla de avance: SOLO el texto exacto normalizado “si enviar informacion”.
   * No se aceptan variantes (“ok”, “sí”, “dale”) para evitar envíos no solicitados.
   */
  private isExplicitYesSendInformationReply(message: InboundMessageCandidate): boolean {
    if (message.replySource === "unsupported") {
      return false;
    }

    return this.normalizeReplyText(message.replyText) === "si enviar informacion";
  }

  /**
   * Responde botones configurados del interactive de intro.
   * El payload puede llegar como id, label o texto de Kapso (`Selected: Ver precios`).
   */
  private async processIntroOptionReply(message: InboundMessageCandidate): Promise<boolean> {
    if (message.replySource === "unsupported" || !message.replyText || !message.phoneNumberId || !message.leadPhoneNumber) {
      return false;
    }

    const executionContext = await this.leadAutomationRepository.findLeadFlowIntroOptionContext({
      phoneNumberId: message.phoneNumberId,
      leadPhoneNumber: message.leadPhoneNumber,
      contextMessageId: message.contextMessageId,
    });

    if (!executionContext) {
      return false;
    }

    const introOptions = this.resolveIntroReplyOptions(executionContext);
    const selectedOption = this.findIntroReplyOption(executionContext, message.replyText, introOptions);

    if (!selectedOption) {
      return false;
    }

    const remainingOptions = introOptions.filter((option) => option.id !== selectedOption.id);
    const optionResponsePayload = this.buildIntroOptionResponsePayload(executionContext, selectedOption, remainingOptions);
    const optionResponse = await this.kapsoPlatformApiService.sendWhatsappMessage(
      executionContext.phoneNumberId,
      optionResponsePayload,
      toKapsoApiOptions({
        projectId: executionContext.projectExternalId,
      }),
    );
    const nextInteractiveMessageId = remainingOptions.length > 0 ? this.extractOutboundMessageId(optionResponse) : null;

    await this.leadAutomationRepository.markLeadFlowIntroOptionAnswered({
      phoneNumberId: message.phoneNumberId,
      leadPhoneNumber: message.leadPhoneNumber,
      contextMessageId: message.contextMessageId,
      optionId: selectedOption.id,
      optionLabel: selectedOption.label,
      keepInteractiveReady: remainingOptions.length > 0,
      nextInteractiveMessageId,
      responsePayload: {
        ...this.buildInboundResponsePayload(message),
        optionResponse,
        remainingOptions: remainingOptions.map((option) => ({
          id: option.id,
          label: option.label,
        })),
      },
    });

    this.logger.log(
      `Lead flow intro option answered phoneNumberId=${message.phoneNumberId} messageId=${message.messageId ?? "n/a"} option=${
        selectedOption.id
      }`,
    );

    return true;
  }

  private findIntroReplyOption(
    context: LeadFlowAnsweredYesContext,
    replyText: string,
    introOptions = this.resolveIntroReplyOptions(context),
  ): IntroReplyOption | null {
    const normalizedReply = this.normalizeIntroOptionReplyText(replyText);

    return (
      introOptions.find((option) => {
        return this.normalizeReplyText(option.id) === normalizedReply || this.normalizeReplyText(option.label) === normalizedReply;
      }) ?? null
    );
  }

  private normalizeIntroOptionReplyText(value: string | null): string {
    return this.normalizeReplyText(value).replace(/^selected\s+/, "");
  }

  /**
   * Normaliza para matching: NFD + quita diacríticos, colapsa no-alfanuméricos a espacio, lower.
   * Así “Sí, enviar información” ≡ “si enviar informacion”.
   */
  private normalizeReplyText(value: string | null): string {
    return (value ?? "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^\p{L}\p{N}]+/gu, " ")
      .trim()
      .toLowerCase();
  }

  /** Template listo: flow UUID correcto + name + language + status approved. */
  private isInitialTemplateReady(candidate: JsonRecord): boolean {
    return (
      firstNonNullString(candidate.flowUuid) === LEAD_INITIAL_CONTACT_FLOW_UUID &&
      Boolean(firstNonNullString(candidate.templateName)) &&
      Boolean(firstNonNullString(candidate.templateLanguage)) &&
      this.normalizeReplyText(firstNonNullString(candidate.templateStatus)) === "approved"
    );
  }

  /**
   * Normaliza teléfonos a E.164 sin `+` (formato Meta/Kapso).
   * - 8 dígitos → asume CR (parse con country CR o fallback `506` + dígitos).
   * - Rechaza secuencias repetidas (11111111) como inválidas.
   * - 10–15 dígitos válidos se aceptan tal cual.
   */
  private normalizeLeadPhoneNumber(value: unknown): string | null {
    const rawValue = String(value ?? "").trim();
    const digits = rawValue.replace(/\D/g, "");

    if (!digits) {
      return null;
    }

    const parsedPhoneNumber =
      digits.length === 8
        ? parsePhoneNumberFromString(digits, "CR")
        : parsePhoneNumberFromString(rawValue.startsWith("+") ? rawValue : `+${digits}`);

    if (parsedPhoneNumber?.isValid()) {
      return parsedPhoneNumber.number.replace("+", "");
    }

    // Fallback CR si libphonenumber no valida pero son 8 dígitos no triviales.
    if (digits.length === 8 && !/^(\d)\1{7}$/.test(digits)) {
      return `506${digits}`;
    }

    if (digits.length >= 10 && digits.length <= 15 && !/^(\d)\1+$/.test(digits)) {
      return digits;
    }

    return null;
  }

  /**
   * Arma el body Cloud API de la plantilla inicial.
   * Parámetros body[0..2]: nombre lead, nombre asesor, nombre proyecto (con fallbacks).
   */
  private buildInitialTemplatePayload(candidate: JsonRecord, leadPhoneNumber: string): InitialTemplatePayload {
    return {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: leadPhoneNumber,
      type: "template",
      template: {
        name: firstNonNullString(candidate.templateName) ?? "saludo",
        language: {
          code: firstNonNullString(candidate.templateLanguage) ?? "es_ES",
        },
        components: [
          {
            type: "body",
            parameters: [
              { type: "text", text: this.resolveTemplateParameter(candidate.nombre_lead, "cliente") },
              { type: "text", text: this.resolveTemplateParameter(candidate.adminName, "asesor") },
              { type: "text", text: this.resolveTemplateParameter(candidate.projectName ?? candidate.proyecto_lead, "el proyecto") },
            ],
          },
        ],
      },
    };
  }

  /** Evita parámetros vacíos que Meta rechazaría en el template. */
  private resolveTemplateParameter(value: unknown, fallback: string): string {
    const text = String(value ?? "").trim();
    return text || fallback;
  }

  /** Garantiza JsonRecord para persistir respuestas API (envuelve primitivos). */
  private toJsonRecord(value: unknown): JsonRecord {
    if (value && typeof value === "object" && !Array.isArray(value)) {
      return value as JsonRecord;
    }

    return { value };
  }

  /**
   * Extrae wamid del response de envío; prueba varias rutas según shape Kapso/Meta.
   */
  private extractOutboundMessageId(responsePayload: unknown): string | null {
    const payload = this.toJsonRecord(responsePayload);
    const messages = asArray(payload.messages);
    const firstMessage = asRecord(messages[0]);

    return firstNonNullString(
      firstMessage.id,
      getNestedValue(payload, "message", "id"),
      payload.whatsapp_message_id,
      payload.messageId,
      payload.id,
    );
  }

  // ===========================================================================
  // Intro post-Sí — mensajes normales (ventana 24h ya abierta por la respuesta)
  // ===========================================================================

  /**
   * Tras answered_yes: envía media intro (si hay) y deja el interactive pendiente
   * hasta confirmación de entrega vía webhook. Sin media → envía interactive al instante.
   *
   * @returns "sent" | "pending" | "failed"
   */
  private async sendIntroMessageForAcceptedLead(context: LeadFlowAnsweredYesContext): Promise<IntroSendOutcome> {
    // Sin proyecto no se pueden resolver adjuntos ni armar copy de intro confiable.
    if (!context.idProyectoNetsuite) {
      await this.markIntroFailed(context.executionId, "El flujo no tiene proyecto CRM asociado para resolver adjuntos.");
      return "failed";
    }

    try {
      // Media activos etapa "intro" para este flow + proyecto NetSuite.
      const mediaItems = await this.flowProjectMediaRepository.listActiveFlowProjectMedia(
        LEAD_INITIAL_CONTACT_FLOW_UUID,
        context.idProyectoNetsuite,
        "intro",
      );
      const sendableMediaItems = mediaItems
        .map((mediaItem): SendableIntroMediaItem | null => {
          const whatsappMediaType = this.resolveIntroWhatsappMediaType(mediaItem);
          const skipReason = this.getIntroMediaSkipReason(mediaItem, whatsappMediaType);

          if (skipReason) {
            this.logger.warn(
              `Intro media skipped reason=${skipReason} internalLeadId=${context.internalLeadId} executionId=${context.executionId} mediaId=${mediaItem.id} mediaType=${mediaItem.mediaType} mimeType=${mediaItem.mimeType} size=${mediaItem.fileSize} max=${WHATSAPP_VIDEO_MAX_FILE_SIZE_BYTES}`,
            );
            return null;
          }

          return { mediaItem, whatsappMediaType };
        })
        .filter((mediaItem): mediaItem is SendableIntroMediaItem => mediaItem !== null);
      const apiOptions = toKapsoApiOptions({ projectId: context.projectExternalId });

      this.logger.log(
        `Intro send started executionId=${context.executionId} phoneNumberId=${context.phoneNumberId} project=${context.projectName} mediaCount=${sendableMediaItems.length} skippedMedia=${mediaItems.length - sendableMediaItems.length}`,
      );
      this.logger.verbose(
        `Intro media items=${summarizePayload(
          sendableMediaItems.map(({ mediaItem, whatsappMediaType }) => ({
            ...mediaItem,
            whatsappMediaType,
          })),
        )}`,
      );

      // Sin adjuntos: no hay que esperar webhooks de media → interactive inmediato.
      if (sendableMediaItems.length === 0) {
        return (await this.sendIntroInteractiveMessage(context)) ? "sent" : "failed";
      }

      const mediaMessages: JsonRecord[] = [];
      // Se pre-arma el interactive y se guarda en pendingPayload para enviarlo luego
      // cuando los webhooks confirmen entrega (sin reconsultar copy/contexto).
      const interactivePayload = this.buildIntroInteractivePayload(
        context,
        sendableMediaItems.map(({ mediaItem }) => mediaItem),
      );

      for (const { mediaItem, whatsappMediaType } of sendableMediaItems) {
        const mediaPayload = this.buildIntroMediaPayload(context, mediaItem, whatsappMediaType);

        this.logger.verbose(
          `Intro media payload executionId=${context.executionId} mediaId=${mediaItem.id} type=${whatsappMediaType} payload=${summarizePayload(
            mediaPayload,
          )}`,
        );

        try {
          const mediaResponse = await this.kapsoPlatformApiService.sendWhatsappMessage(context.phoneNumberId, mediaPayload, apiOptions);
          const mediaMessageId = this.extractOutboundMessageId(mediaResponse);

          // Sin wamid no podríamos correlacionar delivered/failed posteriores.
          if (!mediaMessageId) {
            this.logger.warn(
              `Intro media skipped reason=missing_message_id internalLeadId=${context.internalLeadId} executionId=${context.executionId} mediaId=${mediaItem.id} type=${whatsappMediaType}`,
            );
            continue;
          }

          mediaMessages.push({
            mediaId: mediaItem.id,
            mediaType: whatsappMediaType,
            storedFilename: mediaItem.storedFilename,
            originalName: mediaItem.originalName,
            messageId: mediaMessageId,
            status: "accepted", // accepted por API; delivered llega por webhook
          });

          this.logger.verbose(
            `Intro media Kapso response executionId=${context.executionId} mediaId=${mediaItem.id} payload=${summarizePayload(mediaResponse)}`,
          );
        } catch (error) {
          const message = error instanceof Error ? error.message : "Unknown intro media send error";
          this.logger.warn(
            `Intro media send failed executionId=${context.executionId} mediaId=${mediaItem.id} type=${whatsappMediaType} reason=${message}`,
          );
        }
      }

      if (mediaMessages.length === 0) {
        this.logger.warn(
          `Intro media produced no accepted messages executionId=${context.executionId}; sending interactive message without media confirmation`,
        );
        return (await this.sendIntroInteractiveMessage(context)) ? "sent" : "failed";
      }

      // Persiste estado pending: el webhook de statuses completará o fallará la intro.
      await this.leadAutomationRepository.markLeadFlowIntroMediaPending({
        executionId: context.executionId,
        pendingPayload: {
          stage: "intro_media_pending",
          mediaMessages,
          interactivePayload,
        },
      });

      this.logger.log(
        `Intro media sent; interactive message pending delivery confirmation executionId=${context.executionId} mediaCount=${mediaMessages.length}`,
      );
      return "pending";
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown intro send error";
      await this.markIntroFailed(context.executionId, message);
      this.logger.error(`Intro message failed executionId=${context.executionId} reason=${message}`);
      return "failed";
    }
  }

  /**
   * Envía el mensaje interactive con CTAs (Ver precios / Agendar / Hablar con asesor)
   * y marca intro_sent en BD.
   *
   * Acepta contexto fresco (answered_yes sin media) o contexto rehidratado desde
   * pendingPayload cuando los webhooks de media llegan a estado "ready".
   */
  private async sendIntroInteractiveMessage(context: LeadFlowAnsweredYesContext | LeadFlowIntroInteractiveContext): Promise<boolean> {
    const apiOptions = toKapsoApiOptions({ projectId: context.projectExternalId });
    // Si viene del pending, reutiliza el payload ya armado; si no, lo construye ahora.
    const interactivePayload =
      "interactivePayload" in context ? this.toJsonRecord(context.interactivePayload) : this.buildIntroInteractivePayload(context, []);

    try {
      this.logger.verbose(`Intro interactive payload executionId=${context.executionId} payload=${summarizePayload(interactivePayload)}`);

      const interactiveResponse = await this.kapsoPlatformApiService.sendWhatsappMessage(
        context.phoneNumberId,
        interactivePayload,
        apiOptions,
      );

      this.logger.verbose(
        `Intro interactive Kapso response executionId=${context.executionId} payload=${summarizePayload(interactiveResponse)}`,
      );

      const introInteractiveMessageId = this.extractOutboundMessageId(interactiveResponse);

      await this.leadAutomationRepository.markLeadFlowIntroSent({
        executionId: context.executionId,
        messageId: introInteractiveMessageId,
      });

      this.logger.log(
        `Intro interactive message sent executionId=${context.executionId} phoneNumberId=${context.phoneNumberId} messageId=${introInteractiveMessageId ?? "not_provided"}`,
      );
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown intro send error";
      await this.markIntroFailed(context.executionId, message);
      this.logger.error(`Intro message failed executionId=${context.executionId} reason=${message}`);
      return false;
    }
  }

  /**
   * Body Cloud API para un adjunto intro.
   * Usa URL firmada (TTL) apuntando al archivo almacenado; document incluye filename.
   */
  private resolveIntroWhatsappMediaType(media: FlowProjectMediaRecord): WhatsappIntroMediaType {
    const mimeType = String(media.mimeType ?? "").toLowerCase();

    if (mimeType.startsWith("video/")) {
      return "video";
    }

    if (mimeType.startsWith("image/")) {
      return "image";
    }

    if (mimeType.startsWith("audio/")) {
      return "audio";
    }

    return media.mediaType;
  }

  private getIntroMediaSkipReason(media: FlowProjectMediaRecord, whatsappMediaType: WhatsappIntroMediaType): string | null {
    const fileSize = Number(media.fileSize ?? 0);

    if (whatsappMediaType !== "video") {
      return null;
    }

    if (!Number.isFinite(fileSize) || fileSize <= 0) {
      return "video_size_missing_or_empty";
    }

    if (fileSize > WHATSAPP_VIDEO_MAX_FILE_SIZE_BYTES) {
      return "video_size_too_large";
    }

    return null;
  }

  private buildIntroMediaPayload(
    context: LeadFlowAnsweredYesContext,
    media: FlowProjectMediaRecord,
    whatsappMediaType: WhatsappIntroMediaType,
  ): JsonRecord {
    const signedMediaUrl = this.mediaUrlSigner.createSignedUrl(media.storedFilename);
    const basePayload = {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: context.leadPhoneNumber,
      type: whatsappMediaType,
    };

    if (whatsappMediaType === "document") {
      return {
        ...basePayload,
        document: {
          link: signedMediaUrl,
          filename: media.originalName,
        },
      };
    }

    // image/video/audio: clave dinámica = mediaType con { link }.
    return {
      ...basePayload,
      [whatsappMediaType]: {
        link: signedMediaUrl,
      },
    };
  }

  /**
   * Interactive final de intro configurado por proyecto.
   * Los ids internos quedan estables para no romper los handlers posteriores.
   */
  private buildIntroInteractivePayload(context: LeadFlowAnsweredYesContext, mediaItems: FlowProjectMediaRecord[]): JsonRecord {
    void mediaItems;
    const buttons = this.resolveIntroReplyOptions(context).map((option) => ({
      type: "reply",
      reply: {
        id: option.id,
        title: option.label,
      },
    }));

    return {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: context.leadPhoneNumber,
      type: "interactive",
      interactive: {
        type: "button",
        body: {
          text: this.renderIntroMessageTemplate(context),
        },
        action: {
          buttons,
        },
      },
    };
  }

  private buildIntroOptionResponsePayload(
    context: LeadFlowAnsweredYesContext,
    selectedOption: IntroReplyOption,
    remainingOptions: IntroReplyOption[],
  ): JsonRecord {
    const body = this.renderIntroMessageTemplate(context, selectedOption.messageTemplate);

    if (remainingOptions.length === 0) {
      return {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: context.leadPhoneNumber,
        type: "text",
        text: {
          body,
        },
      };
    }

    return {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: context.leadPhoneNumber,
      type: "interactive",
      interactive: {
        type: "button",
        body: {
          text: body,
        },
        action: {
          buttons: remainingOptions.map((option) => ({
            type: "reply",
            reply: {
              id: option.id,
              title: option.label,
            },
          })),
        },
      },
    };
  }

  private renderIntroMessageTemplate(context: LeadFlowAnsweredYesContext, templateOverride?: string) {
    const template = templateOverride?.trim() || context.introMessageTemplate?.trim() || DEFAULT_INTRO_MESSAGE_TEMPLATE;
    const values = {
      nombre_asesor: context.adminName?.trim() || "asesor",
      nombre_lead: context.leadName?.trim() || "cliente",
      proyecto_lead: context.projectName?.trim() || "este proyecto",
    };

    return template
      .replace(/\{\{\s*(?:nombre_lead|leadName|1)\s*\}\}/gi, values.nombre_lead)
      .replace(/\{\{\s*(?:nombre_asesor|adminName|2)\s*\}\}/gi, values.nombre_asesor)
      .replace(/\{\{\s*(?:proyecto_lead|projectName|3)\s*\}\}/gi, values.proyecto_lead);
  }

  private resolveIntroReplyOptions(context: LeadFlowAnsweredYesContext): IntroReplyOption[] {
    let configuredOptions: Array<{ id?: unknown; label?: unknown; messageTemplate?: unknown }> = [];
    let hasExplicitConfiguredOptions = false;

    if (context.introOptionsJson?.trim()) {
      try {
        const parsedOptions = JSON.parse(context.introOptionsJson);
        hasExplicitConfiguredOptions = Array.isArray(parsedOptions);
        configuredOptions = hasExplicitConfiguredOptions ? parsedOptions : [];
      } catch {
        this.logger.warn(`Intro options invalid JSON executionId=${context.executionId}; using defaults`);
      }
    }

    const resolvedConfiguredOptions = configuredOptions
      .map((configuredOption, index) => {
        const defaultOption = DEFAULT_INTRO_REPLY_OPTIONS[index] ?? DEFAULT_INTRO_REPLY_OPTIONS[0];
        const configuredId = typeof configuredOption.id === "string" ? configuredOption.id.trim() : "";
        const configuredLabel = typeof configuredOption.label === "string" ? configuredOption.label.trim() : "";
        const configuredMessageTemplate =
          typeof configuredOption.messageTemplate === "string" ? configuredOption.messageTemplate.trim() : "";

        return {
          id: configuredId || `intro_option_${index + 1}`,
          label: (configuredLabel || defaultOption.label).slice(0, 20),
          messageTemplate: configuredMessageTemplate || defaultOption.messageTemplate,
        };
      })
      .filter((option) => option.label)
      .slice(0, 3);

    if (resolvedConfiguredOptions.length > 0) {
      return resolvedConfiguredOptions;
    }

    if (hasExplicitConfiguredOptions) {
      return [];
    }

    return DEFAULT_INTRO_REPLY_OPTIONS.map((defaultOption, index) => {
      const configuredOption = configuredOptions.find((option) => option.id === defaultOption.id) ?? configuredOptions[index];
      const configuredLabel = typeof configuredOption?.label === "string" ? configuredOption.label.trim() : "";
      const configuredMessageTemplate = typeof configuredOption?.messageTemplate === "string" ? configuredOption.messageTemplate.trim() : "";

      return {
        ...defaultOption,
        label: (configuredLabel || defaultOption.label).slice(0, 20),
        messageTemplate: configuredMessageTemplate || defaultOption.messageTemplate,
      };
    });
  }

  /** Marca intro failed en BD con razón operativa (proyecto faltante, API error, etc.). */
  private async markIntroFailed(executionId: number, failureReason: string) {
    await this.leadAutomationRepository.markLeadFlowIntroFailed({
      executionId,
      failureReason,
    });
  }
}
