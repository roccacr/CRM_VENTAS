import { type CompiledQuery, DummyDriver, Kysely, MysqlAdapter, MysqlIntrospector, MysqlQueryCompiler } from "kysely";
import { describe, expect, it } from "vitest";

import { canReadFormalizationStages, hasRoutePermission } from "../../src/common/security/route-permission.js";
import type { DatabaseService } from "../../src/database/database.service.js";
import type { CrmDatabase } from "../../src/database/database.types.js";
import { IdentityProfileRepository } from "../../src/modules/crm/identity/identity-profile.repository.js";
import { EffectivePermissionService } from "../../src/modules/crm/permissions/effective-permission.service.js";

const permissions = [
    { code: "mercadeo.home.read", moduleCode: "mercadeo" },
    { code: "formalizacion.home.stages.read", moduleCode: "formalizacion" },
    { code: "ventas.catalog_project.read", moduleCode: "ventas" },
    { code: "role.assign", moduleCode: "role" },
];
const role = (code: string, permissionInheritance = "assigned") => ({ code, name: code, status: "active", inheritanceMode: "assigned", permissionInheritance });
const mapping = (code: string, moduleCode: string) => ({ ...role(code), moduleCode, mappingStatus: "active", moduleStatus: "active", moduleDeleted: null });

function fixture() {
    const queries: CompiledQuery[] = [];
    const state = {
        roles: [role("jefe_general", "selected_modules")],
        modules: ["mercadeo", "formalizacion"],
        scopes: {} as Record<string, string>,
        rolePermissions: permissions.map((permission) => ({ ...permission, roleCode: "jefe_general" })),
        overrides: [{ code: "ventas.catalog_project.read", moduleCode: "ventas", effect: "allow", expiresAt: null }],
        mappings: [...["mercadeo", "formalizacion", "ventas", "contabilidad"].map((code) => mapping("jefe_general", code)), mapping("mercadeo", "mercadeo"), mapping("jefe_mercadeo", "mercadeo"), mapping("formalizacion", "formalizacion"), mapping("jefe_formalizaciones", "formalizacion")],
    };
    const driver = new DummyDriver();
    driver.acquireConnection = async () => {
        const connection = await DummyDriver.prototype.acquireConnection.call(driver);
        // Dispatches table rows only; the real repository resolves the policy under test.
        // eslint-disable-next-line complexity
        connection.executeQuery = (query) => {
            queries.push(query);
            let rows: object[] = [];
            if (query.sql.includes("sec_auth_session")) rows = [{ authIdentityStatus: "active", currentProvider: "local", sessionPublicId: "session", sessionStatus: "active", sessionExpiresAt: new Date("2099-01-01Z"), sessionPermissionVersion: 1, userId: 1, userPublicId: "user", displayName: "Test", email: "test@example.test", userStatus: "active", permissionVersion: 1, profileImageUrl: null }];
            else if (query.sql.includes("sec_role_module")) rows = state.mappings;
            else if (query.sql.includes("sec_user_permission_override")) rows = state.overrides;
            else if (query.sql.includes("sec_role_permission")) rows = state.rolePermissions;
            else if (query.sql.includes("sec_user_role")) rows = state.roles;
            else if (query.sql.includes("sec_user_org_unit")) rows = state.modules.map((code) => ({ code, name: code, publicId: code, status: "active", membership: "leader", scope: state.scopes[code] ?? "own_area_and_children" }));
            else if (query.sql.includes("sec_permission")) rows = permissions;
            else if (query.sql.includes("sec_auth_identity")) rows = [{ status_auth_identity: "active" }];
            return Promise.resolve({ rows: rows as never[] });
        };
        return connection;
    };
    const db = new Kysely<CrmDatabase>({ dialect: { createDriver: () => driver, createAdapter: () => new MysqlAdapter(), createIntrospector: (database) => new MysqlIntrospector(database), createQueryCompiler: () => new MysqlQueryCompiler() } });
    return { state, queries, db, repository: new IdentityProfileRepository({ db } as DatabaseService, new EffectivePermissionService()) };
}

describe("Jefe General selected-module profile", () => {
    it("acepta el marcado manual por grant real de Jefe General sin heredar virtualmente a la jefatura", async () => {
        const f = fixture();
        try {
            f.state.rolePermissions.push({ code: "formalizacion.orders.addendum.mark_pending", moduleCode: "formalizacion", roleCode: "jefe_general" });
            const profile = await f.repository.findBySessionTokenHash("hash");
            expect(profile?.permissions).toContainEqual(expect.objectContaining({ code: "formalizacion.orders.addendum.mark_pending", effect: "allow", source: "role" }));
        } finally {
            await f.db.destroy();
        }
    });
    it("conserva el permiso global del lead y su deny sin exigir un módulo Lead", async () => {
        const f = fixture();
        try {
            f.state.roles = [role("formalizacion")];
            f.state.rolePermissions = [{ code: "lead.profile.read", moduleCode: "lead", roleCode: "formalizacion" }];
            f.state.overrides = [];
            expect((await f.repository.findBySessionTokenHash("hash"))?.permissions).toContainEqual(expect.objectContaining({ code: "lead.profile.read", effect: "allow" }));
            f.state.overrides = [{ code: "lead.profile.read", moduleCode: "lead", effect: "deny", expiresAt: null }];
            expect((await f.repository.findBySessionTokenHash("hash"))?.permissions).toContainEqual(expect.objectContaining({ code: "lead.profile.read", effect: "deny" }));
            f.state.mappings = f.state.mappings.map((entry) => (entry.code === "formalizacion" ? { ...entry, mappingStatus: "inactive" } : entry));
            expect((await f.repository.findBySessionTokenHash("hash"))?.permissions.some((entry) => entry.code === "lead.profile.read" && entry.effect === "allow")).toBe(false);
        } finally {
            await f.db.destroy();
        }
    });
    it("retains a legitimate independent grant from another directly assigned role inside the template ceiling", async () => {
        const f = fixture();
        try {
            f.state.roles.push(role("formalizacion"));
            f.state.rolePermissions = [{ code: "formalizacion.home.stages.read", moduleCode: "formalizacion", roleCode: "formalizacion" }];
            const profile = await f.repository.findBySessionTokenHash("hash");
            expect(profile?.permissions.map((permission) => permission.code)).toEqual(["formalizacion.home.stages.read"]);
        } finally {
            await f.db.destroy();
        }
    });
    it("does not regenerate a permission removed from the General template", async () => {
        const f = fixture();
        try {
            f.state.rolePermissions = f.state.rolePermissions.filter((permission) => permission.code !== "formalizacion.home.stages.read");
            const profile = await f.repository.findBySessionTokenHash("hash");
            if (!profile) throw new Error("Expected authenticated fixture profile");
            expect(profile.permissions.map((permission) => permission.code)).toEqual(["mercadeo.home.read"]);
            expect(canReadFormalizationStages(profile)).toBe(false);
            expect(f.queries.some((query) => query.sql.includes("from `sec_permission` as `permission`"))).toBe(false);
        } finally {
            await f.db.destroy();
        }
    });
    it("removes a role-disabled module despite stale employee memberships and direct allows", async () => {
        const f = fixture();
        try {
            f.state.mappings = f.state.mappings.map((entry) => (entry.code === "jefe_general" && entry.moduleCode === "formalizacion" ? { ...entry, mappingStatus: "inactive" } : entry));
            f.state.overrides = [{ code: "formalizacion.home.stages.read", moduleCode: "formalizacion", effect: "allow", expiresAt: null }];
            const profile = await f.repository.findBySessionTokenHash("hash");
            expect(profile?.orgUnits.map((entry) => entry.code)).toEqual(["mercadeo"]);
            expect(profile?.permissions.map((permission) => permission.code)).toEqual(["mercadeo.home.read"]);
            expect(profile?.roles.map((entry) => entry.code)).toContain("jefe_general");
        } finally {
            await f.db.destroy();
        }
    });
    it("allows only selected operational modules and does not auto grant administration", async () => {
        const f = fixture();
        try {
            const profile = await f.repository.findBySessionTokenHash("hash");
            if (!profile) throw new Error("Expected authenticated fixture profile");
            expect(profile.permissions.map((permission) => permission.code)).toEqual(["formalizacion.home.stages.read", "mercadeo.home.read"]);
            expect(profile.roles.some((entry) => entry.code === "formalizacion")).toBe(true);
            expect(canReadFormalizationStages(profile)).toBe(true);
            expect(hasRoutePermission(profile, { kind: "all", codes: ["ventas.catalog_project.read"] }, {} as never)).toBe(false);
            expect(f.queries.some((query) => /insert |update |delete /i.test(query.sql))).toBe(false);
        } finally {
            await f.db.destroy();
        }
    });
    it("removes a module and its effective roles on the next read", async () => {
        const f = fixture();
        try {
            await f.repository.findBySessionTokenHash("hash");
            f.state.modules = ["mercadeo"];
            const profile = await f.repository.findBySessionTokenHash("hash");
            expect(profile?.roles.some((entry) => entry.code === "formalizacion")).toBe(false);
            expect(profile?.permissions.map((permission) => permission.code)).toEqual(["mercadeo.home.read"]);
        } finally {
            await f.db.destroy();
        }
    });
    it("does not grant operational access with no selected modules, even through an override", async () => {
        const f = fixture();
        try {
            f.state.modules = [];
            const profile = await f.repository.findBySessionTokenHash("hash");
            expect(profile?.permissions).toEqual([]);
            expect(profile?.roles.map((entry) => entry.code)).toEqual(["jefe_general"]);
        } finally {
            await f.db.destroy();
        }
    });
    it("honors individual denies inside the selected module", async () => {
        const f = fixture();
        try {
            f.state.overrides = [{ code: "formalizacion.home.stages.read", moduleCode: "formalizacion", effect: "deny", expiresAt: null }];
            const profile = await f.repository.findBySessionTokenHash("hash");
            if (!profile) throw new Error("Expected authenticated fixture profile");
            expect(profile.permissions.find((permission) => permission.code === "formalizacion.home.stages.read")).toMatchObject({ effect: "deny" });
            expect(canReadFormalizationStages(profile)).toBe(false);
        } finally {
            await f.db.destroy();
        }
    });
    it("keeps chiefs inside their area without broadening their configured permissions", async () => {
        const f = fixture();
        try {
            f.state.roles = [role("jefe_mercadeo")];
            f.state.rolePermissions = permissions.map((permission) => ({ ...permission, roleCode: "jefe_mercadeo" }));
            const profile = await f.repository.findBySessionTokenHash("hash");
            expect(profile?.permissions.map((permission) => permission.code)).toEqual(["mercadeo.home.read"]);
            expect(profile?.roles.map((entry) => entry.code)).toEqual(["jefe_mercadeo", "mercadeo"]);
            expect(profile?.orgUnits.map((entry) => entry.code)).toEqual(["mercadeo"]);
        } finally {
            await f.db.destroy();
        }
    });
    it("drops administrative grants and overrides even with a stale administrative membership", async () => {
        const f = fixture();
        try {
            f.state.modules.push("administration");
            f.state.rolePermissions = [{ code: "role.assign", moduleCode: "role", roleCode: "jefe_general" }];
            f.state.overrides = [{ code: "role.assign", moduleCode: "role", effect: "allow", expiresAt: null }];
            expect((await f.repository.findBySessionTokenHash("hash"))?.permissions.some((permission) => permission.code === "role.assign")).toBe(false);
        } finally {
            await f.db.destroy();
        }
    });
    it("does not retain a revoked chief grant through the base role in the same module", async () => {
        const f = fixture();
        try {
            f.state.roles = [role("jefe_mercadeo"), role("mercadeo")];
            f.state.mappings = f.state.mappings.map((entry) => (entry.code === "jefe_mercadeo" ? { ...entry, mappingStatus: "inactive" } : entry));
            f.state.rolePermissions = [
                { code: "mercadeo.approve", moduleCode: "mercadeo", roleCode: "jefe_mercadeo" },
                { code: "mercadeo.home.read", moduleCode: "mercadeo", roleCode: "mercadeo" },
            ];
            expect((await f.repository.findBySessionTokenHash("hash"))?.permissions.map((permission) => permission.code)).toEqual(["mercadeo.home.read"]);
        } finally {
            await f.db.destroy();
        }
    });
    it("does not let one area role borrow another role's module ceiling", async () => {
        const f = fixture();
        try {
            f.state.roles = [role("jefe_mercadeo"), role("formalizacion")];
            f.state.rolePermissions = [
                { code: "formalizacion.home.stages.read", moduleCode: "formalizacion", roleCode: "jefe_mercadeo" },
                { code: "mercadeo.home.read", moduleCode: "mercadeo", roleCode: "jefe_mercadeo" },
            ];
            expect((await f.repository.findBySessionTokenHash("hash"))?.permissions.map((permission) => permission.code)).toEqual(["mercadeo.home.read"]);
        } finally {
            await f.db.destroy();
        }
    });
    it("keeps per-module scopes even when an excluded membership has a broader scope", async () => {
        const f = fixture();
        try {
            f.state.modules.push("administration");
            f.state.scopes = { mercadeo: "own_area", formalizacion: "assigned", administration: "all_areas" };
            const profile = await f.repository.findBySessionTokenHash("hash");
            expect(profile?.permissions.find((permission) => permission.code === "mercadeo.home.read")?.scope).toBe("own_area");
            expect(profile?.permissions.find((permission) => permission.code === "formalizacion.home.stages.read")?.scope).toBe("assigned");
            expect(profile?.orgUnits.some((unit) => unit.code === "administration")).toBe(false);
        } finally {
            await f.db.destroy();
        }
    });
});
