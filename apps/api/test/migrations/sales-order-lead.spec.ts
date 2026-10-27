import { type CompiledQuery, DummyDriver, Kysely, MysqlAdapter, MysqlIntrospector, MysqlQueryCompiler, type QueryResult } from "kysely";
import { describe, expect, it } from "vitest";

import { selectSchemaMigrations } from "../../scripts/run-schema-migrations.js";

const name = "202610260035_sales_order_lead";
const comment = "Lead nativo relacionado con la orden; nullable hasta contar con evidencia explicita";
const column = { column_type: "bigint unsigned", is_nullable: "YES", column_default: null, extra: "", column_comment: comment };
const index = { index_name: "ix_crm_sales_order_lead", column_name: "lead_id_sales_order", seq_in_index: 1, non_unique: 1, sub_part: null, index_type: "BTREE", is_visible: "YES" };
const foreignKey = { constraint_name: "fk_crm_sales_order_lead", column_name: "lead_id_sales_order", ordinal_position: 1, referenced_table_schema: "CRM_THINK_V2", referenced_table_name: "crm_lead", referenced_column_name: "id_lead", delete_rule: "RESTRICT", update_rule: "RESTRICT" };

function fixture(options: { database?: string; columns?: Record<string, unknown>[]; indexes?: Record<string, unknown>[]; keys?: Record<string, unknown>[]; tables?: Record<string, unknown>[] } = {}) {
    const queries: CompiledQuery[] = [];
    class Driver extends DummyDriver {
        override async acquireConnection() {
            const connection = await super.acquireConnection();
            connection.executeQuery = <R>(query: CompiledQuery): Promise<QueryResult<R>> => {
                queries.push(query);
                const inventory: [string, Record<string, unknown>[]][] = [
                    ["DATABASE() AS name", [{ name: options.database ?? "CRM_THINK_V2" }]],
                    ["information_schema.TABLES", options.tables ?? ["crm_sales_order", "crm_lead"].map((table_name) => ({ table_name, table_type: "BASE TABLE", engine: "InnoDB" }))],
                    ["information_schema.COLUMNS", options.columns ?? []],
                    ["information_schema.STATISTICS", options.indexes ?? []],
                    ["information_schema.KEY_COLUMN_USAGE", options.keys ?? []],
                ];
                const rows = inventory.find(([fragment]) => query.sql.includes(fragment))?.[1] ?? [];
                return Promise.resolve({ rows: rows as R[] });
            };
            return connection;
        }
    }
    const db = new Kysely<unknown>({ dialect: { createAdapter: () => new MysqlAdapter(), createDriver: () => new Driver(), createIntrospector: (database) => new MysqlIntrospector(database), createQueryCompiler: () => new MysqlQueryCompiler() } });
    return { db, queries };
}

describe("sales order native lead migration", () => {
    it("registers an individually selectable migration", () => {
        expect(selectSchemaMigrations(name).map((migration) => migration.name)).toEqual([name]);
    });
    it("adds only a nullable unsigned lead FK, nonunique index and column comment", async () => {
        const f = fixture();
        try {
            await selectSchemaMigrations(name)[0]?.up(f.db);
            const ddl = f.queries.filter((query) => query.sql.startsWith("ALTER TABLE"));
            expect(ddl).toHaveLength(1);
            expect(ddl[0]?.sql).toContain(`ADD COLUMN lead_id_sales_order BIGINT UNSIGNED NULL COMMENT '${comment}'`);
            expect(ddl[0]?.sql).toContain("ADD INDEX ix_crm_sales_order_lead (lead_id_sales_order)");
            expect(ddl[0]?.sql).toContain("REFERENCES crm_lead(id_lead) ON DELETE RESTRICT ON UPDATE RESTRICT");
            expect(f.queries.map((query) => query.sql).join("\n")).not.toMatch(/INSERT|UPDATE crm_|DELETE FROM|DROP |crmdatabase-api/i);
            expect(ddl[0]?.sql).not.toContain("DEFAULT");
        } finally {
            await f.db.destroy();
        }
    });
    it.each([{}, { columns: [column] }, { columns: [column], indexes: [index] }, { columns: [column], indexes: [index], keys: [foreignKey] }])("resumes compatible partial DDL and skips completed objects: %j", async (options) => {
        const f = fixture(options);
        try {
            await selectSchemaMigrations(name)[0]?.up(f.db);
            const ddl = f.queries
                .filter((query) => query.sql.startsWith("ALTER TABLE"))
                .map((query) => query.sql)
                .join("\n");
            expect(ddl.includes("ADD COLUMN")).toBe(!options.columns);
            expect(ddl.includes("ADD INDEX")).toBe(!("indexes" in options));
            expect(ddl.includes("ADD CONSTRAINT")).toBe(!("keys" in options));
        } finally {
            await f.db.destroy();
        }
    });
    it.each([
        { database: "crmdatabase-api" },
        { tables: [] },
        ...["column_type", "is_nullable", "column_default", "extra", "column_comment"].map((key) => ({ columns: [{ ...column, [key]: "drift" }] })),
        ...["index_name", "column_name", "seq_in_index", "non_unique", "sub_part", "index_type", "is_visible"].map((key) => ({ columns: [column], indexes: [{ ...index, [key]: "drift" }] })),
        ...Object.keys(foreignKey).map((key) => ({ columns: [column], keys: [{ ...foreignKey, [key]: "drift" }] })),
        { columns: [column], keys: [foreignKey, foreignKey] },
        { indexes: [index] },
    ])("fails closed before DDL for incompatible metadata: %j", async (options) => {
        const f = fixture(options);
        try {
            await expect(selectSchemaMigrations(name)[0]?.up(f.db)).rejects.toThrow();
            expect(f.queries.every((query) => query.sql.startsWith("SELECT"))).toBe(true);
        } finally {
            await f.db.destroy();
        }
    });
});
