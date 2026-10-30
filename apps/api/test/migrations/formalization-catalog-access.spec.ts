import { type CompiledQuery, DummyDriver, Kysely, MysqlAdapter, MysqlIntrospector, MysqlQueryCompiler, type QueryResult } from "kysely";
import { expect, it } from "vitest";

import { formalizationCatalogAccessMigration as migration } from "../../migrations/schema-only/202610280050_formalization_catalog_access.js";
import { selectSchemaMigrations } from "../../scripts/run-schema-migrations.js";

function fixture({ database = "CRM_THINK_V2", grants = true, actor = true } = {}) {
    const queries: CompiledQuery[] = [];
    class Driver extends DummyDriver {
        override async acquireConnection() {
            const connection = await super.acquireConnection();
            connection.executeQuery = <R>(query: CompiledQuery): Promise<QueryResult<R>> => {
                queries.push(query);
                const rows = query.sql.includes("DATABASE()")
                    ? [{ name: database }]
                    : query.sql.startsWith("SELECT id_role")
                      ? [
                            { id: 85, code: "formalizacion" },
                            { id: 239, code: "jefe_formalizaciones" },
                        ]
                      : query.sql.startsWith("SELECT rp.id_role_permission") && grants
                        ? [{ id: 12, role: "formalizacion", code: "formalizacion.catalog_project.read" }]
                        : query.sql.startsWith("SELECT u.id_user") && actor
                          ? [{ id: 1 }]
                          : [];
                return Promise.resolve({ rows: rows as R[] });
            };
            return connection;
        }
    }
    const db = new Kysely<unknown>({ dialect: { createAdapter: () => new MysqlAdapter(), createDriver: () => new Driver(), createIntrospector: (database) => new MysqlIntrospector(database), createQueryCompiler: () => new MysqlQueryCompiler() } });
    return { db, queries };
}
it("is selectable without replaying other migrations", () => {
    expect(selectSchemaMigrations(migration.name)).toEqual([migration]);
});
it.each([true, false])("revokes active role grants only, with audit and version invalidation when changed: %s", async (grants) => {
    const f = fixture({ grants });
    try {
        await migration.up(f.db);
        const writes = f.queries.filter((q) => /^(UPDATE|INSERT|DELETE)/.test(q.sql));
        expect(writes).toHaveLength(grants ? 3 : 0);
        expect(f.queries.find((q) => q.sql.startsWith("SELECT rp.id_role_permission"))?.parameters).toEqual([85, 239]);
        expect(writes.find((q) => q.sql.startsWith("UPDATE sec_role_permission"))?.parameters).toEqual(grants ? [12] : undefined);
        expect(f.queries.every((q) => !q.sql.includes("sec_user_permission_override") && !q.sql.includes("crmdatabase-api") && !q.sql.startsWith("DELETE"))).toBe(true);
    } finally {
        await f.db.destroy();
    }
});
it.each([{ database: "crmdatabase-api" }, { actor: false }])("fails before writes for invalid destination or missing audit actor: %j", async (options) => {
    const f = fixture(options);
    try {
        await expect(migration.up(f.db)).rejects.toThrow();
        expect(f.queries.some((q) => /^(UPDATE|INSERT|DELETE)/.test(q.sql))).toBe(false);
    } finally {
        await f.db.destroy();
    }
});
