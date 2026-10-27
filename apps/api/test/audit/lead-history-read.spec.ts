import { describe, expect, it, vi } from "vitest";

import { AuditReadService } from "../../src/modules/crm/audit/audit-read.service.js";
import { displayHistoryEntry, readHistoryQuery } from "../../src/modules/crm/leads/lead-history-reader.js";

const id = "01M4VECV87Y3Q3TGBBK8X2MHYX";
describe("lead history read boundaries", () => {
    it("bounds batches and scopes cursors to the record", () => {
        expect(readHistoryQuery(id, {})).toEqual({ limit: 50, before: undefined });
        expect(() => readHistoryQuery(id, { limit: 101 })).toThrow();
        expect(() => readHistoryQuery(id, { extra: "raw" })).toThrow();
        const cursor = Buffer.from(JSON.stringify({ recordId: id, before: 3 })).toString("base64url");
        expect(readHistoryQuery(id, { cursor, limit: "2" }).before).toBe(3);
        expect(() => readHistoryQuery("01M4VECV87Y3Q3TGBBK8X2MHYY", { cursor })).toThrow();
    });
    it("never exposes arbitrary snapshots or source identifiers", () => {
        expect(displayHistoryEntry({ original: { actorReference: 123 }, credential: "not visible" })).toBeNull();
        const row = displayHistoryEntry({ historyEntry: { actionCode: "note_added", reason: null, detail: "Nota", occurredAt: null, evidence: "legacy_observation", secret: "excluded" }, original: { id: 1 } });
        expect(row).not.toHaveProperty("secret");
        expect(row).not.toHaveProperty("original");
    });
    it("checks live permissions before fetching a record, including a direct deny for Owner", async () => {
        const identity = { getCurrentUser: vi.fn().mockResolvedValue({ roles: [{ code: "owner", status: "active" }], permissions: [{ code: "role.assign", effect: "deny" }] }) };
        const repository = { leadTimeline: vi.fn() };
        const service = new AuditReadService(identity as never, repository as never);
        await expect(service.leadTimeline("session", id, {})).rejects.toThrow("Permiso insuficiente");
        expect(repository.leadTimeline).not.toHaveBeenCalled();
        identity.getCurrentUser.mockResolvedValue({ roles: [{ code: "owner", status: "active" }], permissions: [] });
        await service.leadTimeline("session", id, {});
        expect(repository.leadTimeline).toHaveBeenCalledWith(id, {});
    });
});
