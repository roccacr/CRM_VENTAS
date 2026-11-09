import { DummyDriver, Kysely, MysqlAdapter, MysqlIntrospector, MysqlQueryCompiler } from "kysely";
import { describe, expect, it } from "vitest";

import { contractPermissionsMigration } from "../../migrations/schema-only/202610220025_contract_permissions.js";
import { anyOf } from "../support/throws.js";

function setup(options: { destination?: string; revoked?: boolean; conflict?: boolean } = {}) {
    const queries: { sql: string; parameters: readonly unknown[] }[] = [];
    const responses: [RegExp, () => object[]][] = [
        [/SELECT DATABASE/, () => [{ name: options.destination ?? "CRM_THINK_V2" }]],
        [/SELECT id_role AS id/, () => [{ id: 3, status: "active", deleted: null }]],
        [/SELECT u.id_user AS id/, () => [{ id: 1, publicId: "owner", name: "Owner" }]],
        [/SELECT module_code_permission/, () => (options.conflict ? [{ module: "wrong", action: "send", status: "active" }] : [])],
        [/SELECT p.code_permission/, () => (options.revoked ? [{ code: "formalizacion.contracts.send", status: "inactive" }] : [])],
    ];
    const driver = new DummyDriver();
    driver.acquireConnection = async () => {
        const connection = await DummyDriver.prototype.acquireConnection.call(driver);
        connection.executeQuery = (query) => {
            queries.push(query);
            return Promise.resolve({ rows: (responses.find(([pattern]) => pattern.test(query.sql))?.[1]() ?? []) as never[] });
        };
        return connection;
    };
    const db = new Kysely<unknown>({ dialect: { createDriver: () => driver, createAdapter: () => new MysqlAdapter(), createIntrospector: (database) => new MysqlIntrospector(database), createQueryCompiler: () => new MysqlQueryCompiler() } });
    return { db, queries };
}

describe("contract permissions migration", () => {
    it("registers both actions but grants only sending to the base role, retaining user overrides", async () => {
        const f = setup();
        try {
            await contractPermissionsMigration.up(f.db);
            const definitions = f.queries.filter((query) => query.sql.startsWith("INSERT INTO sec_permission"));
            expect(definitions.map((query) => query.parameters[0])).toEqual(["formalizacion.contracts.send", "formalizacion.contracts.revert"]);
            const grants = f.queries.filter((query) => query.sql.startsWith("INSERT INTO sec_role_permission"));
            expect(grants).toHaveLength(1);
            expect(grants[0]?.parameters).toEqual([3, "formalizacion.contracts.send"]);
            expect(f.queries.some((query) => query.sql.startsWith("INSERT INTO audit_security_event"))).toBe(true);
            expect(f.queries.map((query) => query.sql).join("\n")).not.toMatch(/UPDATE sec_user_permission|DELETE|crmdatabase-api/);
        } finally {
            await f.db.destroy();
        }
    });
    it.each([{ destination: "crmdatabase-api" }, { revoked: true }, { conflict: true }])("rejects wrong destination or revoked/conflicting configuration: %j", async (options) => {
        const f = setup(options);
        try {
            await expect(contractPermissionsMigration.up(f.db)).rejects.toThrow(anyOf("Contract permissions require CRM_THINK_V2", "Previously revoked contract grant requires explicit reconciliation", "Contract permission conflicts with existing configuration"));
            expect(f.queries.some((query) => query.sql.startsWith("INSERT INTO sec_role_permission"))).toBe(false);
        } finally {
            await f.db.destroy();
        }
    });
});
