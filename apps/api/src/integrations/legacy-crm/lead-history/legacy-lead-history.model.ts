import { createHash } from "node:crypto";

import { z } from "zod";

/**
 * Fila de `bitacoras` ya unida a `caidas`, mas los conteos vivos de `leads` y
 * `admins`. Otro tipo no se clasifica: no se rellena un campo que la consulta
 * no trajo.
 *
 * `estado_lead` y `estado_caida` se conservan como numeros. No se leen como
 * activo o inactivo, ni como una transicion de etapa.
 */
export const legacyHistoryRowSchema = z.object({
    id: z.number().int().positive(),
    leadReference: z.number().int(),
    actorReference: z.number().int(),
    reasonId: z.number().int().nullable(),
    detail: z.string().nullable(),
    documentType: z.string().nullable(),
    stageLabel: z.string().nullable(),
    recordState: z.number().int(),
    dateText: z.string().nullable(),
    followUpText: z.string().nullable(),
    reasonName: z.string().nullable(),
    reasonState: z.number().int().nullable(),
    reasonScope: z.number().int().nullable(),
    matches: z.coerce.number().int().nonnegative(),
    leadId: z.number().int().nullable(),
    actorMatches: z.coerce.number().int().nonnegative(),
    actorName: z.string().nullable(),
});
export type LegacyHistoryRow = z.infer<typeof legacyHistoryRowSchema>;

/**
 * Diccionario cerrado de caidas ya observadas. Dos ids pueden compartir el
 * mismo codigo porque asi estan registradas. Un id que no esta aqui no se
 * acerca por el nombre: queda sin razon canonica.
 */
export const HISTORY_REASONS: Readonly<Record<number, { code: string; name: string }>> = {
    21: { code: "budget", name: "Presupuesto" },
    22: { code: "location", name: "Ubicación" },
    25: { code: "no_answer", name: "No contesta" },
    19: { code: "no_answer", name: "No contesta" },
    10: { code: "better_offer", name: "Mejor oferta" },
    29: { code: "better_offer", name: "Mejor oferta" },
    68: { code: "invalid_phone", name: "Número de teléfono no válido" },
};

/** Acciones explicitas por id de caida. El resto no se adivina: es una observacion legacy. */
const ACTIONS: Readonly<Record<number, string>> = { 50: "note_added", 51: "calendar_event_created", 70: "message_delivery_reported", 69: "contact_preference_reported", 67: "contact_preference_reported" };

/**
 * Huella de lo que ya estaba en la bitacora. Quedan fuera el conteo de leads,
 * el id resuelto, el conteo de admins y el nombre actual del actor: salen del
 * directorio vivo y pueden cambiar sin que la fila historica cambie.
 */
export function historyFingerprint(row: LegacyHistoryRow): string {
    const { matches: _matches, leadId: _lead, actorMatches: _actorMatches, actorName: _actorName, ...original } = row;
    return createHash("sha256").update(JSON.stringify(original)).digest("hex");
}

/**
 * El padre solo existe si hay exactamente un lead. Varias coincidencias no se
 * resuelven con el `MIN`: la fila queda ambigua. Cero coincidencias queda
 * missing y apunta a la bitacora, no a un lead inventado.
 */
function parent(row: LegacyHistoryRow) {
    const matched = row.matches === 1 && row.leadId !== null;
    return {
        source: { schema: "crmdatabase-api" as const, entity: matched ? "lead" : "lead_history_unresolved", table: matched ? "leads" : "bitacoras", id: String(matched ? row.leadId : row.id) },
        resolution: matched ? "matched" : row.matches > 1 ? "ambiguous" : "missing",
    };
}

/**
 * Clasifica sin fabricar una transicion, una zona horaria ni permisos del actor.
 *
 * La fecha queda como texto. `occurredAt` no se calcula. La fecha de
 * seguimiento sigue en la fila y en la huella, pero no se convierte en una
 * cita. La etapa observada es la etiqueta que vino; no abre ni cierra un estado.
 * El nombre del actor solo se publica si el directorio actual tiene exactamente
 * una fila para ese id de NetSuite.
 */
export function classifyLegacyHistory(row: LegacyHistoryRow) {
    const reasonId = row.reasonId ?? Number.NaN;
    const actionCode = ACTIONS[reasonId] ?? "legacy_observation";
    const reason = HISTORY_REASONS[reasonId] ?? null;
    return {
        ...parent(row),
        hash: historyFingerprint(row),
        entry: {
            actionCode,
            reason,
            classification: actionCode !== "legacy_observation" || reason ? "reviewed" : "unreviewed",
            detail: row.detail,
            sourceReasonLabel: row.reasonName,
            sourceActionLabel: row.documentType,
            stageObserved: row.stageLabel,
            occurredAt: null,
            sourceDate: row.dateText,
            sourceTimeZone: null,
            evidence: "legacy_observation" as const,
        },
        actor: { externalSystem: "netsuite", externalId: String(row.actorReference), nameObserved: row.actorMatches === 1 ? row.actorName : null, nameCoverage: "current_directory", historicalRoles: null },
    };
}
