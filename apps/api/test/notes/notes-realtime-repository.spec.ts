import { type CompiledQuery, DummyDriver, Kysely, MysqlAdapter, MysqlIntrospector, MysqlQueryCompiler, type QueryResult } from "kysely";
import { describe, expect, it } from "vitest";

import type { DatabaseService } from "../../src/database/database.service.js";
import type { CrmDatabase } from "../../src/database/database.types.js";
import { NotesRealtimeEventsRepository } from "../../src/modules/crm/notes/notes-realtime.repository.js";
const id = "01K00000000000000000000001";
const other = "01K00000000000000000000002";
function fixture(rowsFor: (q: CompiledQuery) => object[] = () => []) {
    const queries: CompiledQuery[] = [];
    class Driver extends DummyDriver {
        override async acquireConnection() {
            const connection = await super.acquireConnection();
            connection.executeQuery = <R>(q: CompiledQuery): Promise<QueryResult<R>> => {
                queries.push(q);
                return Promise.resolve({ rows: rowsFor(q) as R[] });
            };
            return connection;
        }
    }
    const db = new Kysely<CrmDatabase>({ dialect: { createAdapter: () => new MysqlAdapter(), createDriver: () => new Driver(), createIntrospector: (d) => new MysqlIntrospector(d), createQueryCompiler: () => new MysqlQueryCompiler() } });
    return { db, queries, repository: new NotesRealtimeEventsRepository({ db } as DatabaseService) };
}
describe("durable note realtime persistence", () => {
    it("fans out to owner and active participants inside caller transaction without bodies", async () => {
        const f = fixture((q) =>
            q.sql.startsWith("SELECT DISTINCT")
                ? [
                      { userId: id, version: 2, collaborationVersion: 4 },
                      { userId: other, version: 2, collaborationVersion: 4 },
                  ]
                : [],
        );
        await f.db.transaction().execute((tx) => f.repository.enqueueNoteChange(tx, { noteId: id, actorPublicId: id, revokedUserIds: [other] }));
        const inserts = f.queries.filter((q) => q.sql.startsWith("INSERT INTO crm_note_realtime_event"));
        expect(inserts).toHaveLength(3);
        expect(JSON.stringify(inserts)).not.toContain("content_note");
        expect(inserts[2]?.parameters).toContain("note.access_revoked");
        await f.db.destroy();
    });
    it("fences success and retries by attempt and lease expiry", async () => {
        const f = fixture();
        const event = { id: 5, attempt: 3, recipientUserId: id, activity: { schemaVersion: 1 as const, eventId: id, kind: "note.changed" as const, occurredAt: new Date().toISOString(), noteId: id } };
        await f.repository.complete(event);
        await f.repository.retry(event);
        for (const q of f.queries) {
            expect(q.sql).toContain("attempts_note_realtime_event=");
            expect(q.sql).toContain("status_note_realtime_event='processing'");
            expect(q.sql).toContain("available_at_note_realtime_event>UTC_TIMESTAMP(3)");
        }
        await f.db.destroy();
    });
    it("never consumes historical stage2 events and waits for notification persistence", async () => {
        const f = fixture();
        await f.repository.claim();
        const q = f.queries.find((q) => q.sql.startsWith("SELECT e.id_note_realtime_event"));
        expect(q?.sql).toContain("FOR UPDATE SKIP LOCKED");
        expect(q?.sql).toContain("aggregate_type_event_outbox='note_collaboration'");
        expect(q?.sql).toContain("destination_code_event_outbox='notification'");
        await f.db.destroy();
    });
    it("locks only transport rows so notification delivery cannot invert user and note locks", async () => {
        const f = fixture();
        await f.repository.claim();
        const claim = f.queries.find((q) => q.sql.startsWith("SELECT e.id_note_realtime_event"));
        expect(claim?.sql).toContain("FOR UPDATE SKIP LOCKED");
        expect(claim?.sql).not.toMatch(/FROM crm_note_realtime_event e JOIN sec_user/);
        expect(claim?.sql).toContain("(SELECT public_id_user FROM sec_user WHERE id_user=e.recipient_user_id_note_realtime_event)");
        await f.db.destroy();
    });
});
