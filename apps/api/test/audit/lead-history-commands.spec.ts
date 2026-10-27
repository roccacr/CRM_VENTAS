import { type CompiledQuery, DummyDriver, Kysely, MysqlAdapter, MysqlIntrospector, MysqlQueryCompiler, type QueryResult } from "kysely";
import { describe, expect, it, vi } from "vitest";

import type { CrmDatabase } from "../../src/database/database.types.js";
import { LeadHistoryCommands } from "../../src/modules/crm/leads/lead-history-commands.js";

const command = { kind: "activity" as const, leadPublicId: "01M4VECV87Y3Q3TGBBK8X2MHYX", actorUserId: 7, operationId: "note-1", expectedVersion: 0, actionCode: "note_added", reasonCode: null, detail: "Nota de contacto" };
function fixture(options: { failAudit?: boolean; version?: number; replay?: object; inactive?: boolean; reasonInactive?: boolean; stage?: string; sequence?: number } = {}) {
    const queries: CompiledQuery[] = [];
    const lifecycle: string[] = [];
    class Driver extends DummyDriver {
        override beginTransaction() {
            lifecycle.push("begin");
            return Promise.resolve();
        }
        override commitTransaction() {
            lifecycle.push("commit");
            return Promise.resolve();
        }
        override rollbackTransaction() {
            lifecycle.push("rollback");
            return Promise.resolve();
        }
        override async acquireConnection() {
            const connection = await super.acquireConnection();
            // eslint-disable-next-line complexity, sonarjs/cognitive-complexity -- The fixture dispatches compiled SQL statements, not business decisions.
            connection.executeQuery = <R>(query: CompiledQuery): Promise<QueryResult<R>> => {
                queries.push(query);
                let rows: object[] = [];
                if (query.sql.includes("from `crm_lead`")) rows = [{ id: 10, version: options.version ?? 0, stage: options.stage ?? "interested", status: "active", deleted: null }];
                else if (query.sql.includes("from `int_lead_history_link`")) rows = [];
                else if (query.sql.includes("from `audit_record_event`")) rows = options.replay ? [{ publicId: "replayed-event", snapshot: JSON.stringify({ historyCommand: options.replay }) }] : [];
                else if (query.sql.includes("from `audit_record`")) rows = [{ id: "01M4VECV87Y3Q3TGBBK8X2MHYY", schema: "CRM_THINK_V2", entity: "lead", table: "crm_lead", sourceId: "10" }];
                else if (query.sql.includes("from `conf_lead_action_type`")) rows = options.inactive ? [] : [{ code: "note_added" }];
                else if (query.sql.includes("from `conf_lead_status`")) rows = options.inactive ? [] : [{ code: "lost" }];
                else if (query.sql.includes("from `conf_action_reason`")) rows = options.reasonInactive ? [] : [{ code: "budget", name: "Presupuesto" }];
                else if (query.sql.includes("from `conf_action_reason_status`")) rows = options.reasonInactive ? [] : [{ code: "budget" }];
                else if (query.sql.includes("from `audit_lead_status_event`")) rows = [{ sequence: options.sequence ?? 0 }];
                return Promise.resolve({ rows: rows as R[] });
            };
            return connection;
        }
    }
    const db = new Kysely<CrmDatabase>({ dialect: { createAdapter: () => new MysqlAdapter(), createDriver: () => new Driver(), createIntrospector: (database) => new MysqlIntrospector(database), createQueryCompiler: () => new MysqlQueryCompiler() } });
    const audit = { captureActor: vi.fn().mockResolvedValue({ publicId: "actor", name: "Usuario", roles: [] }), append: vi.fn().mockImplementation(() => (options.failAudit ? Promise.reject(new Error("Audit unavailable")) : Promise.resolve({ publicId: "01M4VECV87Y3Q3TGBBK8X2MHYZ", sequence: 1, replayed: false }))) };
    return { db, queries, lifecycle, audit, service: new LeadHistoryCommands({ db }, audit) };
}

describe("native lead history commands", () => {
    it("preserves a repeated loss as a new transition with its own reason and sequence", async () => {
        const f = fixture({ stage: "follow_up", sequence: 4 });
        try {
            await f.service.execute({ kind: "status", leadPublicId: command.leadPublicId, actorUserId: 7, operationId: "loss-5", expectedVersion: 0, toStatusCode: "lost", reasonCode: "budget", detail: "No dispone de presupuesto" });
            const transition = f.queries.find((query) => query.sql.startsWith("insert into `audit_lead_status_event`"));
            expect(transition?.parameters).toEqual(expect.arrayContaining([5, "follow_up", "lost", "budget", "Presupuesto", "loss-5"]));
            expect(f.audit.append.mock.calls[0]?.[1]).toMatchObject({ action: "state_change", before: { statusCode: "follow_up" }, after: { statusCode: "lost", historyEntry: { fromStatusCode: "follow_up", toStatusCode: "lost", reason: { code: "budget", name: "Presupuesto" } } } });
            expect(f.lifecycle).toEqual(["begin", "commit"]);
        } finally {
            await f.db.destroy();
        }
    });
    it.each([{ reasonInactive: true }, { stage: "lost" }])("rejects invalid stage transitions without audit or business writes: %j", async (options) => {
        const f = fixture(options);
        try {
            await expect(f.service.execute({ kind: "status", leadPublicId: command.leadPublicId, actorUserId: 7, operationId: "loss", expectedVersion: 0, toStatusCode: "lost", reasonCode: "budget", detail: "Motivo" })).rejects.toThrow();
            expect(f.audit.append).not.toHaveBeenCalled();
            expect(f.lifecycle).toEqual(["begin", "rollback"]);
        } finally {
            await f.db.destroy();
        }
    });
    it("uses the business transaction for actor, activity, version and central audit", async () => {
        const f = fixture();
        try {
            await f.service.execute(command);
            expect(f.lifecycle).toEqual(["begin", "commit"]);
            expect(f.audit.append).toHaveBeenCalledOnce();
            expect(f.audit.captureActor.mock.calls[0]?.[0]).toBe(f.audit.append.mock.calls[0]?.[0]);
            expect(f.queries.some((query) => query.sql.startsWith("insert into `crm_lead_activity`"))).toBe(true);
            expect(f.queries.some((query) => query.sql.startsWith("update `crm_lead`"))).toBe(true);
        } finally {
            await f.db.destroy();
        }
    });
    it("rolls back when central audit fails", async () => {
        const f = fixture({ failAudit: true });
        try {
            await expect(f.service.execute(command)).rejects.toThrow("Audit unavailable");
            expect(f.lifecycle).toEqual(["begin", "rollback"]);
        } finally {
            await f.db.destroy();
        }
    });
    it.each([{ version: 1 }, { inactive: true }])("rejects stale or inactive commands before changing the lead: %j", async (options) => {
        const f = fixture(options);
        try {
            await expect(f.service.execute(command)).rejects.toThrow();
            expect(f.audit.append).not.toHaveBeenCalled();
        } finally {
            await f.db.destroy();
        }
    });
    it("replays identical commands without incrementing the version again", async () => {
        const f = fixture({ version: 1, replay: command });
        try {
            expect(await f.service.execute(command)).toEqual({ publicId: "replayed-event", replayed: true });
            expect(f.audit.append).not.toHaveBeenCalled();
        } finally {
            await f.db.destroy();
        }
    });
    it("rejects reusing an operation with different content", async () => {
        const f = fixture({ replay: { ...command, detail: "Otro texto" } });
        try {
            await expect(f.service.execute(command)).rejects.toThrow("different content");
        } finally {
            await f.db.destroy();
        }
    });
});
