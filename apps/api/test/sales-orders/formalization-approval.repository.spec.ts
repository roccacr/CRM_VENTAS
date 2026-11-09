import { type CompiledQuery, DummyDriver, Kysely, MysqlAdapter, MysqlIntrospector, MysqlQueryCompiler, type QueryResult } from "kysely";
import { expect, it, vi } from "vitest";

import { type DatabaseService } from "../../src/database/database.service.js";
import type { CrmDatabase } from "../../src/database/database.types.js";
import { type RecordAuditService } from "../../src/modules/crm/audit/record-audit.service.js";
import { FormalizationApprovalRepository } from "../../src/modules/crm/sales/sales-orders/formalization-approval.repository.js";
import { anyOf } from "../support/throws.js";

const command = { source: "native" as const, id: "01ARZ3NDEKTSV4RRFFQ69G5FAV", actorPublicId: "actor", ownOnly: false, expectedSequence: 0, operationId: "550e8400-e29b-41d4-a716-446655440000", correlationId: "trace" };
function setup(options: { native?: boolean; inactive?: boolean; prerequisites?: boolean; state?: string; sequence?: number; auditFailure?: boolean; erpFailure?: boolean; owner?: string; replay?: boolean; replayActor?: string; promotion?: boolean } = {}) {
    const steps: string[] = [];
    const queries: CompiledQuery[] = [];
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
    const responses: [string, (query: CompiledQuery) => Record<string, unknown>[]][] = [
        [
            "from `crm_sales_order`",
            (query) => {
                const locking = query.sql.includes("for update");
                steps.push(locking ? "native-lock" : "native-probe");
                if (options.native === false || (options.promotion && !locking)) return [];
                return [{ id_sales_order: 42, public_id_sales_order: command.id, lead_id_sales_order: 12, status_sales_order: options.inactive ? "inactive" : "active", cancelled_sales_order: "no", deleted_at_sales_order: null }];
            },
        ],
        ["from `crm_sales_order_approval`", () => ["sales_management", "developer", "formalization"].map((type) => ({ type_code_sales_order_approval: type, status_sales_order_approval: type === "formalization" || options.prerequisites === false ? "not_approved" : "approved", version_sales_order_approval: 0 }))],
        ["from `crm_sales_order_external_reference`", () => [{ netsuiteId: "123" }]],
        ["from `sec_user`", () => [{ id_user: 7 }]],
        ["from `crm_lead`", () => [{ public_id_user: options.owner ?? "actor" }]],
        ["from `audit_record`", () => (options.replay ? [{ source_schema_record_event: "CRM_THINK_V2", source_id_record_event: "42", actor_reference_record_event: options.replayActor ?? "actor", before_record_event: JSON.stringify({ version: 0 }), after_record_event: JSON.stringify({ state: "contract_pending_send", version: 1 }) }] : [])],
        ["from `audit_sales_order_state_event`", () => (options.state ? [{ sequence: options.sequence ?? 1, state: options.state }] : [])],
    ];
    driver.acquireConnection = () =>
        Promise.resolve({
            executeQuery: <R>(query: CompiledQuery): Promise<QueryResult<R>> => {
                queries.push(query);
                if (query.sql.startsWith("insert") || query.sql.startsWith("update")) steps.push("write");
                const rows = responses.find(([pattern]) => query.sql.includes(pattern))?.[1](query) ?? [];
                return Promise.resolve({ rows: rows as R[] });
            },
            async *streamQuery() {
                yield await Promise.resolve({ rows: [] });
            },
        });
    const db = new Kysely<CrmDatabase>({ dialect: { createDriver: () => driver, createAdapter: () => new MysqlAdapter(), createIntrospector: (database) => new MysqlIntrospector(database), createQueryCompiler: () => new MysqlQueryCompiler() } });
    const audit = {
        enabled: true,
        captureActor: vi.fn().mockResolvedValue({ publicId: "actor", name: "Actor", roles: [] }),
        append: vi.fn().mockImplementation(() => {
            steps.push("audit");
            return options.auditFailure ? Promise.reject(new Error("DB failure")) : Promise.resolve({ sequence: 1 });
        }),
    };
    const legacy = {
        lockApproval: vi.fn().mockImplementation(() => {
            steps.push("legacy-lock");
            return Promise.resolve({ id: "901", netsuiteId: "123", active: !options.inactive, prerequisitesApproved: options.prerequisites !== false, formalization: "not_approved" });
        }),
        owner: vi.fn().mockResolvedValue(options.owner ?? "actor"),
        event: vi.fn().mockResolvedValue(options.state ? { sequence: options.sequence ?? 1, state: options.state } : undefined),
        approveFormalization: vi.fn().mockImplementation(() => {
            steps.push("legacy-write");
            return Promise.resolve();
        }),
        append: vi.fn().mockResolvedValue(undefined),
    };
    const erp = {
        approveFormalization: vi.fn().mockImplementation(() => {
            steps.push("erp");
            return options.erpFailure ? Promise.reject(new Error("ERP unavailable")) : Promise.resolve({ id: "123", approved: true as const, alreadyApproved: true, environment: "sandbox" as const });
        }),
    };
    const repo = new FormalizationApprovalRepository({ db } as DatabaseService, audit as unknown as RecordAuditService, legacy, erp);
    return { db, repo, steps, queries, legacy, audit, erp };
}
it.each([true, false])("confirms ERP before committing the authoritative approval and audit (native %s)", async (native) => {
    const f = setup({ native });
    try {
        await expect(f.repo.approve({ ...command, source: native ? "native" : "legacy", id: native ? command.id : "901" })).resolves.toMatchObject({ source: native ? "native" : "legacy", approved: true, alreadyApproved: true, state: "contract_pending_send", sequence: 1, replayed: false });
        expect(f.steps.indexOf("erp")).toBeLessThan(f.steps.indexOf(native ? "write" : "legacy-write"));
        expect(f.steps.at(-1)).toBe("commit");
        expect(f.audit.append).toHaveBeenCalledOnce();
        if (native) {
            expect(f.legacy.approveFormalization).not.toHaveBeenCalled();
            expect(f.legacy.lockApproval).not.toHaveBeenCalled();
        } else {
            expect(f.legacy.approveFormalization).toHaveBeenCalledOnce();
            expect(f.legacy.append).toHaveBeenCalledOnce();
            expect(f.queries.some((q) => q.sql.startsWith("update `crm_sales_order"))).toBe(false);
        }
    } finally {
        await f.db.destroy();
    }
});
it.each([{ inactive: true }, { prerequisites: false }, { state: "contract_pending_signature" }, { sequence: 2, state: "pending_approval" }, { owner: "other" }])("rejects invalid business state, version or resource scope before ERP %j", async (options) => {
    const f = setup(options);
    try {
        await expect(f.repo.approve({ ...command, ownOnly: true })).rejects.toThrow(anyOf("La orden está inactiva o marcada como venta caída en el CRM.", "En el CRM faltan las aprobaciones de Jefe de Ventas y/o Desarrolladora.", "La orden cambió. Actualiza antes de aprobar.", "La orden está fuera de su alcance."));
        expect(f.erp.approveFormalization).not.toHaveBeenCalled();
        expect(f.audit.append).not.toHaveBeenCalled();
        expect(f.steps.at(-1)).toBe("rollback");
    } finally {
        await f.db.destroy();
    }
});
it("keeps both DB sources untouched when ERP fails", async () => {
    const f = setup({ native: false, erpFailure: true });
    try {
        await expect(f.repo.approve({ ...command, source: "legacy", id: "901" })).rejects.toThrow("ERP unavailable");
        expect(f.legacy.approveFormalization).not.toHaveBeenCalled();
        expect(f.audit.append).not.toHaveBeenCalled();
        expect(f.steps.at(-1)).toBe("rollback");
    } finally {
        await f.db.destroy();
    }
});
it("reports reconciliation instead of a false success after ERP confirmation and local failure", async () => {
    const f = setup({ auditFailure: true });
    try {
        await expect(f.repo.approve(command)).rejects.toMatchObject({ status: 503, response: { code: "FORMALIZATION_APPROVAL_RECONCILIATION_REQUIRED" } });
        expect(f.erp.approveFormalization).toHaveBeenCalledOnce();
        expect(f.steps.at(-1)).toBe("rollback");
    } finally {
        await f.db.destroy();
    }
});
it("replays the same operation without another ERP write or audit event", async () => {
    const f = setup({ replay: true });
    try {
        await expect(f.repo.approve(command)).resolves.toMatchObject({ approved: true, replayed: true, sequence: 1 });
        expect(f.erp.approveFormalization).not.toHaveBeenCalled();
        expect(f.audit.append).not.toHaveBeenCalled();
    } finally {
        await f.db.destroy();
    }
});
it("does not replay another actor's operation", async () => {
    const f = setup({ replay: true, replayActor: "other" });
    try {
        await expect(f.repo.approve(command)).rejects.toMatchObject({ status: 409 });
        expect(f.erp.approveFormalization).not.toHaveBeenCalled();
    } finally {
        await f.db.destroy();
    }
});
it("rechecks native authority after locking legacy to handle promotion races", async () => {
    const f = setup({ promotion: true });
    try {
        await expect(f.repo.approve({ ...command, source: "legacy", id: "901" })).resolves.toMatchObject({ source: "native" });
        expect(f.steps.indexOf("legacy-lock")).toBeLessThan(f.steps.indexOf("native-lock"));
        expect(f.legacy.approveFormalization).not.toHaveBeenCalled();
    } finally {
        await f.db.destroy();
    }
});
