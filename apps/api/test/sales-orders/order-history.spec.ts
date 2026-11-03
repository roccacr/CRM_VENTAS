import { type CompiledQuery, DummyDriver, Kysely, MysqlAdapter, MysqlIntrospector, MysqlQueryCompiler, type Transaction } from "kysely";
import { expect, it } from "vitest";

import type { CrmDatabase } from "../../src/database/database.types.js";
import { displayOrderHistory, readOrderHistory } from "../../src/modules/crm/sales/sales-orders/order-history.query.js";
function fixture(responses: unknown[][]) {
    const queries: CompiledQuery[] = [];
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
const event = {
    eventKey: "audit:1",
    source: "native",
    action: "update",
    actor: { name: "Ana", password: "secret" },
    beforeSnapshot: { state: "contract_pending_send", password: "secret" },
    afterSnapshot: { state: "contract_pending_signature" },
    changes: [
        { path: "/state", before: "contract_pending_send", after: "contract_pending_signature", beforeExists: true, afterExists: true },
        { path: "/password", before: "secret", after: "secret", beforeExists: true, afterExists: true },
    ],
    sortAt: "2026-10-27 10:00:00.000000",
};
it("projects before/after evidence without secrets or request metadata", () => {
    const item = displayOrderHistory({ ...event, ip_address_record_event: "private" });
    expect(item.actorName).toBe("Ana");
    expect(item.changes).toHaveLength(1);
    expect(item.changes[0]).toMatchObject({ field: "state", before: "contract_pending_send", after: "contract_pending_signature" });
    expect(item.hiddenChanges).toBe(1);
    expect(JSON.stringify(item)).not.toContain("secret");
    expect(JSON.stringify(item)).not.toContain("private");
    expect(item.occurredAt).toBeNull();
});
it("reads native and explicitly linked legacy identity, deduplicating state and approval operations", async () => {
    const f = fixture([[{ legacyId: "208" }], [{ id: "nativeRecord" }, { id: "legacyRecord" }], [{ name: "audit_sales_order_state_event" }, { name: "conf_sales_order_state" }], [event]]);
    try {
        const result = await readOrderHistory(f.tx, "native", "7", { legacyEnabled: true });
        expect(result.items).toHaveLength(1);
        expect(result.coverage.legacyAvailable).toBe(true);
        const q = f.queries.at(-1);
        expect(q?.sql).toContain("UNION ALL");
        expect(q?.sql).toContain("SHA2");
        expect(q?.sql).toContain("NOT EXISTS");
        expect(q?.sql).toContain("audit_sales_order_approval_event");
        expect(q?.parameters).toContain("208");
        expect(q?.sql).toContain("LIMIT 51");
        expect(f.queries.every((q) => !/^\s*(INSERT|DELETE|UPDATE)/i.test(q.sql))).toBe(true);
    } finally {
        await f.db.destroy();
    }
});
it("still returns central audit when legacy has no state history tables", async () => {
    const f = fixture([[{ id: "record" }], [], [event]]);
    try {
        const result = await readOrderHistory(f.tx, "legacy", "208", { legacyEnabled: true });
        expect(result.items).toHaveLength(1);
        expect(result.coverage.legacyAvailable).toBe(false);
        expect(f.queries.at(-1)?.sql).not.toContain("`crmdatabase-api`.`audit_sales_order_state_event`");
    } finally {
        await f.db.destroy();
    }
});
it("has bounded pagination and refuses a cursor for another order", async () => {
    const rows = Array.from({ length: 51 }, (_, i) => ({ ...event, eventKey: "audit:" + String(i) }));
    const f = fixture([[], rows, []]);
    try {
        const result = await readOrderHistory(f.tx, "legacy", "208", { legacyEnabled: false });
        expect(result.items).toHaveLength(50);
        expect(result.hasMore).toBe(true);
        expect(result.nextCursor).toBeTruthy();
        await expect(readOrderHistory(f.tx, "legacy", "209", { legacyEnabled: false, cursor: result.nextCursor ?? "" })).rejects.toThrow("Cursor");
    } finally {
        await f.db.destroy();
    }
});
it("native-only mode never touches legacy tables and pages with a deterministic tie break", async () => {
    const cursor = Buffer.from(JSON.stringify({ order: "native:7", date: "2026-10-27 10:00:00.000000", key: "audit:x" })).toString("base64url");
    const f = fixture([[{ legacyId: null }], [], []]);
    try {
        await readOrderHistory(f.tx, "native", "7", { legacyEnabled: false, cursor });
        expect(f.queries.every((q) => !q.sql.includes("`crmdatabase-api`"))).toBe(true);
        expect(f.queries.at(-1)?.parameters).toContain("audit:x");
        expect(f.queries.at(-1)?.sql).toContain("eventKey<");
    } finally {
        await f.db.destroy();
    }
});

it("does not expose nested arbitrary changes under a public scalar field", () => {
    const item = displayOrderHistory({ ...event, changes: [{ path: "/state/password", before: "secret", after: "secret", beforeExists: true, afterExists: true }] });
    expect(item.changes).toEqual([]);
    expect(item.hiddenChanges).toBe(1);
    expect(JSON.stringify(item)).not.toContain("secret");
});
it.each([false, true])("filters addendum-only audit evidence according to the independent marker permission=%s", async (canReadAddendum) => {
    const f = fixture([[], []]);
    try {
        await readOrderHistory(f.tx, "legacy", "208", { legacyEnabled: false, canReadAddendum });
        const query = f.queries.at(-1);
        expect(query?.sql).toContain("e.operation_id_record_event NOT LIKE 'addendum:%'");
        expect(query?.parameters).toContain(canReadAddendum);
    } finally {
        await f.db.destroy();
    }
});
