import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { DummyDriver, Kysely, MysqlAdapter, MysqlIntrospector, MysqlQueryCompiler } from "kysely";
import { describe, expect, it, vi } from "vitest";

import type { DatabaseService } from "../../src/database/database.service.js";
import type { CrmDatabase } from "../../src/database/database.types.js";
import type { SecurityAuditEvent, SecurityAuditService } from "../../src/modules/crm/audit/security-audit.service.js";
import { ReplaceIdentityRolePermissionsDto } from "../../src/modules/crm/identity/dto/access-management.dto.js";
import type { IdentityProfile } from "../../src/modules/crm/identity/identity.types.js";
import { IdentityAccessManagementRepository } from "../../src/modules/crm/identity/identity-access-management.repository.js";
import type { IdentitySessionRepository } from "../../src/modules/crm/identity/identity-session.repository.js";

const ownerProfile = { user: { publicId: "actor", permissionVersion: 1 }, roles: [{ code: "owner", status: "active" }], permissions: [{ code: "role.assign", effect: "allow" }] } as IdentityProfile;
const actor = { actorPublicId: "actor", actorProfile: ownerProfile, code: "jefe_general", reason: "Edit operational template" };
const permissions = [
    { id: 11, code: "lead.read", moduleCode: "ventas" },
    { id: 12, code: "campaign.read", moduleCode: "mercadeo" },
    { id: 13, code: "user.update", moduleCode: "user" },
    { id: 14, code: "role.assign", moduleCode: "role" },
];
const units = [
    { id: 21, code: "ventas" },
    { id: 22, code: "mercadeo" },
    { id: 23, code: "administration" },
];

function fixture(options: { version?: number; status?: string; owner?: boolean; deny?: boolean; emptyGrants?: boolean } = {}) {
    const queries: string[] = [];
    const events: string[] = [];
    let mappings = [{ code: "ventas", status: "active", unitStatus: "active", deletedAt: null }];
    let grants = options.emptyGrants ? [] : permissions.slice(0, 1);
    const driver = new DummyDriver();
    driver.commitTransaction = () => {
        events.push("commit");
        return Promise.resolve();
    };
    driver.rollbackTransaction = () => {
        events.push("rollback");
        return Promise.resolve();
    };
    driver.acquireConnection = async () => {
        const connection = await DummyDriver.prototype.acquireConnection.call(driver);
        // This double supplies rows and observes transaction commands; it is not a SQL evaluator/concurrency test.
        // eslint-disable-next-line complexity, sonarjs/cognitive-complexity
        connection.executeQuery = (query) => {
            queries.push(query.sql);
            if (query.sql.startsWith("update `sec_role_module`")) mappings = mappings.map((mapping) => ({ ...mapping, status: "inactive" }));
            if (query.sql.startsWith("insert into `sec_role_module`"))
                for (let offset = 0; offset < query.parameters.length; offset += 5) {
                    const unit = units.find((entry) => entry.id === query.parameters[offset + 1]);
                    if (unit) mappings = [...mappings.filter((entry) => entry.code !== unit.code), { code: unit.code, status: "active", unitStatus: "active", deletedAt: null }];
                }
            if (query.sql.startsWith("update `sec_role_permission`")) grants = grants.filter((permission) => !query.parameters.slice(2, -1).includes(permission.id));
            if (query.sql.startsWith("insert into `sec_role_permission`"))
                for (let offset = 0; offset < query.parameters.length; offset += 4) {
                    const permission = permissions.find((entry) => entry.id === query.parameters[offset + 1]);
                    if (permission) grants.push(permission);
                }
            const table = query.sql.match(/from `([^`]+)`/u)?.[1] ?? "";
            const rows: Record<string, unknown[]> = {
                sec_role: [{ id: 5, code: "jefe_general", name: "General", description: null, status: "active", permissionInheritance: "selected_modules" }],
                sec_user: [{ id: 7, status: options.status ?? "active", permissionVersion: options.version ?? 1 }],
                sec_user_role: options.owner === false ? [] : [{ id_role: 1 }],
                sec_user_permission_override: options.deny ? [{ id_permission: 14 }] : [],
                sec_permission: permissions.filter((permission) => query.parameters.includes(permission.code)),
                sec_org_unit: units.filter((unit) => query.parameters.includes(unit.code)),
                sec_role_permission: grants,
                sec_role_module: mappings,
            };
            return Promise.resolve({ rows: (rows[table] ?? []) as never[] });
        };
        return connection;
    };
    const db = new Kysely<CrmDatabase>({ dialect: { createDriver: () => driver, createAdapter: () => new MysqlAdapter(), createIntrospector: (database) => new MysqlIntrospector(database), createQueryCompiler: () => new MysqlQueryCompiler() } });
    const audit = {
        captureActor: vi.fn().mockResolvedValue({}),
        record: vi.fn<(event: SecurityAuditEvent, executor: unknown) => Promise<void>>().mockImplementation(() => {
            events.push("audit");
            return Promise.resolve();
        }),
    };
    return { db, queries, events, audit, repository: new IdentityAccessManagementRepository({ db } as DatabaseService, audit as unknown as SecurityAuditService, {} as IdentitySessionRepository) };
}

describe("Owner editable General template", () => {
    it("rolls back the atomic save without committing when audit recording fails", async () => {
        const f = fixture();
        f.audit.record.mockRejectedValueOnce(new Error("Audit unavailable"));
        try {
            await expect(f.repository.replaceRolePermissions({ ...actor, moduleCodes: ["mercadeo"], permissionCodes: ["campaign.read"] })).rejects.toThrow("Audit unavailable");
            expect(f.audit.record).toHaveBeenCalledOnce();
            expect(f.events).toEqual(["rollback"]);
            expect(f.events).not.toContain("commit");
        } finally {
            await f.db.destroy();
        }
    });
    it("stores the module ceiling and grants atomically with one audited before/after and a version bump", async () => {
        const f = fixture();
        try {
            const result = await f.repository.replaceRolePermissions({ ...actor, moduleCodes: ["mercadeo"], permissionCodes: ["campaign.read"] });
            expect(result).toMatchObject({ permissionCodes: ["campaign.read"], role: { moduleCodes: ["mercadeo"], permissionInheritance: "selected_modules", locked: false } });
            expect(f.audit.record.mock.calls[0]?.[0].metadata?.changeSet).toMatchObject({ before: { moduleCodes: ["ventas"], permissionCodes: ["lead.read"] }, after: { moduleCodes: ["mercadeo"], permissionCodes: ["campaign.read"] } });
            expect(f.events).toEqual(["audit", "commit"]);
            expect(f.queries[0]).toContain("for update");
            expect(f.queries.some((query) => query.startsWith("update `sec_user`") && query.includes("permission_version_user"))).toBe(true);
        } finally {
            await f.db.destroy();
        }
    });
    it.each(["replaceRolePermissions", "updateRole"] as const)("revalidates the actor for %s before every mutation", async (method) => {
        for (const options of [{ version: 2 }, { status: "inactive" }, { owner: false }, { deny: true }]) {
            const f = fixture(options);
            try {
                await expect(f.repository[method]({ ...actor, name: "General", moduleCodes: ["ventas"], permissionCodes: ["lead.read"] })).rejects.toMatchObject({ status: 403 });
                expect(f.queries.some((query) => /^(update|insert|delete) /u.test(query))).toBe(false);
                expect(f.audit.record).not.toHaveBeenCalled();
                expect(f.events).toEqual(["rollback"]);
            } finally {
                await f.db.destroy();
            }
        }
    });
    it("leaves removed stored grants absent rather than regenerating active operational permissions", async () => {
        const f = fixture({ emptyGrants: true });
        try {
            expect((await f.repository.readRolePermissions("jefe_general")).permissionCodes).toEqual([]);
        } finally {
            await f.db.destroy();
        }
    });
    it("clears a mapped General template while retaining its marker and inactive ceiling history", async () => {
        const f = fixture();
        try {
            const result = await f.repository.replaceRolePermissions({ ...actor, moduleCodes: [], permissionCodes: [] });
            expect(result).toMatchObject({ permissionCodes: [], role: { moduleCodes: [], moduleScoped: true, permissionInheritance: "selected_modules", locked: false } });
        } finally {
            await f.db.destroy();
        }
    });
    it("rejects grants outside the new module ceiling and rolls the transaction back without an audit event", async () => {
        const f = fixture();
        try {
            await expect(f.repository.replaceRolePermissions({ ...actor, moduleCodes: ["mercadeo"], permissionCodes: ["lead.read"] })).rejects.toMatchObject({ status: 400 });
            expect(f.events).toEqual(["rollback"]);
            expect(f.audit.record).not.toHaveBeenCalled();
        } finally {
            await f.db.destroy();
        }
    });
    it("rejects administrative template modules/grants and inheritance-mode changes", async () => {
        const f = fixture();
        try {
            await expect(f.repository.replaceRolePermissions({ ...actor, moduleCodes: ["administration"], permissionCodes: [] })).rejects.toMatchObject({ status: 400 });
            await expect(f.repository.replaceRolePermissions({ ...actor, permissionCodes: ["user.update"] })).rejects.toMatchObject({ status: 400 });
            await expect(f.repository.updateRole({ ...actor, name: "General", permissionInheritance: "assigned" })).rejects.toMatchObject({ status: 409 });
        } finally {
            await f.db.destroy();
        }
    });
    it.each([null, "ventas", ["Invalid"]])("rejects malformed optional atomic module metadata %j", async (moduleCodes) => {
        expect(await validate(plainToInstance(ReplaceIdentityRolePermissionsDto, { moduleCodes, permissionCodes: [], reason: "Validate atomic metadata" }))).not.toEqual([]);
    });
});
