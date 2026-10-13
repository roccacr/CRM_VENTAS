import { type CompiledQuery, DummyDriver, Kysely, MysqlAdapter, MysqlIntrospector, MysqlQueryCompiler, type QueryResult } from "kysely";
import { describe, expect, it, vi } from "vitest";

import type { DatabaseService } from "../../src/database/database.service.js";
import type { CrmDatabase } from "../../src/database/database.types.js";
import type { AuditChangeSet } from "../../src/modules/crm/audit/audit-change-set.js";
import type { SecurityAuditService } from "../../src/modules/crm/audit/security-audit.service.js";
import { IdentityAccessManagementRepository } from "../../src/modules/crm/identity/identity-access-management.repository.js";
import type { IdentitySessionRepository } from "../../src/modules/crm/identity/identity-session.repository.js";
import { IdentityUserDirectoryRepository } from "../../src/modules/crm/identity/identity-user-directory.repository.js";

function fixture(publicId = "user") {
    const queries: CompiledQuery[] = [];
    let mutated = false;
    class Driver extends DummyDriver {
        override async acquireConnection() {
            const connection = await super.acquireConnection();
            connection.executeQuery = <R>(query: CompiledQuery): Promise<QueryResult<R>> => {
                queries.push(query);
                if (/^update/.test(query.sql)) mutated = true;
                const rowsByTable: Record<string, unknown[]> = {
                    sec_user: query.sql.includes("`normalized_email_user`") ? [] : [{ id: 7, publicId, name: "Person", email: "person@example.test", status: mutated ? "inactive" : "active" }],
                    sec_role: [{ id: 4, code: "sales", name: "Sales", description: "Description", status: "active" }],
                    sec_org_unit: [{ id: 5, code: "ventas" }],
                    sec_role_permission: [{ id: 9, code: "lead.read", moduleCode: "ventas" }],
                    sec_user_role: query.sql.includes("COUNT") ? [{ total: 0 }] : [{ userId: 7, code: "sales", name: "Sales", status: "active", assignedAt: new Date("2026-10-13T12:00:00Z") }],
                    sec_user_org_unit: [{ userId: 7, code: "ventas", name: "Sales", publicId: "area" }],
                    sec_auth_identity: [{ id: 11, userId: 7, provider: "local", code: "local", status: "pending" }],
                    int_user_external_identity: [{ userId: 7, systemCode: "erp", systemName: "ERP", externalUserId: "42", externalUsername: "person", status: "active" }],
                };
                const table = query.sql.match(/from `([^`]+)`/)?.[1] ?? "";
                const rows = rowsByTable[table] ?? [];
                return Promise.resolve({ rows: rows as R[], numAffectedRows: 1n, insertId: 7n });
            };
            return connection;
        }
    }
    const db = new Kysely<CrmDatabase>({ dialect: { createDriver: () => new Driver(), createAdapter: () => new MysqlAdapter(), createIntrospector: (database) => new MysqlIntrospector(database), createQueryCompiler: () => new MysqlQueryCompiler() } });
    const record = vi.fn<SecurityAuditService["record"]>().mockResolvedValue(undefined);
    const captureActor = vi.fn<SecurityAuditService["captureActor"]>().mockImplementation(() => Promise.resolve({ publicId, name: mutated ? "Changed" : "Person", roles: [{ code: mutated ? "replacement" : "sales", name: mutated ? "Replacement" : "Sales" }] }));
    const audit = { record, captureActor } as unknown as SecurityAuditService;
    const database = { db } as DatabaseService;
    return { db, queries, record, captureActor, directory: new IdentityUserDirectoryRepository(database, audit), access: new IdentityAccessManagementRepository(database, audit, { revokeAllActiveSessionsForUser: vi.fn() } as unknown as IdentitySessionRepository) };
}

describe("identity transactional change history", () => {
    it.each(["create", "update", "updateStatus", "replaceUserAccess", "updateRole", "deleteRole", "replaceRolePermissions"] as const)("captures original actor roles and administration context before %s", async (method) => {
        const canonicalId = "01M4V30BJ9BKQF85AWVNHFJNS2";
        const f = fixture(canonicalId);
        const input = { actorPublicId: canonicalId.toLowerCase(), userPublicId: canonicalId.toLowerCase(), displayName: "Changed", email: "changed@example.test", normalizedEmail: "changed@example.test", roleCode: "sales", roleCodes: ["sales"], orgUnitCodes: ["ventas"], accessMethods: ["local"] as const, externalReferences: [], initialStatus: "active" as const, status: "inactive" as const, permissionOverrides: [], code: "sales", name: "Changed", permissionCodes: [], reason: "Reason" };
        const isUserDirectory = ["create", "update", "updateStatus"].includes(method);
        const isRole = ["updateRole", "deleteRole", "replaceRolePermissions"].includes(method);
        try {
            if (method === "create" || method === "update" || method === "updateStatus") await f.directory[method](input);
            else await f.access[method](input);
            expect(f.record).toHaveBeenCalledOnce();
            const call = f.record.mock.calls[0];
            if (!call) throw new Error("Expected a business audit event");
            const [event, executor] = call;
            expect(event).toMatchObject({ actorSnapshot: { publicId: canonicalId, name: "Person", roles: [{ code: "sales", name: "Sales" }] }, metadata: { moduleCode: "administration", sectionCode: isUserDirectory ? "users" : "roles" } });
            expect(f.captureActor).toHaveBeenCalledExactlyOnceWith(7, executor);
            const changeSet = (event.metadata as Record<string, unknown>).changeSet as AuditChangeSet;
            expect(changeSet).toMatchObject({ entity: isRole ? "role" : "user" });
            if (["update", "updateStatus", "replaceUserAccess"].includes(method)) expect(changeSet.recordId).toBe(canonicalId);
        } finally {
            await f.db.destroy();
        }
    });

    it.each(["update", "updateStatus"] as const)("records the stored canonical public ID for case-insensitive %s input", async (method) => {
        const canonicalId = "01M4V30BJ9BKQF85AWVNHFJNS2";
        const f = fixture(canonicalId);
        const input = { actorPublicId: "actor", userPublicId: canonicalId.toLowerCase(), displayName: "Changed", email: "changed@example.test", normalizedEmail: "changed@example.test", roleCode: "sales", roleCodes: ["sales"], orgUnitCodes: ["ventas"], accessMethods: ["local"] as const, externalReferences: [], status: "inactive" as const, reason: "Reason" };
        await f.directory[method](input);
        const changeSet = f.record.mock.calls[0]?.[0].metadata?.changeSet as AuditChangeSet;
        expect(changeSet.recordId).toBe(canonicalId);
        const lookup = f.queries.find((query) => query.sql.includes("for update"));
        expect(lookup?.parameters).toContain(canonicalId.toLowerCase());
        expect(lookup?.sql).toContain("`public_id_user` as `publicId`");
        await f.db.destroy();
    });

    it("records safe complete user snapshots under the parent lock", async () => {
        const f = fixture();
        await f.directory.updateStatus({ actorPublicId: "actor", userPublicId: "user", status: "inactive", reason: "Reason" });
        const event = f.record.mock.calls[0]?.[0];
        expect(event?.metadata?.changeSet).toMatchObject({ version: 1, recordId: "user", action: "deactivate", before: { name: "Person", email: "person@example.test", status: "active", roleCodes: ["sales"], orgUnitCodes: ["ventas"], accessMethods: [{ code: "local", status: "pending" }], externalReferences: [{ externalUserId: "42" }] }, after: { status: "inactive" } });
        const lock = f.queries.findIndex((query) => query.sql.includes("for update"));
        const relation = f.queries.findIndex((query) => query.sql.includes("from `sec_user_role`"));
        expect(lock).toBeGreaterThanOrEqual(0);
        expect(lock).toBeLessThan(relation);
        expect(f.queries.find((query) => /^select/.test(query.sql))?.sql).toContain("for update");
        expect(f.record.mock.calls[0]?.[1]).not.toBe(f.db);
        expect(JSON.stringify(event)).not.toMatch(/password|token|providerSubject/i);
        await f.db.destroy();
    });

    it.each(["updateRole", "deleteRole", "replaceRolePermissions"] as const)("records full role history and locks before %s", async (method) => {
        const f = fixture();
        await f.access[method]({ actorPublicId: "actor", code: "sales", name: "New Sales", description: "New description", permissionCodes: [], reason: "Reason" });
        const changeSet = f.record.mock.calls[0]?.[0].metadata?.changeSet as AuditChangeSet;
        expect(changeSet).toMatchObject({ version: 1, recordId: "sales", before: { name: "Sales", description: "Description", status: "active", permissionCodes: ["lead.read"] } });
        expect(changeSet.after).toMatchObject(method === "updateRole" ? { name: "New Sales", description: "New description" } : method === "deleteRole" ? { status: "inactive" } : { permissionCodes: [] });
        const lock = f.queries.findIndex((query) => query.sql.includes("for update"));
        expect(lock).toBeGreaterThanOrEqual(0);
        expect(lock).toBeLessThan(f.queries.findIndex((query) => /^update/.test(query.sql)));
        expect(f.queries.find((query) => /^select/.test(query.sql))?.sql).toContain("for update");
        expect(f.record.mock.calls[0]?.[1]).not.toBe(f.db);
        await f.db.destroy();
    });

    it.each(["update", "replaceUserAccess"] as const)("locks parent before actor/catalog/snapshot reads for %s", async (method) => {
        const f = fixture();
        const input = { actorPublicId: "actor", userPublicId: "user", displayName: "Changed", email: "changed@example.test", normalizedEmail: "changed@example.test", roleCode: "sales", roleCodes: ["sales"], orgUnitCodes: ["ventas"], accessMethods: ["local"] as const, externalReferences: [], permissionOverrides: [], reason: "Reason" };
        if (method === "update") await f.directory.update(input);
        else await f.access.replaceUserAccess(input);
        const first = f.queries.find((query) => /^select/.test(query.sql));
        expect(first?.sql).toContain("from `sec_user`");
        expect(first?.sql).toContain("for update");
        expect(first?.parameters).toContain("user");
        const changeSet = f.record.mock.calls[0]?.[0].metadata?.changeSet as AuditChangeSet;
        expect(changeSet.before).toMatchObject({ roleCodes: ["sales"], orgUnitCodes: ["ventas"], accessMethods: [{ code: "local", status: "pending" }], externalReferences: [{ externalUserId: "42" }] });
        await f.db.destroy();
    });

    it("propagates audit failure out of the mutation transaction", async () => {
        const f = fixture();
        f.record.mockRejectedValue(new Error("audit unavailable"));
        await expect(f.access.updateRole({ actorPublicId: "actor", code: "sales", name: "Changed", reason: "Reason" })).rejects.toThrow("audit unavailable");
        await f.db.destroy();
    });
});
