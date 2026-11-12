import { SELF_DECLARED_DEPS_METADATA } from "@nestjs/common/constants.js";
import fc from "fast-check";
import { type CompiledQuery, DummyDriver, Kysely, MysqlAdapter, MysqlIntrospector, MysqlQueryCompiler, type QueryResult, type Transaction } from "kysely";
import { afterEach, expect, it, vi } from "vitest";

import { DatabaseService } from "../../src/database/database.service.js";
import type { CrmDatabase } from "../../src/database/database.types.js";
import { NetsuiteRestletClient } from "../../src/integrations/netsuite/netsuite-restlet.client.js";
import { NetsuiteUnitTransferWorkflow } from "../../src/integrations/netsuite/netsuite-unit-transfer.workflow.js";
import { FORMALIZATION_APPROVAL_LEGACY, type FormalizationApprovalLegacy } from "../../src/modules/crm/sales/sales-orders/formalization-approval.port.js";

const databases: Kysely<CrmDatabase>[] = [];
afterEach(async () => {
    await Promise.all(databases.splice(0).map((db) => db.destroy()));
});
const command = { source: "legacy" as const, id: "901", actorPublicId: "actor", operationId: "operation", correlationId: "correlation" };

/** Compila SQL real; el driver conserva el recibo entre llamadas. La concurrencia SQL real queda para QA aislado. */
function setup(initial?: "pending" | "confirmed" | "unknown") {
    let receipt = initial ? { id: "old", status: initial as string, result: initial === "confirmed" ? "confirmed before local rollback" : (null as string | null) } : undefined;
    const driver = new DummyDriver();
    const updateReceipt = (query: CompiledQuery) => {
        if (!receipt) return;
        receipt.status = query.sql.includes("='confirmed'") ? "confirmed" : "unknown";
        receipt.result = receipt.status === "confirmed" ? String(query.parameters[0]) : null;
    };
    driver.acquireConnection = () =>
        Promise.resolve({
            executeQuery: <R>(query: CompiledQuery): Promise<QueryResult<R>> => {
                if (query.sql.startsWith("INSERT INTO")) receipt ??= { id: String(query.parameters[0]), status: "pending", result: null };
                if (query.sql.startsWith("UPDATE")) updateReceipt(query);
                return Promise.resolve({ rows: (query.sql.startsWith("SELECT") && receipt ? [{ ...receipt }] : []) as R[] });
            },
            streamQuery: () => {
                throw new Error("unused");
            },
        });
    const db = new Kysely<CrmDatabase>({ dialect: { createAdapter: () => new MysqlAdapter(), createDriver: () => driver, createIntrospector: (value) => new MysqlIntrospector(value), createQueryCompiler: () => new MysqlQueryCompiler() } });
    databases.push(db);
    const client = { integrationContext: () => ({ environment: "sandbox" }), transferUnit: vi.fn().mockResolvedValue({ environment: "sandbox", instanceId: "789" }) };
    const legacy = { lockApproval: vi.fn().mockResolvedValue({ netsuiteId: "123" }) };
    const workflow = new NetsuiteUnitTransferWorkflow({ db } as DatabaseService, client as unknown as NetsuiteRestletClient, legacy as unknown as FormalizationApprovalLegacy);
    return { execute: (operationId = "operation") => workflow.execute(db as unknown as Transaction<CrmDatabase>, { ...command, operationId }), client, receipt: () => receipt };
}

it("declares every dependency explicitly", () => {
    expect(Reflect.getMetadata(SELF_DECLARED_DEPS_METADATA, NetsuiteUnitTransferWorkflow)).toEqual(
        expect.arrayContaining([
            { index: 0, param: DatabaseService },
            { index: 1, param: NetsuiteRestletClient },
            { index: 2, param: FORMALIZATION_APPROVAL_LEGACY },
        ]),
    );
});
it("reuses external confirmation after the local stage transaction rolled back", async () => {
    const f = setup("confirmed");
    await expect(f.execute()).resolves.toBe("confirmed before local rollback");
    expect(f.client.transferUnit).not.toHaveBeenCalled();
});
it.each(["pending", "unknown"] as const)("blocks %s receipts without calling NetSuite", async (state) => {
    const f = setup(state);
    const response: unknown = expect.objectContaining({ code: "UNIT_TRANSFER_RECONCILIATION_REQUIRED" });
    await expect(f.execute()).rejects.toMatchObject({ response });
    expect(f.client.transferUnit).not.toHaveBeenCalled();
});
it("records unknown outcome durably and does not retry after transport failure", async () => {
    const f = setup();
    f.client.transferUnit.mockRejectedValueOnce(new Error("timeout"));
    await expect(f.execute()).rejects.toThrow("requiere conciliación");
    await expect(f.execute("new operation")).rejects.toThrow("requiere conciliación");
    expect(f.receipt()?.status).toBe("unknown");
    expect(f.client.transferUnit).toHaveBeenCalledOnce();
});
it("allows at most one external invocation across generated retry sequences", async () => {
    await fc.assert(
        fc.asyncProperty(fc.array(fc.uuid(), { minLength: 1, maxLength: 20 }), async (operations) => {
            const f = setup();
            for (const operation of operations) await f.execute(operation);
            expect(f.client.transferUnit).toHaveBeenCalledOnce();
            expect(f.receipt()?.status).toBe("confirmed");
        }),
        { numRuns: 30, seed: 2202780 },
    );
});
it("does not send another PUT for simultaneous requests", async () => {
    const f = setup();
    await Promise.allSettled([f.execute("first"), f.execute("second")]);
    expect(f.client.transferUnit).toHaveBeenCalledOnce();
});
