import { randomUUID } from "node:crypto";

import { Kysely, MysqlDialect, sql, type Transaction } from "kysely";
import { createPool } from "mysql2";
import { ulid } from "ulid";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { loadNotesStatements } from "../../migrations/schema-only/202610270039_notes_domain.js";
import { loadNotesCommandsStatements } from "../../migrations/schema-only/202610270040_notes_commands.js";
import type { DatabaseService } from "../../src/database/database.service.js";
import type { CrmDatabase } from "../../src/database/database.types.js";
import { buildMysqlPoolOptions } from "../../src/database/mysql-pool-options.js";
import type { RecordAuditService } from "../../src/modules/crm/audit/record-audit.service.js";
import { createNoteSchema, editNoteSchema, listNotesSchema, type NoteAccess, noteStateSchema, placementSchema } from "../../src/modules/crm/notes/notes.contract.js";
import { NotesRepository } from "../../src/modules/crm/notes/notes.repository.js";

// Opt in only to an empty, precreated disposable schema. No dotenv or runtime DB_NAME fallback.
const schema = process.env.NOTES_MYSQL_TEST_SCHEMA;
const enabled = Boolean(schema && /^crm_notes_test_[a-z0-9_]+$/.test(schema) && process.env.NOTES_MYSQL_TEST_CONFIRM === schema);
const access: NoteAccess = { actorPublicId: "01K00000000000000000000001", moduleCode: "mercadeo", ownOnly: false };
const other: NoteAccess = { ...access, actorPublicId: "01K00000000000000000000002" };
const operation = () => `notes_test_${randomUUID()}`;
const createInput = () => createNoteSchema.parse({ moduleCode: "mercadeo", operationId: operation(), text: "Synthetic private SQL fixture" });
const tables = ["audit_probe_test", "int_note_command", "int_event_outbox", "int_note_external_reference", "crm_note_mention", "crm_note_reply", "crm_note_participant", "crm_note_placement", "crm_note_link", "crm_note"];

/** Exercises repository SQL/transactions, not the real RecordAuditService implementation or transports. */
describe.skipIf(!enabled)("notes repository MySQL in isolated disposable schema", () => {
    let db: Kysely<CrmDatabase> | undefined;
    let repository: NotesRepository;
    let failure: "audit" | "outbox" | undefined;
    const database = () => {
        if (!db) throw new Error("Isolated notes database was not initialized");
        return db;
    };
    const counts = async () => Promise.all(tables.map(async (table) => Number((await sql<{ count: number }>`SELECT COUNT(*) AS count FROM ${sql.table(table)}`.execute(database())).rows[0]?.count)));
    const share = async (id: string) => {
        await sql`UPDATE crm_note SET visibility_note='shared' WHERE public_id_note=${id}`.execute(database());
        await sql`INSERT INTO crm_note_participant (note_id_note_participant,user_id_note_participant,granted_by_user_id_note_participant) SELECT id_note,2,1 FROM crm_note WHERE public_id_note=${id}`.execute(database());
    };

    const initializeDatabase = (isolatedSchema: string) => {
        const required = (key: string) => {
            const value = process.env[key];
            if (value === undefined) throw new Error(`Missing ${key}`);
            return value;
        };
        db = new Kysely<CrmDatabase>({ dialect: new MysqlDialect({ pool: createPool(buildMysqlPoolOptions({ host: required("DB_HOST"), port: Number(required("DB_PORT")), user: required("DB_USER"), password: required("DB_PASSWORD"), database: isolatedSchema, connectionLimit: 2, ssl: process.env.DB_SSL !== "false", ...(process.env.DB_SSL_CA ? { sslCaPath: process.env.DB_SSL_CA } : {}) })) }) });
    };
    beforeAll(async () => {
        if (!enabled || !schema || ["CRM_THINK_V2", "crmdatabase-api"].includes(schema)) throw new Error("Refusing nonisolated notes test target");
        initializeDatabase(schema);
        const db = database();
        expect((await sql<{ name: string }>`SELECT DATABASE() AS name`.execute(db)).rows[0]?.name).toBe(schema);
        // This assertion precedes every DDL statement, including synthetic parent creation.
        expect((await sql<{ count: number }>`SELECT COUNT(*) AS count FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_TYPE='BASE TABLE'`.execute(db)).rows[0]?.count).toBe(0);
        await sql.raw("CREATE TABLE sec_user (id_user BIGINT UNSIGNED PRIMARY KEY,public_id_user CHAR(26) CHARACTER SET ascii COLLATE ascii_bin NOT NULL UNIQUE,display_name_user VARCHAR(250) NOT NULL,status_user VARCHAR(40) NOT NULL,deleted_at_user DATETIME(3) NULL) ENGINE=InnoDB").execute(db);
        for (const [table, key] of [
            ["crm_contact", "id_contact"],
            ["crm_lead", "id_lead"],
            ["crm_calendar_event", "id_calendar_event"],
        ] as const)
            await sql.raw(`CREATE TABLE ${table} (${key} BIGINT UNSIGNED PRIMARY KEY) ENGINE=InnoDB`).execute(db);
        await sql.raw("CREATE TABLE int_external_system (id_external_system BIGINT UNSIGNED PRIMARY KEY,code_external_system VARCHAR(100) NOT NULL UNIQUE,status_external_system VARCHAR(40) NOT NULL) ENGINE=InnoDB").execute(db);
        await sql.raw("CREATE TABLE crm_sales_order (id_sales_order BIGINT UNSIGNED PRIMARY KEY,public_id_sales_order CHAR(26) CHARACTER SET ascii COLLATE ascii_bin NOT NULL UNIQUE,status_sales_order VARCHAR(40) NOT NULL,deleted_at_sales_order DATETIME(3) NULL,cancelled_sales_order VARCHAR(8) NOT NULL) ENGINE=InnoDB").execute(db);
        for (const statement of [...(await loadNotesStatements()), ...(await loadNotesCommandsStatements())]) await sql.raw(statement).execute(db);
        await sql.raw("CREATE TABLE conf_schema_migration (migration_name_schema_migration VARCHAR(160) PRIMARY KEY) ENGINE=InnoDB").execute(db);
        await sql`INSERT INTO conf_schema_migration VALUES ('202610270039_notes_domain'),('202610270040_notes_commands')`.execute(db);
        await sql.raw("CREATE TABLE audit_probe_test (id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,note_id VARCHAR(120) NOT NULL,action_code VARCHAR(40) NOT NULL,actor_payload JSON NOT NULL,after_payload JSON NOT NULL,operation_id VARCHAR(100) NOT NULL) ENGINE=InnoDB").execute(db);
        await sql`INSERT INTO sec_user (id_user,public_id_user,display_name_user,status_user) VALUES (1,${access.actorPublicId},'Synthetic author','active'),(2,${other.actorPublicId},'Synthetic participant','active')`.execute(db);
        await sql`INSERT INTO int_external_system (id_external_system,code_external_system,status_external_system) VALUES (1,'legacy_crm','active')`.execute(db);
        const audit = {
            enabled: true,
            captureActor: async (tx: Transaction<CrmDatabase>, actor: number) => {
                const result = await sql<{ publicId: string; name: string }>`SELECT public_id_user AS publicId,display_name_user AS name FROM sec_user WHERE id_user=${actor}`.execute(tx);
                return { ...result.rows[0], roles: [] };
            },
            append: async (tx: Transaction<CrmDatabase>, event: { source: { id: string }; action: string; actor: unknown; after: { version?: number }; operationId: string }) => {
                await sql`INSERT INTO audit_probe_test (note_id,action_code,actor_payload,after_payload,operation_id) VALUES (${event.source.id},${event.action},${JSON.stringify(event.actor)},${JSON.stringify(event.after)},${event.operationId})`.execute(tx);
                if (failure === "audit") throw new Error("Synthetic audit failure after write");
                // A valid conflicting delivery makes the repository's subsequent INSERT fail in MySQL.
                if (failure === "outbox") await sql`INSERT INTO int_event_outbox (public_id_event_outbox,aggregate_type_event_outbox,aggregate_public_id_event_outbox,aggregate_version_event_outbox,event_type_event_outbox,destination_code_event_outbox,payload_event_outbox) VALUES (${ulid()},'note',${event.source.id},${event.after.version},'synthetic_conflict','notification','{}')`.execute(tx);
            },
        };
        repository = new NotesRepository({ db } as DatabaseService, audit as unknown as RecordAuditService, { enqueueNoteChange: async () => {} } as never);
    }, 30000);
    beforeEach(async () => {
        failure = undefined;
        for (const table of tables) await sql`DELETE FROM ${sql.table(table)}`.execute(database());
    });
    afterAll(async () => {
        await db?.destroy();
    });

    it("commits note, Home link, audit probe, two pending deliveries and receipt; replay adds nothing", async () => {
        const input = createInput();
        const result = await repository.create(access, input, input.context);
        expect(result).toMatchObject({ version: 1, replayed: false });
        expect(await counts()).toEqual([1, 1, 2, 0, 0, 0, 0, 0, 1, 1]);
        expect(await repository.context(await repository.find(access, result.noteId))).toEqual({ kind: "view" });
        expect((await sql<{ view: string; primary: number }>`SELECT view_code_note_link AS view,is_primary_note_link AS ${sql.ref("primary")} FROM crm_note_link`.execute(database())).rows).toEqual([{ view: "mercadeo.home", primary: 1 }]);
        const deliveries = (await sql<{ destination: string; status: string; payload: unknown }>`SELECT destination_code_event_outbox AS destination,status_event_outbox AS status,payload_event_outbox AS payload FROM int_event_outbox ORDER BY destination_code_event_outbox`.execute(database())).rows;
        expect(deliveries.map((row) => [row.destination, row.status])).toEqual([
            ["legacy_projection", "pending"],
            ["notification", "pending"],
        ]);
        expect(JSON.stringify(deliveries)).not.toContain(input.text);
        expect(await repository.create(access, input, input.context)).toEqual({ ...result, replayed: true });
        expect(await counts()).toEqual([1, 1, 2, 0, 0, 0, 0, 0, 1, 1]);
        await expect(repository.create(access, { ...input, text: "changed" }, input.context)).rejects.toMatchObject({ status: 409 });
    });

    it("keeps personal notes separate from Home and preserves canonical context on replay", async () => {
        const input = createNoteSchema.parse({ ...createInput(), context: { kind: "personal" } });
        const result = await repository.create(access, input, input.context);
        expect(await repository.context(await repository.find(access, result.noteId))).toEqual({ kind: "personal" });
        const personal = await repository.list(access, listNotesSchema.parse({ moduleCode: access.moduleCode, contextType: "personal" }), input.context);
        expect(personal.items.map((note) => note.publicId)).toEqual([result.noteId]);
        expect((await repository.list(access, listNotesSchema.parse({ moduleCode: access.moduleCode }), { kind: "view" })).total).toBe(0);
        expect(await repository.create(access, input, input.context)).toEqual({ ...result, replayed: true });
    });

    it("stores legacy reference metadata without copying an order or broadening note visibility", async () => {
        const formalization = { ...access, moduleCode: "formalizacion" as const };
        const input = createNoteSchema.parse({ ...createInput(), moduleCode: "formalizacion", context: { kind: "sales_order", source: "legacy", id: "208" } });
        const result = await repository.create(formalization, input, input.context);
        expect(await repository.context(await repository.find(formalization, result.noteId))).toEqual(input.context);
        const link = (await sql<{ kind: string; externalId: string; systemId: number; orderId: number | null }>`SELECT target_kind_note_link AS kind,external_id_note_link AS externalId,external_system_id_note_link AS systemId,sales_order_id_note_link AS orderId FROM crm_note_link`.execute(database())).rows[0];
        expect(link).toEqual({ kind: "external", externalId: "208", systemId: 1, orderId: null });
        expect(Number((await sql<{ count: number }>`SELECT COUNT(*) AS count FROM crm_sales_order`.execute(database())).rows[0]?.count)).toBe(0);
        await expect(repository.find({ ...formalization, actorPublicId: other.actorPublicId }, result.noteId)).rejects.toMatchObject({ status: 404 });
        expect(await repository.create(formalization, input, input.context)).toEqual({ ...result, replayed: true });
    });

    it("shares an order across workspaces only with invited people and keeps other orders separate", async () => {
        const author = { ...access, moduleCode: "formalizacion" as const };
        const context = { kind: "sales_order" as const, source: "legacy" as const, id: "208" };
        const command = createNoteSchema.parse({ ...createInput(), moduleCode: "formalizacion", context });
        const { noteId } = await repository.create(author, command, context);
        const query = listNotesSchema.parse({ moduleCode: "contabilidad", contextType: "sales_order", recordSource: "legacy", recordId: "208", status: "all" });
        const reader = { ...other, moduleCode: "contabilidad" as const };
        expect((await repository.list(reader, query, context, ["contabilidad", "formalizacion"])).total).toBe(0);
        await share(noteId);
        const result = await repository.list(reader, query, context, ["contabilidad", "formalizacion"]);
        expect(result.total).toBe(1);
        expect(result.items[0]?.moduleCode).toBe("formalizacion");
        expect((await repository.list(reader, query, { ...context, id: "209" }, ["contabilidad", "formalizacion"])).total).toBe(0);
        expect((await repository.list(reader, query, context, ["contabilidad"])).total).toBe(0);
        await sql`UPDATE crm_note_participant SET status_note_participant='revoked',revoked_at_note_participant=UTC_TIMESTAMP(3),revoked_by_user_id_note_participant=1`.execute(database());
        expect((await repository.list(reader, query, context, ["contabilidad", "formalizacion"])).total).toBe(0);
    });

    it("edits with explicit UTC updatedAt and rejects a stale version without writes", async () => {
        const input = createInput();
        const result = await repository.create(access, input, input.context);
        await sql`UPDATE crm_note SET updated_at_note='2001-01-01 00:00:00.000' WHERE public_id_note=${result.noteId}`.execute(database());
        const edit = editNoteSchema.parse({ moduleCode: "mercadeo", operationId: operation(), expectedVersion: 1, text: "Edited synthetic text" });
        expect(await repository.edit(access, result.noteId, edit)).toMatchObject({ version: 2 });
        const note = await repository.find(access, result.noteId);
        expect(note.text).toBe(edit.text);
        const clock = (await sql<{ delta: number }>`SELECT ABS(TIMESTAMPDIFF(SECOND,updated_at_note,UTC_TIMESTAMP(3))) AS delta FROM crm_note WHERE public_id_note=${result.noteId}`.execute(database())).rows[0];
        expect(clock?.delta).toBeLessThan(10);
        const before = await counts();
        await expect(repository.edit(access, result.noteId, { ...edit, operationId: operation() })).rejects.toMatchObject({ status: 409 });
        expect(await counts()).toEqual(before);
    });

    it("completes, reopens and archives with versioned lifecycle metadata", async () => {
        const input = createInput();
        const { noteId } = await repository.create(access, input, input.context);
        for (const [index, action] of (["complete", "reopen", "archive"] as const).entries()) {
            expect(await repository.lifecycle(access, noteId, noteStateSchema.parse({ moduleCode: "mercadeo", operationId: operation(), expectedVersion: index + 1 }), action)).toMatchObject({ version: index + 2 });
            const note = await repository.find(access, noteId);
            expect(note.status).toBe({ complete: "completed", reopen: "open", archive: "archived" }[action]);
            if (action === "complete") expect(note.completedAt).not.toBeNull();
            if (action === "reopen") expect(note.completedAt).toBeNull();
            if (action === "archive") expect(note.archivedAt).not.toBeNull();
        }
        expect(await counts()).toEqual([4, 4, 8, 0, 0, 0, 0, 0, 1, 1]);
    });

    it("enforces private/list ACL and author-only mutations even for a shared participant", async () => {
        const input = createInput();
        const { noteId } = await repository.create(access, input, input.context);
        await expect(repository.find(other, noteId)).rejects.toMatchObject({ status: 404 });
        expect((await repository.list(other, listNotesSchema.parse({ moduleCode: "mercadeo" }), input.context)).total).toBe(0);
        await share(noteId);
        expect((await repository.find(other, noteId)).publicId).toBe(noteId);
        const before = await counts();
        await expect(repository.edit(other, noteId, editNoteSchema.parse({ moduleCode: "mercadeo", operationId: operation(), expectedVersion: 1, text: "Denied" }))).rejects.toMatchObject({ status: 403 });
        await expect(repository.lifecycle(other, noteId, noteStateSchema.parse({ moduleCode: "mercadeo", operationId: operation(), expectedVersion: 1 }), "archive")).rejects.toMatchObject({ status: 403 });
        expect(await counts()).toEqual(before);
        // A self baseline does not revoke an explicit invitation or grant authorship.
        expect((await repository.list({ ...other, ownOnly: true }, listNotesSchema.parse({ moduleCode: "mercadeo" }), input.context)).total).toBe(1);
    });

    it("versions each actor's layout separately without changing note timestamps, version or outbox", async () => {
        const input = createInput();
        const { noteId } = await repository.create(access, input, input.context);
        await share(noteId);
        const original = await repository.find(access, noteId);
        const move = (version: number) => placementSchema.parse({ moduleCode: "mercadeo", operationId: operation(), expectedLayoutVersion: version, x: 12.5, y: 20, width: 280, height: 200 });
        expect(await repository.move(access, noteId, move(0))).toMatchObject({ version: 1, layoutVersion: 1 });
        expect(await repository.move(access, noteId, move(1))).toMatchObject({ version: 1, layoutVersion: 2 });
        expect(await repository.move(other, noteId, move(0))).toMatchObject({ version: 1, layoutVersion: 1 });
        expect((await repository.placement(access, original))[0]?.layoutVersion).toBe(2);
        expect((await repository.placement(other, original))[0]?.layoutVersion).toBe(1);
        expect(await repository.find(access, noteId)).toEqual(original);
        const before = await counts();
        await expect(repository.move(access, noteId, move(0))).rejects.toMatchObject({ status: 409 });
        expect(await counts()).toEqual(before);
        expect(before[2]).toBe(2);
    });

    it.each(["audit", "outbox"] as const)("rolls back every write when %s fails after audit persistence", async (mode) => {
        const before = await counts();
        failure = mode;
        const input = createInput();
        await expect(repository.create(access, input, input.context)).rejects.toThrow();
        expect(await counts()).toEqual(before);
        failure = undefined;
        expect(await repository.create(access, input, input.context)).toMatchObject({ replayed: false, version: 1 });
    });
});
