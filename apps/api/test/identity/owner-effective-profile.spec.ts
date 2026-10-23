import { type CompiledQuery, DummyDriver, Kysely, MysqlAdapter, MysqlIntrospector, MysqlQueryCompiler } from "kysely";
import { describe, expect, it, vi } from "vitest";

import { hasRoutePermission } from "../../src/common/security/route-permission.js";
import type { DatabaseService } from "../../src/database/database.service.js";
import type { CrmDatabase } from "../../src/database/database.types.js";
import { IdentityProfileRepository } from "../../src/modules/crm/identity/identity-profile.repository.js";
import { EffectivePermissionService } from "../../src/modules/crm/permissions/effective-permission.service.js";
import { HomeSummaryService } from "../../src/modules/crm/sales/sales-orders/home-summary.service.js";

const stagePermission = "formalizacion.home.stages.read";
const owner = { code: "owner", name: "Owner", status: "active", inheritanceMode: "all_active_roles" };

function fixture() {
    const queries: CompiledQuery[] = [];
    const state = {
        direct: [owner],
        active: [owner, { code: "formalizacion", name: "Formalizacion", status: "active" }, { code: "jefe_ventas", name: "Jefe Ventas", status: "active" }],
        deny: true,
        modules: [
            { code: "formalizacion", name: "Formalizacion", publicId: "formalizacion", status: "active" },
            { code: "mercadeo", name: "Mercadeo", publicId: "mercadeo", status: "active" },
        ],
    };
    const driver = new DummyDriver();
    driver.acquireConnection = async () => {
        const connection = await DummyDriver.prototype.acquireConnection.call(driver);
        // Independent query dispatch returns source rows without executing SQL or copying policy logic.
        // eslint-disable-next-line complexity
        connection.executeQuery = (query) => {
            queries.push(query);
            let rows: object[] = [];
            if (query.sql.includes("sec_auth_session"))
                rows = [{ authIdentityStatus: "active", currentProvider: "local", sessionPublicId: "session", sessionStatus: "active", sessionExpiresAt: new Date("2099-01-01Z"), sessionPermissionVersion: 1, userId: 1, userPublicId: "user", displayName: "Test", email: "test@example.test", userStatus: "active", permissionVersion: 1, profileImageUrl: null, microsoftHomeAccountId: null, microsoftInteractionRequiredAt: null, microsoftSyncedAt: null, microsoftTenantId: null }];
            else if (query.sql.includes("sec_user_permission_override")) rows = state.deny ? [{ code: stagePermission, effect: "deny", expiresAt: null }] : [];
            else if (query.sql.includes("sec_role_permission")) rows = [];
            else if (query.sql.includes("sec_user_role")) rows = state.direct;
            else if (query.sql.includes("sec_role")) rows = state.active;
            else if (query.sql.includes("sec_user_org_unit")) rows = [{ membership: "leader", scope: "all_areas", status: "active", code: "empresa", name: "Empresa", publicId: "empresa" }];
            else if (query.sql.includes("sec_org_unit")) rows = state.modules;
            else if (query.sql.includes("sec_permission")) rows = [{ code: stagePermission }, { code: "role.assign" }];
            else if (query.sql.includes("sec_auth_identity")) rows = [{ status_auth_identity: "active" }];
            return Promise.resolve({ rows: rows as never[] });
        };
        return connection;
    };
    const db = new Kysely<CrmDatabase>({ dialect: { createDriver: () => driver, createAdapter: () => new MysqlAdapter(), createIntrospector: (database) => new MysqlIntrospector(database), createQueryCompiler: () => new MysqlQueryCompiler() } });
    return { state, queries, db, repository: new IdentityProfileRepository({ db } as DatabaseService, new EffectivePermissionService()) };
}

describe("Owner effective profile from database policy", () => {
    it("exposes active modules with global scope even when the only direct membership is the company root", async () => {
        const f = fixture();
        try {
            const profile = await f.repository.findBySessionTokenHash("hash");
            expect(profile?.orgUnits.map((unit) => unit.code)).toEqual(["formalizacion", "mercadeo"]);
            expect(profile?.orgUnits.every((unit) => unit.scope === "all_areas")).toBe(true);
            expect(profile?.permissions.find((permission) => permission.code === stagePermission)?.effect).toBe("deny");
            const moduleQuery = f.queries.find((query) => query.sql.includes("from `sec_org_unit`"));
            expect(moduleQuery?.sql).toContain("`deleted_at_org_unit` is null");
        } finally {
            await f.db.destroy();
        }
    });
    it("inherits active roles through the persisted policy without writing assignments", async () => {
        const f = fixture();
        try {
            const profile = await f.repository.findBySessionTokenHash("hash");
            expect(profile?.roles).toEqual(f.state.active.map(({ code, name, status }) => ({ code, name, status })));
            const inherited = f.queries.find((query) => query.sql.includes("from `sec_role` as `role`"));
            expect(inherited?.sql).toContain("`role`.`status_role` = ?");
            expect(inherited?.sql).toContain("`role`.`deleted_at_role` is null");
            expect(f.queries.some((query) => /insert |update |delete /i.test(query.sql))).toBe(false);
        } finally {
            await f.db.destroy();
        }
    });
    it("applies a direct deny after all active Owner permissions", async () => {
        const f = fixture();
        try {
            const profile = await f.repository.findBySessionTokenHash("hash");
            expect(profile?.permissions.find((permission) => permission.code === stagePermission)).toMatchObject({ effect: "deny", source: "override" });
            expect(profile?.permissions.find((permission) => permission.code === "role.assign")).toMatchObject({ effect: "allow", source: "role" });
        } finally {
            await f.db.destroy();
        }
    });
    it("agrees between guard and summary service: an inherited role cannot bypass a direct stage deny", async () => {
        const f = fixture();
        try {
            const profile = await f.repository.findBySessionTokenHash("hash");
            if (!profile) throw new Error("Expected test profile");
            expect(hasRoutePermission(profile, { kind: "active-role", code: "formalizacion", permissionCodes: [stagePermission] }, {} as never)).toBe(false);
            const readSnapshot = vi.fn();
            const service = new HomeSummaryService({ getCurrentUser: () => Promise.resolve(profile) } as never, { readSnapshot } as never, {} as never);
            await expect(service.summary("session")).rejects.toMatchObject({ status: 403 });
            expect(readSnapshot).not.toHaveBeenCalled();
        } finally {
            await f.db.destroy();
        }
    });
    it("sees newly active roles on a subsequent read and loses inherited access when Owner is removed", async () => {
        const f = fixture();
        try {
            await f.repository.findBySessionTokenHash("hash");
            f.state.active.push({ code: "future_role", name: "Future", status: "active" });
            expect((await f.repository.findBySessionTokenHash("hash"))?.roles.some((role) => role.code === "future_role")).toBe(true);
            f.state.direct = [];
            f.state.deny = false;
            const profile = await f.repository.findBySessionTokenHash("hash");
            expect(profile?.roles).toEqual([]);
            expect(profile?.permissions).toEqual([]);
        } finally {
            await f.db.destroy();
        }
    });
    it("does not inherit when policy is assigned-only and excludes revoked role relations in SQL", async () => {
        const f = fixture();
        try {
            f.state.direct = [{ ...owner, inheritanceMode: "assigned" }];
            expect((await f.repository.findBySessionTokenHash("hash"))?.roles.map((role) => role.code)).toEqual(["owner"]);
            const direct = f.queries.find((query) => query.sql.includes("from `sec_user_role` as `userRole`") && !query.sql.includes("sec_role_permission"));
            expect(direct?.sql).toContain("`userRole`.`revoked_at_user_role` is null");
        } finally {
            await f.db.destroy();
        }
    });
});
