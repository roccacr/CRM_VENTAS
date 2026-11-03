import { type CompiledQuery, DummyDriver, Kysely, MysqlAdapter, MysqlIntrospector, MysqlQueryCompiler, type QueryResult } from "kysely";
import { expect, it } from "vitest";

import type { CrmDatabase } from "../../src/database/database.types.js";
import { readLegacyLeadCommercial } from "../../src/integrations/legacy-crm/legacy-lead-commercial.query.js";

it.each(["opportunities", "estimates"] as const)("lee %s por referencia exacta y pagina registros reales", async (kind) => {
    const queries: CompiledQuery[] = [];
    const driver = new DummyDriver();
    driver.acquireConnection = async () => {
        const connection = await DummyDriver.prototype.acquireConnection.call(driver);
        connection.executeQuery = <R>(query: CompiledQuery): Promise<QueryResult<R>> => {
            queries.push(query);
            const rows = query.sql.includes("COUNT(*)") ? [{ total: 101 }] : [kind === "opportunities" ? { id_oport: "7", tranid_oport: "OP-7" } : { id_estimacion: "8", tranid_est: "EST-8" }];
            return Promise.resolve({ rows: rows as R[] });
        };
        return connection;
    };
    const db = new Kysely<CrmDatabase>({ dialect: { createDriver: () => driver, createAdapter: () => new MysqlAdapter(), createIntrospector: (database) => new MysqlIntrospector(database), createQueryCompiler: () => new MysqlQueryCompiler() } });
    try {
        const result = await db.transaction().execute((tx) => readLegacyLeadCommercial(tx, { source: "legacy", id: "12", internalId: "12", reference: "400", values: {} }, kind, 2));
        expect(result).toMatchObject({ total: 101, page: 2, hasMore: true, available: true });
        expect(result.items[0]?.fields).toContainEqual(expect.objectContaining({ value: kind === "opportunities" ? "OP-7" : "EST-8" }));
        expect(queries.every((query) => query.sql.startsWith("SELECT"))).toBe(true);
        expect(queries[1]?.parameters).toEqual(["400", 50]);
        expect(queries[1]?.sql).toContain(kind === "opportunities" ? "`entity_oport`" : "`idLead_est`");
        expect(queries[1]?.sql).not.toMatch(/SELECT \*/u);
    } finally {
        await db.destroy();
    }
});
