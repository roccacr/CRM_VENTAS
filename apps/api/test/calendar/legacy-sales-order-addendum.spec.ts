import { type CompiledQuery, DummyDriver, Kysely, MysqlAdapter, MysqlIntrospector, MysqlQueryCompiler, type QueryResult } from "kysely";
import { expect, it } from "vitest";

import type { CrmDatabase } from "../../src/database/database.types.js";
import { LegacySalesOrderAddendumWriter } from "../../src/integrations/legacy-crm/legacy-sales-order-addendum.writer.js";

function setup(options: { fallback?: boolean; writes?: boolean; schema?: string; duplicateLead?: boolean } = {}) {
    const config = { ENABLE_LEGACY_FALLBACK: options.fallback ?? true, ENABLE_LEGACY_WRITES: options.writes ?? true, LEGACY_CRM_DB_NAME: options.schema ?? "crmdatabase-api" };
    const queries: CompiledQuery[] = [];
    const driver = new DummyDriver();
    driver.acquireConnection = async () => {
        const connection = await DummyDriver.prototype.acquireConnection.call(driver);
        connection.executeQuery = <R>(query: CompiledQuery): Promise<QueryResult<R>> => {
            queries.push(query);
            const row = { id: "78", internalId: "78", active: 1, status: null, version: 0, changedAt: null, leadErpId: 100 };
            const rows = query.sql.includes("FROM `crmdatabase-api`.ordenventa") ? [row] : query.sql.includes("FROM `crmdatabase-api`.leads") ? [{ id: "99" }, ...(options.duplicateLead ? [{ id: "100" }] : [])] : [];
            return Promise.resolve({ rows: rows as R[] });
        };
        return connection;
    };
    const db = new Kysely<CrmDatabase>({ dialect: { createDriver: () => driver, createAdapter: () => new MysqlAdapter(), createIntrospector: (database) => new MysqlIntrospector(database), createQueryCompiler: () => new MysqlQueryCompiler() } });
    const writer = new LegacySalesOrderAddendumWriter({ get: (key: keyof typeof config) => config[key] } as never);
    return { db, writer, queries };
}
it("uses the supplied native transaction for legacy writes, and never writes lead data", async () => {
    const f = setup();
    try {
        await f.db.transaction().execute(async (tx) => {
            const row = await f.writer.read(tx, "78", true);
            if (!row) throw new Error("Expected fixture order");
            expect(row).toMatchObject({ source: "legacy", lead: { source: "legacy", id: "99" }, status: null, version: 0 });
            await f.writer.write(tx, row, { status: "pending", version: 1, changedAt: "2026-11-03T12:00:00.000Z", note: null });
        });
        const writes = f.queries.filter((query) => query.sql.startsWith("UPDATE"));
        expect(writes).toHaveLength(1);
        expect(writes[0]?.sql).toContain("UPDATE `crmdatabase-api`.ordenventa SET estado_adendum_ov=");
        expect(f.queries[0]?.sql).toMatch(/FOR UPDATE$/);
    } finally {
        await f.db.destroy();
    }
});
it.each([{ fallback: false }, { schema: "wrong" }])("requires exact legacy read opt-in: %j", async (options) => {
    const f = setup(options);
    try {
        await expect(f.db.transaction().execute((tx) => f.writer.read(tx, "78", false))).rejects.toMatchObject({ status: 503 });
        expect(f.queries).toHaveLength(0);
    } finally {
        await f.db.destroy();
    }
});
it("allows read-only fallback but rejects legacy mutations without the write gate", async () => {
    const f = setup({ writes: false });
    try {
        await f.db.transaction().execute(async (tx) => {
            const row = await f.writer.read(tx, "78", false);
            if (!row) throw new Error("Expected fixture order");
            await expect(f.writer.write(tx, row, { status: "completed", version: 1, changedAt: "2026-11-03T12:00:00.000Z", note: null })).rejects.toMatchObject({ status: 503 });
        });
        expect(f.queries.some((query) => query.sql.startsWith("UPDATE"))).toBe(false);
    } finally {
        await f.db.destroy();
    }
});
it("does not guess a client when legacy source IDs are ambiguous", async () => {
    const f = setup({ duplicateLead: true });
    try {
        expect(await f.db.transaction().execute((tx) => f.writer.read(tx, "78", true))).toMatchObject({ lead: null });
    } finally {
        await f.db.destroy();
    }
});
