import { Kysely, MysqlDialect, sql, type Transaction } from "kysely";
import { createPool } from "mysql2";
import { ulid } from "ulid";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { loadNotesStatements } from "../../migrations/schema-only/202610270039_notes_domain.js";
import { loadNotesCommandsStatements } from "../../migrations/schema-only/202610270040_notes_commands.js";
import { loadNotesCollaborationStatements } from "../../migrations/schema-only/202610270044_notes_collaboration.js";
import type { DatabaseService } from "../../src/database/database.service.js";
import type { CrmDatabase } from "../../src/database/database.types.js";
import { buildMysqlPoolOptions } from "../../src/database/mysql-pool-options.js";
import type { RecordAuditService } from "../../src/modules/crm/audit/record-audit.service.js";
import { NoteCollaborationRepository } from "../../src/modules/crm/notes/note-collaboration.repository.js";
import type { NoteNotificationsRepository } from "../../src/modules/crm/notes/note-notifications.repository.js";
import type { NoteRelatedReference } from "../../src/modules/crm/notes/note-related-records.contract.js";
import { NoteRelatedRecordsRepository, persistNoteRelatedRecords } from "../../src/modules/crm/notes/note-related-records.repository.js";
import { createNoteSchema, listNotesSchema, type NoteAccess, type NoteContext } from "../../src/modules/crm/notes/notes.contract.js";
import { noteContextKey, NotesRepository } from "../../src/modules/crm/notes/notes.repository.js";
import type { NotesRealtimeEventsRepository } from "../../src/modules/crm/notes/notes-realtime.repository.js";

// Never load dotenv or fall back to the runtime schema. The caller must create a disposable target.
const schema = process.env.NOTES_MYSQL_TEST_SCHEMA;
const enabled = Boolean(schema && /^crm_notes_test_[a-z0-9_]+$/.test(schema) && process.env.NOTES_MYSQL_TEST_CONFIRM === schema);
const author = "01K00000000000000000000001";
const guest = "01K00000000000000000000002";
const stranger = "01K00000000000000000000003";
const leadId = "01K00000000000000000000011";
const orderId = "01K00000000000000000000021";
const access: NoteAccess = { actorPublicId: author, moduleCode: "mercadeo", ownOnly: false };
const nativeLead: NoteRelatedReference = { kind: "lead", source: "native", id: leadId };
const legacyOrder: NoteRelatedReference = { kind: "sales_order", source: "legacy", id: "208" };

describe.skipIf(!enabled)("related records SQL compatibility in a disposable schema", () => {
    let db: Kysely<CrmDatabase>;
    let notes: NotesRepository;
    let related: NoteRelatedRecordsRepository;
    let collaboration: NoteCollaborationRepository;
    const required = (key: string) => {
        const value = process.env[key];
        if (value === undefined) throw new Error(`Missing ${key}`);
        return value;
    };
    beforeAll(async () => {
        if (!enabled || !schema || ["CRM_THINK_V2", "crmdatabase-api"].includes(schema)) throw new Error("Refusing nonisolated related-record test target");
        db = new Kysely<CrmDatabase>({ dialect: new MysqlDialect({ pool: createPool(buildMysqlPoolOptions({ host: required("DB_HOST"), port: Number(required("DB_PORT")), user: required("DB_USER"), password: required("DB_PASSWORD"), database: schema, connectionLimit: 2, ssl: process.env.DB_SSL !== "false", ...(process.env.DB_SSL_CA ? { sslCaPath: process.env.DB_SSL_CA } : {}) })) }) });
        expect((await sql<{ name: string }>`SELECT DATABASE() AS name`.execute(db)).rows[0]?.name).toBe(schema);
        expect((await sql<{ count: number }>`SELECT COUNT(*) AS count FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_TYPE='BASE TABLE'`.execute(db)).rows[0]?.count).toBe(0);
        await sql.raw("CREATE TABLE sec_user (id_user BIGINT UNSIGNED PRIMARY KEY,public_id_user CHAR(26) CHARACTER SET ascii COLLATE ascii_bin NOT NULL UNIQUE,display_name_user VARCHAR(250) NOT NULL,status_user VARCHAR(40) NOT NULL,deleted_at_user DATETIME(3) NULL) ENGINE=InnoDB").execute(db);
        await sql.raw("CREATE TABLE crm_contact (id_contact BIGINT UNSIGNED PRIMARY KEY,public_id_contact CHAR(26) CHARACTER SET ascii COLLATE ascii_bin UNIQUE) ENGINE=InnoDB").execute(db);
        await sql.raw("CREATE TABLE crm_lead (id_lead BIGINT UNSIGNED PRIMARY KEY,public_id_lead CHAR(26) CHARACTER SET ascii COLLATE ascii_bin NOT NULL UNIQUE,status_lead VARCHAR(20) NOT NULL DEFAULT 'active',deleted_at_lead DATETIME(3) NULL) ENGINE=InnoDB").execute(db);
        await sql.raw("CREATE TABLE crm_calendar_event (id_calendar_event BIGINT UNSIGNED PRIMARY KEY) ENGINE=InnoDB").execute(db);
        await sql.raw("CREATE TABLE int_external_system (id_external_system BIGINT UNSIGNED PRIMARY KEY,code_external_system VARCHAR(100) NOT NULL UNIQUE,status_external_system VARCHAR(40) NOT NULL) ENGINE=InnoDB").execute(db);
        await sql.raw("CREATE TABLE crm_sales_order (id_sales_order BIGINT UNSIGNED PRIMARY KEY,public_id_sales_order CHAR(26) CHARACTER SET ascii COLLATE ascii_bin NOT NULL UNIQUE,id_old_produccion_sales_order INT NULL UNIQUE,status_sales_order VARCHAR(40) NOT NULL,deleted_at_sales_order DATETIME(3) NULL,cancelled_sales_order VARCHAR(8) NOT NULL) ENGINE=InnoDB").execute(db);
        for (const statement of [...(await loadNotesStatements()), ...(await loadNotesCommandsStatements()), ...(await loadNotesCollaborationStatements())]) await sql.raw(statement).execute(db);
        await sql.raw("CREATE TABLE audit_record (id_record BIGINT PRIMARY KEY,source_schema_record VARCHAR(100),entity_type_record VARCHAR(50),source_table_record VARCHAR(100),source_id_record VARCHAR(100)) ENGINE=InnoDB").execute(db);
        await sql.raw("CREATE TABLE audit_record_event (id_record_event BIGINT PRIMARY KEY,record_id_record_event BIGINT,action_record_event VARCHAR(50),recorded_at_record_event DATETIME(3),actor_snapshot_record_event JSON,before_record_event JSON,after_record_event JSON,sequence_record_event INT) ENGINE=InnoDB").execute(db);
        await sql.raw("CREATE TABLE conf_schema_migration (migration_name_schema_migration VARCHAR(160) PRIMARY KEY) ENGINE=InnoDB").execute(db);
        await sql`INSERT INTO sec_user (id_user,public_id_user,display_name_user,status_user) VALUES (1,${author},'Synthetic author','active'),(2,${guest},'Synthetic guest','active'),(3,${stranger},'Synthetic stranger','active')`.execute(db);
        await sql`INSERT INTO crm_lead (id_lead,public_id_lead) VALUES (1,${leadId})`.execute(db);
        await sql`INSERT INTO crm_sales_order (id_sales_order,public_id_sales_order,status_sales_order,cancelled_sales_order) VALUES (1,${orderId},'active','no')`.execute(db);
        await sql`INSERT INTO int_external_system VALUES (1,'legacy_crm','active')`.execute(db);
        const database = { db } as DatabaseService;
        // These probes isolate repository transactions; they do not certify central audit/transport.
        const audit = { enabled: true, captureActor: () => Promise.resolve({ publicId: author, name: "Synthetic author", roles: [] }), append: async () => {} } as unknown as RecordAuditService;
        const realtime = { enqueueNoteChange: async () => {} } as unknown as NotesRealtimeEventsRepository;
        notes = new NotesRepository(database, audit, realtime);
        related = new NoteRelatedRecordsRepository(database);
        collaboration = new NoteCollaborationRepository(database, notes, audit, { enqueue: async () => {} } as unknown as NoteNotificationsRepository, realtime);
    }, 30000);
    beforeEach(async () => {
        for (const table of ["audit_record_event", "audit_record", "sec_notification", "int_note_command", "int_event_outbox", "crm_note_link", "crm_note_participant", "crm_note"]) await sql`DELETE FROM ${sql.table(table)}`.execute(db);
    });
    afterAll(async () => db.destroy());

    async function seed(context: NoteContext = { kind: "personal" }) {
        const id = ulid();
        await sql`INSERT INTO crm_note (public_id_note,author_user_id_note,origin_module_code_note,content_note,plain_text_note,updated_by_user_id_note) VALUES (${id},1,'mercadeo',${JSON.stringify({ format: "plain_text", text: "Synthetic related record fixture" })},'Synthetic related record fixture',1)`.execute(db);
        const note = await notes.find(access, id);
        if (context.kind === "sales_order") {
            await sql`INSERT INTO crm_note_link (note_id_note_link,target_key_note_link,target_kind_note_link,entity_type_note_link,sales_order_id_note_link,is_primary_note_link) VALUES (${note.internalId},${noteContextKey(access.moduleCode, context)},'native','sales_order',1,1)`.execute(db);
        } else {
            const view = context.kind === "personal" ? "mercadeo.personal" : "mercadeo.home";
            await sql`INSERT INTO crm_note_link (note_id_note_link,target_key_note_link,target_kind_note_link,entity_type_note_link,view_code_note_link,is_primary_note_link) VALUES (${note.internalId},${noteContextKey(access.moduleCode, context)},'view','view',${view},1)`.execute(db);
        }
        return note;
    }
    const replace = (note: Awaited<ReturnType<typeof seed>>, references: NoteRelatedReference[]) => db.transaction().execute((tx: Transaction<CrmDatabase>) => persistNoteRelatedRecords(tx, note, references));

    it("retains an existing personal primary context when native lead and legacy order references are added", async () => {
        const note = await seed();
        await replace(note, [nativeLead, legacyOrder]);
        expect(await notes.context(note)).toEqual({ kind: "personal" });
        const found = await related.referencesForNotes([note]);
        expect(found.get(note.internalId)?.map((item) => item.reference)).toEqual(expect.arrayContaining([nativeLead, legacyOrder]));
        const page = await notes.list(access, listNotesSchema.parse({ moduleCode: "mercadeo", contextType: "personal" }), { kind: "personal" });
        expect(page.total).toBe(1);
        expect(page.items.map((item) => item.publicId)).toEqual([note.publicId]);
    });
    it("lists a personal note through a secondary legacy order without duplicating it or changing its primary context", async () => {
        const note = await seed();
        await replace(note, [nativeLead, legacyOrder]);
        const context = { kind: "sales_order" as const, source: "legacy" as const, id: "208" };
        const query = listNotesSchema.parse({ moduleCode: "mercadeo", contextType: "sales_order", recordSource: "legacy", recordId: "208" });
        const page = await notes.list(access, query, context, ["mercadeo"]);
        expect(page.total).toBe(1);
        expect(page.items.map((item) => item.publicId)).toEqual([note.publicId]);
        expect(await notes.context(note)).toEqual({ kind: "personal" });
    });
    it("finds the same order note through confirmed native and legacy aliases", async () => {
        const nativeOrder = { kind: "sales_order" as const, source: "native" as const, id: orderId };
        const nativeContext = { kind: "sales_order" as const, source: "native" as const, id: orderId };
        const legacyContext = { kind: "sales_order" as const, source: "legacy" as const, id: "208" };
        const primaryNote = await seed(nativeContext);
        const secondaryNote = await seed();
        await replace(secondaryNote, [legacyOrder]);
        for (const context of [nativeContext, legacyContext]) {
            const query = listNotesSchema.parse({ moduleCode: "mercadeo", contextType: "sales_order", recordSource: context.source, recordId: context.id });
            const page = await notes.list(access, query, context, ["mercadeo"], [nativeOrder, legacyOrder]);
            expect(page.total).toBe(2);
            expect(page.items.map((item) => item.publicId)).toEqual(expect.arrayContaining([primaryNote.publicId, secondaryNote.publicId]));
        }
    });
    it("never removes an existing order primary when replacing secondary relationships", async () => {
        const context = { kind: "sales_order" as const, source: "native" as const, id: orderId };
        const note = await seed(context);
        await replace(note, [nativeLead]);
        await replace(note, []);
        expect(await notes.context(note)).toEqual(context);
        const primary = (await sql<{ count: number }>`SELECT COUNT(*) AS count FROM crm_note_link WHERE note_id_note_link=${note.internalId} AND is_primary_note_link=1`.execute(db)).rows[0];
        expect(Number(primary?.count)).toBe(1);
    });
    it("keeps identical external numbers distinct by entity type and avoids repeated rows on replacement", async () => {
        const note = await seed();
        const legacyLead = { kind: "lead" as const, source: "legacy" as const, id: "208" };
        await replace(note, [legacyLead, legacyOrder]);
        await replace(note, [legacyLead, legacyOrder]);
        const found = (await related.referencesForNotes([note])).get(note.internalId) ?? [];
        expect(found.map((item) => item.reference)).toEqual(expect.arrayContaining([legacyLead, legacyOrder]));
        expect(found).toHaveLength(2);
    });
    it("rolls the new note, its primary context and receipt back when a selected reference cannot persist", async () => {
        const input = createNoteSchema.parse({ moduleCode: "mercadeo", operationId: "qa_related_create_rollback_0001", title: "Synthetic rollback", text: "Synthetic body", relatedRecords: [{ kind: "lead", source: "native", id: "01K00000000000000000000999" }] });
        await expect(notes.create(access, input, { kind: "personal" })).rejects.toThrow();
        for (const table of ["crm_note", "crm_note_link", "int_note_command", "int_event_outbox"]) {
            expect(Number((await sql<{ count: number }>`SELECT COUNT(*) AS count FROM ${sql.table(table)}`.execute(db)).rows[0]?.count)).toBe(0);
        }
    });
    it("rolls secondary replacement back with the caller transaction", async () => {
        const note = await seed();
        await replace(note, [nativeLead]);
        await expect(
            db.transaction().execute(async (tx) => {
                await persistNoteRelatedRecords(tx, note, [legacyOrder]);
                throw new Error("Synthetic post-persistence failure");
            }),
        ).rejects.toThrow("Synthetic post-persistence failure");
        const found = (await related.referencesForNotes([note])).get(note.internalId) ?? [];
        expect(found.map((item) => item.reference)).toEqual([nativeLead]);
    });
    it("does not turn resource visibility into access to an unshared note", async () => {
        const note = await seed();
        await replace(note, [legacyOrder]);
        const context = { kind: "sales_order" as const, source: "legacy" as const, id: "208" };
        const query = listNotesSchema.parse({ moduleCode: "mercadeo", contextType: "sales_order", recordSource: "legacy", recordId: "208" });
        expect((await notes.list({ ...access, actorPublicId: stranger }, query, context, ["mercadeo"])).items).toEqual([]);
        await expect(notes.find({ ...access, actorPublicId: stranger }, note.publicId)).rejects.toMatchObject({ status: 404 });
        await sql`UPDATE crm_note SET visibility_note='shared' WHERE id_note=${note.internalId}`.execute(db);
        await sql`INSERT INTO crm_note_participant (note_id_note_participant,user_id_note_participant,granted_by_user_id_note_participant) VALUES (${note.internalId},2,1)`.execute(db);
        expect((await notes.list({ ...access, actorPublicId: guest }, query, context, ["mercadeo"])).items.map((item) => item.publicId)).toEqual([note.publicId]);
    });
    it("redacts source-qualified related identifiers from the public history snapshots", async () => {
        const note = await seed();
        const snapshot = JSON.stringify({ command: "relatedRecords", relatedRecords: [nativeLead, legacyOrder], collaborationVersion: 2 });
        await sql`INSERT INTO audit_record VALUES (1,'CRM_THINK_V2','note','crm_note',${note.publicId})`.execute(db);
        await sql`INSERT INTO audit_record_event VALUES (1,1,'annotation',UTC_TIMESTAMP(3),${JSON.stringify({ publicId: author })},${snapshot},${snapshot},1)`.execute(db);
        const history = await notes.history(note, guest);
        expect(history).toHaveLength(1);
        const visible = JSON.stringify(history);
        expect(visible).not.toContain("relatedRecords");
        expect(visible).not.toContain(leadId);
        expect(visible).not.toContain('"208"');
        expect(visible).toContain("collaborationVersion");
        const raw = (await sql<{ snapshot: object }>`SELECT after_record_event AS snapshot FROM audit_record_event`.execute(db)).rows[0];
        expect(JSON.stringify(raw)).toContain(leadId);
    });
    it("replays an unchanged client operation after server-only preserved links were populated", async () => {
        const note = await seed();
        await replace(note, [nativeLead]);
        const [stored] = (await related.referencesForNotes([note])).get(note.internalId) ?? [];
        if (!stored) throw new Error("Missing synthetic related link");
        const command = { kind: "relatedRecords" as const, operationId: "qa_related_sql_replay_0001", expectedCollaborationVersion: 1, relatedRecords: [] as NoteRelatedReference[], preservedLinkIds: [] as number[] };
        const authorize: Parameters<NoteCollaborationRepository["command"]>[3] = (_state, _tx, phase) => {
            if (phase === "write") command.preservedLinkIds = [stored.linkId];
            return Promise.resolve();
        };
        const first = await collaboration.command(author, note.publicId, command, authorize);
        expect(command.preservedLinkIds).toEqual([stored.linkId]);
        expect(await collaboration.command(author, note.publicId, command, authorize)).toEqual({ ...first, replayed: true });
        expect((await related.referencesForNotes([note])).get(note.internalId)?.map((item) => item.reference)).toEqual([nativeLead]);
        expect(Number((await sql<{ count: number }>`SELECT COUNT(*) AS count FROM int_note_command`.execute(db)).rows[0]?.count)).toBe(1);
    });
});
