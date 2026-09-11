import { Prisma } from "@prisma/client";

import { BITACORA_DOCUMENT_TYPE, CAIDA_TEMPLATE_INICIAL_ENTREGADO, LEAD_POST_TEMPLATE_ACCION, LEAD_POST_TEMPLATE_SEGUIMIENTO, LEAD_TEMPLATE_PROCESSED_STATUS } from "./envio-template-inicial.constants";
import { CreateBitacoraInput, EnvioTemplateInicialLead } from "./envio-template-inicial.repository";

type BitacoraOverrides = {
    readonly detalleBit: string;
    readonly estadoBit?: string;
    readonly idAdminBit: number;
    readonly idCaidaBit?: number | null;
};

/**
 * Arma el input de bitacora CRM. No escribe: el repo persiste en transaccion
 * junto al update del lead. `idCaidaBit` solo viaja si el caller lo define
 * (undefined ≠ null: null es "sin caida", omitted deja el default del schema).
 */
export function toBitacoraInput(lead: EnvioTemplateInicialLead, input: BitacoraOverrides): CreateBitacoraInput {
    const bitacoraBase: CreateBitacoraInput = {
        detalleBit: input.detalleBit,
        estadoBit: input.estadoBit ?? lead.segiminetoLead ?? "",
        estadoLead: lead.estadoLead ?? 0,
        idAdminBit: input.idAdminBit,
        idLeadBit: lead.idinternoLead ?? lead.idLead,
        tipoDocumentoBit: BITACORA_DOCUMENT_TYPE,
    };

    return input.idCaidaBit !== undefined ? { ...bitacoraBase, idCaidaBit: input.idCaidaBit } : bitacoraBase;
}

/**
 * Update CRM tras un envio exitoso: caida 70, seguimiento 08, telefono normalizado.
 * `actualizadaaccionLead` es DATETIME string (legado CRM), no Date.
 */
export function toSuccessLeadUpdate(normalizedPhoneNumber: string, now = new Date()): Prisma.LeadUpdateManyMutationInput {
    return {
        accionLead: LEAD_POST_TEMPLATE_ACCION,
        actualizadaaccionLead: formatMysqlDateTime(now),
        actualizadoLead: now,
        idCaida: CAIDA_TEMPLATE_INICIAL_ENTREGADO,
        segiminetoLead: LEAD_POST_TEMPLATE_SEGUIMIENTO,
        telefonoLead: normalizedPhoneNumber,
        whatsappTemplateContactSent: LEAD_TEMPLATE_PROCESSED_STATUS,
    };
}

/** Texto usable o fallback. Whitespace-only cuenta como vacio (misma regla que headers). */
export function valueOrFallback(value: string | null | undefined, fallback: string): string {
    const trimmed = value?.trim();
    return trimmed ? trimmed : fallback;
}

export function toErrorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
}

function formatMysqlDateTime(date: Date): string {
    const pad = (value: number): string => String(value).padStart(2, "0");

    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}
