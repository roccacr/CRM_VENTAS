/**
 * Automatización de leads WhatsApp vía Kapso: plantilla inicial, respuestas Sí/No e intro.
 *
 * Ventana de negocio:
 * - La plantilla inicial se envía fuera de conversación (template Meta aprobado).
 * - Tras un “Sí” explícito, el cliente abre ventana de 24h y se envía intro + media
 *   como mensajes normales (no template), con URLs firmadas de adjuntos.
 *
 * Idempotencia: reserva por `flow_uuid + idinterno_lead` antes de enviar plantillas.
 * BullMQ coordina jobs entre procesos; el lock local solo evita invocaciones directas
 * simultaneas dentro de esta misma instancia.
 */

import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
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
import { KapsoLeadAutomationRepository, LeadFlowAnsweredYesContext } from "../repositories/kapso-lead-automation.repository";
import { KapsoMediaUrlSignerService } from "./kapso-media-url-signer.service";
import { KapsoPlatformApiService } from "./kapso-platform-api.service";

const DEFAULT_LEAD_TEMPLATE_BATCH_SIZE = 100;
const LEAD_INITIAL_CONTACT_FLOW_UUID = "94d5c3b8-4b43-4c28-8c76-3d9eaf70ad01";

type InboundMessageCandidate = {
  phoneNumberId: string | null;
  leadPhoneNumber: string | null;
  messageId: string | null;
  timestamp: string | null;
  replyText: string | null;
  replySource: "button" | "interactive_button" | "text" | "unsupported";
  message: JsonRecord;
};

export type InboundWebhookProcessingSummary = {
  processed: number;
  answeredNo: number;
  answeredYes: number;
  introSent: number;
  introFailed: number;
  ignored: number;
};

/**
 * Orquestador de contactos iniciales y avance de flujo según respuestas entrantes.
 */
@Injectable()
export class KapsoLeadAutomationService {
  private readonly logger = new Logger(KapsoLeadAutomationService.name);
  /** Lock local: no reemplaza BullMQ ni la reserva durable en BD. */
  private leadTemplateWorkerRunning = false;

  constructor(
    private readonly configService: ConfigService,
    private readonly kapsoPlatformApiService: KapsoPlatformApiService,
    private readonly leadAutomationRepository: KapsoLeadAutomationRepository,
    private readonly flowProjectMediaRepository: KapsoFlowProjectMediaRepository,
    private readonly mediaUrlSigner: KapsoMediaUrlSignerService,
  ) {}

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

    if (messages.length > 0) {
      this.logger.verbose(`Inbound message candidates extracted count=${messages.length}`);
    }

    for (const message of messages) {
      this.logger.verbose(
        `Inbound message candidate=${summarizePayload({
          phoneNumberId: message.phoneNumberId,
          leadPhoneNumber: message.leadPhoneNumber,
          messageId: message.messageId,
          timestamp: message.timestamp,
          replyText: message.replyText,
          replySource: message.replySource,
          rawMessage: message.message,
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

      if (this.isExplicitNoThanksReply(message)) {
        const updated = await this.leadAutomationRepository.markLeadFlowAnsweredNo({
          phoneNumberId: message.phoneNumberId,
          leadPhoneNumber: message.leadPhoneNumber,
          responsePayload: this.buildInboundResponsePayload(message),
        });

        if (updated) {
          summary.answeredNo += 1;
          this.logger.log(
            `Lead flow answered_no registered phoneNumberId=${message.phoneNumberId} messageId=${message.messageId ?? "n/a"}`,
          );
          continue;
        }

        summary.ignored += 1;
        this.logger.warn(
          `No active lead flow found for No response phoneNumberId=${message.phoneNumberId} messageId=${message.messageId ?? "n/a"}`,
        );
        continue;
      }

      if (this.isExplicitYesSendInformationReply(message)) {
        const executionContext = await this.leadAutomationRepository.markLeadFlowAnsweredYes({
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
   * Worker periódico: toma candidatos, reserva por `flow_uuid + idinterno_lead`
   * y envía la plantilla inicial. La reserva evita duplicados ante reintentos/jobs concurrentes.
   *
   * @returns Resumen scanned/configured/sent/skipped/failed.
   */
  async processLeadTemplateCandidates() {
    const emptySummary = { scanned: 0, configured: 0, sent: 0, skipped: 0, failed: 0 };

    if (this.leadTemplateWorkerRunning) {
      this.logger.verbose("Lead template automation worker skipped because another run is already active");
      return emptySummary;
    }

    this.leadTemplateWorkerRunning = true;

    try {
      const batchSize = this.configService.get<number>("kapso.leadTemplateBatchSize") ?? DEFAULT_LEAD_TEMPLATE_BATCH_SIZE;
      const candidates = await this.leadAutomationRepository.listLeadTemplateCandidates(batchSize, LEAD_INITIAL_CONTACT_FLOW_UUID);

      if (candidates.length === 0) {
        return emptySummary;
      }

      let configured = 0;
      let sent = 0;
      let skipped = 0;
      let failed = 0;

      for (const candidate of candidates) {
        this.logger.verbose(`Lead template candidate payload=${summarizePayload(candidate)}`);

        const hasAdvisor = candidate.idEmpleadoLead !== null && String(candidate.idEmpleadoLead).trim() !== "";
        const hasKapsoAssignment = candidate.kapsoRelationId !== null && candidate.phoneNumberId !== null;

        if (candidate.internalLeadId === null) {
          failed += 1;
          this.logger.error(`Lead template candidate cannot be logged because internalLeadId is null leadId=${candidate.leadId}`);
          continue;
        }

        try {
          if (hasAdvisor && hasKapsoAssignment) {
            const templateReady = this.isInitialTemplateReady(candidate);

            if (!templateReady) {
              skipped += 1;
              this.logger.warn(`Lead template candidate skipped leadId=${candidate.leadId} reason=flow_project_or_template_not_ready`);
              continue;
            }

            const leadPhoneNumber = this.normalizeLeadPhoneNumber(candidate.leadPhoneNumberRaw ?? candidate.telefono_lead);

            if (!leadPhoneNumber) {
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
              this.logger.verbose(`Initial template payload=${summarizePayload(initialTemplatePayload)}`);

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

              await this.leadAutomationRepository.markInitialTemplateSent({
                executionId: reservation.executionId,
                responsePayload: this.toJsonRecord(responsePayload),
              });

              sent += 1;
              this.logger.log(
                `Initial template sent leadId=${candidate.leadId} internalLeadId=${candidate.internalLeadId} phoneNumberId=${candidate.phoneNumberId}`,
              );
            } catch (error) {
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
      this.leadTemplateWorkerRunning = false;
    }
  }

  /** Admite el shape Meta y el shape directo de Kapso por compatibilidad con ambos emisores. */
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

  private extractPayloadPhoneNumberId(payload: JsonRecord): string | null {
    return firstNonNullString(payload.phone_number_id, payload.phoneNumberId, getNestedValue(payload, "metadata", "phone_number_id"));
  }

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

  private normalizeReplyText(value: string | null): string {
    return (value ?? "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^\p{L}\p{N}]+/gu, " ")
      .trim()
      .toLowerCase();
  }

  private isInitialTemplateReady(candidate: JsonRecord): boolean {
    return (
      firstNonNullString(candidate.flowUuid) === LEAD_INITIAL_CONTACT_FLOW_UUID &&
      Boolean(firstNonNullString(candidate.templateName)) &&
      Boolean(firstNonNullString(candidate.templateLanguage)) &&
      this.normalizeReplyText(firstNonNullString(candidate.templateStatus)) === "approved"
    );
  }

  /** Normaliza telefonos a formato E.164 sin `+`, que es el formato esperado por Meta/Kapso. */
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

    if (digits.length === 8 && !/^(\d)\1{7}$/.test(digits)) {
      return `506${digits}`;
    }

    if (digits.length >= 10 && digits.length <= 15 && !/^(\d)\1+$/.test(digits)) {
      return digits;
    }

    return null;
  }

  private buildInitialTemplatePayload(candidate: JsonRecord, leadPhoneNumber: string): JsonRecord {
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

  private resolveTemplateParameter(value: unknown, fallback: string): string {
    const text = String(value ?? "").trim();
    return text || fallback;
  }

  private toJsonRecord(value: unknown): JsonRecord {
    if (value && typeof value === "object" && !Array.isArray(value)) {
      return value as JsonRecord;
    }

    return { value };
  }

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
      const mediaItems = await this.flowProjectMediaRepository.listActiveFlowProjectMedia(
        LEAD_INITIAL_CONTACT_FLOW_UUID,
        context.idProyectoNetsuite,
        "intro",
      );
      const apiOptions = toKapsoApiOptions({ projectId: context.projectExternalId });

      this.logger.log(
        `Intro send started executionId=${context.executionId} phoneNumberId=${context.phoneNumberId} project=${context.projectName} mediaCount=${mediaItems.length}`,
      );
      this.logger.verbose(`Intro media items=${summarizePayload(mediaItems)}`);

      for (const mediaItem of mediaItems) {
        const mediaPayload = this.buildIntroMediaPayload(context, mediaItem);

        this.logger.verbose(
          `Intro media payload executionId=${context.executionId} mediaId=${mediaItem.id} type=${mediaItem.mediaType} payload=${summarizePayload(
            mediaPayload,
          )}`,
        );

        const mediaResponse = await this.kapsoPlatformApiService.sendWhatsappMessage(context.phoneNumberId, mediaPayload, apiOptions);

        this.logger.verbose(
          `Intro media Kapso response executionId=${context.executionId} mediaId=${mediaItem.id} payload=${summarizePayload(mediaResponse)}`,
        );
      }

      const interactivePayload = this.buildIntroInteractivePayload(context, mediaItems);

      this.logger.verbose(`Intro interactive payload executionId=${context.executionId} payload=${summarizePayload(interactivePayload)}`);

      const interactiveResponse = await this.kapsoPlatformApiService.sendWhatsappMessage(
        context.phoneNumberId,
        interactivePayload,
        apiOptions,
      );

      this.logger.verbose(
        `Intro interactive Kapso response executionId=${context.executionId} payload=${summarizePayload(interactiveResponse)}`,
      );

      await this.leadAutomationRepository.markLeadFlowIntroSent({
        executionId: context.executionId,
      });

      this.logger.log(
        `Intro message sent executionId=${context.executionId} phoneNumberId=${context.phoneNumberId} mediaCount=${mediaItems.length}`,
      );
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown intro send error";
      await this.markIntroFailed(context.executionId, message);
      this.logger.error(`Intro message failed executionId=${context.executionId} reason=${message}`);
      return false;
    }
  }

  private buildIntroMediaPayload(context: LeadFlowAnsweredYesContext, media: FlowProjectMediaRecord): JsonRecord {
    const signedMediaUrl = this.mediaUrlSigner.createSignedUrl(media.storedFilename);
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
          link: signedMediaUrl,
          filename: media.originalName,
        },
      };
    }

    return {
      ...basePayload,
      [media.mediaType]: {
        link: signedMediaUrl,
      },
    };
  }

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
    await this.leadAutomationRepository.markLeadFlowIntroFailed({
      executionId,
      failureReason,
    });
  }
}
