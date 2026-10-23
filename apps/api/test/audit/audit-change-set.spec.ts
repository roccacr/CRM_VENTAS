import { describe, expect, it } from "vitest";

import { buildAuditChangeSet, getRecordAuditSourceChange } from "../../src/modules/crm/audit/audit-change-set.js";

describe("safe immutable business changelog", () => {
    it("records role module ceilings and permission inheritance without admitting credentials", () => {
        const change = buildAuditChangeSet({ entity: "role", recordId: "chief", action: "update", before: { moduleCodes: ["mercadeo"], moduleScoped: true, permissionInheritance: "assigned" }, after: { moduleCodes: [], moduleScoped: true, permissionInheritance: "assigned", password: "secret" } });
        expect(change.before).toEqual({ moduleCodes: ["mercadeo"], moduleScoped: true, permissionInheritance: "assigned" });
        expect(change.after).toEqual({ moduleCodes: [], moduleScoped: true, permissionInheritance: "assigned" });
        expect(change.changes).toEqual([{ field: "moduleCodes", before: ["mercadeo"], after: [] }]);
    });
    it("retains only server-built detached partial snapshots with original array order", () => {
        const before = { roleCodes: ["b", "a"], externalReferences: [{ systemCode: "odoo", password: "secret" }] };
        const change = buildAuditChangeSet({ entity: "user", recordId: "id", action: "update", before, after: { name: null } });
        before.roleCodes.reverse();
        expect(getRecordAuditSourceChange(change)).toEqual({ entity: "user", recordId: "id", action: "update", before: { roleCodes: ["b", "a"], externalReferences: [{ systemCode: "odoo" }] }, after: { name: null } });
        expect(getRecordAuditSourceChange(JSON.parse(JSON.stringify(change)))).toBeUndefined();
        expect(getRecordAuditSourceChange({ ...change })).toBeUndefined();
        expect(getRecordAuditSourceChange(null)).toBeUndefined();
        const source = getRecordAuditSourceChange(change);
        (source?.before?.roleCodes as string[]).reverse();
        expect(getRecordAuditSourceChange(change)?.before?.roleCodes).toEqual(["b", "a"]);
    });
    it("captures identity and action independently of mutable public changes and input", () => {
        const input = { entity: "user", recordId: "original-id", action: "update" as const, before: { name: "Before" }, after: { name: "After" } };
        const change = buildAuditChangeSet(input);
        expect(JSON.parse(JSON.stringify(change))).toEqual({ version: 1, entity: "user", recordId: "original-id", action: "update", before: { name: "Before" }, after: { name: "After" }, changes: [{ field: "name", before: "Before", after: "After" }] });
        input.entity = "input-redirect";
        input.recordId = "input-id";
        change.entity = "catalog";
        change.recordId = "redirect-id";
        change.action = "delete";
        change.before = null;
        change.after = null;
        expect(getRecordAuditSourceChange(change)).toEqual({ entity: "user", recordId: "original-id", action: "update", before: { name: "Before" }, after: { name: "After" } });
        const source = getRecordAuditSourceChange(change);
        if (!source) throw new Error("Missing server-built source");
        expect(Reflect.set(source, "entity", "redirected-source")).toBe(false);
        expect(Reflect.set(source, "recordId", "redirected-source-id")).toBe(false);
        expect(Reflect.set(source, "action", "delete")).toBe(false);
        expect(getRecordAuditSourceChange(change)).toMatchObject({ entity: "user", recordId: "original-id", action: "update" });
    });
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
