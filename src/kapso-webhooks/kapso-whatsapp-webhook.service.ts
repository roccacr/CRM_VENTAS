import { Inject, Injectable, Logger } from "@nestjs/common";
import { Prisma } from "@prisma/client";

import { normalizeWhatsappPhoneNumber } from "../common/phone/whatsapp-phone-number";
import { BITACORA_DOCUMENT_TYPE, KAPSO_WHATSAPP_EVENTS, WHATSAPP_RESPONSE_CAIDA, WHATSAPP_RESPONSE_EVENT, WHATSAPP_TEMPLATE_DELIVERED_CAIDA, WHATSAPP_TEMPLATE_DELIVERED_EVENT, WHATSAPP_TEMPLATE_FAILED_CAIDA, WHATSAPP_TEMPLATE_FAILED_EVENT } from "./kapso-webhook.constants";
import { classifyCustomerResponse, CustomerResponseKind } from "./kapso-whatsapp-webhook.classify";
import { extractCustomerPhoneNumber, extractFailureReason, extractLeadIdFromPayload, extractPhoneNumberId, extractReplyContextMessageId, extractResponseText, extractWhatsappMessageId, readStringPath } from "./kapso-whatsapp-webhook.payload";
import { CreateWhatsappResponseBitacoraInput, KapsoWhatsappResponseLead, KapsoWhatsappTemplateAttempt, KapsoWhatsappWebhookRepository } from "./kapso-whatsapp-webhook.repository";

export type KapsoWhatsappWebhookInput = {
    readonly event: string;
    readonly idempotencyKey?: string | undefined;
    readonly payload: unknown;
};

export type KapsoWhatsappWebhookResult = {
    readonly processed: boolean;
    readonly action: "accepted_info" | "rejected_info" | "unmapped_response" | "template_delivered" | "template_failed" | "duplicate" | "ignored";
};

type CustomerResponseRule = {
    readonly caidaId: number | null;
    readonly detail: string;
};

const CUSTOMER_RESPONSE_RULES: Record<CustomerResponseKind, CustomerResponseRule> = {
    accepted_info: {
        caidaId: WHATSAPP_RESPONSE_CAIDA.ACCEPTED_INFO,
        detail: "El cliente acepto recibir informacion por WhatsApp.",
    },
    rejected_info: {
        caidaId: WHATSAPP_RESPONSE_CAIDA.REJECTED_INFO,
        detail: "El cliente no quiso recibir informacion por WhatsApp.",
    },
    unmapped_response: {
        caidaId: WHATSAPP_RESPONSE_CAIDA.ACCEPTED_INFO,
        detail: "El cliente respondio, pero no fue ninguna de las respuestas predeterminadas.",
    },
};

/**
 * Procesa respuestas WhatsApp al template inicial `saludo`.
 *
 * En esta etapa registra solo la primera respuesta posterior al template inicial.
 * Mensajes/conversaciones completos quedan fuera de este flujo.
 */
@Injectable()
export class KapsoWhatsappWebhookService {
    private readonly logger = new Logger(KapsoWhatsappWebhookService.name);

    constructor(
        @Inject(KapsoWhatsappWebhookRepository)
        private readonly repository: Pick<KapsoWhatsappWebhookRepository, "findBitacoraByIdempotencyKey" | "findLeadForWhatsappResponse" | "findOpenTemplateAttemptByLeadId" | "findTemplateAttemptByMessageId" | "findTemplateAttemptByPhone" | "registerWhatsappResponse" | "updateTemplateAttemptConversation" | "updateTemplateAttemptDelivered" | "updateTemplateAttemptFailure">,
    ) {}

    async process(input: KapsoWhatsappWebhookInput): Promise<KapsoWhatsappWebhookResult> {
        if (input.event === KAPSO_WHATSAPP_EVENTS.MESSAGE_DELIVERED) {
            return this.processTemplateDelivered(input);
        }

        if (input.event === KAPSO_WHATSAPP_EVENTS.MESSAGE_FAILED) {
            return this.processTemplateFailure(input);
        }

        if (input.event !== KAPSO_WHATSAPP_EVENTS.MESSAGE_RECEIVED) {
            return { processed: false, action: "ignored" };
        }

        // Kapso puede reintentar webhooks; el marker en bitacora evita duplicar acciones del cliente.
        if (input.idempotencyKey) {
            const existing = await this.repository.findBitacoraByIdempotencyKey(input.idempotencyKey);

            if (existing) {
                return { processed: false, action: "duplicate" };
            }
        }

        const leadId = await this.resolveLeadIdForResponse(input.payload);

        // Si Kapso no manda marcador/contexto/telefono conocido, no hay forma segura de tocar el lead.
        if (!leadId) {
            return { processed: false, action: "ignored" };
        }

        const lead = await this.repository.findLeadForWhatsappResponse(leadId);

        if (!lead) {
            return { processed: false, action: "ignored" };
        }

        const responseText = extractResponseText(input.payload);
        const responseKind = classifyCustomerResponse(responseText);
        const conversationId = readStringPath(input.payload, ["conversation", "id"]);

        if (conversationId) {
            await this.repository.updateTemplateAttemptConversation(lead.idLead, conversationId);
        }

        await this.repository.registerWhatsappResponse(lead.idLead, toLeadUpdate(responseKind), toBitacora(lead, responseKind, responseText, input.idempotencyKey), {
            markTemplateAttemptResponseRegistered: true,
        });

        this.logger.log({
            action: responseKind,
            conversationId,
            event: WHATSAPP_RESPONSE_EVENT,
            idempotencyKey: input.idempotencyKey,
            leadId: lead.idLead,
        });

        return { processed: true, action: responseKind };
    }

    private async resolveLeadIdForResponse(payload: unknown): Promise<number | null> {
        const directLeadId = extractLeadIdFromPayload(payload);

        if (directLeadId) {
            const attempt = await this.repository.findOpenTemplateAttemptByLeadId(directLeadId);
            return attempt?.idLead ?? null;
        }

        const attemptByContext = await this.findAttemptByReplyContext(payload);

        if (attemptByContext) {
            return attemptByContext.idLead;
        }

        const attemptByPhone = await this.findAttemptByCustomerPhone(payload);
        return attemptByPhone?.idLead ?? null;
    }

    private async findAttemptByReplyContext(payload: unknown): Promise<KapsoWhatsappTemplateAttempt | null> {
        const contextMessageId = extractReplyContextMessageId(payload);

        if (!contextMessageId) {
            return null;
        }

        return this.repository.findTemplateAttemptByMessageId(contextMessageId);
    }

    private async findAttemptByCustomerPhone(payload: unknown): Promise<KapsoWhatsappTemplateAttempt | null> {
        const normalized = normalizeWhatsappPhoneNumber(extractCustomerPhoneNumber(payload));

        if (!normalized.e164Digits) {
            return null;
        }

        return this.repository.findTemplateAttemptByPhone({
            phoneNumber: normalized.e164Digits,
            phoneNumberId: extractPhoneNumberId(payload),
        });
    }

    private async processTemplateDelivered(input: KapsoWhatsappWebhookInput): Promise<KapsoWhatsappWebhookResult> {
        const resolved = await this.resolveTemplateStatusWebhook(input);

        if (!resolved) {
            return { processed: false, action: resolved === null ? "ignored" : "duplicate" };
        }

        const detail = `WhatsApp confirmo que el cliente recibio el template inicial.${input.idempotencyKey ? ` [Kapso webhook idem:${input.idempotencyKey}]` : ""}`;

        await this.repository.updateTemplateAttemptDelivered(resolved.lead.idLead, resolved.conversationId);
        await this.repository.registerWhatsappResponse(
            resolved.lead.idLead,
            { idCaida: WHATSAPP_TEMPLATE_DELIVERED_CAIDA },
            toBitacora(resolved.lead, {
                caidaId: WHATSAPP_TEMPLATE_DELIVERED_CAIDA,
                detail,
            }),
        );

        this.logger.log({
            conversationId: resolved.conversationId,
            event: WHATSAPP_TEMPLATE_DELIVERED_EVENT,
            idempotencyKey: input.idempotencyKey,
            leadId: resolved.lead.idLead,
            messageId: resolved.messageId,
        });

        return { processed: true, action: "template_delivered" };
    }

    private async processTemplateFailure(input: KapsoWhatsappWebhookInput): Promise<KapsoWhatsappWebhookResult> {
        const resolved = await this.resolveTemplateStatusWebhook(input);

        if (!resolved) {
            return { processed: false, action: resolved === null ? "ignored" : "duplicate" };
        }

        const failureReason = extractFailureReason(input.payload) ?? "Kapso reporto whatsapp.message.failed sin detalle adicional.";
        const detail = `No se pudo entregar el template saludo inicial por WhatsApp. Revisar el numero del cliente antes de reintentar.${input.idempotencyKey ? ` [Kapso webhook idem:${input.idempotencyKey}]` : ""}`;

        await this.repository.updateTemplateAttemptFailure(resolved.lead.idLead, {
            conversationId: resolved.conversationId,
            errorMessage: failureReason,
        });
        await this.repository.registerWhatsappResponse(
            resolved.lead.idLead,
            { idCaida: WHATSAPP_TEMPLATE_FAILED_CAIDA },
            toBitacora(resolved.lead, {
                caidaId: WHATSAPP_TEMPLATE_FAILED_CAIDA,
                detail,
            }),
        );

        this.logger.warn({
            conversationId: resolved.conversationId,
            event: WHATSAPP_TEMPLATE_FAILED_EVENT,
            idempotencyKey: input.idempotencyKey,
            leadId: resolved.lead.idLead,
            messageId: resolved.messageId,
            reason: failureReason,
        });

        return { processed: true, action: "template_failed" };
    }

    private async resolveTemplateStatusWebhook(input: KapsoWhatsappWebhookInput): Promise<{ readonly conversationId: string | null; readonly lead: KapsoWhatsappResponseLead; readonly messageId: string } | false | null> {
        if (input.idempotencyKey) {
            const existing = await this.repository.findBitacoraByIdempotencyKey(input.idempotencyKey);

            if (existing) {
                return false;
            }
        }

        const messageId = extractWhatsappMessageId(input.payload);

        if (!messageId) {
            return null;
        }

        const attempt = await this.repository.findTemplateAttemptByMessageId(messageId);

        if (!attempt) {
            return null;
        }

        const lead = await this.repository.findLeadForWhatsappResponse(attempt.idLead);

        if (!lead) {
            return null;
        }

        const conversationId = readStringPath(input.payload, ["conversation", "id"]);

        return { conversationId, lead, messageId };
    }
}

function toLeadUpdate(kind: CustomerResponseKind): Prisma.LeadUpdateManyMutationInput | null {
    const caidaId = CUSTOMER_RESPONSE_RULES[kind].caidaId;
    return caidaId ? { idCaida: caidaId } : null;
}

function toBitacora(lead: KapsoWhatsappResponseLead, kindOrRule: CustomerResponseKind | CustomerResponseRule, responseText: string | null = null, idempotencyKey: string | undefined = undefined): CreateWhatsappResponseBitacoraInput {
    const rule = typeof kindOrRule === "string" ? CUSTOMER_RESPONSE_RULES[kindOrRule] : kindOrRule;
    const marker = idempotencyKey ? ` [Kapso webhook idem:${idempotencyKey}]` : "";
    const response = responseText ? ` Respuesta: "${responseText}".` : "";

    return {
        detalleBit: `${rule.detail}${response}${marker}`,
        estadoBit: lead.segiminetoLead ?? "",
        estadoLead: lead.estadoLead ?? 0,
        idAdminBit: lead.idEmpleadoLead ?? 0,
        idCaidaBit: rule.caidaId,
        idLeadBit: lead.idinternoLead ?? lead.idLead,
        tipoDocumentoBit: BITACORA_DOCUMENT_TYPE,
    };
}
