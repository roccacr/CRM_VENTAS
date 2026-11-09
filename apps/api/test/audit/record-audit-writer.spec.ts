import { BadRequestException, ServiceUnavailableException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { type CompiledQuery, DummyDriver, Kysely, MysqlAdapter, MysqlIntrospector, MysqlQueryCompiler, type QueryResult } from "kysely";
import { describe, expect, it, vi } from "vitest";

import type { DatabaseService } from "../../src/database/database.service.js";
import type { CrmDatabase } from "../../src/database/database.types.js";
import { captureIntegrationAuditActor } from "../../src/modules/crm/audit/audit-actor.js";
import { RecordAuditService } from "../../src/modules/crm/audit/record-audit.service.js";

const input = {
    source: { schema: "CRM_THINK_V2" as const, entity: "project", table: "crm_project", id: "7" },
    actor: { publicId: "actor", name: "Authenticated actor", roles: [{ code: "formalizacion", name: "Formalizacion" }] },
    action: "update" as const,
    module: "administration",
    before: { name: "Before" },
    after: { name: "After" },
    allowedFields: ["name"],
    operationId: "operation",
    correlationId: "correlation",
    reason: "Change",
    snapshotScope: "partial" as const,
};

/** Compiles SQL and observes transaction lifecycle without a connection or environment file. */
const setup = (options: { ready?: boolean; replay?: Record<string, unknown>; sequence?: number; failInsert?: boolean; schema?: string; anchor?: boolean; startupFailures?: number; startupCode?: string } = {}) => {
    const queries: CompiledQuery[] = [];
    let startupFailures = options.startupFailures ?? 0;
    const lifecycle: string[] = [];
    const responses: [string, (query: CompiledQuery) => unknown[]][] = [
        ["DATABASE()", () => [{ name: options.schema ?? "CRM_THINK_V2" }]],
        ["conf_schema_migration", () => (options.ready === false ? [] : [{ name: "202610220023_record_audit" }, { name: "202610220024_record_audit_identifier_collation" }])],
        ["sec_user_role", () => input.actor.roles.map((role) => ({ ...role }))],
        ["from `sec_user`", () => [{ publicId: input.actor.publicId, name: input.actor.name, status: "active", deleted: null }]],
        ["from `audit_record`", () => (options.anchor === false ? [] : [{ id: "01AAAAAAAAAAAAAAAAAAAAAAAA" }])],
        ["from `audit_record_event`", (query) => (query.sql.includes("operation_id_record_event") ? (options.replay ? [options.replay] : []) : options.sequence ? [{ sequence: options.sequence }] : [])],
    ];
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
            connection.executeQuery = <R>(query: CompiledQuery): Promise<QueryResult<R>> => {
                queries.push(query);
                if (query.sql.includes("DATABASE()") && startupFailures-- > 0) return Promise.reject(Object.assign(new Error("synthetic connection failure"), { code: options.startupCode ?? "ETIMEDOUT" }));
                if (options.failInsert && /^insert into `audit_record_event`/i.test(query.sql)) return Promise.reject(new Error("Injected central audit failure"));
                const rows = responses.find(([fragment]) => query.sql.includes(fragment))?.[1](query) ?? [];
                return Promise.resolve({ rows: rows as R[] });
            };
            return connection;
        }
    }
    const db = new Kysely<CrmDatabase>({ dialect: { createAdapter: () => new MysqlAdapter(), createDriver: () => new Driver(), createIntrospector: (database) => new MysqlIntrospector(database), createQueryCompiler: () => new MysqlQueryCompiler() } });
    const database = { db } as DatabaseService;
    return { db, database, queries, lifecycle, service: new RecordAuditService(database, new ConfigService({ ENABLE_RECORD_AUDIT: true })) };
};

describe("central transactional record writer", () => {
    it.each([
        { failures: 1, code: "ETIMEDOUT", succeeds: true, queries: 3 },
        { failures: 5, code: "ETIMEDOUT", succeeds: false, queries: 3 },
        { failures: 1, code: "ER_ACCESS_DENIED_ERROR", succeeds: false, queries: 1 },
    ])("bounds startup connection retries without retrying writes or configuration errors: %j", async ({ failures, code, succeeds, queries: expected }) => {
        vi.useFakeTimers();
        const f = setup({ startupFailures: failures, startupCode: code });
        try {
            const operation = f.service.onModuleInit();
            const assertion = succeeds ? expect(operation).resolves.toBeUndefined() : expect(operation).rejects.toMatchObject({ code });
            await vi.runAllTimersAsync();
            await assertion;
            expect(f.queries).toHaveLength(expected);
            expect(f.queries.every((query) => /^SELECT\b/.test(query.sql))).toBe(true);
        } finally {
            vi.useRealTimers();
            await f.db.destroy();
        }
    });
    it("does not query on disabled startup and fails enabled startup without the migration ledger", async () => {
        const { db, database, queries } = setup({ ready: false });
        try {
            await new RecordAuditService(database).onModuleInit();
            expect(queries).toHaveLength(0);
            await expect(new RecordAuditService(database, new ConfigService({ ENABLE_RECORD_AUDIT: true })).onModuleInit()).rejects.toThrow("023 and 024");
        } finally {
            await db.destroy();
        }
    });

    it("rejects actor lookalikes without issuing SQL", async () => {
        const { db, service, queries } = setup();
        try {
            await expect(db.transaction().execute((tx) => service.append(tx, input))).rejects.toThrow("captured by the server");
            expect(queries).toHaveLength(0);
        } finally {
            await db.destroy();
        }
    });

    it("retains the server capture even when the caller mutates its actor copy", async () => {
        const { db, service, queries } = setup();
        try {
            await db.transaction().execute(async (tx) => {
                const actor = await service.captureActor(tx, 1);
                actor.name = "Forged later";
                actor.roles.splice(0);
                await service.append(tx, { ...input, actor });
            });
            expect(queries.find((query) => /^insert into `audit_record_event`/i.test(query.sql))?.parameters).toContain(JSON.stringify(input.actor));
        } finally {
            await db.destroy();
        }
    });

    it("creates an audit identity, never a business record", async () => {
        const { db, service, queries } = setup({ anchor: false });
        try {
            await db.transaction().execute(async (tx) => service.append(tx, { ...input, actor: await service.captureActor(tx, 1) }));
            expect(queries.filter((query) => /^insert/i.test(query.sql)).map((query) => query.sql.match(/^insert into `([^`]+)`/i)?.[1])).toEqual(["audit_record", "audit_record_event"]);
        } finally {
            await db.destroy();
        }
    });

    it.each([false, true])("replays exactly once or rejects changed retry content: changed=%s", async (changed) => {
        const replay = {
            id_record_event: "existing-event",
            sequence_record_event: 2,
            action_record_event: input.action,
            module_record_event: input.module,
            actor_reference_record_event: input.actor.publicId,
            reason_record_event: input.reason,
            source_schema_record_event: input.source.schema,
            source_table_record_event: input.source.table,
            source_id_record_event: input.source.id,
            snapshot_scope_record_event: "partial",
            snapshot_version_record_event: 1,
            before_record_event: input.before,
            after_record_event: JSON.stringify(input.after),
        };
        const { db, service, queries } = setup({ replay });
        try {
            const operation = db.transaction().execute(async (tx) => service.append(tx, { ...input, after: { name: changed ? "Different" : "After" }, actor: await service.captureActor(tx, 1), expectedSequence: 0 }));
            if (changed) await expect(operation).rejects.toThrow("different content");
            else expect(await operation).toEqual({ publicId: "existing-event", sequence: 2, replayed: true });
            expect(queries.some((query) => /^insert/i.test(query.sql))).toBe(false);
        } finally {
            await db.destroy();
        }
    });

    it("is disabled by default and never silently appends outside a transaction", async () => {
        const { db, database, service, queries } = setup();
        try {
            expect(new RecordAuditService(database).enabled).toBe(false);
            await expect(service.append(db as never, input)).rejects.toThrow("transaction");
            expect(queries).toHaveLength(0);
        } finally {
            await db.destroy();
        }
    });

    it.each([{ ready: false }, { schema: "crmdatabase-api" }])("fails closed on an unprepared destination %j", async (options) => {
        const { db, service, queries, lifecycle } = setup(options);
        try {
            await expect(db.transaction().execute(async (tx) => service.append(tx, { ...input, actor: await service.captureActor(tx, 1) }))).rejects.toThrow(ServiceUnavailableException);
            expect(queries.some((query) => /^insert/i.test(query.sql))).toBe(false);
            expect(lifecycle).toEqual(["begin", "rollback"]);
        } finally {
            await db.destroy();
        }
    });

    it("locks the stream and latest event, appends only partial snapshots and commits", async () => {
        const { db, service, queries, lifecycle } = setup({ sequence: 3 });
        try {
            const result = await db.transaction().execute(async (tx) => service.append(tx, { ...input, actor: await service.captureActor(tx, 1), expectedSequence: 3 }));
            expect(result).toMatchObject({ sequence: 4, replayed: false });
            expect(queries.some((query) => query.sql.includes("audit_record`") && query.sql.includes("for update"))).toBe(true);
            expect(queries.some((query) => query.sql.includes("order by") && query.sql.includes("for update"))).toBe(true);
            const event = queries.find((query) => /^insert into `audit_record_event`/i.test(query.sql));
            expect(event?.parameters).toContain("partial");
            expect(event?.parameters).toContain('{"name":"Before"}');
            expect(event?.parameters).toContain('{"name":"After"}');
            expect(lifecycle).toEqual(["begin", "commit"]);
            expect(queries.every((query) => !/^(update|delete)/i.test(query.sql))).toBe(true);
        } finally {
            await db.destroy();
        }
    });

    it("rejects stale versions without inserting an event", async () => {
        const { db, service, queries } = setup({ sequence: 2 });
        try {
            await expect(db.transaction().execute(async (tx) => service.append(tx, { ...input, actor: await service.captureActor(tx, 1), expectedSequence: 1 }))).rejects.toThrow("version");
            expect(queries.some((query) => /^insert into `audit_record_event`/i.test(query.sql))).toBe(false);
        } finally {
            await db.destroy();
        }
    });

    it("rolls back the enclosing business transaction when central persistence fails", async () => {
        const { db, service, lifecycle } = setup({ failInsert: true });
        try {
            await expect(db.transaction().execute(async (tx) => service.append(tx, { ...input, actor: await service.captureActor(tx, 1) }))).rejects.toThrow("Injected central audit failure");
            expect(lifecycle).toEqual(["begin", "rollback"]);
        } finally {
            await db.destroy();
        }
    });

    it.each([
        { ...input, action: "restore" },
        { ...input, reason: "", action: "revert" },
        { ...input, operationId: "" },
        { ...input, actor: { ...input.actor, password: "secret" } },
        { ...input, after: { password: "secret" } },
    ])("rejects invalid or unsupported input before SQL %#", async (value) => {
        const { db, service, queries } = setup();
        try {
            await expect(db.transaction().execute((tx) => service.append(tx, value as typeof input))).rejects.toThrow(BadRequestException);
            expect(queries).toHaveLength(0);
        } finally {
            await db.destroy();
        }
    });
});

it("records an explicitly captured integration service without impersonating a user", async () => {
    const f = setup();
    try {
        const actor = captureIntegrationAuditActor({ publicId: "integration:netsuite:sandbox", name: "NetSuite Sandbox" });
        await f.db.transaction().execute((tx) => f.service.append(tx, { ...input, actor }));
        const insert = f.queries.find((query) => /^insert into `audit_record_event`/i.test(query.sql));
        expect(insert?.parameters).toContain("integration");
        expect(insert?.parameters).toContain("service");
        await expect(f.db.transaction().execute((tx) => f.service.append(tx, { ...input, actor: { ...actor } }))).rejects.toThrow("captured");
    } finally {
        await f.db.destroy();
    }
});
