import { DummyDriver, Kysely, MysqlAdapter, MysqlIntrospector, MysqlQueryCompiler } from "kysely";
import { describe, expect, it } from "vitest";

import type { IdentityProfile } from "../../src/modules/crm/identity/identity.types.js";
import { IdentityAccessManagementRepository } from "../../src/modules/crm/identity/identity-access-management.repository.js";

const code = "formalizacion.orders.addendum.mark_pending";
function fixture(granted: boolean) {
    const driver = new DummyDriver();
    driver.acquireConnection = async () => {
        const connection = await DummyDriver.prototype.acquireConnection.call(driver);
        connection.executeQuery = (query) => {
            const definitions = [
                { code, moduleCode: "formalizacion" },
                { code: "role.assign", moduleCode: "role" },
            ];
            const responses: [string, object[]][] = [
                ["sec_role_module", []],
                ["sec_role_permission", granted ? [definitions[0] as object] : []],
                ["from `sec_role`", [{ id: 1, code: "owner", name: "Owner", status: "active", permissionInheritance: "assigned" }]],
                ["from `sec_permission`", definitions],
            ];
            return Promise.resolve({ rows: (responses.find(([fragment]) => query.sql.includes(fragment))?.[1] ?? []) as never[] });
        };
        return connection;
    };
    const db = new Kysely({ dialect: { createDriver: () => driver, createAdapter: () => new MysqlAdapter(), createIntrospector: (database) => new MysqlIntrospector(database), createQueryCompiler: () => new MysqlQueryCompiler() } });
    return { db, repository: new IdentityAccessManagementRepository({ db } as never, {} as never, {} as never) };
}

describe("excepción explícita de marcado manual de adéndum", () => {
    it.each([false, true])("el editor de Owner refleja el grant real: %s", async (granted) => {
        const f = fixture(granted);
        try {
            const role = await f.repository.readRolePermissions("owner");
            expect(role.permissionCodes.includes(code)).toBe(granted);
            expect(role.permissionCodes).toContain("role.assign");
        } finally {
            await f.db.destroy();
        }
    });
    it("un administrador con role.assign puede asignar la excepción personal sin ejecutar la acción", async () => {
        const f = fixture(false);
        try {
            const profile = { roles: [], orgUnits: [], permissions: [{ code: "role.assign", effect: "allow" }] } as unknown as IdentityProfile;
            await expect(f.repository.assertDelegableAccess(profile, [], [], [{ code, effect: "allow" }])).resolves.toBeUndefined();
            await expect(f.repository.assertDelegableAccess(profile, [], [], [{ code: "other.sensitive.action", effect: "allow" }])).rejects.toMatchObject({ status: 403 });
            profile.permissions.push({ code: "role.assign", effect: "deny" } as never);
            await expect(f.repository.assertDelegableAccess(profile, [], [], [{ code, effect: "allow" }])).rejects.toMatchObject({ status: 403 });
        } finally {
            await f.db.destroy();
        }
    });
});
