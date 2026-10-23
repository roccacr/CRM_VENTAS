import { SELF_DECLARED_DEPS_METADATA } from "@nestjs/common/constants.js";
import { type CompiledQuery, DummyDriver, Kysely, MysqlAdapter, MysqlIntrospector, MysqlQueryCompiler, type QueryResult } from "kysely";
import { describe, expect, it, vi } from "vitest";

import type { DatabaseService } from "../../src/database/database.service.js";
import type { CrmDatabase } from "../../src/database/database.types.js";
import { RecordAuditService } from "../../src/modules/crm/audit/record-audit.service.js";
import { type LifecycleContext, SalesOrderLifecycleRepository } from "../../src/modules/crm/sales/sales-orders/sales-order-lifecycle.repository.js";

const trustedActor = { publicId: "actor-public", name: "Database actor", roles: [{ code: "sales", name: "Sales" }] };
const context: LifecycleContext = { orderId: "order-public", actor: { publicId: trustedActor.publicId, name: "Forged", roles: [{ code: "owner", name: "Forged" }] }, reason: "Reviewed change", operationId: "operation", correlationId: "correlation" };

function setup(options: { enabled?: boolean; legacyId?: number; repeated?: boolean; sequence?: number; version?: number } = {}) {
    const queries: { sql: string; parameters: readonly unknown[] }[] = [];
    const steps: string[] = [];
    const committed: string[] = [];
    let pending: string[] = [];
    const readers: Record<string, (sql: string) => Record<string, unknown>[]> = {
        crm_sales_order: () => [{ id_sales_order: 42, public_id_sales_order: context.orderId, native_code_sales_order: "SO-42", id_old_produccion_sales_order: options.legacyId ?? null, status_sales_order: "active", cancelled_sales_order: "no" }],
        sec_user: () => [{ id_user: 7 }],
        audit_sales_order_state_event: (sql) => {
            if (!sql.includes("operation_id")) return options.sequence === 0 ? [] : [{ sequence_sales_order_state_event: options.sequence ?? 2, to_state_code_sales_order_state_event: "sales" }];
            return options.repeated ? [{ sequence_sales_order_state_event: 3, to_state_code_sales_order_state_event: "formalization", actor_user_id_sales_order_state_event: 7, reason_sales_order_state_event: context.reason }] : [];
        },
        audit_sales_order_approval_event: () => (options.repeated ? [{ version_sales_order_approval_event: 4, after_status_sales_order_approval_event: "approved", actor_user_id_sales_order_approval_event: 7, reason_sales_order_approval_event: context.reason }] : []),
        crm_sales_order_approval: () => (options.version === 0 ? [] : [{ status_sales_order_approval: "not_approved", version_sales_order_approval: options.version ?? 3 }]),
    };
    const driver = new DummyDriver();
    driver.beginTransaction = () => {
        steps.push("begin");
        pending = [];
        return Promise.resolve();
    };
    driver.commitTransaction = () => {
        steps.push("commit");
        committed.push(...pending);
        return Promise.resolve();
    };
    driver.rollbackTransaction = () => {
        steps.push("rollback");
        pending = [];
        return Promise.resolve();
    };
    driver.acquireConnection = () =>
        Promise.resolve({
            executeQuery: <R>(query: CompiledQuery): Promise<QueryResult<R>> => {
                queries.push(query);
                let rows: Record<string, unknown>[] = [];
                if (query.sql.startsWith("select")) {
                    const reader = Object.entries(readers).find(([table]) => query.sql.includes(`from \`${table}\``))?.[1];
                    rows = reader?.(query.sql) ?? [];
                } else {
                    steps.push("write");
                    pending.push(query.sql);
                }
                return Promise.resolve({ rows: rows as R[] });
            },
            async *streamQuery() {
                yield await Promise.resolve({ rows: [] });
            },
        });
    const db = new Kysely<CrmDatabase>({ dialect: { createDriver: () => driver, createAdapter: () => new MysqlAdapter(), createIntrospector: (database) => new MysqlIntrospector(database), createQueryCompiler: () => new MysqlQueryCompiler() } });
    const captureActor = vi.fn<RecordAuditService["captureActor"]>().mockImplementation(() => {
        steps.push("capture");
        return Promise.resolve(trustedActor);
    });
    const append = vi.fn<RecordAuditService["append"]>().mockImplementation(() => {
        steps.push("append");
        return Promise.resolve({ publicId: "event", sequence: 1, replayed: false });
    });
    const audit = { enabled: options.enabled ?? true, captureActor, append } as unknown as RecordAuditService;
    const database = { db } as DatabaseService;
    return { repo: new SalesOrderLifecycleRepository(database, audit), database, db, queries, steps, committed, captureActor, append };
}

describe("sales order central audit (in-memory Kysely only)", () => {
    it("declares explicit central audit injection for metadata-free Nest transforms", () => {
        const dependencies: unknown = Reflect.getMetadata(SELF_DECLARED_DEPS_METADATA, SalesOrderLifecycleRepository);
        expect(dependencies).toContainEqual({ index: 1, param: RecordAuditService });
    });

    it("records the first state and approval with null previous values and zero versions", async () => {
        const f = setup({ sequence: 0, version: 0 });
        await f.repo.transition({ ...context, state: "sales", expectedSequence: 0 });
        await f.repo.recordApproval({ ...context, type: "formalization", status: "approved", expectedVersion: 0 });
        expect(f.append.mock.calls[0]?.[1]).toMatchObject({ before: { businessId: "SO-42", state: null, version: 0 }, after: { state: "sales", version: 1 }, snapshotScope: "partial" });
        expect(f.append.mock.calls[1]?.[1]).toMatchObject({ before: { businessId: "SO-42", type: "formalization", status: null, version: 0 }, after: { status: "approved", version: 1 }, snapshotScope: "partial" });
        await f.db.destroy();
    });

    it("rejects a changed specialized retry without appending central history", async () => {
        const f = setup({ repeated: true });
        await expect(f.repo.transition({ ...context, state: "sales", expectedSequence: 0 })).rejects.toThrow("Operacion reutilizada");
        await expect(f.repo.recordApproval({ ...context, type: "formalization", status: "not_approved", expectedVersion: 0 })).rejects.toThrow("Operacion reutilizada");
        expect(f.append).not.toHaveBeenCalled();
        expect(f.steps).not.toContain("write");
        await f.db.destroy();
    });

    it("captures the trusted actor before writes and appends a partial state event in the same transaction", async () => {
        const f = setup();
        expect(await f.repo.transition({ ...context, state: "formalization", expectedSequence: 2 })).toBe(3);
        expect(f.captureActor).toHaveBeenCalledWith(expect.objectContaining({ isTransaction: true }), 7);
        expect(f.append.mock.calls[0]?.[0]).toBe(f.captureActor.mock.calls[0]?.[0]);
        expect(f.steps).toEqual(["begin", "capture", "write", "write", "append", "commit"]);
        expect(f.append.mock.calls[0]?.[1]).toMatchObject({ source: { schema: "CRM_THINK_V2", entity: "sales_order", table: "crm_sales_order", id: "42" }, actor: trustedActor, action: "state_change", module: "formalizacion", before: { businessId: "SO-42", state: "sales", version: 2 }, after: { businessId: "SO-42", state: "formalization", version: 3 }, allowedFields: ["businessId", "state", "version"], snapshotScope: "partial", reason: context.reason, correlationId: context.correlationId });
        expect(f.queries.find((q) => q.sql.startsWith("insert into `audit_sales_order_state_event`"))?.parameters).toContain(JSON.stringify(trustedActor));
        await f.db.destroy();
    });

    it("uses legacy canonical identity and native effective PK without writing legacy or promoting an order", async () => {
        const f = setup({ legacyId: 901 });
        await f.repo.recordApproval({ ...context, type: "formalization", status: "approved", expectedVersion: 3 });
        expect(f.append.mock.calls[0]?.[1]).toMatchObject({
            source: { schema: "crmdatabase-api", entity: "sales_order", table: "ordenventa", id: "901" },
            effectiveSource: { schema: "CRM_THINK_V2", table: "crm_sales_order", id: "42" },
            actor: trustedActor,
            action: "approval_change",
            before: { businessId: "SO-42", type: "formalization", status: "not_approved", version: 3 },
            after: { businessId: "SO-42", type: "formalization", status: "approved", version: 4 },
            allowedFields: ["businessId", "type", "status", "version"],
            snapshotScope: "partial",
        });
        expect(f.queries.find((q) => q.sql.startsWith("insert into `audit_sales_order_approval_event`"))?.parameters).toContain(JSON.stringify(trustedActor));
        expect(f.queries.some((q) => q.sql.includes("ordenventa") || q.sql.startsWith("insert into `crm_sales_order`"))).toBe(false);
        expect(f.steps.indexOf("capture")).toBeLessThan(f.steps.indexOf("write"));
        expect(f.append.mock.calls[0]?.[0]).toBe(f.captureActor.mock.calls[0]?.[0]);
        await f.db.destroy();
    });

    it.each(["state", "approval"] as const)("rolls back %s business writes if central append fails", async (kind) => {
        const f = setup();
        const failure = new Error("central readiness or append failure");
        f.append.mockRejectedValue(failure);
        const operation = kind === "state" ? f.repo.transition({ ...context, state: "formalization", expectedSequence: 2 }) : f.repo.recordApproval({ ...context, type: "formalization", status: "approved", expectedVersion: 3 });
        await expect(operation).rejects.toBe(failure);
        expect(f.steps.at(-1)).toBe("rollback");
        expect(f.steps.filter((s) => s === "begin")).toHaveLength(1);
        expect(f.committed).toEqual([]);
        await f.db.destroy();
    });

    it("does not write if trusted actor capture fails", async () => {
        const f = setup();
        f.captureActor.mockRejectedValue(new Error("actor missing"));
        await expect(f.repo.transition({ ...context, state: "formalization", expectedSequence: 2 })).rejects.toThrow("actor missing");
        expect(f.steps).not.toContain("write");
        expect(f.append).not.toHaveBeenCalled();
        await f.db.destroy();
    });

    it.each(["state", "approval"] as const)("preserves %s idempotent retries without appending again", async (kind) => {
        const f = setup({ repeated: true });
        const result = kind === "state" ? await f.repo.transition({ ...context, state: "formalization", expectedSequence: 0 }) : await f.repo.recordApproval({ ...context, type: "formalization", status: "approved", expectedVersion: 0 });
        expect(result).toBe(kind === "state" ? 3 : 4);
        expect(f.append).not.toHaveBeenCalled();
        expect(f.steps).not.toContain("write");
        await f.db.destroy();
    });

    it("keeps optimistic conflicts ahead of business writes and central append", async () => {
        const f = setup();
        await expect(f.repo.transition({ ...context, state: "formalization", expectedSequence: 1 })).rejects.toThrow("La orden cambio");
        await expect(f.repo.recordApproval({ ...context, type: "formalization", status: "approved", expectedVersion: 1 })).rejects.toThrow("La aprobacion cambio");
        expect(f.steps).not.toContain("write");
        expect(f.append).not.toHaveBeenCalled();
        await f.db.destroy();
    });

    it("namespaces independent state and approval operations deterministically within 100 characters", async () => {
        const f = setup();
        const input = { ...context, operationId: "x".repeat(100) };
        await f.repo.transition({ ...input, state: "formalization", expectedSequence: 2 });
        for (const type of ["formalization", "developer", "formalization"]) await f.repo.recordApproval({ ...input, type, status: "approved", expectedVersion: 3 });
        const ids = f.append.mock.calls.map(([, event]) => event.operationId);
        expect(new Set(ids)).toHaveProperty("size", 3);
        expect(ids[1]).toBe(ids[3]);
        for (const id of ids) expect(id.length).toBeLessThanOrEqual(100);
        await f.db.destroy();
    });

    it("keeps flag-off behavior and the existing manual constructor free of central audit calls", async () => {
        const f = setup({ enabled: false });
        await f.repo.transition({ ...context, state: "formalization", expectedSequence: 2 });
        await f.repo.recordApproval({ ...context, type: "formalization", status: "approved", expectedVersion: 3 });
        await new SalesOrderLifecycleRepository(f.database).transition({ ...context, state: "formalization", expectedSequence: 2 });
        expect(f.captureActor).not.toHaveBeenCalled();
        expect(f.append).not.toHaveBeenCalled();
        expect(f.queries.find((q) => q.sql.startsWith("insert into `audit_sales_order_state_event`"))?.parameters).toContain(JSON.stringify(context.actor));
        await f.db.destroy();
    });
});
