import { Inject, Injectable, Logger } from "@nestjs/common";
import { Prisma } from "@prisma/client";

import { BITACORA_DOCUMENT_TYPE, KAPSO_WHATSAPP_EVENTS, WHATSAPP_RESPONSE_CAIDA, WHATSAPP_RESPONSE_EVENT } from "./kapso-webhook.constants";
import { classifyCustomerResponse, CustomerResponseKind } from "./kapso-whatsapp-webhook.classify";
import { extractLeadIdFromPayload, extractResponseText, readStringPath } from "./kapso-whatsapp-webhook.payload";
import { CreateWhatsappResponseBitacoraInput, KapsoWhatsappResponseLead, KapsoWhatsappWebhookRepository } from "./kapso-whatsapp-webhook.repository";

export type KapsoWhatsappWebhookInput = {
    readonly event: string;
    readonly idempotencyKey?: string | undefined;
    readonly payload: unknown;
};

export type KapsoWhatsappWebhookResult = {
    readonly processed: boolean;
    readonly action: "accepted_info" | "rejected_info" | "unmapped_response" | "duplicate" | "ignored";
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
        caidaId: null,
        detail: "El cliente respondio, pero no fue ninguna de las respuestas predeterminadas.",
    },
};

/**
 * Procesa respuestas WhatsApp al template inicial `saludo`.
 *
 * En esta etapa registra decision en bitacora y solo cambia caida cuando el
 * boton esta mapeado. Mensajes/conversaciones completos quedan fuera.
 */
@Injectable()
export class KapsoWhatsappWebhookService {
    private readonly logger = new Logger(KapsoWhatsappWebhookService.name);

    constructor(
        @Inject(KapsoWhatsappWebhookRepository)
        private readonly repository: Pick<KapsoWhatsappWebhookRepository, "findBitacoraByIdempotencyKey" | "findLeadForWhatsappResponse" | "registerWhatsappResponse" | "updateTemplateAttemptConversation">,
    ) {}

    async process(input: KapsoWhatsappWebhookInput): Promise<KapsoWhatsappWebhookResult> {
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

        const leadId = extractLeadIdFromPayload(input.payload);

        // Sin `crm_lead:{id}` no hay forma segura de tocar el lead correcto.
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

        await this.repository.registerWhatsappResponse(lead.idLead, toLeadUpdate(responseKind), toBitacora(lead, responseKind, responseText, input.idempotencyKey));

        this.logger.log({
            action: responseKind,
            conversationId,
            event: WHATSAPP_RESPONSE_EVENT,
            idempotencyKey: input.idempotencyKey,
            leadId: lead.idLead,
        });

        return { processed: true, action: responseKind };
    }
}

function toLeadUpdate(kind: CustomerResponseKind): Prisma.LeadUpdateManyMutationInput | null {
    const caidaId = CUSTOMER_RESPONSE_RULES[kind].caidaId;
    return caidaId ? { idCaida: caidaId } : null;
}

function toBitacora(lead: KapsoWhatsappResponseLead, kind: CustomerResponseKind, responseText: string | null, idempotencyKey: string | undefined): CreateWhatsappResponseBitacoraInput {
    const rule = CUSTOMER_RESPONSE_RULES[kind];
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
