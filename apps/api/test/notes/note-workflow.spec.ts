import { BadRequestException, ConflictException, ForbiddenException } from "@nestjs/common";
import { type CompiledQuery, DummyDriver, Kysely, MysqlAdapter, MysqlIntrospector, MysqlQueryCompiler, type QueryResult } from "kysely";
import { describe, expect, it, vi } from "vitest";

import { loadNotesWorkflowStatements } from "../../migrations/schema-only/202610280053_notes_workflow.js";
import type { DatabaseService } from "../../src/database/database.service.js";
import type { CrmDatabase } from "../../src/database/database.types.js";
import type { RecordAuditService } from "../../src/modules/crm/audit/record-audit.service.js";
import type { CollaborationNote, NoteCollaborationRepository } from "../../src/modules/crm/notes/note-collaboration.repository.js";
import { reminderSchema, taskSchema } from "../../src/modules/crm/notes/note-workflow.contract.js";
import { NoteWorkflowRepository } from "../../src/modules/crm/notes/note-workflow.repository.js";
import { NoteWorkflowService } from "../../src/modules/crm/notes/note-workflow.service.js";
import { NoteWorkflowWorker } from "../../src/modules/crm/notes/note-workflow.worker.js";

const noteId = "01K00000000000000000000000",
    actor = "01K00000000000000000000001",
    guest = "01K00000000000000000000002";
const state: CollaborationNote = { note: { internalId: 7, publicId: noteId, authorId: 1, authorPublicId: actor, authorName: "Owner", moduleCode: "ventas", title: null, text: "secret", color: "#FFFF88", priority: "normal", status: "open", visibility: "shared", version: 4, createdAt: "now", updatedAt: "now", completedAt: null, archivedAt: null }, context: { kind: "personal" }, collaborationVersion: 2, participants: [{ userId: guest, displayName: "Guest", access: "read", following: true }] };
const task = { kind: "task" as const, operationId: "operation_00000001", expectedVersion: 0, assigneeUserId: guest, dueAt: "2026-01-01T00:00:00.000Z" };
const event = { id: 4, attempt: 2, noteId, userId: guest, kind: "reminder" as const };

function fixture(rowsFor: (query: CompiledQuery) => object[] = () => [], deadlocks = 0) {
    const queries: CompiledQuery[] = [],
        lifecycle: string[] = [];
    let receipt: object[] = [];
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
                if (query.sql.startsWith("INSERT INTO crm_note_task") && deadlocks-- > 0) return Promise.reject(Object.assign(new Error("deadlock victim"), { errno: 1213 }));
                let rows = rowsFor(query);
                if (query.sql.startsWith("SELECT COUNT(*) AS ready")) rows = [{ ready: 1 }];
                if (query.sql.startsWith("SELECT id_user AS id")) rows = [{ id: 1 }];
                if (query.sql.startsWith("SELECT request_hash")) rows = receipt;
                if (query.sql.startsWith("INSERT INTO int_note_command")) receipt = [{ hash: query.parameters[2], result: query.parameters[3] }];
                return Promise.resolve({ rows: rows as R[] });
            };
            return connection;
        }
    }
    const db = new Kysely<CrmDatabase>({ dialect: { createAdapter: () => new MysqlAdapter(), createDriver: () => new Driver(), createIntrospector: (database) => new MysqlIntrospector(database), createQueryCompiler: () => new MysqlQueryCompiler() } });
    const collaboration = { load: vi.fn().mockResolvedValue(structuredClone(state)) };
    const audit = { enabled: true, captureActor: vi.fn().mockResolvedValue({}), append: vi.fn().mockResolvedValue({}) };
    const realtime = { enqueueNoteChange: vi.fn().mockResolvedValue(undefined), enqueueUserEvent: vi.fn().mockResolvedValue(undefined) };
    const repository = new NoteWorkflowRepository({ db } as DatabaseService, collaboration as unknown as NoteCollaborationRepository, audit as unknown as RecordAuditService, realtime as never);
    return { db, repository, queries, lifecycle, collaboration, audit, realtime };
}

describe("native note workflow contracts", () => {
    it("requires UTC, bounded dates, explicit nulls and rejects author reassignment", () => {
        expect(taskSchema.safeParse(task).success).toBe(false); // discriminator is server-owned
        const { kind: _kind, ...input } = task;
        expect(taskSchema.safeParse(input).success).toBe(true); // past due dates are legal
        expect(taskSchema.safeParse({ ...input, dueAt: "2026-01-01T08:00:00+08:00" }).success).toBe(false);
        expect(taskSchema.safeParse({ ...input, dueAt: "2099-01-01T00:00:00Z" }).success).toBe(false);
        expect(taskSchema.safeParse({ ...input, authorUserId: guest }).success).toBe(false);
        expect(reminderSchema.safeParse({ operationId: task.operationId, remindAt: null }).success).toBe(true);
    });
    it("loads only additive native tables and the bounded notification check extension", async () => {
        const statements = await loadNotesWorkflowStatements();
        expect(statements).toHaveLength(3);
        expect(statements.join(" ")).not.toMatch(/crmdatabase|INSERT INTO|TRIGGER/i);
        expect(statements[2]).toContain("'assigned','reminder','due'");
    });
});

describe("workflow transactional persistence", () => {
    it("uses the author as deadline owner only when no responsible is explicitly assigned", async () => {
        const f = fixture();
        await f.repository.overviewIds(actor);
        expect(f.queries[0]?.sql).toContain("COALESCE(t.assignee_user_id_note_task,n.author_user_id_note)");
        expect(f.queries[0]?.sql).toContain("(t.assignee_user_id_note_task IS NOT NULL) AS explicitAssigned");
        await f.db.destroy();
    });
    it("restarts a rolled-back deadlock victim transaction with the same operation id", async () => {
        const f = fixture(() => [], 1),
            authorize = vi.fn().mockResolvedValue(undefined);
        await expect(f.repository.command(actor, noteId, task, authorize)).resolves.toMatchObject({ noteId, replayed: false });
        expect(f.lifecycle).toEqual(["begin", "rollback", "begin", "commit"]);
        expect(f.collaboration.load).toHaveBeenCalledTimes(2);
        expect(f.audit.append).toHaveBeenCalledOnce();
        const receipts = f.queries.filter((q) => q.sql.startsWith("INSERT INTO int_note_command"));
        expect(receipts).toHaveLength(1);
        expect(receipts[0]?.parameters[1]).toBe(task.operationId);
        await f.db.destroy();
    });
    it("rechecks locked ACL, shares global command receipts and replays without duplicate schedules", async () => {
        const f = fixture(),
            authorize = vi.fn().mockResolvedValue(undefined);
        const result = await f.repository.command(actor, noteId, task, authorize);
        expect(await f.repository.command(actor, noteId, task, authorize)).toEqual({ ...result, replayed: true });
        expect(f.collaboration.load).toHaveBeenCalledWith(actor, noteId, expect.anything(), true);
        expect(authorize).toHaveBeenCalledTimes(2);
        expect(f.queries.filter((q) => q.sql.startsWith("INSERT INTO crm_note_workflow_event"))).toHaveLength(2);
        expect(f.audit.append).toHaveBeenCalledOnce();
        expect(JSON.stringify(f.audit.append.mock.calls)).not.toContain("secret");
        expect(f.lifecycle).toEqual(["begin", "commit", "begin", "commit"]);
        await expect(f.repository.command(actor, noteId, { ...task, dueAt: null }, authorize)).rejects.toBeInstanceOf(ConflictException);
        await f.db.destroy();
    });
    it("denies invited readers from changing responsible and preserves immutable authorship", async () => {
        const f = fixture();
        await expect(f.repository.command(guest, noteId, task, vi.fn())).rejects.toBeInstanceOf(ForbiddenException);
        expect(f.queries.some((q) => q.sql.startsWith("INSERT INTO crm_note_task"))).toBe(false);
        expect(f.lifecycle).toContain("rollback");
        await f.db.destroy();
    });
    it("rejects outsiders and stale task versions before writing", async () => {
        const f = fixture();
        await expect(f.repository.command(actor, noteId, { ...task, expectedVersion: 2 }, vi.fn())).rejects.toBeInstanceOf(ConflictException);
        await expect(f.repository.command(actor, noteId, { ...task, assigneeUserId: "01K00000000000000000000003" }, vi.fn())).rejects.toBeInstanceOf(ForbiddenException);
        await f.db.destroy();
    });
    it("preserves a pending assignment notice when only the due date changes", async () => {
        const f = fixture((q) => (q.sql.startsWith("SELECT t.version_note_task") ? [{ version: 1, publicId: guest, displayName: "Guest", dueAt: null }] : []));
        await f.repository.command(actor, noteId, { ...task, expectedVersion: 1 }, vi.fn());
        const cancellation = f.queries.find((q) => q.sql.startsWith("UPDATE crm_note_workflow_event"));
        expect(cancellation?.parameters).toEqual([7, false]);
        expect(cancellation?.sql).toContain("OR (? AND kind_note_workflow_event='assigned')");
        expect(f.queries.filter((q) => q.sql.startsWith("INSERT INTO crm_note_workflow_event")).map((q) => q.parameters[2])).toEqual(["due"]);
        await f.db.destroy();
    });
    it("does not duplicate already delivered due notices when unchanged task metadata is saved", async () => {
        const f = fixture((q) => (q.sql.startsWith("SELECT t.version_note_task") ? [{ version: 1, publicId: guest, displayName: "Guest", dueAt: task.dueAt }] : []));
        await f.repository.command(actor, noteId, { ...task, expectedVersion: 1 }, vi.fn());
        expect(f.queries.some((q) => q.sql.startsWith("INSERT INTO crm_note_workflow_event"))).toBe(false);
        await f.db.destroy();
    });
    it("rolls back task, schedule and receipt when central audit fails", async () => {
        const f = fixture();
        f.audit.append.mockRejectedValue(new Error("audit down"));
        await expect(f.repository.command(actor, noteId, task, vi.fn())).rejects.toThrow("audit down");
        expect(f.lifecycle).toEqual(["begin", "rollback"]);
        expect(f.queries.some((q) => q.sql.startsWith("INSERT INTO int_note_command"))).toBe(false);
        await f.db.destroy();
    });
    it("schedules only the actor's personal reminder and supports cancelling without due date", async () => {
        const f = fixture();
        await f.repository.command(guest, noteId, { kind: "reminder", operationId: task.operationId, remindAt: new Date(Date.now() + 3600000).toISOString() }, vi.fn());
        const insert = f.queries.find((q) => q.sql.startsWith("INSERT INTO crm_note_workflow_event"));
        expect(insert?.parameters.slice(0, 3)).toEqual([7, 1, "reminder"]);
        expect(f.queries.some((q) => q.sql.startsWith("INSERT INTO crm_note_task"))).toBe(false);
        expect(f.realtime.enqueueNoteChange).not.toHaveBeenCalled();
        await f.db.destroy();
    });
    it("rejects past personal reminders while retaining legal past due dates", async () => {
        const f = fixture();
        await expect(f.repository.command(actor, noteId, { kind: "reminder", operationId: task.operationId, remindAt: "2020-01-01T00:00:00Z" }, vi.fn())).rejects.toBeInstanceOf(BadRequestException);
        await f.db.destroy();
    });
    it("claims expired leases with SKIP LOCKED and increments the fencing attempt", async () => {
        const f = fixture((q) => (q.sql.startsWith("SELECT e.id_note_workflow_event") ? [{ ...event, attempt: 3 }] : []));
        expect(await f.repository.claim()).toMatchObject({ attempt: 4 });
        expect(f.queries[0]?.sql).toContain("FOR UPDATE SKIP LOCKED");
        expect(f.queries[1]?.sql).toContain("INTERVAL 60 SECOND");
        await f.db.destroy();
    });
    it("suppresses delivery on completion even when the browser is offline", async () => {
        const f = fixture((q) => (q.sql.startsWith("SELECT id_note AS") ? [{ id: 7, authorId: 1, status: "completed", moduleCode: "ventas", version: 2 }] : q.sql.startsWith("SELECT id_note_workflow_event") ? [{ id: 4 }] : []));
        const authorize = vi.fn();
        await f.repository.deliver(event, authorize);
        expect(authorize).not.toHaveBeenCalled();
        expect(f.queries.find((q) => q.sql.startsWith("UPDATE crm_note_workflow_event"))?.parameters[0]).toBe("suppressed");
        expect(f.queries.some((q) => q.sql.startsWith("INSERT INTO sec_notification"))).toBe(false);
        await f.db.destroy();
    });
    it("publishes one bell and durable socket atomically after live authorization", async () => {
        const f = fixture((q) => (q.sql.startsWith("SELECT id_note AS") ? [{ id: 7, authorId: 1, status: "open", moduleCode: "ventas", version: 2 }] : q.sql.startsWith("SELECT id_note_workflow_event") || q.sql.startsWith("SELECT u.id_user") ? [{ id: 4, status: "active" }] : []));
        const authorize = vi.fn().mockResolvedValue({ noteId });
        await f.repository.deliver(event, authorize);
        expect(authorize).toHaveBeenCalledWith(guest, noteId);
        expect(f.queries.filter((q) => q.sql.startsWith("INSERT INTO sec_notification"))).toHaveLength(1);
        expect(f.realtime.enqueueUserEvent).toHaveBeenCalledWith(expect.anything(), guest, expect.objectContaining({ kind: "notification.created" }));
        expect(f.lifecycle).toEqual(["begin", "commit"]);
        await f.db.destroy();
    });
    it("stale lease attempts cannot produce notices", async () => {
        const f = fixture((q) => (q.sql.startsWith("SELECT id_note AS") ? [{ id: 7, authorId: 1, status: "open", moduleCode: "ventas", version: 2 }] : []));
        await f.repository.deliver(event, vi.fn());
        expect(f.queries[1]?.sql).toContain("attempts_note_workflow_event=?");
        expect(f.queries.some((q) => q.sql.startsWith("INSERT INTO sec_notification"))).toBe(false);
        await f.db.destroy();
    });
    it.each(["assigned", "due"] as const)("delivers %s even when the recipient muted conversation replies", async (kind) => {
        const f = fixture((q) => (q.sql.startsWith("SELECT id_note AS") ? [{ id: 7, authorId: 1, status: "open", moduleCode: "ventas", version: 2 }] : q.sql.startsWith("SELECT id_note_workflow_event") || q.sql.startsWith("SELECT u.id_user") ? [{ id: 4, status: "active", following: false }] : []));
        await f.repository.deliver({ ...event, kind }, vi.fn().mockResolvedValue({ noteId }));
        const eligibility = f.queries.find((q) => q.sql.startsWith("SELECT u.id_user"));
        expect(eligibility?.sql).not.toContain("following_note_participant");
        expect(f.queries.filter((q) => q.sql.startsWith("INSERT INTO sec_notification"))).toHaveLength(1);
        expect(f.realtime.enqueueUserEvent).toHaveBeenCalledOnce();
        await f.db.destroy();
    });
    it("preserves dormant assignee notices as unread metadata without authorizing present access", async () => {
        const f = fixture((q) => (q.sql.startsWith("SELECT id_note AS") ? [{ id: 7, authorId: 1, status: "open", moduleCode: "ventas", version: 2 }] : q.sql.startsWith("SELECT id_note_workflow_event") || q.sql.startsWith("SELECT u.id_user") ? [{ id: 4, status: "inactive" }] : []));
        const authorize = vi.fn().mockResolvedValue(null);
        await f.repository.deliver({ ...event, kind: "assigned" }, authorize);
        expect(authorize).not.toHaveBeenCalled();
        expect(f.queries.some((q) => q.sql.startsWith("INSERT INTO sec_notification"))).toBe(true);
        await f.db.destroy();
    });
});

describe("workflow service and worker gates", () => {
    it("counts own unassigned deadlines without inflating explicitly assigned tasks", async () => {
        const repository = { schemaReady: vi.fn().mockResolvedValue(true), overviewIds: vi.fn().mockResolvedValue([{ id: noteId, dueAt: new Date(Date.now() - 1000).toISOString(), explicitAssigned: 0 }]) };
        const service = new NoteWorkflowService({ getCurrentUser: vi.fn().mockResolvedValue({ user: { publicId: actor } }) } as never, { authorizeProfileNoteAccess: vi.fn().mockResolvedValue({ noteId }) } as never, {} as never, repository as never, {} as never);
        expect(await service.overview("session", { timeZone: "UTC" })).toMatchObject({ counts: { assigned: 0, dueToday: 1, overdue: 1 } });
    });
    it("uses the reader timezone for today around the UTC midnight boundary", async () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date("2026-10-28T02:00:00Z"));
        try {
            const repository = {
                schemaReady: vi.fn().mockResolvedValue(true),
                overviewIds: vi.fn().mockResolvedValue([
                    { id: noteId, dueAt: "2026-10-27T18:00:00Z", explicitAssigned: 1 },
                    { id: noteId, dueAt: "2026-10-28T10:00:00Z", explicitAssigned: 1 },
                ]),
            };
            const service = new NoteWorkflowService({ getCurrentUser: vi.fn().mockResolvedValue({ user: { publicId: actor } }) } as never, { authorizeProfileNoteAccess: vi.fn().mockResolvedValue({ noteId }) } as never, {} as never, repository as never, {} as never);
            expect(await service.overview("session", { timeZone: "America/Costa_Rica" })).toMatchObject({ counts: { assigned: 2, dueToday: 1, overdue: 1 }, timeZone: "America/Costa_Rica" });
            await expect(service.overview("session", { timeZone: "INVALID/ZONE" })).rejects.toBeInstanceOf(BadRequestException);
        } finally {
            vi.useRealTimers();
        }
    });
    it("honors an author's revoked edit capability before task changes", async () => {
        const repository = {
            schemaReady: vi.fn().mockResolvedValue(true),
            command: vi.fn().mockImplementation(async (_actor, _id, _command, authorize: (note: CollaborationNote) => Promise<void>) => {
                await authorize(state);
                return {};
            }),
        };
        const service = new NoteWorkflowService({ getCurrentUser: vi.fn().mockResolvedValue({ user: { publicId: actor }, permissions: [] }) } as never, { authorizeProfileNoteAccess: vi.fn().mockResolvedValue({ noteId }) } as never, {} as never, repository as never, {} as never);
        const { kind: _kind, ...body } = task;
        await expect(service.task("session", noteId, body)).rejects.toBeInstanceOf(ForbiddenException);
    });
    it("does not leak workflow metadata after a live authorization denial", async () => {
        const repository = { schemaReady: vi.fn().mockResolvedValue(true), read: vi.fn() };
        const service = new NoteWorkflowService({ getCurrentUser: vi.fn().mockResolvedValue({ user: { publicId: actor } }) } as never, { authorizeProfileNoteAccess: vi.fn().mockResolvedValue(null) } as never, {} as never, repository as never, {} as never);
        await expect(service.read("session", noteId)).rejects.toBeInstanceOf(ForbiddenException);
        expect(repository.read).not.toHaveBeenCalled();
    });
    it("keeps all polling inert before the schema ledger is registered", async () => {
        const repository = { schemaReady: vi.fn().mockResolvedValue(false), claim: vi.fn() };
        const worker = new NoteWorkflowWorker(repository as never, {} as never, {} as never);
        await worker.tick();
        expect(repository.claim).not.toHaveBeenCalled();
    });
    it("delivers through note-only authorization without loading linked resource context", async () => {
        const collaboration = { authorizeUserNoteAccess: vi.fn().mockResolvedValue({ noteId, moduleCode: "ventas" }), authorizeUserRead: vi.fn().mockRejectedValue(new Error("linked resource unavailable")) };
        const repository = {
            schemaReady: vi.fn().mockResolvedValue(true),
            claim: vi.fn().mockResolvedValueOnce(event).mockResolvedValue(null),
            deliver: vi.fn().mockImplementation(async (_event, authorize: (user: string, note: string) => Promise<unknown>) => {
                await authorize(guest, noteId);
            }),
        };
        const worker = new NoteWorkflowWorker(repository as never, collaboration as never, { notify: vi.fn() } as never);
        await worker.tick();
        expect(collaboration.authorizeUserNoteAccess).toHaveBeenCalledWith(guest, noteId);
        expect(collaboration.authorizeUserRead).not.toHaveBeenCalled();
    });
    it("bounds batches, retries failures, and prevents work after shutdown", async () => {
        const repository = { schemaReady: vi.fn().mockResolvedValue(true), claim: vi.fn().mockResolvedValue(event), deliver: vi.fn().mockRejectedValue(new Error("down")), retry: vi.fn().mockResolvedValue(undefined) };
        const worker = new NoteWorkflowWorker(repository as never, {} as never, {} as never);
        await worker.tick();
        expect(repository.claim).toHaveBeenCalledTimes(10);
        expect(repository.retry).toHaveBeenCalledTimes(10);
        worker.onModuleDestroy();
        await worker.tick();
        expect(repository.claim).toHaveBeenCalledTimes(10);
    });
});
