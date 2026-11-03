import { type CompiledQuery, DummyDriver, Kysely, MysqlAdapter, MysqlIntrospector, MysqlQueryCompiler, type QueryResult } from "kysely";
import { expect, it } from "vitest";

import type { CrmDatabase } from "../../src/database/database.types.js";
import type { LegacyCrmDatabaseService } from "../../src/integrations/legacy-crm/legacy-crm-database.service.js";
import { LegacyLeadProfileReader } from "../../src/integrations/legacy-crm/legacy-lead-profile.reader.js";

function database(answer: (sql: string) => object[]) {
    const queries: CompiledQuery[] = [];
    const driver = new DummyDriver();
    driver.acquireConnection = async () => {
        const connection = await DummyDriver.prototype.acquireConnection.call(driver);
        connection.executeQuery = <R>(query: CompiledQuery): Promise<QueryResult<R>> => {
            queries.push(query);
            return Promise.resolve({ rows: answer(query.sql) as R[] });
        };
        return connection;
    };
    const db = new Kysely<CrmDatabase>({ dialect: { createDriver: () => driver, createAdapter: () => new MysqlAdapter(), createIntrospector: (name) => new MysqlIntrospector(name), createQueryCompiler: () => new MysqlQueryCompiler() } });
    return { db, queries, reader: new LegacyLeadProfileReader({ isConfigured: () => true } as LegacyCrmDatabaseService) };
}
const lead = { source: "legacy" as const, id: "12", internalId: "12", reference: "400", values: {} };

it("toma el nombre del corredor de su catálogo y no del texto suelto del perfil ampliado", async () => {
    const f = database((sql) => (sql.includes("info_extra_lead") ? [{ identification: "801290689" }] : sql.includes("fullName") ? [{ id: "12", reference: "400", fullName: "Ana", broker: "Marielos Carmona" }] : [{ id: "12" }]));
    try {
        const found = await f.db.transaction().execute((tx) => f.reader.find(tx, "id", "12"));
        expect(found?.values).toMatchObject({ broker: "Marielos Carmona", identification: "801290689" });
        const main = f.queries.find((query) => query.sql.includes("AS fullName"));
        expect(main?.sql).toContain("corredores");
        expect(main?.sql).toContain("bk.id_corredor=l.id_corredor");
        expect(f.queries.find((query) => query.sql.includes("info_extra_lead"))?.sql).not.toContain("Corredor_lead");
    } finally {
        await f.db.destroy();
    }
});
it("lee los eventos del cliente por su referencia y omite los ya migrados al calendario nuevo", async () => {
    const rows = [{ id: "5", source: "legacy", title: "Cita", type: "Cita", status: "Pendiente", date: "2024-02-20", startTime: "10:00", endTime: "11:00" }];
    const f = database(() => rows);
    try {
        const page = await f.db.transaction().execute((tx) => f.reader.events(tx, lead, 2));
        expect(page).toEqual({ items: rows, hasMore: false, page: 2 });
        expect(f.queries[0]?.sql).toContain("calendars");
        expect(f.queries[0]?.sql).toContain("legacy_calendar_id_calendar_event=c.id_calendar");
        expect(f.queries[0]?.parameters).toEqual(["400", 50]);
        expect(f.queries[0]?.sql.startsWith("SELECT")).toBe(true);
        expect(await f.db.transaction().execute((tx) => f.reader.events(tx, { ...lead, reference: null }, 1))).toEqual({ items: [], hasMore: false, page: 1 });
    } finally {
        await f.db.destroy();
    }
});
