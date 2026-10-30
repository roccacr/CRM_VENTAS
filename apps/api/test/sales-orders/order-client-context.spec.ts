import { DummyDriver, Kysely, MysqlAdapter, MysqlIntrospector, MysqlQueryCompiler, type Transaction } from "kysely";
import { expect, it } from "vitest";

import type { CrmDatabase } from "../../src/database/database.types.js";
import { displayClientHistory, normalizeLeadStatus, readOrderClientContext } from "../../src/modules/crm/sales/sales-orders/order-client-context.query.js";

it.each([
    ["legacy", 1, "active"],
    ["legacy", 0, "inactive"],
    ["native", "active", "active"],
    ["native", "inactive", "inactive"],
    ["native", "1", "unknown"],
] as const)("normalizes %s validity %s", (source, value, code) => {
    expect(normalizeLeadStatus(source, value).code).toBe(code);
});
it("does not expose raw snapshots or invent legacy dates and actors", () => {
    const item = displayClientHistory({ eventKey: "legacy:1", source: "legacy", reasonId: 58, reasonName: "Cierre Firmado\r\n", detail: "Nota", sourceDate: "2026-10-01 10:00:00", snapshot: { password: "secret" } });
    expect(item.reason).toEqual({ code: "legacy:58", name: "Cierre Firmado" });
    expect(item.occurredAt).toBeNull();
    expect(item.actorName).toBeNull();
    expect(JSON.stringify(item)).not.toContain("secret");
});
function fixture(responses: unknown[][]) {
    const queries: { sql: string; parameters: readonly unknown[] }[] = [];
    const driver = new DummyDriver();
    driver.acquireConnection = async () => {
        const connection = await DummyDriver.prototype.acquireConnection.call(driver);
        connection.executeQuery = (q) => {
            queries.push(q);
            return Promise.resolve({ rows: (responses.shift() ?? []) as never[] });
        };
        return connection;
    };
    const db = new Kysely<CrmDatabase>({ dialect: { createDriver: () => driver, createAdapter: () => new MysqlAdapter(), createIntrospector: (instance) => new MysqlIntrospector(instance), createQueryCompiler: () => new MysqlQueryCompiler() } });
    return { db, queries, tx: db as unknown as Transaction<CrmDatabase> };
}
it("reads bounded legacy history by internal lead reference and normalizes the current classification", async () => {
    const f = fixture([[], [{ eventKey: "legacy:2", source: "legacy", sortAt: "2026-01-01", reasonId: 58, reasonName: "Cierre Firmado" }], [{ code: "legacy:58", name: "Cierre Firmado\r\n" }]]);
    try {
        const result = await readOrderClientContext(f.tx, { source: "legacy", lead: { sourceFields: { id_lead: 40440, idinterno_lead: 4312475, estado_lead: 1, id_Caida: 58 } } }, { legacyEnabled: true });
        expect(result.status.label).toBe("Activo");
        expect(result.followUpReason?.name).toBe("Cierre Firmado");
        expect(result.history.items).toHaveLength(1);
        const q = f.queries[1];
        expect(q?.sql).toContain("LIMIT 51");
        expect(q?.parameters).toContain(4312475);
        expect(q?.sql).toContain("NOT EXISTS");
        expect(f.queries.every((q) => !/^\s*(INSERT|UPDATE|DELETE)/i.test(q.sql))).toBe(true);
    } finally {
        await f.db.destroy();
    }
});
it("native-only history never reads legacy tables and rejects another client's cursor", async () => {
    const f = fixture([[], [], []]);
    try {
        await readOrderClientContext(f.tx, { source: "native", lead: { sourceFields: { id_lead: 7, status_lead: "active" } } }, { legacyEnabled: false });
        expect(f.queries.every((q) => !q.sql.includes("`crmdatabase-api`"))).toBe(true);
        const count = f.queries.length;
        await expect(readOrderClientContext(f.tx, { source: "native", lead: { sourceFields: { id_lead: 7 } } }, { legacyEnabled: false, cursor: Buffer.from(JSON.stringify({ lead: "native:8", before: "x", key: "x" })).toString("base64url") })).rejects.toThrow("Cursor");
        expect(f.queries).toHaveLength(count);
    } finally {
        await f.db.destroy();
    }
});
it("paginates without truncating history silently", async () => {
    const rows = Array.from({ length: 51 }, (_, i) => ({ eventKey: "native:" + String(i), source: "native", sortAt: "2026-10-01", actor: null, snapshot: null }));
    const f = fixture([[], rows, []]);
    try {
        const result = await readOrderClientContext(f.tx, { source: "native", lead: { sourceFields: { id_lead: 7, status_lead: "active" } } }, { legacyEnabled: false });
        expect(result.history.items).toHaveLength(50);
        expect(result.history.hasMore).toBe(true);
        expect(result.history.nextCursor).toBeTruthy();
    } finally {
        await f.db.destroy();
    }
});
