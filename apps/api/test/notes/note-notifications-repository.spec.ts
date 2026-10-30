import { type CompiledQuery, DummyDriver, Kysely, MysqlAdapter, MysqlIntrospector, MysqlQueryCompiler, type QueryResult } from "kysely";
import { describe, expect, it, vi } from "vitest";

import type { DatabaseService } from "../../src/database/database.service.js";
import type { CrmDatabase } from "../../src/database/database.types.js";
import { NoteNotificationsRepository } from "../../src/modules/crm/notes/note-notifications.repository.js";
import { NotesRealtimeEventsRepository } from "../../src/modules/crm/notes/notes-realtime.repository.js";
const id = "01M4VECV87Y3Q3TGBBK8X2MHYX";
function fixture(rowsFor: (query: CompiledQuery) => object[] = () => []) {
    const queries: CompiledQuery[] = [];
    class Driver extends DummyDriver {
        override async acquireConnection() {
            const connection = await super.acquireConnection();
            connection.executeQuery = <R>(query: CompiledQuery): Promise<QueryResult<R>> => {
                queries.push(query);
                return Promise.resolve({ rows: rowsFor(query) as R[] });
            };
            return connection;
        }
    }
    const db = new Kysely<CrmDatabase>({ dialect: { createAdapter: () => new MysqlAdapter(), createDriver: () => new Driver(), createIntrospector: (database) => new MysqlIntrospector(database), createQueryCompiler: () => new MysqlQueryCompiler() } });
    return { db, queries, repository: new NoteNotificationsRepository({ db } as DatabaseService, new NotesRealtimeEventsRepository({ db } as DatabaseService)) };
}
describe("notification persistence", () => {
    it("stores an invited inactive member's notice without pretending that the account can read it now", async () => {
        const payload = { noteId: id, moduleCode: "ventas", actorPublicId: id, version: 2, recipients: [{ publicId: "01M4VECV87Y3Q3TGBBK8X2MHYZ", kind: "shared" }] };
        const f = fixture((q) => (q.sql.startsWith("SELECT payload_event_outbox") ? [{ payload }] : q.sql.startsWith("SELECT u.id_user") ? [{ id: 9 }] : []));
        await f.repository.deliver({ id: 4, attempt: 1, payload, noteId: id }, vi.fn().mockResolvedValue(null));
        expect(f.queries.some((q) => q.sql.startsWith("INSERT INTO sec_notification"))).toBe(true);
        await f.db.destroy();
    });
    it("writes only a same-transaction collaboration outbox without private bodies", async () => {
        const f = fixture();
        await f.db.transaction().execute((tx) =>
            f.repository.enqueue(tx, {
                noteId: id,
                moduleCode: "ventas",
                actorPublicId: id,
                version: 2,
                recipients: [
                    { publicId: id, kind: "mention" },
                    { publicId: "01M4VECV87Y3Q3TGBBK8X2MHYZ", kind: "reply" },
                ],
            }),
        );
        const insert = f.queries.find((q) => q.sql.startsWith("INSERT INTO int_event_outbox"));
        expect(insert?.sql).toContain("'note_collaboration'");
        expect(insert?.sql).not.toContain("legacy_projection");
        expect((JSON.parse(String(insert?.parameters.at(-1))) as { recipients: unknown[] }).recipients).toHaveLength(1);
        await f.db.destroy();
    });
    it("retains an empty collaboration event for atomic receipts and audit", async () => {
        const f = fixture();
        await f.db.transaction().execute((tx) => f.repository.enqueue(tx, { noteId: id, moduleCode: "ventas", actorPublicId: id, version: 3, recipients: [] }));
        expect(f.queries.filter((q) => q.sql.startsWith("INSERT INTO int_event_outbox"))).toHaveLength(1);
        await f.db.destroy();
    });
    it("suppresses delivered metadata and strips old pending recipients before reinvitation", async () => {
        const payload = { noteId: id, moduleCode: "ventas", actorPublicId: id, version: 2, recipients: [{ publicId: "01M4VECV87Y3Q3TGBBK8X2MHYZ", kind: "mention" }] };
        const f = fixture((q) => (q.sql.startsWith("SELECT id_event_outbox AS id,payload") ? [{ id: 4, payload: JSON.stringify(payload) }] : []));
        await f.db.transaction().execute((tx) => f.repository.suppressForNote(tx, id, ["01M4VECV87Y3Q3TGBBK8X2MHYZ"]));
        expect(f.queries[0]?.sql).toContain("status_notification='suppressed'");
        const update = f.queries.find((q) => q.sql.startsWith("UPDATE int_event_outbox SET payload"));
        expect((JSON.parse(String(update?.parameters[0])) as { recipients: unknown[] }).recipients).toEqual([]);
        await f.db.destroy();
    });
    it("revalidates delivery recipients and skips revoked targets without a notification insert", async () => {
        const payload = { noteId: id, moduleCode: "ventas", actorPublicId: id, version: 2, recipients: [{ publicId: "01M4VECV87Y3Q3TGBBK8X2MHYZ", kind: "mention" }] };
        const f = fixture((q) => (q.sql.startsWith("SELECT payload_event_outbox") ? [{ payload }] : []));
        const authorize = vi.fn().mockResolvedValue(null);
        await f.repository.deliver({ id: 4, attempt: 1, payload, noteId: id }, authorize);
        expect(authorize).toHaveBeenCalledWith("01M4VECV87Y3Q3TGBBK8X2MHYZ", id);
        expect(f.queries.some((q) => q.sql.startsWith("INSERT INTO sec_notification"))).toBe(false);
        expect(f.queries.at(-1)?.sql).toContain("status_event_outbox='delivered'");
        await f.db.destroy();
    });
    it("uses source-event time, deduplicates delivery and fences stale workers", async () => {
        const payload = { noteId: id, moduleCode: "ventas", actorPublicId: id, version: 2, recipients: [{ publicId: "01M4VECV87Y3Q3TGBBK8X2MHYZ", kind: "mention" }] };
        const f = fixture((q) => (q.sql.startsWith("SELECT payload_event_outbox") ? [{ payload }] : []));
        await f.repository.deliver({ id: 4, attempt: 2, payload, noteId: id }, vi.fn().mockResolvedValue({}));
        const insert = f.queries.find((q) => q.sql.startsWith("INSERT INTO sec_notification"));
        expect(insert?.sql).toContain("e.created_at_event_outbox");
        expect(insert?.sql).toContain("NOT EXISTS");
        const locked = f.queries.find((q) => q.sql.startsWith("SELECT payload_event_outbox"));
        expect(locked?.sql).toContain("attempts_event_outbox=");
        expect(locked?.parameters).toContain(2);
        await f.db.destroy();
    });
    it("binds read-all to recipient, active state and the observed cutoff", async () => {
        const f = fixture();
        await f.repository.markRead(id, [], "2026-10-27T10:00:00.000Z");
        expect(f.queries).toHaveLength(0);
        await f.repository.markRead(id, [id], "2026-10-27T10:00:00.000Z");
        const q = f.queries[0];
        expect(q?.sql).toContain("recipient_user_id_notification");
        expect(q?.sql).toContain("created_at_notification<=");
        expect(q?.sql).toContain("status_notification='active'");
        expect(q?.parameters).toContain("2026-10-27 10:00:00.000");
        await f.db.destroy();
    });
    it("permanently exhausts expired final leases without touching historical events", async () => {
        const f = fixture();
        await f.repository.claim();
        const terminal = f.queries.find((q) => q.sql.startsWith("UPDATE int_event_outbox") && q.sql.includes("'failed'"));
        expect(terminal?.sql).toContain("aggregate_type_event_outbox='note_collaboration'");
        expect(terminal?.sql).toContain("available_at_event_outbox<=UTC_TIMESTAMP(3)");
        expect(terminal?.sql).toContain("attempts_event_outbox>=");
        await f.db.destroy();
    });
    it("claims only new collaboration events with bounded lease and retry limit", async () => {
        const f = fixture();
        await f.repository.claim();
        const q = f.queries.find((q) => q.sql.includes("SKIP LOCKED"));
        expect(q?.sql).toContain("aggregate_type_event_outbox='note_collaboration'");
        expect(q?.sql).toContain("destination_code_event_outbox='notification'");
        expect(q?.sql).toContain("attempts_event_outbox<");
        expect(q?.sql).toContain("available_at_event_outbox<=UTC_TIMESTAMP(3)");
        await f.db.destroy();
    });
});
