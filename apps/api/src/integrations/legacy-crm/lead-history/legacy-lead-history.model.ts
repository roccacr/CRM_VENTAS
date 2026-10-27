import { createHash } from "node:crypto";

import { z } from "zod";

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

/** Explicit semantics, not fuzzy matches or an interpretation of estado_caida as active/inactive. */
export const HISTORY_REASONS: Readonly<Record<number, { code: string; name: string }>> = {
    21: { code: "budget", name: "Presupuesto" },
    22: { code: "location", name: "Ubicación" },
    25: { code: "no_answer", name: "No contesta" },
    19: { code: "no_answer", name: "No contesta" },
    10: { code: "better_offer", name: "Mejor oferta" },
    29: { code: "better_offer", name: "Mejor oferta" },
    68: { code: "invalid_phone", name: "Número de teléfono no válido" },
};
const ACTIONS: Readonly<Record<number, string>> = { 50: "note_added", 51: "calendar_event_created", 70: "message_delivery_reported", 69: "contact_preference_reported", 67: "contact_preference_reported" };

/** Source hash excludes live-directory names and reconciliation results, which are not historical facts. */
export function historyFingerprint(row: LegacyHistoryRow): string {
    const { matches: _matches, leadId: _lead, actorMatches: _actorMatches, actorName: _actorName, ...original } = row;
    return createHash("sha256").update(JSON.stringify(original)).digest("hex");
}

/** Parent matching must resolve exactly one legacy PK; never pick MIN when several match. */
function parent(row: LegacyHistoryRow) {
    const matched = row.matches === 1 && row.leadId !== null;
    return {
        source: { schema: "crmdatabase-api" as const, entity: matched ? "lead" : "lead_history_unresolved", table: matched ? "leads" : "bitacoras", id: String(matched ? row.leadId : row.id) },
        resolution: matched ? "matched" : row.matches > 1 ? "ambiguous" : "missing",
    };
}

/** Preserve observed stages and dates without manufacturing a transition, timezone or actor permissions. */
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
