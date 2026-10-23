import { DummyDriver, Kysely, MysqlAdapter, MysqlIntrospector, MysqlQueryCompiler } from "kysely";
import { describe, expect, it, vi } from "vitest";

import type { DatabaseService } from "../../src/database/database.service.js";
import type { CrmDatabase } from "../../src/database/database.types.js";
import type { SecurityAuditService } from "../../src/modules/crm/audit/security-audit.service.js";
import type { IdentityProfile } from "../../src/modules/crm/identity/identity.types.js";
import { IdentityAccessManagementRepository } from "../../src/modules/crm/identity/identity-access-management.repository.js";
import type { IdentitySessionRepository } from "../../src/modules/crm/identity/identity-session.repository.js";
import { IdentityUserDirectoryRepository } from "../../src/modules/crm/identity/identity-user-directory.repository.js";

const profile = { user: { publicId: "actor", permissionVersion: 1 }, roles: [{ code: "ventas", status: "active" }], orgUnits: [{ code: "ventas", status: "active" }], permissions: [{ code: "lead.read", effect: "allow" }] } as IdentityProfile;

function fixture() {
    const queries: string[] = [];
    const connectionIds: number[] = [];
    let acquisitions = 0;
    let expanded = false;
    let actorVersion = 1;
    const driver = new DummyDriver();
    driver.acquireConnection = async () => {
        const connectionId = ++acquisitions;
        const connection = await DummyDriver.prototype.acquireConnection.call(driver);
        connection.executeQuery = (query) => {
            queries.push(query.sql);
            connectionIds.push(connectionId);
            if (/^(insert|update|delete) /u.test(query.sql)) throw new Error("Unexpected mutation before validation");
            const permissions = [{ code: "lead.read", id: 1, moduleCode: "ventas" }, ...(expanded ? [{ code: "lead.create", id: 2, moduleCode: "ventas" }] : [])];
            const rowsByTable: Record<string, unknown[]> = {
                sec_role: [{ id: 1, code: "ventas", name: "Sales", description: null, status: "active", permissionInheritance: "assigned" }],
                sec_role_permission: permissions,
                sec_permission: permissions,
                sec_user: [{ id: 2, publicId: "target", name: "Target", email: "target@example.test", status: "active", permissionVersion: actorVersion }],
                sec_org_unit: [{ id: 3, code: "ventas" }],
            };
            const rows = rowsByTable[query.sql.match(/from `([^`]+)`/u)?.[1] ?? ""] ?? [];
            return Promise.resolve({ rows: rows as never[] });
        };
        return connection;
    };
    const db = new Kysely<CrmDatabase>({ dialect: { createDriver: () => driver, createAdapter: () => new MysqlAdapter(), createIntrospector: (database) => new MysqlIntrospector(database), createQueryCompiler: () => new MysqlQueryCompiler() } });
    const audit = { captureActor: vi.fn().mockResolvedValue({}), record: vi.fn().mockResolvedValue(undefined) };
    const repository = new IdentityAccessManagementRepository({ db } as DatabaseService, audit as unknown as SecurityAuditService, {} as IdentitySessionRepository);
    const directory = new IdentityUserDirectoryRepository({ db } as DatabaseService, audit as unknown as SecurityAuditService, {} as IdentitySessionRepository);
    return {
        db,
        queries,
        connectionIds,
        audit,
        repository,
        directory,
        expand: () => {
            expanded = true;
        },
        revokeActor: () => {
            actorVersion++;
        },
    };
}

describe("assignment revalidation in the writer transaction (SQL doubles, not MySQL concurrency)", () => {
    it("rejects role expansion after preflight before any access write or event", async () => {
        const f = fixture();
        try {
            await f.repository.assertDelegableAccess(profile, ["ventas"], ["ventas"], []);
            f.expand();
            f.queries.length = 0;
            f.connectionIds.length = 0;
            await expect(f.repository.replaceUserAccess({ validateAccess: (tx) => f.repository.validateAssignmentInTransaction(tx, { profile, roleCodes: ["ventas"], moduleCodes: ["ventas"], overrides: [] }), actorPublicId: "actor", userPublicId: "target", roleCodes: ["ventas"], orgUnitCodes: ["ventas"], permissionOverrides: [], reason: "Role expansion regression" })).rejects.toMatchObject({ status: 403 });
            const roleLock = f.queries.findIndex((query) => query.includes("from `sec_role`") && query.endsWith("for update"));
            const grantsRead = f.queries.findIndex((query) => query.includes("sec_role_permission"));
            expect(roleLock).toBeGreaterThanOrEqual(0);
            expect(grantsRead).toBeGreaterThan(roleLock);
            expect(f.queries.some((query) => /^(insert|update|delete) /u.test(query))).toBe(false);
            expect(f.audit.record).not.toHaveBeenCalled();
            expect(new Set(f.connectionIds).size).toBe(1);
        } finally {
            await f.db.destroy();
        }
    });
    it.each(["create", "update"] as const)("revalidates directory %s under the role lock before persistence or audit", async (method) => {
        const f = fixture();
        try {
            await f.repository.assertDelegableAccess(profile, ["ventas"], ["ventas"], []);
            f.expand();
            f.queries.length = 0;
            f.connectionIds.length = 0;
            const input = {
                validateAccess: (tx: Parameters<IdentityAccessManagementRepository["validateAssignmentInTransaction"]>[0]) => f.repository.validateAssignmentInTransaction(tx, { profile, roleCodes: ["ventas"], moduleCodes: ["ventas"], overrides: [] }),
                actorPublicId: "actor",
                userPublicId: "target",
                preserveAssignments: false,
                roleCode: "ventas",
                roleCodes: ["ventas"],
                orgUnitCodes: ["ventas"],
                displayName: "Target",
                email: "target@example.test",
                normalizedEmail: "target@example.test",
                externalReferences: [],
                accessMethods: ["local"] as const,
                initialStatus: "active" as const,
                reason: "Expanded role regression",
            };
            await expect(f.directory[method](input)).rejects.toMatchObject({ status: 403 });
            const lock = f.queries.findIndex((query) => query.includes("from `sec_role`") && query.endsWith("for update"));
            const grantRead = f.queries.findIndex((query) => query.includes("sec_role_permission"));
            expect(lock).toBeGreaterThanOrEqual(0);
            expect(grantRead).toBeGreaterThan(lock);
            expect(f.queries.slice(0, lock).every((query) => query.endsWith("for update"))).toBe(true);
            expect(f.queries.some((query) => /^(insert|update|delete) /u.test(query))).toBe(false);
            expect(f.audit.record).not.toHaveBeenCalled();
            expect(new Set(f.connectionIds).size).toBe(1);
        } finally {
            await f.db.destroy();
        }
    });
    it("rejects a changed actor permission version under the transaction lock", async () => {
        const f = fixture();
        try {
            f.revokeActor();
            await expect(f.db.transaction().execute((tx) => f.repository.validateAssignmentInTransaction(tx, { profile, roleCodes: ["ventas"], moduleCodes: ["ventas"], overrides: [] }))).rejects.toMatchObject({ status: 403 });
            expect(f.queries.some((query) => query.includes("permission_version_user") && query.endsWith("for update"))).toBe(true);
            expect(f.queries.some((query) => query.includes("sec_role_permission"))).toBe(false);
            expect(f.audit.record).not.toHaveBeenCalled();
        } finally {
            await f.db.destroy();
        }
    });
});
