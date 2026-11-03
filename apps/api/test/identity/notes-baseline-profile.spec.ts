import { type CompiledQuery, DummyDriver, Kysely, MysqlAdapter, MysqlIntrospector, MysqlQueryCompiler } from "kysely";
import { describe, expect, it } from "vitest";

import type { DatabaseService } from "../../src/database/database.service.js";
import type { CrmDatabase } from "../../src/database/database.types.js";
import { IdentityProfileRepository } from "../../src/modules/crm/identity/identity-profile.repository.js";
import { canUseCollaboration, canUseNotes } from "../../src/modules/crm/notes/notes.permissions.js";
import { EffectivePermissionService } from "../../src/modules/crm/permissions/effective-permission.service.js";

const permissions = [...["mercadeo", "formalizacion", "ventas"].flatMap((moduleCode) => ["read", "create", "edit_own", "resolve_own", "archive_own"].map((action) => ({ code: `${moduleCode}.notes.${action}`, moduleCode }))), { code: "mercadeo.home.read", moduleCode: "mercadeo" }, { code: "formalizacion.home.stages.read", moduleCode: "formalizacion" }, { code: "ventas.catalog_project.read", moduleCode: "ventas" }, { code: "role.assign", moduleCode: "role" }];
const role = (code: string, permissionInheritance = "assigned") => ({ code, name: code, status: "active", inheritanceMode: "assigned", permissionInheritance });
const mapping = (code: string, moduleCode: string) => ({ ...role(code), moduleCode, mappingStatus: "active", moduleStatus: "active", moduleDeleted: null });

function fixture() {
    const queries: CompiledQuery[] = [];
    const state = {
        roles: [role("jefe_general", "selected_modules")],
        modules: ["mercadeo", "formalizacion"],
        scopes: {} as Record<string, string>,
        rolePermissions: [] as Array<{ code: string; moduleCode: string; roleCode: string }>,
        activePermissions: permissions,
        userStatus: "active",
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
            if (query.sql.includes("sec_auth_session")) rows = [{ authIdentityStatus: "active", currentProvider: "local", sessionPublicId: "session", sessionStatus: "active", sessionExpiresAt: new Date("2099-01-01Z"), sessionPermissionVersion: 1, userId: 1, userPublicId: "user", displayName: "Test", email: "test@example.test", userStatus: state.userStatus, permissionVersion: 1, profileImageUrl: null }];
            else if (query.sql.includes("sec_role_module")) rows = state.mappings;
            else if (query.sql.includes("sec_user_permission_override")) rows = state.overrides;
            else if (query.sql.includes("sec_role_permission")) rows = state.rolePermissions;
            else if (query.sql.includes("sec_user_role")) rows = state.roles;
            else if (query.sql.includes("sec_user_org_unit")) rows = state.modules.map((code) => ({ code, name: code, publicId: code, status: "active", membership: "leader", scope: state.scopes[code] ?? "own_area_and_children" }));
            else if (query.sql.includes("sec_permission")) rows = state.activePermissions;
            else if (query.sql.includes("sec_auth_identity")) rows = [{ status_auth_identity: "active" }];
            else if (query.sql.includes("from `sec_user`")) rows = state.userStatus === "active" ? [{ id: 1, publicId: "user", displayName: "Test", email: "test@example.test", status: "active", permissionVersion: 1 }] : [];
            return Promise.resolve({ rows: rows as never[] });
        };
        return connection;
    };
    const db = new Kysely<CrmDatabase>({ dialect: { createDriver: () => driver, createAdapter: () => new MysqlAdapter(), createIntrospector: (database) => new MysqlIntrospector(database), createQueryCompiler: () => new MysqlQueryCompiler() } });
    return { state, queries, db, repository: new IdentityProfileRepository({ db } as DatabaseService, new EffectivePermissionService()) };
}

describe("Personal notes baseline in the effective profile", () => {
    it("grants self-only personal actions inside effective modules without other business permissions", async () => {
        const f = fixture();
        try {
            f.state.roles = [role("mercadeo")];
            const profile = await f.repository.findBySessionTokenHash("hash");
            if (!profile) throw new Error("Expected active profile");
            expect(canUseNotes(profile, "mercadeo", "create")).toBe(true);
            expect(profile.permissions.filter((p) => p.effect === "allow")).toHaveLength(5);
            expect(profile.permissions.every((p) => p.scope === "self")).toBe(true);
            expect(canUseNotes(profile, "ventas", "create")).toBe(false);
            expect(f.queries.some((q) => /insert |update |delete /i.test(q.sql))).toBe(false);
        } finally {
            await f.db.destroy();
        }
    });
    it("resolves current server authorization without a session or synthetic authentication", async () => {
        const f = fixture();
        const target = await f.repository.findAuthorizationByUserPublicId("user");
        expect(target?.user.publicId).toBe("user");
        expect(target).not.toHaveProperty("session");
        expect(target).not.toHaveProperty("auth");
        expect(f.queries.some((q) => q.sql.includes("sec_auth_session"))).toBe(false);
        const session = await f.repository.findBySessionTokenHash("hash");
        expect(target?.permissions).toEqual(session?.permissions);
        f.state.userStatus = "inactive";
        expect(await f.repository.findAuthorizationByUserPublicId("user")).toBeNull();
        await f.db.destroy();
    });
    it("retains origin notes explicit denies outside the module ceiling for personal invitation fallback", async () => {
        const f = fixture();
        f.state.roles = [role("mercadeo")];
        f.state.modules = ["mercadeo"];
        f.state.overrides = [{ code: "ventas.notes.read", moduleCode: "ventas", effect: "deny", expiresAt: null }];
        const target = await f.repository.findAuthorizationByUserPublicId("user");
        if (!target) throw new Error("Expected target");
        expect(canUseNotes(target, "mercadeo", "read")).toBe(true);
        expect(canUseCollaboration(target, "ventas", "read", true)).toBe(false);
        await f.db.destroy();
    });
    it("honors individual denies and preserves configured wider grants", async () => {
        const f = fixture();
        try {
            f.state.overrides = [{ code: "mercadeo.notes.create", moduleCode: "mercadeo", effect: "deny", expiresAt: null }];
            f.state.rolePermissions = [{ code: "mercadeo.notes.read", moduleCode: "mercadeo", roleCode: "jefe_general" }];
            const profile = await f.repository.findBySessionTokenHash("hash");
            if (!profile) throw new Error("Expected active profile");
            expect(canUseNotes(profile, "mercadeo", "create")).toBe(false);
            expect(canUseNotes(profile, "formalizacion", "create")).toBe(true);
            expect(profile.permissions.find((p) => p.code === "mercadeo.notes.read")?.scope).toBe("own_area_and_children");
        } finally {
            await f.db.destroy();
        }
    });
    it("does not restore unregistered permissions or a module removed from the role ceiling", async () => {
        const f = fixture();
        try {
            f.state.activePermissions = f.state.activePermissions.filter((p) => p.code !== "mercadeo.notes.create");
            f.state.mappings = f.state.mappings.map((m) => (m.moduleCode === "formalizacion" ? { ...m, mappingStatus: "inactive" } : m));
            const profile = await f.repository.findBySessionTokenHash("hash");
            if (!profile) throw new Error("Expected active profile");
            expect(canUseNotes(profile, "mercadeo", "create")).toBe(false);
            expect(canUseNotes(profile, "mercadeo", "read")).toBe(true);
            expect(canUseNotes(profile, "formalizacion", "create")).toBe(false);
            const query = f.queries.find((q) => q.sql.includes("from `sec_permission`"));
            expect(query?.sql).toContain("`status_permission` = ?");
            expect(query?.parameters).toContain("active");
        } finally {
            await f.db.destroy();
        }
    });
    it("grants nothing with no effective modules and rejects inactive users", async () => {
        const f = fixture();
        try {
            f.state.modules = [];
            expect((await f.repository.findBySessionTokenHash("hash"))?.permissions).toEqual([]);
            f.state.userStatus = "inactive";
            expect(await f.repository.findBySessionTokenHash("hash")).toBeNull();
        } finally {
            await f.db.destroy();
        }
    });
});

describe("effective personal grants across modules and catalogs", () => {
    it.each(["formalizacion", "mercadeo"])("preserves direct capabilities in %s without matching role grants", async (moduleCode) => {
        const f = fixture();
        try {
            f.state.roles = [role(moduleCode)];
            f.state.modules = [moduleCode];
            const codes = ["catalog_bank.read", "catalog_project.read", "calendar.read", "notes.create", "home.stages.read", "orders.read"].map((action) => `${moduleCode}.${action}`);
            f.state.overrides = codes.map((code) => ({ code, moduleCode, effect: "allow", expiresAt: null }));
            const profile = await f.repository.findBySessionTokenHash("hash");
            const internal = await f.repository.findAuthorizationByUserPublicId("user");
            for (const target of [profile, internal]) {
                for (const code of codes) expect(target?.permissions).toContainEqual(expect.objectContaining({ code, effect: "allow", source: "override" }));
            }
        } finally {
            await f.db.destroy();
        }
    });
    it("keeps a direct deny and excludes a grant outside the assigned modules", async () => {
        const f = fixture();
        try {
            f.state.roles = [role("formalizacion")];
            f.state.modules = ["formalizacion"];
            f.state.rolePermissions = [{ code: "formalizacion.catalog_bank.read", moduleCode: "formalizacion", roleCode: "formalizacion" }];
            f.state.overrides = [
                { code: "formalizacion.catalog_bank.read", moduleCode: "formalizacion", effect: "deny", expiresAt: null },
                { code: "ventas.catalog_bank.read", moduleCode: "ventas", effect: "allow", expiresAt: null },
            ];
            const profile = await f.repository.findBySessionTokenHash("hash");
            expect(profile?.permissions).toContainEqual(expect.objectContaining({ code: "formalizacion.catalog_bank.read", effect: "deny" }));
            expect(profile?.permissions.some((permission) => permission.code === "ventas.catalog_bank.read")).toBe(false);
        } finally {
            await f.db.destroy();
        }
    });
});
