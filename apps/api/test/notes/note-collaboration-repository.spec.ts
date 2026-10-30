import { ForbiddenException } from "@nestjs/common";
import { type CompiledQuery, DummyDriver, Kysely, MysqlAdapter, MysqlIntrospector, MysqlQueryCompiler, type QueryResult } from "kysely";
import { describe, expect, it, vi } from "vitest";

import type { DatabaseService } from "../../src/database/database.service.js";
import type { CrmDatabase } from "../../src/database/database.types.js";
import type { RecordAuditService } from "../../src/modules/crm/audit/record-audit.service.js";
import { collaborationInboxSchema } from "../../src/modules/crm/notes/note-collaboration.contract.js";
import { type CollaborationNote, NoteCollaborationRepository } from "../../src/modules/crm/notes/note-collaboration.repository.js";
import type { NoteNotificationsRepository } from "../../src/modules/crm/notes/note-notifications.repository.js";
import type { NotesRepository } from "../../src/modules/crm/notes/notes.repository.js";
const id = "01K00000000000000000000000",
    actorId = "01K00000000000000000000001",
    otherId = "01K00000000000000000000002";
const state: CollaborationNote = {
    note: { internalId: 7, publicId: id, authorId: 1, authorPublicId: actorId, authorName: "Owner", moduleCode: "ventas", title: null, text: "secret note", color: "#FFFF88", priority: "normal", status: "open", visibility: "shared", version: 4, createdAt: "now", updatedAt: "now", completedAt: null, archivedAt: null },
    context: { kind: "personal" },
    collaborationVersion: 2,
    participants: [{ active: false, userId: otherId, displayName: "Other", access: "reply", following: true }],
};
function fixture(fail?: string, replyAuthor = 1) {
    const queries: CompiledQuery[] = [];
    const lifecycle: string[] = [];
    let receipt: object[] = [];
    let operation: unknown;
    function readRows(query: CompiledQuery): object[] {
        let rows: object[] = [];
        if (query.sql.startsWith("SELECT id_user AS id")) rows = [{ id: 1 }];
        if (query.sql.startsWith("SELECT public_id_user AS id")) rows = [{ id: actorId }];
        if (query.sql.startsWith("SELECT request_hash")) rows = query.parameters[1] === operation ? receipt : [];
        if (query.sql.startsWith("SELECT id_note_reply AS id")) rows = [{ id: 12, author: replyAuthor, version: 1, withdrawn: 0 }];
        if (query.sql.startsWith("INSERT INTO int_note_command")) {
            operation = query.parameters[1];
            receipt = [{ hash: query.parameters[2], result: query.parameters[3] }];
        }

        return rows;
    }
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
                if (fail && query.sql.startsWith(fail)) return Promise.reject(new Error("write failed"));
                const rows = readRows(query);
                return Promise.resolve({ rows: rows as R[] });
            };
            return connection;
        }
    }
    const db = new Kysely<CrmDatabase>({ dialect: { createAdapter: () => new MysqlAdapter(), createDriver: () => new Driver(), createIntrospector: (database) => new MysqlIntrospector(database), createQueryCompiler: () => new MysqlQueryCompiler() } });
    const audit = { enabled: true, captureActor: vi.fn().mockResolvedValue({}), append: vi.fn().mockResolvedValue({}) };
    const realtime = { enqueueNoteChange: vi.fn().mockResolvedValue(undefined) };
    const notifications = { enqueue: vi.fn().mockResolvedValue(undefined), suppressForNote: vi.fn().mockResolvedValue(undefined) };
    const repository = new NoteCollaborationRepository({ db } as DatabaseService, {} as NotesRepository, audit as unknown as RecordAuditService, notifications as unknown as NoteNotificationsRepository, realtime as never);
    const load = vi.spyOn(repository, "load").mockResolvedValue(structuredClone(state));
    return { db, queries, lifecycle, audit, notifications, realtime, repository, load };
}
describe("collaboration atomic command persistence", () => {
    it("locks existing ACL before replay, commits receipt/audit/outbox together and keeps note content version separate", async () => {
        const f = fixture();
        const authorize = vi.fn().mockResolvedValue(undefined);
        const input = { kind: "reply" as const, operationId: "operation_00000001", text: "secret reply", mentionUserIds: [otherId] };
        const result = await f.repository.command(actorId, id, input, authorize);
        expect(result).toMatchObject({ version: 4, collaborationVersion: 3, replyVersion: 1 });
        expect(await f.repository.command(actorId, id, input, authorize)).toEqual({ ...result, replayed: true });
        expect(f.lifecycle).toEqual(["begin", "commit", "begin", "commit"]);
        expect(f.load).toHaveBeenCalledWith(actorId, id, expect.anything(), true);
        expect(authorize).toHaveBeenCalledTimes(3);
        expect(f.notifications.enqueue).toHaveBeenCalledOnce();
        expect(f.realtime.enqueueNoteChange).toHaveBeenCalledOnce();
        expect(JSON.stringify(f.audit.append.mock.calls)).not.toContain("secret");
        expect(f.queries.filter((q) => q.sql.startsWith("UPDATE crm_note SET"))[0]?.sql).not.toContain("version_note=version_note");
        await f.db.destroy();
    });
    it("replays lost-success receipt after completion and target policy changes, while visibility is still rechecked", async () => {
        const f = fixture();
        let targetAllowed = true;
        const authorize = vi.fn((current: CollaborationNote, _tx: unknown, phase: string) => {
            if (phase === "write" && (current.note.status !== "open" || !targetAllowed)) return Promise.reject(new ForbiddenException());
            return Promise.resolve();
        });
        const input = { kind: "reply" as const, operationId: "operation_00000001", text: "first", mentionUserIds: [otherId] };
        const result = await f.repository.command(actorId, id, input, authorize);
        f.load.mockResolvedValue({ ...state, note: { ...state.note, status: "completed" } });
        targetAllowed = false;
        expect(await f.repository.command(actorId, id, input, authorize)).toEqual({ ...result, replayed: true });
        expect(authorize.mock.calls.map((c) => c[2])).toEqual(["read", "write", "read"]);
        f.load.mockRejectedValue(new ForbiddenException());
        await expect(f.repository.command(actorId, id, input, authorize)).rejects.toBeInstanceOf(ForbiddenException);
        await f.db.destroy();
    });
    it("operation reuse with changed payload conflicts without a second reply", async () => {
        const f = fixture();
        const input = { kind: "reply" as const, operationId: "operation_00000001", text: "first", mentionUserIds: [] };
        await f.repository.command(actorId, id, input, async () => {});
        await expect(f.repository.command(actorId, id, { ...input, text: "changed" }, async () => {})).rejects.toThrow("clave");
        expect(f.queries.filter((q) => q.sql.startsWith("INSERT INTO crm_note_reply"))).toHaveLength(1);
        expect(f.lifecycle.at(-1)).toBe("rollback");
        await f.db.destroy();
    });
    it("receipt write failure rolls back already written reply, audit and outbox", async () => {
        const f = fixture("INSERT INTO int_note_command");
        await expect(f.repository.command(actorId, id, { kind: "reply", operationId: "operation_00000001", text: "private", mentionUserIds: [] }, async () => {})).rejects.toThrow("write failed");
        expect(f.lifecycle).toEqual(["begin", "rollback"]);
        expect(f.notifications.enqueue).toHaveBeenCalledOnce();
        await f.db.destroy();
    });
    it.each(["editReply", "withdrawReply"] as const)("owner cannot %s another author's reply", async (kind) => {
        const f = fixture(undefined, 2);
        const input = kind === "editReply" ? { kind, operationId: "operation_00000001", replyId: otherId, expectedVersion: 1, text: "changed", mentionUserIds: [] } : { kind, operationId: "operation_00000001", replyId: otherId, expectedVersion: 1 };
        await expect(f.repository.command(actorId, id, input, async () => {})).rejects.toBeInstanceOf(ForbiddenException);
        expect(f.audit.append).not.toHaveBeenCalled();
        expect(f.notifications.enqueue).not.toHaveBeenCalled();
        expect(f.lifecycle.at(-1)).toBe("rollback");
        await f.db.destroy();
    });
    it("replacement revokes access, mentions and old notification delivery before visibility change", async () => {
        const f = fixture();
        await f.repository.command(actorId, id, { kind: "participants", operationId: "operation_00000001", expectedCollaborationVersion: 2, participants: [] }, async () => {});
        expect(f.realtime.enqueueNoteChange).toHaveBeenCalledWith(expect.anything(), { noteId: id, actorPublicId: actorId, revokedUserIds: [otherId] });
        expect(f.notifications.suppressForNote).toHaveBeenCalledWith(expect.anything(), id, [otherId]);
        expect(f.queries.some((q) => q.sql.startsWith("DELETE m FROM crm_note_mention"))).toBe(true);
        expect(f.queries.find((q) => q.sql.startsWith("UPDATE crm_note SET visibility"))?.parameters).toContain("private");
        await f.db.destroy();
    });
    it("following audits and receipts without notification; stale collaboration version rejects share", async () => {
        const f = fixture();
        await f.repository.command(actorId, id, { kind: "following", operationId: "operation_00000001", following: false }, async () => {});
        expect(f.notifications.enqueue).not.toHaveBeenCalled();
        expect(f.realtime.enqueueNoteChange).not.toHaveBeenCalled();
        await expect(f.repository.command(actorId, id, { kind: "participants", operationId: "operation_00000002", expectedCollaborationVersion: 1, participants: [] }, async () => {})).rejects.toThrow("cambio");
        await f.db.destroy();
    });
});

it("combined inbox remains bound to authorship or active invitation and returns unique note rows", async () => {
    const f = fixture();
    await f.repository.inboxIds(actorId, collaborationInboxSchema.parse({ kind: "all", status: "all" }));
    const query = f.queries.find((q) => q.sql.startsWith("SELECT n.public_id_note AS id"));
    expect(query?.sql).toContain("IN ('all','created')");
    expect(query?.sql).toContain("IN ('all','shared')");
    expect(query?.sql).toContain("p.revoked_at_note_participant IS NULL");
    expect(query?.sql).toContain("n.author_user_id_note=u.id_user");
    expect(query?.parameters).toContain(actorId);
});

it("searches matching live replies before bounded SQL pagination and escapes literal wildcards", async () => {
    const f = fixture();
    await f.repository.inboxPage(actorId, collaborationInboxSchema.parse({ kind: "all", status: "all", search: "50%_off", page: 2 }), ["ventas"]);
    const query = f.queries.find((q) => q.sql.startsWith("SELECT n.public_id_note AS id"));
    expect(query?.sql).toContain("sr.withdrawn_at_note_reply IS NULL");
    expect(query?.sql).toContain("LIMIT ? OFFSET ?");
    expect(query?.sql).toContain("n.origin_module_code_note IN");
    expect(query?.parameters).toContain("%50=%=_off%");
    expect(query?.parameters.slice(-2)).toEqual([25, 25]);
    await f.db.destroy();
});
