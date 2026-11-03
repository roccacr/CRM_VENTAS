import { SELF_DECLARED_DEPS_METADATA } from "@nestjs/common/constants.js";
import { type CompiledQuery, DummyDriver, Kysely, MysqlAdapter, MysqlIntrospector, MysqlQueryCompiler, type QueryResult } from "kysely";
import { describe, expect, it, vi } from "vitest";

import { DatabaseService } from "../../src/database/database.service.js";
import type { CrmDatabase } from "../../src/database/database.types.js";
import { RecordAuditService } from "../../src/modules/crm/audit/record-audit.service.js";
import { CONTRACT_TRANSITION_LEGACY } from "../../src/modules/crm/sales/sales-orders/contract-transition.port.js";
import { ContractTransitionRepository } from "../../src/modules/crm/sales/sales-orders/contract-transition.repository.js";

const request = { source: "native" as const, id: "01ARZ3NDEKTSV4RRFFQ69G5FAV", action: "send" as const, ownOnly: false, actorPublicId: "actor", reason: "", operationId: "550e8400-e29b-41d4-a716-446655440000", correlationId: "trace", expectedSequence: 0 };
function paidFixture(paid: "yes" | "no" | "unknown" = "yes") {
    return { native: paid, legacy: { yes: true, no: false, unknown: null }[paid] };
}
function completionFixture(value: boolean | null = false) {
    const native = value === null ? "unknown" : value ? "yes" : "no";
    return { native, legacy: value };
}
function commandIdentity(native: boolean) {
    return native ? { source: "native" as const, id: request.id } : { source: "legacy" as const, id: "901" };
}
function setup(
    options: {
        paid?: "yes" | "no" | "unknown";
        transferred?: boolean | null;
        keys?: boolean | null;
        delivered?: boolean | null;
        formalizationOnly?: boolean;
        funds?: "own_funds" | "bank_financing" | null;
        signed?: "yes" | "no" | "unknown";
        native?: boolean;
        probeMiss?: boolean;
        inactive?: boolean;
        deleted?: boolean;
        migrated?: boolean;
        approved?: boolean;
        state?: string;
        sequence?: number;
        replay?: boolean;
        replayReason?: string;
        replayState?: string;
        enabled?: boolean;
        owner?: string | null;
        auditSequence?: number;
        fundsReplay?: Record<string, unknown>;
    } = {},
) {
    const paid = paidFixture(options.paid);
    const queries: CompiledQuery[] = [];
    const steps: string[] = [];
    const nativeRows = [
        {
            installments_fully_paid_sales_order: paid.native,
            unit_transferred_sales_order: completionFixture(options.transferred).native,
            keys_delivered_sales_order: completionFixture(options.keys).native,
            unit_delivered_sales_order: completionFixture(options.delivered).native,
            id_sales_order: 42,
            purchase_funds_origin_sales_order: options.funds,
            contract_signed_sales_order: options.signed ?? "yes",
            lead_id_sales_order: 12,
            public_id_sales_order: request.id,
            native_code_sales_order: "SO-42",
            id_old_produccion_sales_order: options.migrated ? 901 : null,
            status_sales_order: options.inactive ? "inactive" : "active",
            cancelled_sales_order: "no",
            deleted_at_sales_order: options.deleted ? new Date() : null,
        },
    ];
    const responses: [RegExp, (query: CompiledQuery) => Record<string, unknown>[]][] = [
        [/from `audit_record_event`.*`operation_id_record_event`/, () => (options.fundsReplay ? [options.fundsReplay] : [])],
        [/from `audit_record_event`/, () => (options.auditSequence ? [{ sequence_record_event: options.auditSequence }] : [])],
        [
            /from `crm_sales_order`/,
            (query) => {
                const locking = query.sql.includes("for update");
                steps.push(locking ? "native-lock" : "native-probe");
                return options.native === false || (options.probeMiss && !locking) ? [] : nativeRows;
            },
        ],
        [/from `crm_lead`/, () => (options.owner === null ? [] : [{ public_id_user: options.owner ?? "actor" }])],
        [/from `sec_user`/, () => [{ id_user: 7 }]],
        [/from `crm_sales_order_approval`/, () => (options.approved === false ? [] : (options.formalizationOnly ? ["formalization"] : ["sales_management", "developer", "formalization"]).map((type) => ({ type_code_sales_order_approval: type, status_sales_order_approval: "approved" })))],
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
        owner: vi.fn().mockResolvedValue(options.owner === undefined ? "actor" : options.owner),
        lock: vi.fn().mockImplementation(() => {
            steps.push("legacy-lock");
            return Promise.resolve({ installmentsFullyPaid: paid.legacy, unitTransferred: completionFixture(options.transferred).legacy, keysDelivered: completionFixture(options.keys).legacy, unitDelivered: completionFixture(options.delivered).legacy, id: "901", businessId: "901", purchaseFundsOrigin: options.funds ?? null, active: true, approved: true, contractSigned: (options.signed ?? "yes") === "yes" });
        }),
        event: vi.fn().mockImplementation((_tx, _id, operationId) => Promise.resolve(!operationId && options.state ? { sequence: options.sequence ?? 1, state: options.state } : undefined)),
        append: vi.fn().mockResolvedValue(undefined),
        updatePurchaseFunds: vi.fn().mockResolvedValue(undefined),
    };
    return { repo: new ContractTransitionRepository({ db } as DatabaseService, audit as unknown as RecordAuditService, legacy), db, queries, steps, audit, legacy };
}

describe("contract transitions on one transaction with doubles only", () => {
    it("rolls back a classification update when its audit cannot be appended", async () => {
        const f = setup();
        f.audit.append.mockRejectedValueOnce(new Error("audit failed"));
        try {
            await expect(f.repo.updatePurchaseFunds({ ...request, expectedAuditSequence: 0, purchaseFundsOrigin: "own_funds", expectedPurchaseFundsOrigin: null })).rejects.toThrow("audit failed");
            expect(f.steps.at(-1)).toBe("rollback");
        } finally {
            await f.db.destroy();
        }
    });
    it("uses the authoritative native alias and permits classification before approvals", async () => {
        const f = setup({ migrated: true, approved: false });
        try {
            await f.repo.updatePurchaseFunds({ ...request, source: "legacy", id: "901", expectedAuditSequence: 0, purchaseFundsOrigin: "own_funds", expectedPurchaseFundsOrigin: null });
            expect(f.legacy.updatePurchaseFunds).not.toHaveBeenCalled();
            expect(f.audit.append).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ source: { schema: "crmdatabase-api", entity: "sales_order", table: "ordenventa", id: "901" }, effectiveSource: { schema: "CRM_THINK_V2", table: "crm_sales_order", id: "42" } }));
            expect(f.queries.filter((q) => q.sql.includes("from `audit_record_event`")).every((q) => q.sql.includes("for update"))).toBe(true);
        } finally {
            await f.db.destroy();
        }
    });
    it("rejects ABA edits using the audit version even when funds and stage match", async () => {
        const f = setup({ funds: null, auditSequence: 2 });
        try {
            await expect(f.repo.updatePurchaseFunds({ ...request, expectedAuditSequence: 0, purchaseFundsOrigin: "own_funds", expectedPurchaseFundsOrigin: null })).rejects.toThrow("orden");
            expect(f.audit.append).not.toHaveBeenCalled();
        } finally {
            await f.db.destroy();
        }
    });
    it.each(["valid", "actor", "payload", "corrupt"])("validates historical funds retry %s before any mutation", async (mode) => {
        const before = { auditVersion: 0, stateVersion: 0, purchaseFundsOrigin: null };
        const after = { auditVersion: 0, stateVersion: 0, purchaseFundsOrigin: mode === "payload" ? "bank_financing" : "own_funds" };
        const f = setup({ funds: "bank_financing", state: "pending_balance", auditSequence: 8, fundsReplay: { actor_reference_record_event: mode === "actor" ? "other" : "actor", action_record_event: "update", before_record_event: JSON.stringify(before), after_record_event: mode === "corrupt" ? "broken" : JSON.stringify(after) } });
        try {
            const result = f.repo.updatePurchaseFunds({ ...request, expectedAuditSequence: 0, purchaseFundsOrigin: "own_funds", expectedPurchaseFundsOrigin: null });
            if (mode === "valid") await expect(result).resolves.toMatchObject({ replayed: true, purchaseFundsOrigin: "own_funds" });
            else await expect(result).rejects.toMatchObject({ status: 409 });
            expect(f.audit.append).not.toHaveBeenCalled();
            expect(f.queries.some((q) => q.sql.startsWith("update "))).toBe(false);
        } finally {
            await f.db.destroy();
        }
    });
    it.each([true, false])("saves funds independently without creating a stage visit (native %s)", async (native) => {
        const f = setup({ native, funds: null });
        try {
            await expect(f.repo.updatePurchaseFunds({ ...request, ...commandIdentity(native), expectedAuditSequence: 0, purchaseFundsOrigin: "own_funds", expectedPurchaseFundsOrigin: null })).resolves.toMatchObject({ purchaseFundsOrigin: "own_funds", sequence: 0 });
            expect(f.audit.append).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ action: "update", before: { purchaseFundsOrigin: null, stateVersion: 0, auditVersion: 0 }, after: { purchaseFundsOrigin: "own_funds", stateVersion: 0, auditVersion: 0 } }));
            expect(f.queries.some((q) => q.sql.startsWith("insert into `audit_sales_order_state_event`"))).toBe(false);
            expect(f.legacy.append).not.toHaveBeenCalled();
            if (!native) expect(f.legacy.updatePurchaseFunds).toHaveBeenCalledWith(expect.anything(), "901", "own_funds");
            expect(f.steps.at(-1)).toBe("commit");
        } finally {
            await f.db.destroy();
        }
    });
    it.each([{ funds: "bank_financing" as const }, { state: "pending_balance" }, { owner: "someone-else" }])("rejects stale or unauthorized funds edits %j", async (options) => {
        const f = setup(options);
        try {
            await expect(f.repo.updatePurchaseFunds({ ...request, ownOnly: true, expectedAuditSequence: 0, purchaseFundsOrigin: "own_funds", expectedPurchaseFundsOrigin: null })).rejects.toThrow();
            expect(f.audit.append).not.toHaveBeenCalled();
            expect(f.queries.some((q) => q.sql.startsWith("update "))).toBe(false);
        } finally {
            await f.db.destroy();
        }
    });
    it.each(["own_funds", "bank_financing"] as const)("does not let exceptional capability bypass the %s exit route", async (purchaseFundsOrigin) => {
        const f = setup({ state: "contract_pending_signature" });
        try {
            await expect(f.repo.transition({ ...request, action: "set", targetState: "closed", expectedSequence: 1, canSkipStages: true, reason: "Exception", purchaseFundsOrigin })).rejects.toMatchObject({ response: { code: "PURCHASE_FUNDS_ROUTE_REQUIRED" } });
            expect(f.audit.append).not.toHaveBeenCalled();
        } finally {
            await f.db.destroy();
        }
    });
    it.each([
        [true, "own_funds", "pending_balance"],
        [true, "bank_financing", "bank_management_in_progress"],
        [false, "own_funds", "pending_balance"],
        [false, "bank_financing", "bank_management_in_progress"],
    ] as const)("branches and audits explicit funds atomically (native %s, %s)", async (native, origin, targetState) => {
        const f = setup({ native, state: "contract_pending_signature" });
        try {
            const command = { ...request, source: native ? ("native" as const) : ("legacy" as const), id: native ? request.id : "901", action: "set" as const, targetState, expectedSequence: 1, purchaseFundsOrigin: origin };
            await expect(f.repo.transition(command)).resolves.toMatchObject({ state: targetState, purchaseFundsOrigin: origin });
            expect(f.audit.append.mock.calls[0]?.[1]).toMatchObject({ actor: { publicId: "actor" }, before: { purchaseFundsOrigin: null }, after: { purchaseFundsOrigin: origin } });
            if (native) {
                const update = f.queries.find((q) => q.sql.startsWith("update `crm_sales_order`"));
                expect(update?.sql).toContain("`purchase_funds_origin_sales_order` = ?");
                expect(update?.parameters).toContain(origin);
                expect(update?.sql).not.toMatch(/netsuite|contract_signed/);
            } else expect(f.legacy.append).toHaveBeenCalledWith(expect.anything(), "901", expect.objectContaining({ purchaseFundsOrigin: origin, state: targetState }));
            expect(f.steps.at(-1)).toBe("commit");
        } finally {
            await f.db.destroy();
        }
    });
    it("allows contracts with only Formalization approved while retaining signature guard", async () => {
        const f = setup({ formalizationOnly: true });
        try {
            await expect(f.repo.transition(request)).resolves.toMatchObject({ state: "contract_pending_signature" });
        } finally {
            await f.db.destroy();
        }
    });
    it.each([true, false])("uses stored funds when leaving contracts and preserves historical null later stages (native %s)", async (native) => {
        const f = setup({ native, funds: "own_funds", state: "contract_pending_signature" });
        const g = setup({ native, state: "pending_balance" });
        try {
            const identity = { source: native ? ("native" as const) : ("legacy" as const), id: native ? request.id : "901" };
            await expect(f.repo.transition({ ...request, ...identity, action: "set", targetState: "pending_balance", expectedSequence: 1 })).resolves.toMatchObject({ state: "pending_balance", purchaseFundsOrigin: "own_funds" });
            await expect(g.repo.transition({ ...request, ...identity, action: "set", targetState: "pending_transfer", expectedSequence: 1 })).resolves.toMatchObject({ state: "pending_transfer", purchaseFundsOrigin: null });
        } finally {
            await f.db.destroy();
            await g.db.destroy();
        }
    });
    it.each([true, false].flatMap((native) => ["no", "unknown"].flatMap((paid) => ["pending_transfer", "transfer_signed", "closed"].map((targetState) => ({ native, paid, targetState })))))("blocks unpaid/unknown transfer destinations including exceptional jumps ($native $paid $targetState)", async ({ native, paid, targetState }) => {
        const f = setup({ native, paid: paid as "no" | "unknown", state: "pending_balance" });
        try {
            await expect(f.repo.transition({ ...request, source: native ? "native" : "legacy", id: native ? request.id : "901", action: "set", targetState: targetState as "pending_transfer" | "transfer_signed" | "closed", expectedSequence: 1, canSkipStages: true, reason: "exception" })).rejects.toThrow("cuotas");
            expect(f.audit.append).not.toHaveBeenCalled();
            expect(f.steps.at(-1)).toBe("rollback");
        } finally {
            await f.db.destroy();
        }
    });
    it.each([true, false].flatMap((native) => ["pending_transfer", "transfer_signed", "closed"].map((state) => ({ native, state }))))("forbids returning to balance after transfer ($native $state)", async ({ native, state }) => {
        const f = setup({ native, state });
        try {
            await expect(f.repo.transition({ ...request, source: native ? "native" : "legacy", id: native ? request.id : "901", action: "set", targetState: "pending_balance", expectedSequence: 1, canSkipStages: true, reason: "exception" })).rejects.toThrow("saldo");
        } finally {
            await f.db.destroy();
        }
    });
    it.each([true, false])("retains later stage and blocks forward when checkbox becomes unmarked (native %s)", async (native) => {
        const f = setup({ native, state: "pending_transfer", paid: "no" });
        try {
            await expect(f.repo.transition({ ...request, source: native ? "native" : "legacy", id: native ? request.id : "901", action: "set", targetState: "transfer_signed", expectedSequence: 1 })).rejects.toThrow("cuotas");
            expect(f.audit.append).not.toHaveBeenCalled();
            expect(f.legacy.append).not.toHaveBeenCalled();
        } finally {
            await f.db.destroy();
        }
    });
    it.each(
        [true, false].flatMap((native) =>
            (
                [
                    ["transfer_signed", "pending_transfer"],
                    ["closed", "transfer_signed"],
                ] as const
            ).map(([state, targetState]) => ({ native, state, targetState })),
        ),
    )("preserves authorized reversals with exact destination flags among transfer stages ($native $state)", async ({ native, state, targetState }) => {
        const f = setup({ native, state, transferred: targetState === "transfer_signed" });
        try {
            const command = { ...request, source: native ? ("native" as const) : ("legacy" as const), id: native ? request.id : "901", action: "set" as const, targetState, expectedSequence: 1 };
            await expect(f.repo.transition(command)).rejects.toMatchObject({ status: 403 });
            await expect(f.repo.transition({ ...command, canSkipStages: true })).rejects.toThrow("motivo");
            await expect(f.repo.transition({ ...command, canSkipStages: true, reason: "correction" })).resolves.toMatchObject({ state: targetState, sequence: 2 });
        } finally {
            await f.db.destroy();
        }
    });
    it("rejects changed funds on an idempotent operation", async () => {
        const f = setup({ funds: "own_funds", replay: true, replayState: "pending_balance" });
        try {
            await expect(f.repo.transition({ ...request, action: "set", targetState: "pending_balance", purchaseFundsOrigin: "bank_financing" })).rejects.toThrow("different content");
            expect(f.audit.append).not.toHaveBeenCalled();
        } finally {
            await f.db.destroy();
        }
    });
    it.each([true, false])("requires explicit funds before leaving contracts, including exceptional skip (native %s)", async (native) => {
        const f = setup({ native, state: "contract_pending_signature" });
        try {
            await expect(f.repo.transition({ ...request, source: native ? "native" : "legacy", id: native ? request.id : "901", action: "set", targetState: "closed", expectedSequence: 1, canSkipStages: true, reason: "Excepci�n" })).rejects.toThrow("origen");
            expect(f.audit.append).not.toHaveBeenCalled();
        } finally {
            await f.db.destroy();
        }
    });

    it.each(["contract_pending_signature", "pending_transfer", "transfer_signed", "closed"])("allows explicitly selected destination %s after Formalization approval", async (targetState) => {
        const initial = targetState === "contract_pending_signature";
        const f = setup(initial ? {} : { state: "bank_management_in_progress", transferred: targetState === "transfer_signed", delivered: targetState === "closed" });
        try {
            await expect(f.repo.transition({ ...request, expectedSequence: initial ? 0 : 1, action: "set", targetState, purchaseFundsOrigin: "bank_financing", canSkipStages: true, reason: "Excepción autorizada" } as never)).resolves.toMatchObject({ state: targetState, sequence: initial ? 1 : 2 });
        } finally {
            await f.db.destroy();
        }
    });
    it.each([true, false])("selects any postapproval stage atomically (native %s)", async (native) => {
        const f = setup({ native, state: "contract_pending_signature" });
        try {
            const command = { ...request, expectedSequence: 1, action: "set", targetState: "bank_management_in_progress", purchaseFundsOrigin: "bank_financing", source: native ? "native" : "legacy", id: native ? request.id : "901" };
            await expect(f.repo.transition(command as never)).resolves.toMatchObject({ state: "bank_management_in_progress", sequence: 2 });
            expect(f.audit.append.mock.calls[0]?.[1]).toMatchObject({ after: { state: "bank_management_in_progress" } });
            if (!native) expect(f.legacy.append).toHaveBeenCalledWith(expect.anything(), "901", expect.objectContaining({ state: "bank_management_in_progress" }));
        } finally {
            await f.db.destroy();
        }
    });
    it("requires Formalization approval for a selected stage", async () => {
        const f = setup({ approved: false });
        try {
            await expect(f.repo.transition({ ...request, action: "set", targetState: "closed" } as never)).rejects.toThrow("Formalization approval");
            expect(f.audit.append).not.toHaveBeenCalled();
        } finally {
            await f.db.destroy();
        }
    });
    it("requires a reason when selecting an earlier stage", async () => {
        const f = setup({ state: "bank_management" });
        try {
            await expect(f.repo.transition({ ...request, expectedSequence: 1, action: "set", targetState: "contract_pending_send", canSkipStages: true } as never)).rejects.toThrow("motivo");
            expect(f.audit.append).not.toHaveBeenCalled();
        } finally {
            await f.db.destroy();
        }
    });
    it("records a reasoned selected reversal without deleting history", async () => {
        const f = setup({ state: "closed", sequence: 3, transferred: true });
        try {
            await expect(f.repo.transition({ ...request, expectedSequence: 3, action: "set", targetState: "transfer_signed", canSkipStages: true, reason: "Correccion autorizada" } as never)).resolves.toMatchObject({ sequence: 4, state: "transfer_signed" });
            expect(f.audit.append.mock.calls[0]?.[1]).toMatchObject({ action: "revert", before: { state: "closed" }, after: { state: "transfer_signed" }, reason: "Correccion autorizada" });
        } finally {
            await f.db.destroy();
        }
    });
    it("uses native lead ownership for a legacy pointer shadowed by a native order", async () => {
        const f = setup({ migrated: true, owner: "other", replay: true });
        try {
            await expect(f.repo.transition({ ...request, source: "legacy", id: "901", ownOnly: true })).rejects.toMatchObject({ status: 403 });
            expect(f.legacy.owner).not.toHaveBeenCalled();
            expect(f.legacy.event).not.toHaveBeenCalled();
            expect(f.audit.append).not.toHaveBeenCalled();
        } finally {
            await f.db.destroy();
        }
    });
    it.each([true, false])("area scope permits unowned orders without an owner lookup (native %s)", async (native) => {
        const f = setup({ native, owner: null });
        try {
            await expect(f.repo.transition({ ...request, source: native ? "native" : "legacy", id: native ? request.id : "901" })).resolves.toMatchObject({ sequence: 1 });
            expect(f.legacy.owner).not.toHaveBeenCalled();
            expect(f.queries.some((q) => q.sql.includes("from `crm_lead`"))).toBe(false);
        } finally {
            await f.db.destroy();
        }
    });
    it.each([true, false])("denies a nonowner before replay or writes (native %s)", async (native) => {
        const f = setup({ native, owner: "someone-else", replay: true });
        try {
            await expect(f.repo.transition({ ...request, ownOnly: true, source: native ? "native" : "legacy", id: native ? request.id : "901" })).rejects.toMatchObject({ status: 403 });
            expect(f.legacy.event).not.toHaveBeenCalled();
            expect(f.queries.some((q) => q.sql.includes("from `audit_sales_order_state_event`"))).toBe(false);
            expect(f.audit.append).not.toHaveBeenCalled();
            expect(f.legacy.append).not.toHaveBeenCalled();
            expect(f.steps.at(-1)).toBe("rollback");
        } finally {
            await f.db.destroy();
        }
    });
    it.each([true, false])("permits uniquely resolved owner (native %s)", async (native) => {
        const f = setup({ native });
        try {
            await expect(f.repo.transition({ ...request, ownOnly: true, source: native ? "native" : "legacy", id: native ? request.id : "901" })).resolves.toMatchObject({ sequence: 1 });
            if (native) expect(f.queries.find((q) => q.sql.includes("from `crm_lead`"))?.sql).toContain("for update");
            else expect(f.legacy.owner).toHaveBeenCalledWith(f.legacy.lock.mock.calls[0]?.[0], "901");
        } finally {
            await f.db.destroy();
        }
    });
    it.each([true, false])("defaults omitted scope to owner-only and rejects missing owner (native %s)", async (native) => {
        const f = setup({ native, owner: null });
        const { ownOnly: _scope, ...command } = request;
        try {
            await expect(f.repo.transition({ ...command, source: native ? "native" : "legacy", id: native ? request.id : "901" })).rejects.toMatchObject({ status: 403 });
            expect(f.audit.append).not.toHaveBeenCalled();
        } finally {
            await f.db.destroy();
        }
    });
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
    it("records the logical previous stage, actor and stage responsible without inventing its entry date", async () => {
        const f = setup();
        await expect(f.repo.transition(request)).resolves.toMatchObject({ sequence: 1, state: "contract_pending_signature", source: "native", replayed: false });
        const event = f.queries.find((q) => q.sql.startsWith("insert into `audit_sales_order_state_event`"));
        expect(event?.parameters[3]).toBeNull();
        expect(event?.sql).toContain("responsible_user_id_sales_order_state_event");
        expect(event?.sql).toContain("responsible_snapshot_sales_order_state_event");
        expect(f.audit.append).toHaveBeenCalledWith(f.audit.captureActor.mock.calls[0]?.[0], expect.objectContaining({ before: { businessId: "SO-42", state: "contract_pending_send", version: 0, purchaseFundsOrigin: null }, after: { businessId: "SO-42", state: "contract_pending_signature", version: 1, purchaseFundsOrigin: null } }));
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
        expect(f.legacy.append).toHaveBeenCalledWith(f.audit.append.mock.calls[0]?.[0], "901", expect.objectContaining({ from: null, state: "contract_pending_signature", actor: "actor", actorSnapshot: { publicId: "actor", name: "Actor", roles: [] }, responsibleSnapshot: { publicId: "actor", name: "Actor", roles: [] } }));
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

describe("confirmed contract signature gates banking and all later stages", () => {
    it.each([true, false])("blocks all later destinations without signature in source native=%s", async (native) => {
        for (const signed of ["no", "unknown"] as const) {
            for (const targetState of ["bank_management", "pending_balance", "pending_transfer", "transfer_signed", "closed"]) {
                const f = setup({ native, signed, state: "contract_pending_signature" });
                try {
                    await expect(f.repo.transition({ ...request, source: native ? "native" : "legacy", id: native ? request.id : "901", expectedSequence: 1, action: "set", targetState, purchaseFundsOrigin: "bank_financing", canSkipStages: true, reason: "Excepción autorizada" } as never)).rejects.toMatchObject({ response: { code: "CONTRACT_SIGNATURE_REQUIRED" } });
                    expect(f.audit.append).not.toHaveBeenCalled();
                    expect(f.legacy.append).not.toHaveBeenCalled();
                    expect(f.queries.some((q) => /^(insert|update)/i.test(q.sql))).toBe(false);
                } finally {
                    await f.db.destroy();
                }
            }
        }
    });
    it.each([true, false])("cannot skip sending even if signature is marked (native=%s)", async (native) => {
        const f = setup({ native });
        try {
            await expect(f.repo.transition({ ...request, source: native ? "native" : "legacy", id: native ? request.id : "901", action: "set", targetState: "bank_management" } as never)).rejects.toMatchObject({ response: { code: "CONTRACT_SEND_REQUIRED" } });
            expect(f.audit.append).not.toHaveBeenCalled();
        } finally {
            await f.db.destroy();
        }
    });
});

it.each([true, false])("protects exceptional jumps under the locked native/legacy order (native %s)", async (native) => {
    const f = setup({ native, signed: "yes", transferred: true, state: "bank_management_in_progress" });
    const cmd = { ...request, source: native ? "native" : "legacy", id: native ? request.id : "901", action: "set", targetState: "transfer_signed", expectedSequence: 1, purchaseFundsOrigin: "bank_financing", reason: "Excepción autorizada" };
    try {
        await expect(f.repo.transition(cmd as never)).rejects.toThrow();
        expect(f.audit.append).not.toHaveBeenCalled();
        await expect(f.repo.transition({ ...cmd, canSkipStages: true, reason: "" } as never)).rejects.toThrow("motivo");
        await expect(f.repo.transition({ ...cmd, canSkipStages: true } as never)).resolves.toMatchObject({ state: "transfer_signed" });
    } finally {
        await f.db.destroy();
    }
});

it.each([true, false])("keeps the first visit compatible with SQL constraints while central audit preserves the prior logical state (native %s)", async (native) => {
    const f = setup({ native });
    try {
        await f.repo.transition({ ...request, source: native ? "native" : "legacy", id: native ? request.id : "901" });
        if (native) {
            const insert = f.queries.find((q) => q.sql.startsWith("insert into `audit_sales_order_state_event`"));
            expect(insert?.parameters[3]).toBeNull();
        } else expect(f.legacy.append).toHaveBeenCalledWith(expect.anything(), "901", expect.objectContaining({ sequence: 1, from: null }));
        expect(f.audit.append.mock.calls[0]?.[1]).toMatchObject({ before: { state: "contract_pending_send" }, after: { state: "contract_pending_signature" } });
    } finally {
        await f.db.destroy();
    }
});

it("retains the actual previous visit for subsequent stage changes", async () => {
    const f = setup({ state: "bank_management", sequence: 2 });
    try {
        await f.repo.transition({ ...request, action: "set", targetState: "bank_management_in_progress", expectedSequence: 2 });
        const insert = f.queries.find((q) => q.sql.startsWith("insert into `audit_sales_order_state_event`"));
        expect(insert?.parameters[2]).toBe(3);
        expect(insert?.parameters[3]).toBe("bank_management");
    } finally {
        await f.db.destroy();
    }
});

describe("completion truth table manual commands", () => {
    it.each([true, false].flatMap((native) => Array.from({ length: 16 }, (_, bits) => ({ native, paid: !!(bits & 8), transferred: !!(bits & 4), keys: !!(bits & 2), delivered: !!(bits & 1) }))))("enforces exact target flags in either source %j", async ({ native, paid, transferred, keys, delivered }) => {
        const targets = [null, "closed", null, "closed", null, "closed", null, "closed", "pending_transfer", "closed", "pending_transfer", "closed", "transfer_signed", "closed", null, "closed"];
        const index = Number(paid) * 8 + Number(transferred) * 4 + Number(keys) * 2 + Number(delivered);
        const target = targets[index];
        for (const targetState of ["pending_transfer", "transfer_signed", "closed"] as const) {
            const f = setup({ native, paid: paid ? "yes" : "no", transferred, keys, delivered, state: "pending_balance" });
            try {
                const result = f.repo.transition({ ...request, ...commandIdentity(native), action: "set", targetState, expectedSequence: 1, canSkipStages: true, reason: "Validación" });
                if (targetState === target) await expect(result).resolves.toMatchObject({ state: targetState });
                else await expect(result).rejects.toThrow();
            } finally {
                await f.db.destroy();
            }
        }
    });
    it.each([true, false])("rejects unknown unchecked flags %s", async (native) => {
        const f = setup({ native, state: "pending_balance", transferred: null });
        try {
            await expect(f.repo.transition({ ...request, source: native ? "native" : "legacy", id: native ? request.id : "901", action: "set", targetState: "pending_transfer", expectedSequence: 1 })).rejects.toThrow();
        } finally {
            await f.db.destroy();
        }
    });
});

it.each([true, false].flatMap((native) => ["pending_balance", "pending_transfer", "transfer_signed"].map((state) => ({ native, state }))))("accepts delivered closure without skip capability %j", async ({ native, state }) => {
    const f = setup({ native, state, paid: "no", delivered: true });
    try {
        await expect(f.repo.transition({ ...request, source: native ? "native" : "legacy", id: native ? request.id : "901", action: "set", targetState: "closed", expectedSequence: 1 })).resolves.toMatchObject({ state: "closed" });
    } finally {
        await f.db.destroy();
    }
});

describe("QA nullable completion evidence on manual destinations", () => {
    const values = [false, true, null] as const;
    const cases = [true, false].flatMap((native) => values.flatMap((paid) => values.flatMap((transferred) => values.flatMap((keys) => values.map((delivered) => ({ native, paid, transferred, keys, delivered }))))));
    function expectedDestination(paid: boolean | null, transferred: boolean | null, keys: boolean | null, delivered: boolean | null) {
        if (delivered === true) return "closed";
        if (delivered !== false || paid !== true) return null;
        if (transferred === false) return "pending_transfer";
        if (transferred === true && keys === false) return "transfer_signed";
        return null;
    }
    it.each(cases)("never treats unknown as unchecked %j", async ({ native, paid, transferred, keys, delivered }) => {
        const expected = expectedDestination(paid, transferred, keys, delivered);
        for (const targetState of ["pending_transfer", "transfer_signed", "closed"] as const) {
            const f = setup({ native, paid: paid === null ? "unknown" : paid ? "yes" : "no", transferred, keys, delivered, state: "pending_balance" });
            try {
                const result = f.repo.transition({ ...request, ...commandIdentity(native), action: "set", targetState, expectedSequence: 1, canSkipStages: true, reason: "QA nullable evidence" });
                if (expected === targetState) {
                    await expect(result).resolves.toMatchObject({ state: targetState, sequence: 2 });
                    expect(f.audit.append).toHaveBeenCalledTimes(1);
                    expect(f.steps.at(-1)).toBe("commit");
                } else {
                    await expect(result).rejects.toMatchObject({ response: { code: "FORMALIZATION_COMPLETION_FLAGS_REQUIRED" } });
                    expect(f.audit.append).not.toHaveBeenCalled();
                    expect(f.legacy.append).not.toHaveBeenCalled();
                    expect(f.queries.some((q) => /^(insert|update)/i.test(q.sql))).toBe(false);
                    expect(f.steps.at(-1)).toBe("rollback");
                }
            } finally {
                await f.db.destroy();
            }
        }
    });
    it.each([true, false])("permits highest eligible signed destination without skip native=%s", async (native) => {
        const f = setup({ native, state: "pending_balance", transferred: true });
        try {
            await expect(f.repo.transition({ ...request, ...commandIdentity(native), action: "set", targetState: "transfer_signed", expectedSequence: 1 })).resolves.toMatchObject({ state: "transfer_signed", sequence: 2 });
            expect(f.audit.append).toHaveBeenCalledTimes(1);
        } finally {
            await f.db.destroy();
        }
    });
    it.each([true, false])("blocks same-stage manual command without any writes native=%s", async (native) => {
        const f = setup({ native, state: "pending_transfer" });
        try {
            await expect(f.repo.transition({ ...request, ...commandIdentity(native), action: "set", targetState: "pending_transfer", expectedSequence: 1 })).rejects.toThrow("already");
            expect(f.audit.append).not.toHaveBeenCalled();
            expect(f.legacy.append).not.toHaveBeenCalled();
            expect(f.queries.some((q) => /^(insert|update)/i.test(q.sql))).toBe(false);
        } finally {
            await f.db.destroy();
        }
    });
});
