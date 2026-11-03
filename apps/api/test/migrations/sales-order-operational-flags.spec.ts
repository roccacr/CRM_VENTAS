import { type CompiledQuery, DummyDriver, Kysely, MysqlAdapter, MysqlIntrospector, MysqlQueryCompiler, type QueryResult } from "kysely";
import { describe, expect, it } from "vitest";

import { planSalesOrderFlags, salesOrderFlagColumns, salesOrderOperationalFlagsMigration } from "../../migrations/schema-only/202610300057_sales_order_operational_flags.js";
import { runLegacySalesOrderFlags } from "../../scripts/migrate-legacy-sales-order-flags.js";
import { selectSchemaMigrations } from "../../scripts/run-schema-migrations.js";

function fixture(source: "native" | "legacy", existing = false, drift = false, wrongDatabase = false) {
    const queries: CompiledQuery[] = [];
    const database = source === "native" ? "CRM_THINK_V2" : "crmdatabase-api";
    let added = existing;
    class Driver extends DummyDriver {
        override async acquireConnection() {
            const connection = await super.acquireConnection();
            connection.executeQuery = <R>(query: CompiledQuery): Promise<QueryResult<R>> => {
                queries.push(query);
                if (query.sql.startsWith("ALTER TABLE")) added = true;
                let rows: unknown[] = [];
                if (query.sql.includes("GET_LOCK")) rows = [{ acquired: 1 }];
                else if (query.sql.includes("DATABASE() AS name")) rows = [{ name: wrongDatabase ? "other" : database }];
                else if (query.sql.includes("information_schema.TABLES")) rows = [{ engine: "InnoDB", kind: "BASE TABLE" }];
                else if (query.sql.includes("information_schema.COLUMNS") && added) rows = salesOrderFlagColumns.map((column) => ({ name: column[source], type: drift ? "varchar(10)" : source === "native" ? "enum('yes','no','unknown')" : "tinyint unsigned", nullable: source === "native" ? "NO" : "YES", defaultValue: source === "native" ? "unknown" : null }));
                return Promise.resolve({ rows: rows as R[] });
            };
            return connection;
        }
    }
    return { queries, db: new Kysely<unknown>({ dialect: { createAdapter: () => new MysqlAdapter(), createDriver: () => new Driver(), createIntrospector: (db) => new MysqlIntrospector(db), createQueryCompiler: () => new MysqlQueryCompiler() } }) };
}

describe("additive operational sales order flags", () => {
    it.each([false, true])("legacy holds and releases its lock; only apply=%s executes DDL", async (apply) => {
        const { db, queries } = fixture("legacy");
        try {
            expect(await runLegacySalesOrderFlags(db, apply)).toHaveLength(1);
            expect(queries.filter((q) => q.sql.startsWith("ALTER TABLE"))).toHaveLength(apply ? 1 : 0);
            expect(queries.at(-1)?.sql).toContain("RELEASE_LOCK");
        } finally {
            await db.destroy();
        }
    });
    it("releases the legacy lock when destination validation fails", async () => {
        const { db, queries } = fixture("legacy", false, false, true);
        try {
            await expect(runLegacySalesOrderFlags(db, true)).rejects.toThrow("destination");
            expect(queries.filter((q) => q.sql.startsWith("ALTER TABLE"))).toHaveLength(0);
            expect(queries.at(-1)?.sql).toContain("RELEASE_LOCK");
        } finally {
            await db.destroy();
        }
    });
    it.each(["native", "legacy"] as const)("plans only seven missing columns with unknown defaults: %s", async (source) => {
        const { db } = fixture(source);
        try {
            const plan = await planSalesOrderFlags(db, source);
            expect(plan).toHaveLength(1);
            expect(plan[0]?.match(/ADD COLUMN/g)).toHaveLength(7);
            expect(plan[0]).toContain("ALGORITHM=INSTANT");
            expect(plan[0]).not.toMatch(/\b(DROP|MODIFY|CHANGE|UPDATE|DELETE|INSERT|TRUNCATE)\b/i);
            expect(plan[0]).not.toContain("ADD COLUMN `pagadas_ov`");
            expect(plan[0]).toContain(source === "native" ? "DEFAULT 'unknown'" : "DEFAULT NULL");
        } finally {
            await db.destroy();
        }
    });
    it.each(["native", "legacy"] as const)("rejects schema drift before proposing changes: %s", async (source) => {
        const { db } = fixture(source, true, true);
        try {
            await expect(planSalesOrderFlags(db, source)).rejects.toThrow("column drift");
        } finally {
            await db.destroy();
        }
    });
    it.each(["native", "legacy"] as const)("rejects a different destination: %s", async (source) => {
        const { db } = fixture(source, false, false, true);
        try {
            await expect(planSalesOrderFlags(db, source)).rejects.toThrow("destination");
        } finally {
            await db.destroy();
        }
    });
    it("is registered, verifies the result and is idempotent", async () => {
        const { db, queries } = fixture("native");
        try {
            expect(selectSchemaMigrations(salesOrderOperationalFlagsMigration.name)).toEqual([salesOrderOperationalFlagsMigration]);
            await salesOrderOperationalFlagsMigration.up(db);
            await salesOrderOperationalFlagsMigration.up(db);
            expect(queries.filter((q) => q.sql.startsWith("ALTER TABLE"))).toHaveLength(1);
        } finally {
            await db.destroy();
        }
    });
});
