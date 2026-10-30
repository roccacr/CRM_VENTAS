import { type CompiledQuery, DummyDriver, Kysely, MysqlAdapter, MysqlIntrospector, MysqlQueryCompiler, type QueryResult } from "kysely";
import { expect, it } from "vitest";

import { marketingGlobalReadMigration } from "../../migrations/schema-only/202610290056_marketing_global_read.js";

function fixture(schema = "CRM_THINK_V2", existing?: { module: string; action: string; status: string }) {
    const queries: string[] = [];
    const driver = new DummyDriver();
    driver.acquireConnection = () =>
        Promise.resolve({
            executeQuery: <R>(query: CompiledQuery): Promise<QueryResult<R>> => {
                queries.push(query.sql);
                const rows = query.sql.includes("DATABASE() AS name")
                    ? [{ name: schema }]
                    : query.sql.includes("information_schema.TABLES")
                      ? [
                            { name: "sec_permission", engine: "InnoDB" },
                            { name: "audit_security_event", engine: "InnoDB" },
                        ]
                      : query.sql.includes("SELECT module_code_permission") && existing
                        ? [existing]
                        : [];
                return Promise.resolve({ rows: rows as R[] });
            },
            async *streamQuery() {
                yield await Promise.resolve({ rows: [] });
            },
        });
    return { queries, db: new Kysely<unknown>({ dialect: { createDriver: () => driver, createAdapter: () => new MysqlAdapter(), createIntrospector: (database) => new MysqlIntrospector(database), createQueryCompiler: () => new MysqlQueryCompiler() } }) };
}

it("adds only the native read permission and its audit without granting roles", async () => {
    const f = fixture();
    try {
        await marketingGlobalReadMigration.up(f.db);
        expect(f.queries.filter((query) => query.startsWith("INSERT INTO sec_permission"))).toHaveLength(1);
        expect(f.queries.filter((query) => query.startsWith("INSERT INTO audit_security_event"))).toHaveLength(1);
        expect(f.queries.join(" ")).not.toMatch(/sec_role_permission|sec_user_role|crmdatabase-api/);
    } finally {
        await f.db.destroy();
    }
});

it("preserves an existing matching permission without duplicate writes", async () => {
    const f = fixture("CRM_THINK_V2", { module: "mercadeo", action: "read", status: "active" });
    try {
        await marketingGlobalReadMigration.up(f.db);
        expect(f.queries.some((query) => query.startsWith("INSERT"))).toBe(false);
    } finally {
        await f.db.destroy();
    }
});

it("refuses another database before writing", async () => {
    const f = fixture("other_database");
    try {
        await expect(marketingGlobalReadMigration.up(f.db)).rejects.toThrow("requires CRM_THINK_V2");
        expect(f.queries.some((query) => query.startsWith("INSERT"))).toBe(false);
    } finally {
        await f.db.destroy();
    }
});

it("does not reactivate an explicitly disabled permission", async () => {
    const f = fixture("CRM_THINK_V2", { module: "mercadeo", action: "read", status: "inactive" });
    try {
        await expect(marketingGlobalReadMigration.up(f.db)).rejects.toThrow("conflicts");
        expect(f.queries.some((query) => /^(INSERT|UPDATE)/.test(query))).toBe(false);
    } finally {
        await f.db.destroy();
    }
});
