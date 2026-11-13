import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { DummyDriver, Kysely, MysqlAdapter, MysqlIntrospector, MysqlQueryCompiler } from "kysely";
import { describe, expect, it, vi } from "vitest";

import type { DatabaseService } from "../../src/database/database.service.js";
import type { CrmDatabase } from "../../src/database/database.types.js";
import type { SecurityAuditEvent, SecurityAuditService } from "../../src/modules/crm/audit/security-audit.service.js";
import { UpdateIdentityRoleDto } from "../../src/modules/crm/identity/dto/access-management.dto.js";
import type { IdentityProfile } from "../../src/modules/crm/identity/identity.types.js";
import { IdentityAccessManagementRepository } from "../../src/modules/crm/identity/identity-access-management.repository.js";
import type { IdentitySessionRepository } from "../../src/modules/crm/identity/identity-session.repository.js";

function fixture(input: { code?: string; mode?: "assigned" | "selected_modules"; permissionModule?: string; permissionCode?: string; mappings?: { code: string; status: string; unitStatus: string; deletedAt: null }[] } = {}) {
    const permissionCode = input.permissionCode ?? "lead.read";
    const queries: string[] = [];
    const parameters: unknown[][] = [];
    let mappings = input.mappings ?? [{ code: "ventas", status: "active", unitStatus: "active", deletedAt: null }];
    const audit = { captureActor: vi.fn().mockResolvedValue({}), record: vi.fn<(event: SecurityAuditEvent, executor: unknown) => Promise<void>>().mockResolvedValue(undefined) };
    const driver = new DummyDriver();
    driver.acquireConnection = async () => {
        const connection = await DummyDriver.prototype.acquireConnection.call(driver);
        connection.executeQuery = (query) => {
            queries.push(query.sql);
            parameters.push([...query.parameters]);
            if (query.sql.startsWith("update `sec_role_module`")) mappings = mappings.map((mapping) => ({ ...mapping, status: "inactive" }));
            const table = query.sql.match(/from `([^`]+)`/u)?.[1] ?? "";
            const rowsByTable: Record<string, unknown[]> = {
                audit_security_event: [],
                sec_user_permission_override: [],
                sec_user: [{ id: 1, status: "active", permissionVersion: 1 }],
                sec_role: [{ id: 1, code: input.code ?? "jefe_general", name: "Jefe General", description: null, status: "active", permissionInheritance: input.mode ?? "selected_modules" }],
                sec_role_module: mappings,
            };
            const rows = rowsByTable[table] ?? [{ code: permissionCode, id: 1, moduleCode: input.permissionModule ?? "ventas" }];
            return Promise.resolve({ rows: rows as never[] });
        };
        return connection;
    };
    const db = new Kysely<CrmDatabase>({ dialect: { createDriver: () => driver, createAdapter: () => new MysqlAdapter(), createIntrospector: (database) => new MysqlIntrospector(database), createQueryCompiler: () => new MysqlQueryCompiler() } });
    return { db, queries, parameters, audit, repository: new IdentityAccessManagementRepository({ db } as DatabaseService, audit as unknown as SecurityAuditService, {} as IdentitySessionRepository) };
}

describe("role module policy", () => {
    it.each(["owner", "jefe_general", "auditor"])("refuses deletion of protected %s even without direct assignments", async (code) => {
        const f = fixture({ code, mode: code === "auditor" ? "selected_modules" : "assigned", mappings: [] });
        try {
            await expect(f.repository.deleteRole({ actorPublicId: "actor", code })).rejects.toMatchObject({ status: 409 });
            expect(f.queries.some((query) => query.startsWith("update "))).toBe(false);
            expect(f.audit.record).not.toHaveBeenCalled();
        } finally {
            await f.db.destroy();
        }
    });
    it("rejects explicitly clearing a role that has never had a module ceiling", async () => {
        const f = fixture({ code: "auditor", mode: "assigned", mappings: [] });
        try {
            await expect(f.repository.updateRole({ actorPublicId: "actor", code: "auditor", name: "Auditor", moduleCodes: [], reason: "Reject ambiguous clearing" })).rejects.toMatchObject({ status: 400 });
            expect(f.queries.some((query) => query.startsWith("update ") || query.startsWith("insert "))).toBe(false);
            expect(f.audit.record).not.toHaveBeenCalled();
        } finally {
            await f.db.destroy();
        }
    });
    it("rejects non-operational General selections even when Owner is the actor", async () => {
        const f = fixture({ mappings: [] });
        const owner = { roles: [{ code: "owner", status: "active" }] } as IdentityProfile;
        try {
            await expect(f.repository.assertDelegableAccess(owner, ["jefe_general"], ["administration"], [])).rejects.toMatchObject({ status: 403 });
        } finally {
            await f.db.destroy();
        }
    });
    it("rejects non-operational General direct allows based on permission metadata", async () => {
        const f = fixture({ permissionModule: "user" });
        const owner = { roles: [{ code: "owner", status: "active" }] } as IdentityProfile;
        try {
            await expect(f.repository.assertDelegableAccess(owner, ["jefe_general"], ["ventas"], [{ code: "lead.read", effect: "allow" }])).rejects.toMatchObject({ status: 403 });
        } finally {
            await f.db.destroy();
        }
    });
    it.each([{ moduleCodes: null }, { moduleCodes: "ventas" }, { moduleCodes: ["Invalid"] }, { permissionInheritance: null }, { permissionInheritance: "all" }])("rejects invalid optional policy metadata %j", async (metadata) => {
        expect(await validate(plainToInstance(UpdateIdentityRoleDto, { name: "Auditor", reason: "Policy validation", ...metadata }))).not.toEqual([]);
    });
    it("reads General stored grants through its active template ceiling and leaves it editable", async () => {
        const f = fixture();
        try {
            const result = await f.repository.readRolePermissions("jefe_general");
            expect(result.permissionCodes).toEqual(["lead.read"]);
            expect(result.role).toMatchObject({ permissionInheritance: "selected_modules", moduleCodes: ["ventas"], moduleScoped: true, locked: false });
            expect(f.queries.some((query) => query.includes("permission_inheritance_mode_role"))).toBe(true);
            expect(f.queries.some((query) => query.includes("sec_role_permission"))).toBe(true);
            expect(f.queries.some((query) => query.includes("from `sec_permission`"))).toBe(false);
        } finally {
            await f.db.destroy();
        }
    });
    it("allows stored General permission replacement while keeping its inheritance marker", async () => {
        const f = fixture();
        try {
            const result = await f.repository.replaceRolePermissions({ actorPublicId: "actor", actorProfile: { user: { publicId: "actor", permissionVersion: 1 } } as IdentityProfile, code: "jefe_general", permissionCodes: [], reason: "Edit template grants" });
            expect(result.permissionCodes).toEqual([]);
            expect(result.role).toMatchObject({ permissionInheritance: "selected_modules", locked: false });
        } finally {
            await f.db.destroy();
        }
    });
    it("exposes the same stored General base and editable state in the security catalog", async () => {
        const f = fixture({ permissionCode: "ventas.home.read" });
        try {
            const result = await f.repository.readSecurityCatalog();
            expect(result.rolePermissions.jefe_general).toEqual(["ventas.home.read"]);
            expect(result.roles[0]).toMatchObject({ code: "jefe_general", permissionInheritance: "selected_modules", moduleCodes: ["ventas"], moduleScoped: true, locked: false });
        } finally {
            await f.db.destroy();
        }
    });
    it("allows bounded delegation and rejects modules or roles the actor does not hold", async () => {
        const f = fixture({ code: "ventas", mode: "assigned" });
        const actor = { roles: [{ code: "ventas", status: "active" }], orgUnits: [{ code: "ventas", status: "active" }], permissions: [{ code: "lead.read", effect: "allow" }] } as IdentityProfile;
        try {
            await expect(f.repository.assertDelegableAccess(actor, ["ventas"], ["ventas"], [])).resolves.toBeUndefined();
            await expect(f.repository.assertDelegableAccess(actor, ["ventas"], ["mercadeo"], [])).rejects.toMatchObject({ status: 403 });
            await expect(f.repository.assertDelegableAccess(actor, ["jefe_general"], ["ventas"], [])).rejects.toMatchObject({ status: 403 });
        } finally {
            await f.db.destroy();
        }
    });
    it("rejects Owner and out-of-authority direct grants for non-Owners, including allow plus deny", async () => {
        const f = fixture();
        const actor = {
            roles: [{ code: "ventas", status: "active" }],
            orgUnits: [{ code: "ventas", status: "active" }],
            permissions: [
                { code: "lead.read", effect: "allow" },
                { code: "lead.read", effect: "deny" },
            ],
        } as IdentityProfile;
        try {
            vi.spyOn(f.repository, "readRolePermissions").mockResolvedValue({ role: { code: "ventas", name: "Ventas", status: "active", description: null }, permissionCodes: ["lead.read"] });
            await expect(f.repository.assertDelegableAccess(actor, ["owner"], [], [])).rejects.toMatchObject({ status: 403 });
            await expect(f.repository.assertDelegableAccess(actor, ["ventas"], ["ventas"], [{ code: "lead.read", effect: "allow" }])).rejects.toMatchObject({ status: 403 });
        } finally {
            await f.db.destroy();
        }
    });
    it("retains a cleared mapping as a scoped empty ceiling", async () => {
        const f = fixture({ code: "auditor", mode: "assigned", mappings: [{ code: "ventas", status: "inactive", unitStatus: "active", deletedAt: null }] });
        try {
            const result = await f.repository.readRolePermissions("auditor");
            expect(result.role).toMatchObject({ moduleCodes: [], moduleScoped: true, permissionInheritance: "assigned" });
            expect(result.permissionCodes).toEqual([]);
        } finally {
            await f.db.destroy();
        }
    });
    it("preserves grants for a generic role with no relation rows", async () => {
        const f = fixture({ code: "auditor", mode: "assigned", mappings: [] });
        try {
            expect((await f.repository.readRolePermissions("auditor")).permissionCodes).toEqual(["lead.read"]);
        } finally {
            await f.db.destroy();
        }
    });
    it("retains the existing role ceiling when optional metadata is omitted", async () => {
        const f = fixture({ code: "auditor", mode: "assigned" });
        try {
            await f.repository.updateRole({ actorPublicId: "actor", code: "auditor", name: "Auditor", reason: "Rename only" });
            expect(f.queries.some((query) => query.startsWith("update `sec_role_module`"))).toBe(false);
            expect(f.audit.record.mock.calls[0]?.[0].metadata?.changeSet).toMatchObject({ before: { moduleCodes: ["ventas"], permissionInheritance: "assigned" }, after: { moduleCodes: ["ventas"], permissionInheritance: "assigned" } });
        } finally {
            await f.db.destroy();
        }
    });
    it("clears modules by retaining inactive relation rows and audits the before/after change", async () => {
        const f = fixture({ code: "auditor", mode: "assigned" });
        try {
            const role = await f.repository.updateRole({ actorPublicId: "actor", code: "auditor", name: "Auditor", moduleCodes: [], reason: "Clear module ceiling" });
            expect(role).toMatchObject({ moduleCodes: [], moduleScoped: true, permissionInheritance: "assigned" });
            expect(f.queries.some((query) => query.startsWith("update `sec_role_module`"))).toBe(true);
            expect(f.queries.some((query) => query.includes("delete from"))).toBe(false);
            expect(f.audit.record.mock.calls[0]?.[0].metadata?.changeSet).toMatchObject({ before: { moduleCodes: ["ventas"] }, after: { moduleCodes: [], moduleScoped: true } });
        } finally {
            await f.db.destroy();
        }
    });
});
