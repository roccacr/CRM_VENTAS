import { type CompiledQuery, DummyDriver, Kysely, MysqlAdapter, MysqlIntrospector, MysqlQueryCompiler, type QueryResult } from "kysely";
import { describe, expect, it } from "vitest";

import { planBankingInProgressStage, planPurchaseFundsColumn } from "../../migrations/schema-only/202611020062_formalization_purchase_funds.js";
import { runLegacyPurchaseFunds } from "../../scripts/migrate-legacy-purchase-funds.js";

function fixture(source: "native" | "legacy", { existing = false, drift = false, wrong = false, existingStage = false }: { existing?: boolean; drift?: boolean; wrong?: boolean; existingStage?: boolean } = {}) {
    const queries: CompiledQuery[] = [];
    const responses: [string, () => object[]][] = [
        ["GET_LOCK", () => [{ acquired: 1 }]],
        ["SELECT DATABASE()", () => [{ name: wrong ? "other" : { native: "CRM_THINK_V2", legacy: "crmdatabase-api" }[source] }]],
        ["information_schema.TABLES", () => [{ engine: "InnoDB", kind: "BASE TABLE" }]],
        ["information_schema.COLUMNS", () => (existing ? [{ type: drift ? "varchar(32)" : "enum('own_funds','bank_financing')", nullable: "YES", defaultValue: null }] : [])],
        ["FROM conf_sales_order_state", () => [{ code: "bank_management", name: "Gestion bancaria", position: 4 }, ...(existingStage ? [{ code: "bank_management_in_progress", name: "Gestión bancaria en proceso", position: 5 }] : [])]],
    ];
    class Driver extends DummyDriver {
        override async acquireConnection() {
            const connection = await super.acquireConnection();
            connection.executeQuery = <R>(query: CompiledQuery): Promise<QueryResult<R>> => {
                queries.push(query);
                const rows = responses.find(([fragment]) => query.sql.includes(fragment))?.[1]() ?? [];
                return Promise.resolve({ rows: rows as R[] });
            };
            return connection;
        }
    }
    return { queries, db: new Kysely<unknown>({ dialect: { createAdapter: () => new MysqlAdapter(), createDriver: () => new Driver(), createIntrospector: (db) => new MysqlIntrospector(db), createQueryCompiler: () => new MysqlQueryCompiler() } }) };
}

describe("explicit purchase funds schema", () => {
    it.each(["native", "legacy"] as const)("provisions the stage in its own catalog and preserves existing visits: %s", async (source) => {
        for (const exists of [false, true]) {
            const { db } = fixture(source, { existingStage: exists });
            try {
                const plan = await planBankingInProgressStage(db, source);
                expect(plan).toHaveLength(exists ? 0 : 2);
                if (!exists) {
                    expect(plan[1]).toContain("'bank_management_in_progress','Gestión bancaria en proceso',5");
                    expect(plan.join(";")).not.toContain("audit_sales_order_state_event");
                }
            } finally {
                await db.destroy();
            }
        }
    });
    it.each([false, true])("legacy plans the field and referenced stage; apply=%s writes both", async (apply) => {
        const { db, queries } = fixture("legacy");
        try {
            expect(await runLegacyPurchaseFunds(db, apply)).toHaveLength(3);
            expect(queries.filter((query) => /^(ALTER TABLE|UPDATE conf_sales_order_state|INSERT INTO conf_sales_order_state)/.test(query.sql))).toHaveLength(apply ? 3 : 0);
            expect(queries.at(-1)?.sql).toContain("RELEASE_LOCK");
        } finally {
            await db.destroy();
        }
    });
    it.each(["native", "legacy"] as const)("adds only a nullable choice without selecting funds: %s", async (source) => {
        const { db } = fixture(source);
        try {
            const plan = await planPurchaseFundsColumn(db, source);
            expect(plan).toHaveLength(1);
            expect(plan[0]).toContain("ENUM('own_funds','bank_financing') NULL DEFAULT NULL");
            expect(plan[0]).toContain(source === "native" ? "purchase_funds_origin_sales_order" : "origen_fondos_compra_ov");
            expect(plan[0]).toContain("ALGORITHM=INSTANT");
            expect(plan[0]).not.toMatch(/\b(UPDATE|DELETE|DROP|INSERT|TRIGGER)\b/i);
        } finally {
            await db.destroy();
        }
    });
    it.each(["native", "legacy"] as const)("preserves existing exact fields and rejects drift/wrong database: %s", async (source) => {
        for (const [existing, drift, wrong] of [
            [true, false, false],
            [true, true, false],
            [false, false, true],
        ] as const) {
            const { db } = fixture(source, { existing, drift, wrong });
            try {
                if (drift || wrong) await expect(planPurchaseFundsColumn(db, source)).rejects.toThrow();
                else expect(await planPurchaseFundsColumn(db, source)).toEqual([]);
            } finally {
                await db.destroy();
            }
        }
    });
});
