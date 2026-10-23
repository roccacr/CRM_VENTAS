import { SELF_DECLARED_DEPS_METADATA } from "@nestjs/common/constants.js";
import { type CompiledQuery, DummyDriver, Kysely, MysqlAdapter, MysqlIntrospector, MysqlQueryCompiler, type QueryResult } from "kysely";
import { describe, expect, it, vi } from "vitest";

import { DatabaseService } from "../../src/database/database.service.js";
import type { CrmDatabase } from "../../src/database/database.types.js";
import { RecordAuditService } from "../../src/modules/crm/audit/record-audit.service.js";
import { CONTRACT_TRANSITION_LEGACY } from "../../src/modules/crm/sales/sales-orders/contract-transition.port.js";
import { ContractTransitionRepository } from "../../src/modules/crm/sales/sales-orders/contract-transition.repository.js";

const request = { source: "native" as const, id: "01ARZ3NDEKTSV4RRFFQ69G5FAV", action: "send" as const, actorPublicId: "actor", reason: "", operationId: "550e8400-e29b-41d4-a716-446655440000", correlationId: "trace", expectedSequence: 0 };
function setup(options: { native?: boolean; probeMiss?: boolean; inactive?: boolean; deleted?: boolean; migrated?: boolean; approved?: boolean; state?: string; sequence?: number; replay?: boolean; replayReason?: string; replayState?: string; enabled?: boolean } = {}) {
    const queries: CompiledQuery[] = [];
    const steps: string[] = [];
    const nativeRows = [{ id_sales_order: 42, public_id_sales_order: request.id, native_code_sales_order: "SO-42", id_old_produccion_sales_order: options.migrated ? 901 : null, status_sales_order: options.inactive ? "inactive" : "active", cancelled_sales_order: "no", deleted_at_sales_order: options.deleted ? new Date() : null }];
    const responses: [RegExp, (query: CompiledQuery) => Record<string, unknown>[]][] = [
        [
            /from `crm_sales_order`/,
            (query) => {
                const locking = query.sql.includes("for update");
                steps.push(locking ? "native-lock" : "native-probe");
                return options.native === false || (options.probeMiss && !locking) ? [] : nativeRows;
            },
        ],
        [/from `sec_user`/, () => [{ id_user: 7 }]],
        [/from `crm_sales_order_approval`/, () => (options.approved === false ? [] : ["sales_management", "developer", "formalization"].map((type) => ({ type_code_sales_order_approval: type, status_sales_order_approval: "approved" })))],
        [/from `audit_sales_order_state_event`.*`operation_id_sales_order_state_event`/, () => (options.replay ? [{ sequence_sales_order_state_event: 1, to_state_code_sales_order_state_event: options.replayState ?? "contract_pending_signature", actor_user_id_sales_order_state_event: 7, reason_sales_order_state_event: options.replayReason ?? "" }] : [])],
        [/from `audit_sales_order_state_event`/, () => (options.state ? [{ sequence_sales_order_state_event: options.sequence ?? 1, to_state_code_sales_order_state_event: options.state }] : [])],
    ];
    const driver = new DummyDriver();
    driver.beginTransaction = () => {
        steps.push("begin");
        return Promise.resolve();
    };
    driver.commitTransaction = () => {
        steps.push("commit");
        return Promise.resolve();
    };
    driver.rollbackTransaction = () => {
        steps.push("rollback");
        return Promise.resolve();
    };
    driver.acquireConnection = () =>
        Promise.resolve({
            executeQuery: <R>(q: CompiledQuery): Promise<QueryResult<R>> => {
                queries.push(q);
                const rows = responses.find(([pattern]) => pattern.test(q.sql))?.[1](q) ?? [];
                return Promise.resolve({ rows: rows as R[] });
            },
            async *streamQuery() {
                yield await Promise.resolve({ rows: [] });
            },
        });
    const db = new Kysely<CrmDatabase>({ dialect: { createDriver: () => driver, createAdapter: () => new MysqlAdapter(), createIntrospector: (database) => new MysqlIntrospector(database), createQueryCompiler: () => new MysqlQueryCompiler() } });
    const actor = { publicId: "actor", name: "Actor", roles: [] };
    const audit = { enabled: options.enabled ?? true, captureActor: vi.fn().mockResolvedValue(actor), append: vi.fn().mockResolvedValue({ sequence: 1 }) };
    const legacy = {
        lock: vi.fn().mockImplementation(() => {
            steps.push("legacy-lock");
            return Promise.resolve({ id: "901", businessId: "901", active: true, approved: true });
        }),
        event: vi.fn().mockResolvedValue(undefined),
        append: vi.fn().mockResolvedValue(undefined),
    };
    return { repo: new ContractTransitionRepository({ db } as DatabaseService, audit as unknown as RecordAuditService, legacy), db, queries, steps, audit, legacy };
}

describe("contract transitions on one transaction with doubles only", () => {
    it("declares all injection tokens explicitly", () => {
        expect(Reflect.getMetadata(SELF_DECLARED_DEPS_METADATA, ContractTransitionRepository)).toEqual(
            expect.arrayContaining([
                { index: 0, param: DatabaseService },
                { index: 1, param: RecordAuditService },
                { index: 2, param: CONTRACT_TRANSITION_LEGACY },
            ]),
        );
    });
    it("replays legacy history before version checks without appending central evidence", async () => {
        const f = setup({ native: false });
        f.legacy.event.mockResolvedValue({ sequence: 4, state: "contract_pending_signature", actor: "actor", reason: "" });
        await expect(f.repo.transition({ ...request, source: "legacy", id: "901" })).resolves.toMatchObject({ sequence: 4, replayed: true });
        expect(f.legacy.append).not.toHaveBeenCalled();
        expect(f.audit.append).not.toHaveBeenCalled();
        await f.db.destroy();
    });
    it("records first explicit send from null and snapshots the derived previous stage centrally", async () => {
        const f = setup();
        await expect(f.repo.transition(request)).resolves.toMatchObject({ sequence: 1, state: "contract_pending_signature", source: "native", replayed: false });
        expect(f.queries.find((q) => q.sql.startsWith("insert into `audit_sales_order_state_event`"))?.parameters).toContain(null);
        expect(f.audit.append).toHaveBeenCalledWith(f.audit.captureActor.mock.calls[0]?.[0], expect.objectContaining({ before: { businessId: "SO-42", state: "contract_pending_send", version: 0 }, after: { businessId: "SO-42", state: "contract_pending_signature", version: 1 } }));
        expect(f.steps.at(-1)).toBe("commit");
        await f.db.destroy();
    });
    it.each(["unclassified", "pending_approval"])("derives send for approved native import %s", async (state) => {
        const f = setup({ state });
        await expect(f.repo.transition({ ...request, expectedSequence: 1 })).resolves.toMatchObject({ sequence: 2 });
        await f.db.destroy();
    });
    it.each(["bank_management", "pending_balance", "pending_transfer", "transfer_signed", "closed", "contract_pending_signature"])("blocks send from stored %s", async (state) => {
        const f = setup({ state });
        await expect(f.repo.transition({ ...request, expectedSequence: 1 })).rejects.toThrow();
        expect(f.audit.append).not.toHaveBeenCalled();
        await f.db.destroy();
    });
    it("reverts signature only and retains the reason", async () => {
        const f = setup({ state: "contract_pending_signature" });
        await expect(f.repo.transition({ ...request, action: "revert", reason: "Correction", expectedSequence: 1 })).resolves.toMatchObject({ sequence: 2, state: "contract_pending_send" });
        expect(f.audit.append.mock.calls[0]?.[1]).toMatchObject({ action: "revert", reason: "Correction" });
        await f.db.destroy();
    });
    it.each([{ inactive: true }, { approved: false }, { enabled: false }])("fails closed %j", async (options) => {
        const f = setup(options);
        await expect(f.repo.transition(request)).rejects.toThrow();
        expect(f.audit.append).not.toHaveBeenCalled();
        await f.db.destroy();
    });
    it("returns original sequence before stale checks and never duplicates central audit", async () => {
        const f = setup({ replay: true, state: "closed", sequence: 9 });
        await expect(f.repo.transition(request)).resolves.toMatchObject({ sequence: 1, replayed: true });
        expect(f.audit.append).not.toHaveBeenCalled();
        await f.db.destroy();
    });
    it.each([{ replayReason: "different" }, { replayState: "contract_pending_send" }])("rejects altered replay %j", async (options) => {
        const f = setup({ replay: true, ...options });
        await expect(f.repo.transition(request)).rejects.toThrow("content");
        await f.db.destroy();
    });
    it("rejects stale sequence", async () => {
        const f = setup({ state: "contract_pending_send", sequence: 2 });
        await expect(f.repo.transition(request)).rejects.toThrow("changed");
        await f.db.destroy();
    });
    it.each([{ inactive: true }, { deleted: true }, { inactive: true, replay: true }])("legacy pointer locks the legacy parent then rejects native shadow %j", async (options) => {
        const f = setup({ ...options, migrated: true, probeMiss: true });
        await expect(f.repo.transition({ ...request, source: "legacy", id: "901" })).rejects.toThrow();
        expect(f.legacy.lock).toHaveBeenCalled();
        expect(f.legacy.append).not.toHaveBeenCalled();
        expect(f.steps.indexOf("legacy-lock")).toBeLessThan(f.steps.indexOf("native-lock"));
        expect(f.queries.find((q) => q.sql.includes("from `crm_sales_order`"))?.sql).not.toContain("deleted_at_sales_order` is null");
        await f.db.destroy();
    });
    it("legacy pointer resolves an existing native alias while the legacy adapter is disabled", async () => {
        const f = setup({ migrated: true });
        f.legacy.lock.mockRejectedValue(new Error("Legacy disabled"));
        await expect(f.repo.transition({ ...request, source: "legacy", id: "901" })).resolves.toMatchObject({ source: "native", id: request.id, sequence: 1 });
        expect(f.legacy.lock).not.toHaveBeenCalled();
        expect(f.legacy.append).not.toHaveBeenCalled();
        expect(f.steps).toContain("native-probe");
        expect(f.steps).toContain("native-lock");
        await f.db.destroy();
    });
    it.each([{ inactive: true }, { deleted: true }])("existing native shadow rejects without touching disabled legacy %j", async (options) => {
        const f = setup({ ...options, migrated: true });
        f.legacy.lock.mockRejectedValue(new Error("Legacy disabled"));
        await expect(f.repo.transition({ ...request, source: "legacy", id: "901" })).rejects.toThrow("inactive, deleted or cancelled");
        expect(f.legacy.lock).not.toHaveBeenCalled();
        expect(f.legacy.append).not.toHaveBeenCalled();
        await f.db.destroy();
    });
    it("native request never falls back to legacy when missing", async () => {
        const f = setup({ native: false });
        await expect(f.repo.transition(request)).rejects.toThrow("unavailable");
        expect(f.legacy.lock).not.toHaveBeenCalled();
        expect(f.legacy.append).not.toHaveBeenCalled();
        await f.db.destroy();
    });
    it("writes legacy specialized history and native central audit using the identical transaction", async () => {
        const f = setup({ native: false });
        await f.repo.transition({ ...request, source: "legacy", id: "901" });
        expect(f.legacy.append).toHaveBeenCalledWith(f.audit.append.mock.calls[0]?.[0], "901", expect.objectContaining({ from: null, state: "contract_pending_signature", actor: "actor" }));
        expect(f.audit.append.mock.calls[0]?.[1]).toMatchObject({ source: { schema: "crmdatabase-api", table: "ordenventa", id: "901" } });
        expect(f.queries.some((q) => q.sql.startsWith("insert into `crm_sales_order`"))).toBe(false);
        await f.db.destroy();
    });
    it("migrated native uses legacy canonical identity plus native effective source", async () => {
        const f = setup({ migrated: true });
        await f.repo.transition(request);
        expect(f.audit.append.mock.calls[0]?.[1]).toMatchObject({ source: { schema: "crmdatabase-api", table: "ordenventa", id: "901" }, effectiveSource: { schema: "CRM_THINK_V2", table: "crm_sales_order", id: "42" } });
        await f.db.destroy();
    });
    it.each([true, false])("central failure rolls back the entire transaction (native %s)", async (native) => {
        const f = setup({ native });
        f.audit.append.mockRejectedValue(new Error("central failure"));
        await expect(f.repo.transition(native ? request : { ...request, source: "legacy", id: "901" })).rejects.toThrow("central failure");
        expect(f.steps.at(-1)).toBe("rollback");
        expect(f.steps).not.toContain("commit");
        await f.db.destroy();
    });
});
