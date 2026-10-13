import { describe, expect, it } from "vitest";

import { buildAuditChangeSet } from "../../src/modules/crm/audit/audit-change-set.js";

describe("safe immutable business changelog", () => {
    it("captures creation and changed fields without credentials or arbitrary metadata", () => {
        const change = buildAuditChangeSet({ entity: "user", recordId: "user-id", action: "create", before: null, after: { name: "Roberto", email: "r@example.invalid", roleCodes: ["owner"], password: "secret", passwordHash: "hash", accessToken: "token", arbitrary: "private" } });
        expect(change.before).toBeNull();
        expect(change.after).toEqual({ name: "Roberto", email: "r@example.invalid", roleCodes: ["owner"] });
        expect(change.changes).toContainEqual({ field: "name", before: null, after: "Roberto" });
        expect(JSON.stringify(change)).not.toMatch(/secret|hash|token|private/);
    });

    it("records real differences and treats relationship ordering as unchanged", () => {
        const before = { name: "Roberto", status: "active", roleCodes: ["b", "a"] };
        const change = buildAuditChangeSet({ entity: "user", recordId: "user-id", action: "update", before, after: { ...before, name: "Roberto Carlos", roleCodes: ["a", "b"] } });
        expect(change.changes).toEqual([{ field: "name", before: "Roberto", after: "Roberto Carlos" }]);
        before.name = "Mutated later";
        expect(change.before?.name).toBe("Roberto");
    });

    it("normalizes external relationships and excludes nested credentials", () => {
        const change = buildAuditChangeSet({ entity: "catalog", recordId: "project-id", action: "update", before: { externalReferences: [{ systemCode: "odoo", externalId: "1", status: "active" }] }, after: { externalReferences: [{ systemCode: "odoo", externalId: "2", status: "active", password: "secret" }] } });
        expect(change.changes).toEqual([{ field: "externalReferences", before: [{ externalId: "1", status: "active", systemCode: "odoo" }], after: [{ externalId: "2", status: "active", systemCode: "odoo" }] }]);
    });
});
