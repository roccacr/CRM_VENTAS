import { describe, expect, it } from "vitest";
import { ZodError } from "zod";

import { classifyLegacyHistory, historyFingerprint, legacyHistoryRowSchema } from "../../src/integrations/legacy-crm/lead-history/legacy-lead-history.model.js";

const row = { id: 255872, leadReference: 6619427, actorReference: 5411399, reasonId: 51, detail: ".", documentType: "Se generó un evento para el cliente", stageLabel: "08-LEAD-SEGUIMIENTO", recordState: 1, dateText: "2026-10-23 13:26:53", followUpText: "", reasonName: "Evento Lead", reasonState: 1, reasonScope: 5, matches: 1, leadId: 77975, actorMatches: 1, actorName: "Directorio actual" };

describe("legacy lead history interpretation", () => {
    it("links by resolved original PK, preserves the observation, and never invents a transition", () => {
        const entry = classifyLegacyHistory(legacyHistoryRowSchema.parse(row));
        expect(entry.source.id).toBe("77975");
        expect(entry.source.entity).toBe("lead");
        expect(entry.entry.actionCode).toBe("calendar_event_created");
        expect(entry.entry.reason).toBeNull();
        expect(entry.entry.stageObserved).toBe("08-LEAD-SEGUIMIENTO");
        expect(entry.entry.occurredAt).toBeNull();
        expect(entry.entry.sourceDate).toBe(row.dateText);
    });
    it.each([0, 2])("quarantines %i matching leads without selecting a convenient minimum", (matches) => {
        const entry = classifyLegacyHistory(legacyHistoryRowSchema.parse({ ...row, matches }));
        expect(entry.source.entity).toBe("lead_history_unresolved");
        expect(entry.source.table).toBe("bitacoras");
        expect(entry.source.id).toBe(String(row.id));
        expect(entry.resolution).toBe(matches ? "ambiguous" : "missing");
    });
    it("distinguishes a budget reason from an activity and preserves unknown source values", () => {
        const budget = classifyLegacyHistory(legacyHistoryRowSchema.parse({ ...row, reasonId: 21, reasonName: "Presupuesto", stageLabel: "07-LEAD-PERDIDO" }));
        expect(budget.entry.reason?.code).toBe("budget");
        expect(budget.entry.actionCode).toBe("legacy_observation");
        const unknown = classifyLegacyHistory(legacyHistoryRowSchema.parse({ ...row, reasonId: 999, reasonName: "Sin clasificar" }));
        expect(unknown.entry.reason).toBeNull();
        expect(unknown.entry.classification).toBe("unreviewed");
    });
    it("fingerprints source content and does not claim directory names are historical evidence", () => {
        const parsed = legacyHistoryRowSchema.parse(row);
        expect(historyFingerprint(parsed)).toBe(historyFingerprint({ ...parsed, actorName: "Nombre cambiado hoy" }));
        expect(historyFingerprint(parsed)).not.toBe(historyFingerprint({ ...parsed, detail: "Texto modificado" }));
    });
    it("rejects malformed rows instead of silently dropping evidence", () => {
        expect(() => legacyHistoryRowSchema.parse({ ...row, id: 0 })).toThrow(ZodError);
        expect(() => legacyHistoryRowSchema.parse({ ...row, detail: { unsafe: true } })).toThrow(ZodError);
    });
});
