import { type CompiledQuery, DummyDriver, Kysely, MysqlAdapter, MysqlIntrospector, MysqlQueryCompiler, type QueryResult, type Transaction } from "kysely";
import { expect, it, vi } from "vitest";

import type { CrmDatabase } from "../../src/database/database.types.js";
import type { RecordAuditInput } from "../../src/modules/crm/audit/record-audit.service.js";
import type { AddendumOrder, FutureAddendum } from "../../src/modules/crm/sales/sales-orders/sales-order-addendum.port.js";
import { SalesOrderAddendumRepository } from "../../src/modules/crm/sales/sales-orders/sales-order-addendum.repository.js";

const id = "01ARZ3NDEKTSV4RRFFQ69G5FAV";
const leadId = "01ARZ3NDEKTSV4RRFFQ69G5FAX";
const operationId = "550e8400-e29b-41d4-a716-446655440000";
const before: AddendumOrder = { source: "native", id, internalId: "7", active: true, status: "pending", version: 3, changedAt: "2026-11-03T12:00:00.000Z", note: null, lead: { source: "native", id: leadId } };

function setup(options: { legacy?: boolean; absent?: boolean; inactive?: boolean; ambiguous?: boolean; failAudit?: boolean; future?: FutureAddendum; status?: AddendumOrder["status"] } = {}) {
    const queries: CompiledQuery[] = [];
    const steps: string[] = [];
    let order: AddendumOrder = { ...before, ...(options.legacy ? { source: "legacy", id: "78", internalId: "78", lead: { source: "legacy", id: "99" } } : {}), ...(options.status === undefined ? {} : { status: options.status }), active: !options.inactive };
    let initial = structuredClone(order);
    const entries = new Map<string, Record<string, unknown>>();
    const driver = new DummyDriver();
    driver.beginTransaction = () => {
        initial = structuredClone(order);
        steps.push("begin");
        return Promise.resolve();
    };
    driver.commitTransaction = () => {
        steps.push("commit");
        return Promise.resolve();
    };
    driver.rollbackTransaction = () => {
        order = initial;
        steps.push("rollback");
        return Promise.resolve();
    };
    driver.acquireConnection = async () => {
        const connection = await DummyDriver.prototype.acquireConnection.call(driver);
        // Dispatcher de respuestas SQL del escenario; las ramas son datos de prueba, no reglas de negocio duplicadas.
        // eslint-disable-next-line complexity, sonarjs/cognitive-complexity
        connection.executeQuery = <R>(query: CompiledQuery): Promise<QueryResult<R>> => {
            queries.push(query);
            let rows: object[] = [];
            if (query.sql.includes("from `sec_user`")) rows = [{ id_user: 1 }];
            if (query.sql.includes("FROM crm_sales_order o WHERE") && !options.legacy && !options.absent) rows = [order, ...(options.ambiguous ? [order] : [])];
            if (query.sql.includes("SELECT public_id_lead AS id")) rows = [{ id: leadId }];
            if (query.sql.includes("SELECT e.after_record_event AS")) {
                const entry = entries.get(String(query.parameters.at(-1)));
                rows = entry ? [{ after: entry }] : [];
            }
            if (query.sql.includes("FROM crm_calendar_event e JOIN crm_calendar_event_link")) rows = options.future ? [options.future] : [];
            if (query.sql.startsWith("update `crm_sales_order`")) {
                steps.push("native-write");
                order = { ...order, status: query.parameters[0] as AddendumOrder["status"], version: query.parameters[1] as number, changedAt: String(query.parameters[2]).replace(" ", "T") + "Z", note: query.parameters[3] as string | null };
            }
            return Promise.resolve({ rows: rows as R[] });
        };
        return connection;
    };
    const db = new Kysely<CrmDatabase>({ dialect: { createDriver: () => driver, createAdapter: () => new MysqlAdapter(), createIntrospector: (database) => new MysqlIntrospector(database), createQueryCompiler: () => new MysqlQueryCompiler() } });
    const legacy = {
        countPending: vi.fn().mockResolvedValue(0),
        read: vi.fn().mockImplementation(() => Promise.resolve(options.absent ? undefined : order)),
        write: vi.fn().mockImplementation((_tx: Transaction<CrmDatabase>, _order: AddendumOrder, next: { status: AddendumOrder["status"]; version: number; changedAt: string; note: string | null }) => {
            steps.push("legacy-write");
            order = { ...order, ...next };
            return Promise.resolve();
        }),
    };
    const audit = {
        enabled: true,
        captureActor: vi.fn().mockResolvedValue({ publicId: "actor", name: "Actor", roles: [] }),
        append: vi.fn<(tx: Transaction<CrmDatabase>, entry: RecordAuditInput) => Promise<void>>().mockImplementation((_tx, entry) => {
            steps.push("audit");
            if (options.failAudit) return Promise.reject(new Error("audit failed"));
            if (!entry.after) throw new Error("Expected audit after snapshot");
            entries.set(entry.operationId, entry.after);
            return Promise.resolve();
        }),
    };
    const repo = new SalesOrderAddendumRepository({ db } as never, audit as never, legacy);
    if (!order.lead) throw new Error("Expected fixture lead");
    const pending = { order: { source: order.source, id: order.id }, lead: order.lead, actorPublicId: "actor", operationId, markPending: true, reason: "Documento requerido", broad: true };
    return { db, repo, queries, steps, legacy, audit, pending, current: () => order };
}

it.each([false, true])("sets pending atomically with central audit in native/legacy=%s and refreshes an already pending version", async (legacy) => {
    const f = setup({ legacy });
    try {
        await f.db.transaction().execute((tx) => f.repo.prepareEvent(tx, f.pending));
        expect(f.current()).toMatchObject({ status: "pending", version: 4 });
        expect(f.steps).toEqual(["begin", legacy ? "legacy-write" : "native-write", "audit", "commit"]);
        const captured = f.audit.append.mock.calls[0];
        if (!captured) throw new Error("Expected central audit");
        expect(captured[0].isTransaction).toBe(true);
        expect(captured[1].source.schema).toBe(legacy ? "crmdatabase-api" : "CRM_THINK_V2");
        expect(captured[1].before).toMatchObject({ addendumVersion: 3 });
        expect(captured[1].after).toMatchObject({ addendumVersion: 4 });
        const currentFutureRead = f.queries.find((query) => query.sql.includes("FROM crm_calendar_event e JOIN crm_calendar_event_link"));
        if (!currentFutureRead) throw new Error("Expected current future-event query");
        expect(currentFutureRead.sql).toMatch(/starts_at_calendar_event>UTC_TIMESTAMP\(3\)/);
        expect(currentFutureRead.sql).toMatch(/status_calendar_event='scheduled'/);
        expect(currentFutureRead.sql).toMatch(/FOR UPDATE$/);
        const orderLockIndex = f.queries.findIndex((query) => query.sql.includes("FROM crm_sales_order o WHERE") && query.sql.endsWith("FOR UPDATE"));
        if (!legacy) expect(f.queries.indexOf(currentFutureRead)).toBeGreaterThan(orderLockIndex);
        if (!legacy) expect(f.legacy.read).not.toHaveBeenCalled();
    } finally {
        await f.db.destroy();
    }
});
it.each([false, true])("rolls the marker back if central audit fails in native/legacy=%s", async (legacy) => {
    const f = setup({ legacy, failAudit: true });
    try {
        await expect(f.db.transaction().execute((tx) => f.repo.prepareEvent(tx, f.pending))).rejects.toThrow("audit failed");
        expect(f.current()).toMatchObject({ status: "pending", version: 3 });
        expect(f.steps.at(-1)).toBe("rollback");
    } finally {
        await f.db.destroy();
    }
});
it.each(["completed", "cancelled"] as const)("does not reopen an existing %s on an ordinary event edit", async (status) => {
    const f = setup({ status });
    try {
        await f.db.transaction().execute((tx) => f.repo.prepareEvent(tx, { ...f.pending, markPending: false, excludeEventId: id }));
        expect(f.current()).toMatchObject({ status, version: 3 });
        expect(f.audit.append).not.toHaveBeenCalled();
        expect(f.queries.find((query) => query.sql.includes("FROM crm_calendar_event e JOIN crm_calendar_event_link"))?.parameters).toContain(id);
    } finally {
        await f.db.destroy();
    }
});
it.each(["completed", "cancelled"] as const)("manual %s is versioned, audited and idempotent without clearing a later new pending marker", async (status) => {
    const f = setup();
    try {
        const command = { source: "native" as const, id, status, expectedVersion: 3, operationId, actorPublicId: "actor" };
        expect(await f.repo.change(command)).toMatchObject({ status, version: 4, replayed: false });
        expect(await f.repo.change(command)).toMatchObject({ status, version: 4, replayed: true });
        await f.db.transaction().execute((tx) => f.repo.prepareEvent(tx, f.pending));
        expect(await f.repo.change(command)).toMatchObject({ status: "pending", version: 5, replayed: true });
        await expect(f.repo.change({ ...command, operationId: "550e8400-e29b-41d4-a716-446655440001" })).rejects.toMatchObject({ status: 409 });
        expect(f.current()).toMatchObject({ status: "pending", version: 5 });
    } finally {
        await f.db.destroy();
    }
});
it.each([{ absent: true }, { inactive: true }, { ambiguous: true }])("does not mutate an absent, inactive or ambiguous order: %j", async (options) => {
    const f = setup(options);
    try {
        await expect(f.db.transaction().execute((tx) => f.repo.prepareEvent(tx, f.pending))).rejects.toThrow();
        expect(f.audit.append).not.toHaveBeenCalled();
        expect(f.steps).not.toContain("native-write");
    } finally {
        await f.db.destroy();
    }
});
it("blocks a future duplicate before writing and redacts another owner's restricted event", async () => {
    const f = setup({ future: { id, start: "2027-01-01T14:00:00.000Z", ownerPublicId: "other", invited: 0 } });
    try {
        await expect(f.db.transaction().execute((tx) => f.repo.prepareEvent(tx, { ...f.pending, broad: false }))).rejects.toMatchObject({ status: 409, response: { code: "EXISTING_FUTURE_ADDENDUM", existing: null } });
        expect(f.current().version).toBe(3);
        expect(f.audit.append).not.toHaveBeenCalled();
        expect(await f.repo.future(f.pending.order, { actorPublicId: "actor", broad: true })).toMatchObject({ blocked: true, existing: { id, start: "2027-01-01T14:00:00.000Z" } });
        expect(await f.repo.future(f.pending.order, { actorPublicId: "actor", broad: false })).toMatchObject({ blocked: true, existing: null });
    } finally {
        await f.db.destroy();
    }
});
it.each([null, "completed", "cancelled"] as const)("manually marks %s pending with an optional audited note, without consulting or creating calendar events", async (status) => {
    const f = setup({ status });
    try {
        const command = { source: "native" as const, id, expectedVersion: 3, operationId, actorPublicId: "actor", note: "Esperar documento del cliente" };
        expect(await f.repo.markManually(command)).toMatchObject({ status: "pending", version: 4, note: command.note, replayed: false });
        expect(await f.repo.markManually(command)).toMatchObject({ version: 4, replayed: true });
        expect(f.audit.append).toHaveBeenCalledOnce();
        expect(f.audit.append.mock.calls[0]?.[1].after).toMatchObject({ addendumNote: command.note });
        expect(f.queries.some((query) => query.sql.includes("FROM crm_calendar_event"))).toBe(false);
        await expect(f.repo.markManually({ ...command, note: "Otro contenido" })).rejects.toMatchObject({ status: 409 });
    } finally {
        await f.db.destroy();
    }
});
it("rejects a new manual mark when already pending without any version or audit change", async () => {
    const f = setup();
    try {
        await expect(f.repo.markManually({ source: "native", id, expectedVersion: 3, operationId, actorPublicId: "actor", note: "Documento requerido" })).rejects.toMatchObject({ status: 409 });
        expect(f.current().version).toBe(3);
        expect(f.audit.append).not.toHaveBeenCalled();
    } finally {
        await f.db.destroy();
    }
});
it("preserves a manual note on completion and replaces it only when a new calendar Adéndum marks pending", async () => {
    const f = setup({ status: null });
    try {
        await f.repo.markManually({ source: "native", id, expectedVersion: 3, operationId, actorPublicId: "actor", note: "Nota manual" });
        expect(await f.repo.change({ source: "native", id, status: "completed", expectedVersion: 4, operationId, actorPublicId: "actor" })).toMatchObject({ status: "completed", version: 5, note: "Nota manual" });
        await f.db.transaction().execute((tx) => f.repo.prepareEvent(tx, f.pending));
        expect(f.current()).toMatchObject({ status: "pending", version: 6, note: "Documento requerido" });
    } finally {
        await f.db.destroy();
    }
});

it.each([false, true])("records sent with reason retained, replay/CAS and completion from sent in legacy=%s", async (legacy) => {
    const f = setup({ legacy });
    try {
        await f.db.transaction().execute((tx) => f.repo.prepareEvent(tx, f.pending));
        const command = { ...f.pending.order, status: "sent" as const, expectedVersion: 4, operationId, actorPublicId: "actor" };
        expect(await f.repo.change(command)).toMatchObject({ status: "sent", version: 5, note: "Documento requerido", replayed: false });
        expect(await f.repo.change(command)).toMatchObject({ status: "sent", version: 5, replayed: true });
        await expect(f.repo.change({ ...command, operationId: "550e8400-e29b-41d4-a716-446655440001" })).rejects.toMatchObject({ status: 409 });
        expect(await f.repo.change({ ...command, status: "completed", expectedVersion: 5, operationId: "550e8400-e29b-41d4-a716-446655440002" })).toMatchObject({ status: "completed", note: "Documento requerido" });
        expect(f.audit.append.mock.calls[1]?.[1].after).toMatchObject({ addendumStatus: "sent", addendumNote: "Documento requerido" });
    } finally {
        await f.db.destroy();
    }
});
it.each([undefined, " ", "ab", "x".repeat(2001)])("rejects an event marker without a valid reason", async (reason) => {
    const f = setup();
    try {
        await expect(f.db.transaction().execute((tx) => f.repo.prepareEvent(tx, { ...f.pending, reason }))).rejects.toMatchObject({ status: 400 });
        expect(f.audit.append).not.toHaveBeenCalled();
    } finally {
        await f.db.destroy();
    }
});

it.each([null, " ", "ab", "x".repeat(2001)])("validates manual reason at repository boundary", async (note) => {
    const f = setup({ status: null });
    try {
        await expect(f.repo.markManually({ source: "native", id, expectedVersion: 3, operationId, actorPublicId: "actor", note })).rejects.toMatchObject({ status: 400 });
        expect(f.audit.append).not.toHaveBeenCalled();
    } finally {
        await f.db.destroy();
    }
});

it.each([null, "sent", "completed", "cancelled"] as const)("rejects sending a marker in %s without mutation", async (status) => {
    const f = setup({ status });
    try {
        await expect(f.repo.change({ source: "native", id, status: "sent", expectedVersion: 3, operationId, actorPublicId: "actor" })).rejects.toMatchObject({ status: 409 });
        expect(f.current()).toMatchObject({ status, version: 3 });
        expect(f.audit.append).not.toHaveBeenCalled();
    } finally {
        await f.db.destroy();
    }
});
it("allows a historical pending marker without reason to be sent without backfill", async () => {
    const f = setup();
    try {
        expect(await f.repo.change({ source: "native", id, status: "sent", expectedVersion: 3, operationId, actorPublicId: "actor" })).toMatchObject({ status: "sent", note: null });
    } finally {
        await f.db.destroy();
    }
});
