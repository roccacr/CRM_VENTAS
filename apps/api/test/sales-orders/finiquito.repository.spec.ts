import { type CompiledQuery, DummyDriver, Kysely, MysqlAdapter, MysqlIntrospector, MysqlQueryCompiler, type QueryResult } from "kysely";
import { expect, it, vi } from "vitest";

import type { DatabaseService } from "../../src/database/database.service.js";
import type { CrmDatabase } from "../../src/database/database.types.js";
import type { RecordAuditInput, RecordAuditService } from "../../src/modules/crm/audit/record-audit.service.js";
import type { ContractTransitionLegacy } from "../../src/modules/crm/sales/sales-orders/contract-transition.port.js";
import { type ContractTransitionCommand,ContractTransitionRepository } from "../../src/modules/crm/sales/sales-orders/contract-transition.repository.js";

function setup(native = true, flags = { available: true, saleLost: true, contractSigned: true }) {
    const queries: CompiledQuery[] = [];
    const entries: { after_record_event: unknown; actor_reference_record_event: string; operation_id_record_event: string }[] = [];
    const driver = new DummyDriver();
    driver.acquireConnection = async () => {
        const connection = await DummyDriver.prototype.acquireConnection.call(driver);
        connection.executeQuery = <R>(query: CompiledQuery): Promise<QueryResult<R>> => {
            queries.push(query);
            let rows: object[] = [];
            if (query.sql.includes("from `audit_record_event`")) {
                const operation = query.sql.includes("`event`.`operation_id_record_event` =");
                rows = operation ? entries.filter((entry) => entry.operation_id_record_event === query.parameters.find((value) => typeof value === "string" && /^[a-f0-9]{64}$/.test(value))) : entries.slice(-1);
            }
            if (query.sql.includes("from `sec_user`")) rows = [{ id_user: 9 }];
            return Promise.resolve({ rows: rows as R[] });
        };
        return connection;
    };
    const db = new Kysely<CrmDatabase>({ dialect: { createAdapter: () => new MysqlAdapter(), createDriver: () => driver, createIntrospector: (database) => new MysqlIntrospector(database), createQueryCompiler: () => new MysqlQueryCompiler() } });
    const append = vi.fn((_tx: unknown, input: RecordAuditInput) => {
        entries.push({ after_record_event: JSON.stringify(input.after), actor_reference_record_event: input.actor.publicId, operation_id_record_event: input.operationId });
        return Promise.resolve({ sequence: entries.length, replayed: false, publicId: "event" });
    });
    const repo = new ContractTransitionRepository({ db } as DatabaseService, { enabled: true, captureActor: vi.fn().mockResolvedValue({ publicId: "actor", name: "Actor", roles: [] }), append } as unknown as RecordAuditService, {} as ContractTransitionLegacy);
    // Source resolution is independently covered by contract-transition repository/legacy suites.
    const internals = repo as unknown as { resolve: (...args: unknown[]) => Promise<unknown>; readEvent: (...args: unknown[]) => Promise<unknown> };
    vi.spyOn(internals, "resolve").mockResolvedValue({ source: native ? "native" : "legacy", native: native ? { public_id_sales_order: "native", id_sales_order: 7, id_old_produccion_sales_order: null } : undefined, order: { id: "7", approved: true, ...flags } });
    const readEvent = vi.spyOn(internals, "readEvent").mockResolvedValue({ state: "bank_management", sequence: 4 });
    const command: ContractTransitionCommand = { source: native ? "native" : "legacy", id: "7", action: "set", ownOnly: false, actorPublicId: "actor", reason: "", operationId: "uuid-1", correlationId: "trace", expectedSequence: 4 };
    return { db, repo, command, append, readEvent, queries, entries };
}
it.each([true, false])("persiste y relee la rama sin cambiar visitas, nativo=%s", async (native) => {
    const f = setup(native);
    try {
        expect(await f.repo.finiquito(f.command)).toMatchObject({ eligible: true, status: null, version: 0 });
        const started = await f.repo.finiquito(f.command, { status: "pending_send", expectedVersion: 0 });
        expect(started).toMatchObject({ status: "pending_send", version: 1, originStage: "bank_management" });
        f.readEvent.mockResolvedValue({ state: "pending_balance", sequence: 5 });
        await f.repo.finiquito({ ...f.command, operationId: "uuid-2" }, { status: "sent", expectedVersion: 1 });
        await f.repo.finiquito({ ...f.command, operationId: "uuid-3" }, { status: "signed", expectedVersion: 2 });
        expect(await f.repo.finiquito(f.command)).toMatchObject({ status: "signed", version: 3, originStage: "bank_management" });
        expect(f.append.mock.calls[0]?.[1].source.schema).toBe(native ? "CRM_THINK_V2" : "crmdatabase-api");
        expect(f.queries.every((query) => !/^(insert|update|delete)/i.test(query.sql))).toBe(true);
    } finally {
        await f.db.destroy();
    }
});
it("el UUID idéntico devuelve el resultado original sin duplicarlo", async () => {
    const f = setup();
    try {
        const change = { status: "pending_send" as const, expectedVersion: 0 };
        const first = await f.repo.finiquito(f.command, change);
        expect(await f.repo.finiquito(f.command, change)).toEqual(first);
        expect(f.append).toHaveBeenCalledOnce();
        await expect(f.repo.finiquito(f.command, { status: "sent", expectedVersion: 1 })).rejects.toMatchObject({ status: 409 });
        await expect(f.repo.finiquito({ ...f.command, actorPublicId: "other" }, change)).rejects.toMatchObject({ status: 409 });
    } finally {
        await f.db.destroy();
    }
});
it("rechaza versiones viejas y saltos sin escribir", async () => {
    const f = setup();
    try {
        await expect(f.repo.finiquito(f.command, { status: "pending_send", expectedVersion: 1 })).rejects.toMatchObject({ status: 409 });
        await expect(f.repo.finiquito(f.command, { status: "signed", expectedVersion: 0 })).rejects.toMatchObject({ status: 409 });
        expect(f.append).not.toHaveBeenCalled();
    } finally {
        await f.db.destroy();
    }
});
it.each([
    { available: true, saleLost: false, contractSigned: true },
    { available: true, saleLost: true, contractSigned: false },
    { available: false, saleLost: true, contractSigned: true },
])("revalida los checks de BD %j", async (flags) => {
    const f = setup(true, flags);
    try {
        await expect(f.repo.finiquito(f.command, { status: "pending_send", expectedVersion: 0 })).rejects.toMatchObject({ status: flags.available ? 409 : 404 });
        expect(f.append).not.toHaveBeenCalled();
    } finally {
        await f.db.destroy();
    }
});
it("si falla auditoría la transacción rechaza y no confirma éxito", async () => {
    const f = setup();
    f.append.mockRejectedValueOnce(new Error("audit unavailable"));
    try {
        await expect(f.repo.finiquito(f.command, { status: "pending_send", expectedVersion: 0 })).rejects.toThrow("audit unavailable");
    } finally {
        await f.db.destroy();
    }
});
