import { Kysely, MysqlDialect, sql } from "kysely";
import { createPool } from "mysql2";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { loadNotesRealtimeStatements } from "../../migrations/schema-only/202610280046_notes_realtime.js";
import type { DatabaseService } from "../../src/database/database.service.js";
import type { CrmDatabase } from "../../src/database/database.types.js";
import { buildMysqlPoolOptions } from "../../src/database/mysql-pool-options.js";
import { NoteNotificationsRepository } from "../../src/modules/crm/notes/note-notifications.repository.js";
import { NotesRealtimeEventsRepository } from "../../src/modules/crm/notes/notes-realtime.repository.js";
const schema = process.env.NOTES_MYSQL_TEST_SCHEMA;
const enabled = Boolean(schema && /^crm_notes_test_[a-z0-9_]+$/.test(schema) && process.env.NOTES_MYSQL_TEST_CONFIRM === schema);
const owner = "01K00000000000000000000001",
    invitee = "01K00000000000000000000002",
    note = "01K00000000000000000000003";
/** Only a confirmed disposable empty schema; never reads dotenv or falls back to the commercial DB_NAME. */
describe.skipIf(!enabled)("durable realtime MySQL isolated synthetic metadata", () => {
    let db: Kysely<CrmDatabase>;
    let repository: NotesRealtimeEventsRepository;
    let notifications: NoteNotificationsRepository;
    const count = async (table: string) => Number((await sql<{ total: number }>`SELECT COUNT(*) AS total FROM ${sql.table(table)}`.execute(db)).rows[0]?.total);
    beforeAll(async () => {
        if (!schema || !enabled) throw new Error("Nonisolated target refused");
        const required = (key: string) => {
            const value = process.env[key];
            if (value === undefined) throw new Error(`Missing ${key}`);
            return value;
        };
        db = new Kysely<CrmDatabase>({ dialect: new MysqlDialect({ pool: createPool(buildMysqlPoolOptions({ host: required("DB_HOST"), port: Number(required("DB_PORT")), user: required("DB_USER"), password: required("DB_PASSWORD"), database: schema, connectionLimit: 4, ssl: process.env.DB_SSL !== "false", ...(process.env.DB_SSL_CA ? { sslCaPath: process.env.DB_SSL_CA } : {}) })) }) });
        expect((await sql<{ name: string }>`SELECT DATABASE() AS name`.execute(db)).rows[0]?.name).toBe(schema);
        expect((await sql<{ total: number }>`SELECT COUNT(*) AS total FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_TYPE='BASE TABLE'`.execute(db)).rows[0]?.total).toBe(0);
        for (const ddl of [
            "CREATE TABLE sec_user (id_user BIGINT UNSIGNED PRIMARY KEY,public_id_user CHAR(26) CHARACTER SET ascii COLLATE ascii_bin UNIQUE NOT NULL,status_user VARCHAR(16) NOT NULL,deleted_at_user DATETIME(3) NULL) ENGINE=InnoDB",
            "CREATE TABLE crm_note (id_note BIGINT UNSIGNED PRIMARY KEY,public_id_note CHAR(26) CHARACTER SET ascii COLLATE ascii_bin UNIQUE NOT NULL,author_user_id_note BIGINT UNSIGNED NOT NULL,version_note INT UNSIGNED NOT NULL,collaboration_version_note INT UNSIGNED NOT NULL) ENGINE=InnoDB",
            "CREATE TABLE crm_note_participant (note_id_note_participant BIGINT UNSIGNED NOT NULL,user_id_note_participant BIGINT UNSIGNED NOT NULL,status_note_participant VARCHAR(16) NOT NULL,revoked_at_note_participant DATETIME(3) NULL) ENGINE=InnoDB",
            "CREATE TABLE sec_notification (id_notification BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,public_id_notification CHAR(26) CHARACTER SET ascii COLLATE ascii_bin UNIQUE NOT NULL,recipient_user_id_notification BIGINT UNSIGNED NOT NULL,actor_user_id_notification BIGINT UNSIGNED NOT NULL,source_event_id_notification BIGINT UNSIGNED NOT NULL,note_id_notification BIGINT UNSIGNED NOT NULL,module_code_notification VARCHAR(40) NOT NULL,kind_notification VARCHAR(16) NOT NULL,status_notification VARCHAR(16) NOT NULL DEFAULT 'active',read_at_notification DATETIME(3) NULL,created_at_notification DATETIME(3) NOT NULL DEFAULT (UTC_TIMESTAMP(3)),UNIQUE(source_event_id_notification,recipient_user_id_notification)) ENGINE=InnoDB",
            "CREATE TABLE int_event_outbox (id_event_outbox BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,public_id_event_outbox CHAR(26) CHARACTER SET ascii COLLATE ascii_bin UNIQUE NOT NULL,aggregate_type_event_outbox VARCHAR(40) NOT NULL,aggregate_public_id_event_outbox CHAR(26) NOT NULL,aggregate_version_event_outbox INT NOT NULL,event_type_event_outbox VARCHAR(40) NOT NULL,destination_code_event_outbox VARCHAR(40) NOT NULL,payload_event_outbox JSON NOT NULL,status_event_outbox VARCHAR(16) NOT NULL DEFAULT 'pending',attempts_event_outbox INT NOT NULL DEFAULT 0,available_at_event_outbox DATETIME(3) NOT NULL DEFAULT (UTC_TIMESTAMP(3)),created_at_event_outbox DATETIME(3) NOT NULL DEFAULT (UTC_TIMESTAMP(3)),updated_at_event_outbox DATETIME(3) NOT NULL DEFAULT (UTC_TIMESTAMP(3)),delivered_at_event_outbox DATETIME(3) NULL,last_error_code_event_outbox VARCHAR(64) NULL) ENGINE=InnoDB",
            "CREATE TABLE conf_schema_migration (migration_name_schema_migration VARCHAR(160) PRIMARY KEY) ENGINE=InnoDB",
            ...(await loadNotesRealtimeStatements()),
        ])
            await sql.raw(ddl).execute(db);
        await sql`INSERT INTO conf_schema_migration VALUES ('202610270044_notes_collaboration'),('202610280046_notes_realtime')`.execute(db);
        const service = { db } as DatabaseService;
        repository = new NotesRealtimeEventsRepository(service);
        notifications = new NoteNotificationsRepository(service, repository);
    }, 30000);
    beforeEach(async () => {
        for (const table of ["crm_note_realtime_event", "sec_notification", "int_event_outbox", "crm_note_participant", "crm_note", "sec_user"]) await sql`DELETE FROM ${sql.table(table)}`.execute(db);
        await sql`INSERT INTO sec_user VALUES (1,${owner},'active',NULL),(2,${invitee},'active',NULL)`.execute(db);
        await sql`INSERT INTO crm_note VALUES (1,${note},1,2,3)`.execute(db);
        await sql`INSERT INTO crm_note_participant VALUES (1,2,'active',NULL)`.execute(db);
    });
    afterAll(async () => {
        await db.destroy();
    });
    const enqueue = () => db.transaction().execute((tx) => repository.enqueueNoteChange(tx, { noteId: note, actorPublicId: owner }));
    const seedNotification = async () => {
        await db.transaction().execute((tx) => notifications.enqueue(tx, { noteId: note, moduleCode: "ventas", actorPublicId: owner, version: 3, recipients: [{ publicId: invitee, kind: "mention" }] }));
        const claimed = await notifications.claim();
        if (!claimed) throw new Error("Missing notification claim");
        return claimed;
    };
    it("rolls note mutation and realtime intents back atomically", async () => {
        await expect(
            db.transaction().execute(async (tx) => {
                await sql`UPDATE crm_note SET version_note=3 WHERE id_note=1`.execute(tx);
                await repository.enqueueNoteChange(tx, { noteId: note, actorPublicId: owner });
                throw new Error("Synthetic failure");
            }),
        ).rejects.toThrow("Synthetic failure");
        expect(await count("crm_note_realtime_event")).toBe(0);
        expect((await sql<{ version: number }>`SELECT version_note AS version FROM crm_note`.execute(db)).rows[0]?.version).toBe(2);
    });
    it("persists notification and intention atomically and prioritizes bell before note invalidation", async () => {
        await enqueue();
        const claimed = await seedNotification();
        expect(await repository.claim()).toBeNull();
        await notifications.deliver(claimed, () => Promise.resolve({}));
        expect(await count("sec_notification")).toBe(1);
        expect(await count("crm_note_realtime_event")).toBe(3);
        await notifications.deliver(claimed, () => Promise.resolve({}));
        expect(await count("sec_notification")).toBe(1);
        expect(await count("crm_note_realtime_event")).toBe(3);
        const realtime = await repository.claim();
        expect(realtime?.activity.kind).toBe("notification.created");
        if (!realtime) throw new Error("Missing realtime");
        expect(await repository.notificationActive(invitee, realtime.activity.notificationId ?? "", note)).toBe(true);
        expect(await repository.notificationActive(owner, realtime.activity.notificationId ?? "", note)).toBe(false);
        await repository.complete(realtime);
        expect((await repository.claim())?.activity.kind).toBe("note.changed");
    });
    it.each(["pending", "inactive"])("stores a %s invitee's notice, exposing it only after activation", async (status) => {
        const claimed = await seedNotification();
        await sql`UPDATE sec_user SET status_user=${status} WHERE id_user=2`.execute(db);
        await notifications.deliver(claimed, () => Promise.resolve(null));
        expect(await count("sec_notification")).toBe(1);
        expect(await count("crm_note_realtime_event")).toBe(0);
        const row = (await sql<{ id: string }>`SELECT public_id_notification AS id FROM sec_notification`.execute(db)).rows[0];
        if (!row) throw new Error("Missing dormant invitation notification");
        expect(await repository.notificationActive(invitee, row.id, note)).toBe(false);
        await sql`UPDATE sec_user SET status_user='active' WHERE id_user=2`.execute(db);
        expect(await repository.notificationActive(invitee, row.id, note)).toBe(true);
    });
    it("does not revive an invitation revoked before account activation", async () => {
        const claimed = await seedNotification();
        await sql`UPDATE sec_user SET status_user='pending' WHERE id_user=2`.execute(db);
        await notifications.deliver(claimed, () => Promise.resolve(null));
        await db.transaction().execute(async (tx) => {
            await sql`SELECT id_note FROM crm_note WHERE id_note=1 FOR UPDATE`.execute(tx);
            await notifications.suppressForNote(tx, note, [invitee]);
        });
        await sql`UPDATE sec_user SET status_user='active' WHERE id_user=2`.execute(db);
        const row = (await sql<{ id: string }>`SELECT public_id_notification AS id FROM sec_notification`.execute(db)).rows[0];
        if (!row) throw new Error("Missing suppressed invitation notification");
        expect(await repository.notificationActive(invitee, row.id, note)).toBe(false);
    });
    it("claims a transport event while its recipient is locked by notification delivery", async () => {
        await db.transaction().execute((tx) => repository.enqueueUserEvent(tx, owner, { kind: "note.changed", noteId: note }));
        let acquired!: () => void;
        let release!: () => void;
        const ready = new Promise<void>((resolve) => {
            acquired = resolve;
        });
        const unlock = new Promise<void>((resolve) => {
            release = resolve;
        });
        const delivery = db.transaction().execute(async (tx) => {
            await sql`SELECT id_user FROM sec_user WHERE id_user=1 FOR UPDATE`.execute(tx);
            acquired();
            await unlock;
        });
        await ready;
        try {
            const claimed = await repository.claim();
            expect(claimed?.recipientUserId).toBe(owner);
            expect(claimed?.activity.noteId).toBe(note);
        } finally {
            release();
            await delivery;
        }
    });
    it("rolls notification back if realtime intent fails in the same delivery transaction", async () => {
        const claimed = await seedNotification();
        class Failing extends NotesRealtimeEventsRepository {
            override async enqueueUserEvent(...args: Parameters<NotesRealtimeEventsRepository["enqueueUserEvent"]>): Promise<void> {
                await super.enqueueUserEvent(...args);
                throw new Error("Synthetic publish intent failure");
            }
        }
        const failing = new NoteNotificationsRepository({ db } as DatabaseService, new Failing({ db } as DatabaseService));
        await expect(failing.deliver(claimed, () => Promise.resolve({}))).rejects.toThrow("Synthetic publish intent failure");
        expect(await count("sec_notification")).toBe(0);
        expect(await count("crm_note_realtime_event")).toBe(0);
    });
    it("fences expired workers and terminates exhausted leases", async () => {
        await db.transaction().execute((tx) => repository.enqueueUserEvent(tx, owner, { kind: "notifications.changed" }));
        const first = await repository.claim();
        if (!first) throw new Error("Missing claim");
        await sql`UPDATE crm_note_realtime_event SET available_at_note_realtime_event=DATE_SUB(UTC_TIMESTAMP(3),INTERVAL 1 SECOND)`.execute(db);
        const second = await repository.claim();
        expect(second?.attempt).toBe(2);
        if (!second) throw new Error("Missing reclaim");
        await repository.complete(first);
        await repository.retry(first);
        expect((await sql<{ status: string; attempt: number }>`SELECT status_note_realtime_event AS status,attempts_note_realtime_event AS attempt FROM crm_note_realtime_event`.execute(db)).rows[0]).toEqual({ status: "processing", attempt: 2 });
        await sql`UPDATE crm_note_realtime_event SET attempts_note_realtime_event=5,available_at_note_realtime_event=DATE_SUB(UTC_TIMESTAMP(3),INTERVAL 1 SECOND)`.execute(db);
        expect(await repository.claim()).toBeNull();
        expect((await sql<{ status: string }>`SELECT status_note_realtime_event AS status FROM crm_note_realtime_event`.execute(db)).rows[0]?.status).toBe("failed");
    });
    it("publishes explicit read and suppression while never reviving suppressed notices", async () => {
        const claimed = await seedNotification();
        await notifications.deliver(claimed, () => Promise.resolve({}));
        const row = (await sql<{ id: string }>`SELECT public_id_notification AS id FROM sec_notification`.execute(db)).rows[0];
        if (!row) throw new Error("Missing notification");
        await notifications.markRead(invitee, [row.id], "2099-01-01T00:00:00.000Z");
        await db.transaction().execute(async (tx) => {
            await sql`SELECT id_note FROM crm_note WHERE id_note=1 FOR UPDATE`.execute(tx);
            await notifications.suppressForNote(tx, note, [invitee]);
        });
        expect(await repository.notificationActive(invitee, row.id, note)).toBe(false);
        expect((await sql<{ total: number }>`SELECT COUNT(*) AS total FROM crm_note_realtime_event WHERE kind_note_realtime_event='notifications.changed'`.execute(db)).rows[0]?.total).toBe(2);
    });
});
