import { createHash } from "node:crypto";

import { Kysely, MysqlDialect } from "kysely";
import { createPool } from "mysql2";
import { describe, expect, it, vi } from "vitest";

import type { CrmDatabase } from "../../src/database/database.types.js";
import type { PersistedOrderEvent } from "../../src/integrations/netsuite/netsuite-order-event.contract.js";
import { advancePaidInstallments } from "../../src/integrations/netsuite/netsuite-paid-installments.handler.js";
import type { RecordAuditService } from "../../src/modules/crm/audit/record-audit.service.js";

function fixture(destination: "native" | "legacy", paid: boolean = true, state = "pending_balance") {
    const statements: string[] = [];
    const db = new Kysely<CrmDatabase>({ dialect: new MysqlDialect({ pool: createPool({ host: "127.0.0.1", port: 1 }) }), plugins: [{ transformQuery: ({ node }) => node, transformResult: ({ result }) => Promise.resolve(result) }] });
    const compiledExecutor = db.getExecutor();
    const executor = {
        ...compiledExecutor,
        transformQuery: compiledExecutor.transformQuery.bind(compiledExecutor),
        compileQuery: compiledExecutor.compileQuery.bind(compiledExecutor),
        executeQuery: vi.fn((query: { sql: string }) => {
            statements.push(query.sql);
            return Promise.resolve({ rows: query.sql.startsWith("select") ? [{ status_sales_order_approval: "approved" }] : query.sql.startsWith("SELECT") ? [{ sequence: 3, state }] : [] });
        }),
    };
    vi.spyOn(db, "getExecutor").mockReturnValue(executor as never);
    // RawBuilder and typed builders share the same in-memory executor; no database connection opens.
    const select = { select: () => select, where: () => select, forUpdate: () => select, executeTakeFirst: () => Promise.resolve({ status_sales_order_approval: "approved" }) };
    vi.spyOn(db, "selectFrom").mockReturnValue(select as never);
    const insert = {
        values: () => insert,
        execute: () => {
            statements.push("INSERT INTO native_stage");
            return Promise.resolve();
        },
    };
    vi.spyOn(db, "insertInto").mockReturnValue(insert as never);
    const tx = db as never;
    const append = vi.fn(() => Promise.resolve());
    const audit = { enabled: true, append } as unknown as RecordAuditService;
    const event = { event: { eventType: "edit", eventId: "test-event" }, source: { accountId: "4552704_SB1" }, snapshot: { data: { fields: { custbody_cuotas_pagadas: paid } } } } as unknown as PersistedOrderEvent;
    const completion = destination === "native" ? { installments_fully_paid_sales_order: paid ? "yes" : "no", unit_transferred_sales_order: "no", keys_delivered_sales_order: "no", unit_delivered_sales_order: "no" } : { cuotas_pagadas_completo_ov: Number(paid), unidad_traspasada_ov: 0, entrega_llaves_ov: 0, unidad_entregada_ov: 0 };
    const target = { destination, id: "1", row: destination === "native" ? { status_sales_order: "active", cancelled_sales_order: "no", deleted_at_sales_order: null, contract_signed_sales_order: "yes" } : { status_ov: 1, caida_ov: 0, contrado_frima_ov: 1, aprobacion_forma_ov: 1 } };
    Object.assign(target.row, completion);
    return { tx, audit, event, target, append, statements, db };
}

describe("NetSuite paid installments stage", () => {
    for (const destination of ["native", "legacy"] as const) {
        it.each(
            (
                [
                    ["pending_balance", true, false, true, false, "pending_transfer"],
                    ["pending_transfer", true, true, false, false, "transfer_signed"],
                    ["pending_balance", false, false, false, true, "closed"],
                    ["transfer_signed", false, false, false, true, "closed"],
                    ["pending_transfer", true, true, true, false, null],
                    ["transfer_signed", true, false, false, false, null],
                    ["closed", true, false, false, false, null],
                    ["pending_approval", false, false, false, true, null],
                ] as const
            ).map(([state, paid, transferred, keys, delivered, expected]) => ({ state, paid, transferred, keys, delivered, expected })),
        )(`${destination}: completion $state paid=$paid transferred=$transferred keys=$keys delivered=$delivered targets $expected`, async ({ state, paid, transferred, keys, delivered, expected }) => {
            const f = fixture(destination, paid, state);
            const columns = destination === "native" ? ["installments_fully_paid_sales_order", "unit_transferred_sales_order", "keys_delivered_sales_order", "unit_delivered_sales_order"] : ["cuotas_pagadas_completo_ov", "unidad_traspasada_ov", "entrega_llaves_ov", "unidad_entregada_ov"];
            const changes = columns.map((column, index) => ({ field: column, column, before: null, after: destination === "native" ? ([paid, transferred, keys, delivered][index] ? "yes" : "no") : Number([paid, transferred, keys, delivered][index]) }));
            const result = await advancePaidInstallments(f.tx, f.audit, { event: f.event, target: f.target, changes });
            expect(result?.after ?? null).toBe(expected);
            expect(f.append).toHaveBeenCalledTimes(expected ? 1 : 0);
            await f.db.destroy();
        });
        it(`${destination}: delivery closes even when other indicators are unknown`, async () => {
            const f = fixture(destination, false, "transfer_signed");
            Object.assign(f.target.row, destination === "native" ? { installments_fully_paid_sales_order: "unknown", unit_transferred_sales_order: "unknown", keys_delivered_sales_order: "unknown", unit_delivered_sales_order: "yes" } : { cuotas_pagadas_completo_ov: null, unidad_traspasada_ov: null, entrega_llaves_ov: null, unidad_entregada_ov: 1 });
            expect((await advancePaidInstallments(f.tx, f.audit, { event: f.event, target: f.target, changes: [] }))?.after).toBe("closed");
            await f.db.destroy();
        });
        it.each(["create", "delete"])(`${destination}: ignores %s event`, async (eventType) => {
            const f = fixture(destination);
            f.event.event.eventType = eventType as typeof f.event.event.eventType;
            expect(await advancePaidInstallments(f.tx, f.audit, { event: f.event, target: f.target, changes: [] })).toBeNull();
            expect(f.append).not.toHaveBeenCalled();
            await f.db.destroy();
        });
        it(`${destination}: advances an existing balance visit and appends central state audit`, async () => {
            const f = fixture(destination);
            const result = await advancePaidInstallments(f.tx, f.audit, { event: f.event, target: f.target, changes: [] });
            expect(result?.after).toBe("pending_transfer");
            expect(f.append).toHaveBeenCalledWith(
                f.tx,
                expect.objectContaining({
                    action: "state_change",
                    operationId: createHash("sha256")
                        .update(JSON.stringify(["sales_order", "state", "netsuite:4552704_SB1:test-event:paid"]))
                        .digest("hex"),
                    after: { state: "pending_transfer", version: 4 },
                }),
            );
            expect(f.statements.some((statement) => /insert into|INSERT INTO/.test(statement))).toBe(true);
            await f.db.destroy();
        });
        it.each(["cancelled", "unsigned", "inactive"] as const)(`${destination}: preserves the visit when %s`, async (condition) => {
            const f = fixture(destination);
            const columns = destination === "native" ? { cancelled: "cancelled_sales_order", unsigned: "contract_signed_sales_order", inactive: "status_sales_order" } : { cancelled: "caida_ov", unsigned: "contrado_frima_ov", inactive: "status_ov" };
            const values = destination === "native" ? { cancelled: "yes", unsigned: "unknown", inactive: "inactive" } : { cancelled: 1, unsigned: null, inactive: 0 };
            (f.target.row as Record<string, unknown>)[columns[condition]] = values[condition];
            expect(await advancePaidInstallments(f.tx, f.audit, { event: f.event, target: f.target, changes: [] })).toBeNull();
            expect(f.append).not.toHaveBeenCalled();
            await f.db.destroy();
        });
        it(`${destination}: a post-event signature revocation blocks the advance`, async () => {
            const f = fixture(destination);
            const changes = [{ field: "custbody90", column: destination === "native" ? "contract_signed_sales_order" : "contrado_frima_ov", before: destination === "native" ? "yes" : 1, after: destination === "native" ? "no" : 0 }];
            expect(await advancePaidInstallments(f.tx, f.audit, { event: f.event, target: f.target, changes })).toBeNull();
            expect(f.append).not.toHaveBeenCalled();
            await f.db.destroy();
        });
        it(`${destination}: xedit uses post-event flags before evaluating completion`, async () => {
            const f = fixture(destination, false);
            f.event.event.eventType = "xedit";
            const column = destination === "native" ? "installments_fully_paid_sales_order" : "cuotas_pagadas_completo_ov";
            const changes = [{ field: "custbody_cuotas_pagadas", column, before: destination === "native" ? "no" : 0, after: destination === "native" ? "yes" : 1 }];
            expect((await advancePaidInstallments(f.tx, f.audit, { event: f.event, target: f.target, changes }))?.after).toBe("pending_transfer");
            expect(f.append).toHaveBeenCalledTimes(1);
            await f.db.destroy();
        });
        it.each([true, "T", "1", 2])(`${destination}: rejects noncanonical completion flag %s without a stage write`, async (value) => {
            const f = fixture(destination);
            const column = destination === "native" ? "installments_fully_paid_sales_order" : "cuotas_pagadas_completo_ov";
            (f.target.row as Record<string, unknown>)[column] = value;
            expect(await advancePaidInstallments(f.tx, f.audit, { event: f.event, target: f.target, changes: [] })).toBeNull();
            expect(f.statements).toEqual([]);
            expect(f.append).not.toHaveBeenCalled();
            await f.db.destroy();
        });
        it(`${destination}: disabled central audit rejects before appending a visit`, async () => {
            const f = fixture(destination);
            Object.assign(f.audit, { enabled: false });
            await expect(advancePaidInstallments(f.tx, f.audit, { event: f.event, target: f.target, changes: [] })).rejects.toThrow("enabled central record audit");
            expect(f.statements.filter((statement) => /insert into/i.test(statement))).toEqual([]);
            expect(f.append).not.toHaveBeenCalled();
            await f.db.destroy();
        });
        it(`${destination}: propagates a central audit failure for the owning transaction to roll back`, async () => {
            const f = fixture(destination);
            f.append.mockRejectedValueOnce(new Error("audit unavailable"));
            await expect(advancePaidInstallments(f.tx, f.audit, { event: f.event, target: f.target, changes: [] })).rejects.toThrow("audit unavailable");
            expect(f.append).toHaveBeenCalledTimes(1);
            await f.db.destroy();
        });
        it(`${destination}: a same-event signature confirmation permits the eligible advance`, async () => {
            const f = fixture(destination);
            const column = destination === "native" ? "contract_signed_sales_order" : "contrado_frima_ov";
            (f.target.row as Record<string, unknown>)[column] = destination === "native" ? "no" : 0;
            const changes = [{ field: "custbody90", column, before: destination === "native" ? "no" : 0, after: destination === "native" ? "yes" : 1 }];
            expect((await advancePaidInstallments(f.tx, f.audit, { event: f.event, target: f.target, changes }))?.after).toBe("pending_transfer");
            await f.db.destroy();
        });
        it(`${destination}: incomplete approval prevents stage writes`, async () => {
            const f = fixture(destination);
            if (destination === "legacy") {
                Object.assign(f.target.row, { aprobacion_forma_ov: 0 });
            } else {
                const select = { select: () => select, where: () => select, forUpdate: () => select, executeTakeFirst: () => Promise.resolve({ status_sales_order_approval: "pending" }) };
                vi.spyOn(f.db, "selectFrom").mockReturnValue(select as never);
            }
            expect(await advancePaidInstallments(f.tx, f.audit, { event: f.event, target: f.target, changes: [] })).toBeNull();
            expect(f.statements).toEqual([]);
            expect(f.append).not.toHaveBeenCalled();
            await f.db.destroy();
        });
        it(`${destination}: false never reverses`, async () => {
            const f = fixture(destination, false);
            expect(await advancePaidInstallments(f.tx, f.audit, { event: f.event, target: f.target, changes: [] })).toBeNull();
            expect(f.append).not.toHaveBeenCalled();
            await f.db.destroy();
        });
        it(`${destination}: transfer does not append another visit`, async () => {
            const f = fixture(destination, true, "pending_transfer");
            expect(await advancePaidInstallments(f.tx, f.audit, { event: f.event, target: f.target, changes: [] })).toBeNull();
            expect(f.append).not.toHaveBeenCalled();
            await f.db.destroy();
        });
    }
});
