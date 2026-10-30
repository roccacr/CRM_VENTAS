import "reflect-metadata";

import { randomUUID } from "node:crypto";
import { createServer } from "node:http";

import { ConfigService } from "@nestjs/config";
import { Kysely, MysqlDialect, sql, type Transaction } from "kysely";
import { createPool } from "mysql2";
import { Server } from "socket.io";
import { io, type Socket as ClientSocket } from "socket.io-client";
import { ulid } from "ulid";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { loadNotesStatements } from "../../migrations/schema-only/202610270039_notes_domain.js";
import { loadNotesCommandsStatements } from "../../migrations/schema-only/202610270040_notes_commands.js";
import { loadNotesCollaborationStatements } from "../../migrations/schema-only/202610270044_notes_collaboration.js";
import { loadNotesRealtimeStatements } from "../../migrations/schema-only/202610280046_notes_realtime.js";
import { loadNotesLocationsStatements } from "../../migrations/schema-only/202610280052_notes_locations.js";
import { loadNotesWorkflowStatements } from "../../migrations/schema-only/202610280053_notes_workflow.js";
import { createSignedCsrfToken } from "../../src/common/security/csrf-token.js";
import type { DatabaseService } from "../../src/database/database.service.js";
import type { CrmDatabase } from "../../src/database/database.types.js";
import { buildMysqlPoolOptions } from "../../src/database/mysql-pool-options.js";
import type { RecordAuditService } from "../../src/modules/crm/audit/record-audit.service.js";
import type { IdentityService } from "../../src/modules/crm/identity/identity.service.js";
import type { CollaborationCommand } from "../../src/modules/crm/notes/note-collaboration.contract.js";
import { NoteCollaborationRepository } from "../../src/modules/crm/notes/note-collaboration.repository.js";
import type { NoteCollaborationService } from "../../src/modules/crm/notes/note-collaboration.service.js";
import { NoteNotificationsRepository } from "../../src/modules/crm/notes/note-notifications.repository.js";
import { NoteNotificationsWorker } from "../../src/modules/crm/notes/note-notifications.worker.js";
import { reminderSchema, taskSchema } from "../../src/modules/crm/notes/note-workflow.contract.js";
import { NoteWorkflowRepository } from "../../src/modules/crm/notes/note-workflow.repository.js";
import { listNotesSchema } from "../../src/modules/crm/notes/notes.contract.js";
import { createNoteSchema, type NoteAccess } from "../../src/modules/crm/notes/notes.contract.js";
import { NotesRepository } from "../../src/modules/crm/notes/notes.repository.js";
import { NotesRealtimeAuth } from "../../src/modules/crm/notes/notes-realtime.auth.js";
import type { NotesRealtimeActivity } from "../../src/modules/crm/notes/notes-realtime.contract.js";
import { NotesRealtimeGateway } from "../../src/modules/crm/notes/notes-realtime.gateway.js";
import { NotesRealtimeEventsRepository } from "../../src/modules/crm/notes/notes-realtime.repository.js";
import { NotesRealtimeSignal } from "../../src/modules/crm/notes/notes-realtime.signal.js";
import { NotesRealtimeWorker } from "../../src/modules/crm/notes/notes-realtime.worker.js";
import { retryNoteDeadlock } from "../../src/modules/crm/notes/notes-transaction.js";
// A precreated empty disposable schema and matching confirmation are both mandatory.
// Never load dotenv here and never fall back to the application's DB_NAME.
const schema = process.env.NOTES_MYSQL_TEST_SCHEMA;
const enabled = Boolean(schema && /^crm_notes_test_[a-z0-9_]+$/.test(schema) && process.env.NOTES_MYSQL_TEST_CONFIRM === schema);
const owner = "01K00000000000000000000001";
const participant = "01K00000000000000000000002";
const stranger = "01K00000000000000000000003";
const access: NoteAccess = { actorPublicId: owner, moduleCode: "mercadeo", ownOnly: false };
const operation = () => `notes_collaboration_test_${randomUUID()}`;
const tables = ["crm_note_workflow_event", "crm_note_task", "crm_note_location", "crm_note_realtime_event", "sec_notification", "audit_probe_test", "int_note_command", "int_event_outbox", "int_note_external_reference", "crm_note_mention", "crm_note_reply", "crm_note_participant", "crm_note_placement", "crm_note_link", "crm_note"];

/** Real SQL/transactions and worker, with synthetic audit storage and repository-ACL authorization facade. */
describe.skipIf(!enabled)("collaboration and notification worker MySQL in isolated disposable schema", () => {
    let db: Kysely<CrmDatabase> | undefined;
    let notes: NotesRepository;
    let realtime: NotesRealtimeEventsRepository;
    let collaboration: NoteCollaborationRepository;
    let notifications: NoteNotificationsRepository;
    let worker: NoteNotificationsWorker;
    let workflow: NoteWorkflowRepository;
    let failure: "audit" | "outbox" | "authorization" | undefined;
    const database = () => {
        if (!db) throw new Error("Isolated collaboration database was not initialized");
        return db;
    };
    const count = async (table: string) => Number((await sql<{ total: number }>`SELECT COUNT(*) AS total FROM ${sql.table(table)}`.execute(database())).rows[0]?.total);
    const counts = () => Promise.all(tables.map(count));
    const command = (actor: string, noteId: string, input: CollaborationCommand) => collaboration.command(actor, noteId, input, async () => {});
    const invite = (noteId: string, version = 1) => command(owner, noteId, { kind: "participants", operationId: operation(), expectedCollaborationVersion: version, participants: [{ userId: participant, access: "reply" }] });
    const revoke = (noteId: string, version: number) => command(owner, noteId, { kind: "participants", operationId: operation(), expectedCollaborationVersion: version, participants: [] });
    const create = async () => {
        const input = createNoteSchema.parse({ moduleCode: access.moduleCode, operationId: operation(), text: "Synthetic note body must remain private", context: { kind: "personal" } });
        return notes.create(access, input, input.context);
    };
    const authorize = async (userId: string, noteId: string) => {
        if (failure === "authorization") throw new Error("Synthetic transient authorization failure");
        try {
            const state = await collaboration.load(userId, noteId);
            return { noteId, moduleCode: state.note.moduleCode, context: state.context };
        } catch (error) {
            if (error instanceof Error && "status" in error && error.status === 404) return null;
            throw error;
        }
    };
    const through = "2099-01-01T00:00:00.000Z";
    const delivered = (userId: string) => notifications.candidates(userId, through);

    const initializeDatabase = (isolatedSchema: string) => {
        const required = (key: string) => {
            const value = process.env[key];
            if (value === undefined) throw new Error(`Missing ${key}`);
            return value;
        };
        db = new Kysely<CrmDatabase>({ dialect: new MysqlDialect({ pool: createPool(buildMysqlPoolOptions({ host: required("DB_HOST"), port: Number(required("DB_PORT")), user: required("DB_USER"), password: required("DB_PASSWORD"), database: isolatedSchema, connectionLimit: 4, ssl: process.env.DB_SSL !== "false", ...(process.env.DB_SSL_CA ? { sslCaPath: process.env.DB_SSL_CA } : {}) })) }) });
    };
    beforeAll(async () => {
        if (!enabled || !schema) throw new Error("Refusing nonisolated collaboration target");
        initializeDatabase(schema);
        const db = database();
        expect((await sql<{ name: string }>`SELECT DATABASE() AS name`.execute(db)).rows[0]?.name).toBe(schema);
        // Refuse reuse before any DDL or DELETE, including synthetic parent tables.
        expect((await sql<{ total: number }>`SELECT COUNT(*) AS total FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_TYPE='BASE TABLE'`.execute(db)).rows[0]?.total).toBe(0);
        await sql.raw("CREATE TABLE sec_user (id_user BIGINT UNSIGNED PRIMARY KEY,public_id_user CHAR(26) CHARACTER SET ascii COLLATE ascii_bin NOT NULL UNIQUE,display_name_user VARCHAR(250) NOT NULL,status_user VARCHAR(40) NOT NULL,deleted_at_user DATETIME(3) NULL) ENGINE=InnoDB").execute(db);
        for (const [table, key] of [
            ["crm_contact", "id_contact"],
            ["crm_lead", "id_lead"],
            ["crm_calendar_event", "id_calendar_event"],
        ] as const)
            await sql.raw(`CREATE TABLE ${table} (${key} BIGINT UNSIGNED PRIMARY KEY) ENGINE=InnoDB`).execute(db);
        await sql.raw("CREATE TABLE int_external_system (id_external_system BIGINT UNSIGNED PRIMARY KEY,code_external_system VARCHAR(100) NOT NULL UNIQUE,status_external_system VARCHAR(40) NOT NULL) ENGINE=InnoDB").execute(db);
        await sql.raw("CREATE TABLE crm_sales_order (id_sales_order BIGINT UNSIGNED PRIMARY KEY,public_id_sales_order CHAR(26) CHARACTER SET ascii COLLATE ascii_bin NOT NULL UNIQUE,status_sales_order VARCHAR(40) NOT NULL,deleted_at_sales_order DATETIME(3) NULL,cancelled_sales_order VARCHAR(8) NOT NULL) ENGINE=InnoDB").execute(db);
        for (const statement of [...(await loadNotesStatements()), ...(await loadNotesCommandsStatements()), ...(await loadNotesCollaborationStatements()), ...(await loadNotesRealtimeStatements()), ...(await loadNotesLocationsStatements()), ...(await loadNotesWorkflowStatements())]) await sql.raw(statement).execute(db);
        await sql.raw("CREATE TABLE conf_schema_migration (migration_name_schema_migration VARCHAR(160) PRIMARY KEY) ENGINE=InnoDB").execute(db);
        await sql`INSERT INTO conf_schema_migration VALUES ('202610270044_notes_collaboration'),('202610280046_notes_realtime'),('202610280052_notes_locations'),('202610280053_notes_workflow')`.execute(db);
        await sql.raw("CREATE TABLE audit_probe_test (id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,note_id VARCHAR(120) NOT NULL,action_code VARCHAR(40) NOT NULL,actor_payload JSON NOT NULL,after_payload JSON NOT NULL,operation_id VARCHAR(100) NOT NULL) ENGINE=InnoDB").execute(db);
        await sql`INSERT INTO sec_user (id_user,public_id_user,display_name_user,status_user) VALUES (1,${owner},'Synthetic author','active'),(2,${participant},'Synthetic invitee','active'),(3,${stranger},'Synthetic stranger','active')`.execute(db);
        const audit = {
            enabled: true,
            captureActor: async (tx: Transaction<CrmDatabase>, actor: number) => {
                const result = await sql<{ publicId: string; name: string }>`SELECT public_id_user AS publicId,display_name_user AS name FROM sec_user WHERE id_user=${actor}`.execute(tx);
                return { ...result.rows[0], roles: [] };
            },
            append: async (tx: Transaction<CrmDatabase>, event: { source: { id: string }; action: string; actor: unknown; after: { collaborationVersion?: number }; operationId: string }) => {
                await sql`INSERT INTO audit_probe_test (note_id,action_code,actor_payload,after_payload,operation_id) VALUES (${event.source.id},${event.action},${JSON.stringify(event.actor)},${JSON.stringify(event.after)},${event.operationId})`.execute(tx);
                if (failure === "audit") throw new Error("Synthetic audit failure after persistence");
                if (failure === "outbox") await sql`INSERT INTO int_event_outbox (public_id_event_outbox,aggregate_type_event_outbox,aggregate_public_id_event_outbox,aggregate_version_event_outbox,event_type_event_outbox,destination_code_event_outbox,payload_event_outbox) VALUES (${ulid()},'note_collaboration',${event.source.id},${event.after.collaborationVersion},'synthetic_conflict','notification','{}')`.execute(tx);
            },
        };
        const service = { db } as DatabaseService;
        realtime = new NotesRealtimeEventsRepository(service);
        notes = new NotesRepository(service, audit as unknown as RecordAuditService, realtime);
        notifications = new NoteNotificationsRepository(service, realtime);
        collaboration = new NoteCollaborationRepository(service, notes, audit as unknown as RecordAuditService, notifications, realtime);
        workflow = new NoteWorkflowRepository(service, collaboration, audit as unknown as RecordAuditService, realtime);
        worker = new NoteNotificationsWorker(notifications, { authorizeUserRead: authorize } as unknown as NoteCollaborationService, new NotesRealtimeSignal());
    }, 30000);
    beforeEach(async () => {
        failure = undefined;
        for (const table of tables) await sql`DELETE FROM ${sql.table(table)}`.execute(database());
    }, 30000);
    afterAll(async () => {
        await db?.destroy();
    }, 30000);

    // Identity is synthetic; all note ACL reads, mutations, outboxes, notices and dispatch leases are real SQL.
    const openRealtimeTransport = async () => {
        const origin = "http://synthetic-notes.test";
        const secret = "isolated-synthetic-notes-cookie-secret";
        const config = new ConfigService({ FRONTEND_ORIGIN: origin, COOKIE_SECRET: secret, NOTES_REALTIME_ENABLED: true, NOTES_REALTIME_TOPOLOGY: "single" });
        const sessions = new Map([
            ["synthetic-owner-session", owner],
            ["synthetic-invitee-session", participant],
            ["synthetic-stranger-session", stranger],
        ]);
        const expiresAt = new Date(Date.now() + 120000).toISOString();
        const identity = {
            getCurrentUser: (token: string) => {
                const publicId = sessions.get(token);
                if (!publicId) throw new Error("Synthetic unauthenticated session");
                return Promise.resolve({ user: { publicId }, session: { expiresAt } });
            },
        } as unknown as IdentityService;
        const http = createServer();
        const server = new Server(http, { transports: ["websocket"] });
        const namespace = server.of("/notes");
        const acl = { authorizeUserRead: authorize } as unknown as NoteCollaborationService;
        const gateway = new NotesRealtimeGateway(new NotesRealtimeAuth(config, identity), acl, realtime, config);
        await gateway.afterInit(namespace);
        namespace.on("connection", (socket) => {
            gateway.handleConnection(socket);
        });
        await new Promise<void>((resolve) => {
            http.listen(0, "127.0.0.1", resolve);
        });
        const address = http.address();
        if (!address || typeof address === "string") throw new Error("Missing synthetic socket port");
        const clients: ClientSocket[] = [];
        const connect = async (token: string) => {
            const csrf = createSignedCsrfToken(secret, token);
            const socket = io(`http://127.0.0.1:${String(address.port)}/notes`, { transports: ["websocket"], reconnection: false, auth: { csrfToken: csrf }, extraHeaders: { Origin: origin, Cookie: `crm_session=${token}; crm_csrf=${csrf}` } });
            clients.push(socket);
            const packets: NotesRealtimeActivity[] = [];
            socket.on("activity", (packet: NotesRealtimeActivity) => {
                packets.push(packet);
            });
            await new Promise<void>((resolve, reject) => {
                socket.once("connect", () => {
                    resolve();
                });
                socket.once("connect_error", reject);
            });
            return { socket, packets };
        };
        const publisher = new NotesRealtimeWorker(realtime, gateway, new NotesRealtimeSignal(), config);
        const close = async () => {
            publisher.onModuleDestroy();
            for (const socket of clients) socket.disconnect();
            await gateway.onModuleDestroy();
            await new Promise<void>((resolve) => {
                void server.close(() => {
                    resolve();
                });
            });
        };
        return { connect, publisher, close };
    };

    it("enterprise rejects a revoked participant after a pre-lock metadata snapshot", async () => {
        const { noteId } = await create();
        await command(owner, noteId, {
            kind: "participants",
            operationId: operation(),
            expectedCollaborationVersion: 1,
            participants: [
                { userId: participant, access: "reply" },
                { userId: stranger, access: "reply" },
            ],
        });
        let reached: () => void = () => {};
        let release: () => void = () => {};
        const metadataRead = new Promise<void>((resolve) => {
            reached = resolve;
        });
        const gate = new Promise<void>((resolve) => {
            release = resolve;
        });
        const original = collaboration.metadata.bind(collaboration);
        const spy = vi.spyOn(collaboration, "metadata").mockImplementationOnce(async (...args) => {
            const result = await original(...args);
            reached();
            await gate;
            return result;
        });
        const result = command(participant, noteId, { kind: "reply", operationId: operation(), text: "Revoked snapshot must never write", mentionUserIds: [] }).then(
            () => ({ accepted: true }),
            (error: unknown) => error,
        );
        try {
            await metadataRead;
            await sql`DELETE FROM crm_note_participant WHERE user_id_note_participant=2`.execute(database());
            release();
            expect(await result).toMatchObject({ status: 404 });
            expect(await count("crm_note_reply")).toBe(0);
        } finally {
            release();
            await result;
            spy.mockRestore();
        }
    });
    it("enterprise retries actual MySQL deadlock victims without replaying uncertain network failures", async () => {
        let firstReady: () => void = () => {};
        let secondReady: () => void = () => {};
        const firstLocked = new Promise<void>((resolve) => {
            firstReady = resolve;
        });
        const secondLocked = new Promise<void>((resolve) => {
            secondReady = resolve;
        });
        let attempts = 0;
        const transaction = (first: number, second: number, ready: () => void, other: Promise<void>) =>
            retryNoteDeadlock(() =>
                database()
                    .transaction()
                    .execute(async (tx) => {
                        attempts++;
                        await sql`SELECT id_user FROM sec_user WHERE id_user=${first} FOR UPDATE`.execute(tx);
                        ready();
                        await other;
                        await sql`SELECT id_user FROM sec_user WHERE id_user=${second} FOR UPDATE`.execute(tx);
                        return first;
                    }),
            );
        expect(await Promise.all([transaction(1, 2, firstReady, secondLocked), transaction(2, 1, secondReady, firstLocked)])).toEqual([1, 2]);
        expect(attempts).toBeGreaterThan(2);
        expect(attempts).toBeLessThanOrEqual(6);
    }, 30000);
    it("enterprise keeps one canonical note while displaying authorized additional Homes", async () => {
        const { noteId } = await create();
        await command(owner, noteId, { kind: "participants", operationId: operation(), expectedCollaborationVersion: 1, participants: [{ userId: participant, access: "reply" }] });
        await command(owner, noteId, { kind: "locations", operationId: operation(), expectedCollaborationVersion: 2, locations: [{ moduleCode: "ventas", code: "sales-home" }] });
        const request = listNotesSchema.parse({ moduleCode: "ventas", contextType: "view", status: "all" });
        const reader = { actorPublicId: participant, moduleCode: "ventas" as const, ownOnly: true };
        expect((await notes.list(reader, request, { kind: "view" }, ["ventas", "mercadeo"])).total).toBe(1);
        expect((await notes.list({ ...reader, actorPublicId: stranger }, request, { kind: "view" }, ["ventas", "mercadeo"])).total).toBe(0);
        expect(await count("crm_note")).toBe(1);
        expect(await count("crm_note_link")).toBe(1);
        await command(owner, noteId, { kind: "locations", operationId: operation(), expectedCollaborationVersion: 3, locations: [] });
        expect((await notes.list(reader, request, { kind: "view" }, ["ventas", "mercadeo"])).total).toBe(0);
    }, 30000);
    it("enterprise persists a private reminder, delivers once and fences duplicate claims", async () => {
        const { noteId } = await create();
        await command(owner, noteId, { kind: "participants", operationId: operation(), expectedCollaborationVersion: 1, participants: [{ userId: participant, access: "reply" }] });
        const state = await collaboration.load(owner, noteId);
        const reminder = { ...reminderSchema.parse({ operationId: operation(), remindAt: new Date(Date.now() + 86400000).toISOString() }), kind: "reminder" as const };
        await workflow.command(owner, noteId, reminder, async () => {});
        expect((await workflow.read(participant, state)).reminder).toBeNull();
        await sql`UPDATE crm_note_workflow_event SET scheduled_at_note_workflow_event=DATE_SUB(UTC_TIMESTAMP(3),INTERVAL 1 SECOND),available_at_note_workflow_event=DATE_SUB(UTC_TIMESTAMP(3),INTERVAL 1 SECOND)`.execute(database());
        const claims = (await Promise.all([workflow.claim(), workflow.claim()])).filter((row) => row !== null);
        expect(claims).toHaveLength(1);
        const event = claims[0];
        if (!event) throw Error("Missing reminder claim");
        await workflow.deliver(event, authorize);
        await workflow.deliver(event, authorize);
        expect((await delivered(owner)).map((row) => row.kind)).toEqual(["reminder"]);
        expect((await workflow.read(owner, state)).reminder?.status).toBe("delivered");
        const transport = await openRealtimeTransport();
        try {
            const author = await transport.connect("synthetic-owner-session");
            const invitee = await transport.connect("synthetic-invitee-session");
            await transport.publisher.tick();
            await vi.waitFor(
                () => {
                    expect(author.packets).toContainEqual(expect.objectContaining({ kind: "notification.created", noteId }));
                },
                { timeout: 10000 },
            );
            expect(invitee.packets.filter((packet) => packet.kind === "notification.created" && packet.noteId === noteId)).toHaveLength(0);
            expect(JSON.stringify(author.packets)).not.toContain("Synthetic note body");
        } finally {
            await transport.close();
        }
    }, 60000);
    it("enterprise keeps assignment notice on due edit and permanently cancels schedules on closure", async () => {
        const { noteId } = await create();
        await command(owner, noteId, { kind: "participants", operationId: operation(), expectedCollaborationVersion: 1, participants: [{ userId: participant, access: "reply" }] });
        const task = { ...taskSchema.parse({ operationId: operation(), expectedVersion: 0, assigneeUserId: participant, dueAt: new Date(Date.now() + 86400000).toISOString() }), kind: "task" as const };
        await workflow.command(owner, noteId, task, async () => {});
        await workflow.command(owner, noteId, { ...task, operationId: operation(), expectedVersion: 1, dueAt: new Date(Date.now() + 172800000).toISOString() }, async () => {});
        const pending = (await sql<{ kind: string }>`SELECT kind_note_workflow_event AS kind FROM crm_note_workflow_event WHERE status_note_workflow_event='pending' ORDER BY id_note_workflow_event`.execute(database())).rows;
        expect(pending.map((row) => row.kind)).toEqual(["assigned", "due"]);
        await command(owner, noteId, { kind: "participants", operationId: operation(), expectedCollaborationVersion: 2, participants: [] });
        const state = await collaboration.load(owner, noteId);
        expect((await workflow.read(owner, state)).assignee).toBeNull();
        const fallback = (await sql<{ publicId: string }>`SELECT u.public_id_user AS publicId FROM crm_note_workflow_event e JOIN sec_user u ON u.id_user=e.recipient_user_id_note_workflow_event WHERE e.status_note_workflow_event='pending' AND e.kind_note_workflow_event='due'`.execute(database())).rows;
        expect(fallback).toEqual([{ publicId: owner }]);
        await notes.lifecycle(access, noteId, { moduleCode: access.moduleCode, operationId: operation(), expectedVersion: 1 }, "complete");
        expect((await sql`SELECT id_note_workflow_event FROM crm_note_workflow_event WHERE status_note_workflow_event IN ('pending','processing')`.execute(database())).rows).toHaveLength(0);
    }, 30000);
    it("delivers real committed invitations and replies over sockets, then revokes and blocks private activity", async () => {
        const transport = await openRealtimeTransport();
        try {
            const author = await transport.connect("synthetic-owner-session");
            const invitee = await transport.connect("synthetic-invitee-session");
            const outsider = await transport.connect("synthetic-stranger-session");
            const { noteId } = await create();
            expect(await invitee.socket.emitWithAck("subscribe", { noteId })).toMatchObject({ ok: false });
            await invite(noteId);
            expect(await count("sec_notification")).toBe(0);
            expect(await count("crm_note_realtime_event")).toBeGreaterThan(0);
            await worker.tick();
            const invitation = (await delivered(participant))[0];
            expect(invitation?.kind).toBe("shared");
            await transport.publisher.tick();
            await vi.waitFor(
                () => {
                    expect(invitee.packets).toContainEqual(expect.objectContaining({ kind: "notification.created", noteId, notificationId: invitation?.id }));
                },
                { timeout: 10000 },
            );
            expect(await invitee.socket.emitWithAck("subscribe", { noteId })).toEqual({ ok: true });
            expect((await collaboration.load(participant, noteId)).note.text).toContain("Synthetic note body");

            const reply = await command(participant, noteId, { kind: "reply", operationId: operation(), text: "Synthetic socket reply must remain private", mentionUserIds: [owner] });
            await worker.tick();
            const replyNotice = (await delivered(owner))[0];
            expect(replyNotice?.kind).toBe("mention");
            await transport.publisher.tick();
            await vi.waitFor(
                () => {
                    expect(author.packets).toContainEqual(expect.objectContaining({ kind: "notification.created", noteId, notificationId: replyNotice?.id }));
                },
                { timeout: 10000 },
            );
            expect(await count("crm_note_reply")).toBe(1);

            await revoke(noteId, reply.collaborationVersion);
            await worker.tick();
            await transport.publisher.tick();
            await vi.waitFor(
                () => {
                    expect(invitee.packets).toContainEqual(expect.objectContaining({ kind: "note.access_revoked", noteId }));
                },
                { timeout: 10000 },
            );
            await expect(collaboration.load(participant, noteId)).rejects.toMatchObject({ status: 404 });
            await expect(command(participant, noteId, { kind: "reply", operationId: operation(), text: "Blocked revoked reply", mentionUserIds: [] })).rejects.toMatchObject({ status: 404 });
            expect(await invitee.socket.emitWithAck("subscribe", { noteId })).toMatchObject({ ok: false });
            const receivedAfterRevoke = invitee.packets.length;
            await command(owner, noteId, { kind: "reply", operationId: operation(), text: "Private author followup after revoke", mentionUserIds: [] });
            await worker.tick();
            await transport.publisher.tick();
            expect(invitee.packets).toHaveLength(receivedAfterRevoke);
            expect(outsider.packets.filter((packet) => packet.noteId === noteId)).toEqual([]);
            const serialized = JSON.stringify([...author.packets, ...invitee.packets, ...outsider.packets]);
            for (const text of ["Synthetic note body", "Synthetic socket reply", "Private author followup", "Blocked revoked reply"]) expect(serialized).not.toContain(text);
        } finally {
            await transport.close();
        }
    }, 120000);

    it("commits invitation/reply/metadata receipts and delivers once while leaving original stage2 events pending", async () => {
        const { noteId } = await create();
        await expect(collaboration.load(participant, noteId)).rejects.toMatchObject({ status: 404 });
        const input: CollaborationCommand = { kind: "participants", operationId: operation(), expectedCollaborationVersion: 1, participants: [{ userId: participant, access: "reply" }] };
        const shared = await command(owner, noteId, input);
        const before = await counts();
        expect(await command(owner, noteId, input)).toEqual({ ...shared, replayed: true });
        expect(await counts()).toEqual(before);
        expect((await collaboration.load(participant, noteId)).participants[0]?.userId).toBe(participant);
        await expect(collaboration.load(stranger, noteId)).rejects.toMatchObject({ status: 404 });
        await worker.tick();
        expect((await delivered(participant)).map((n) => n.kind)).toEqual(["shared"]);
        const reply: CollaborationCommand = { kind: "reply", operationId: operation(), text: "Synthetic private reply", mentionUserIds: [owner] };
        const receipt = await command(participant, noteId, reply);
        expect(receipt).toMatchObject({ version: 1, collaborationVersion: 3, replyVersion: 1 });
        expect(await command(participant, noteId, reply)).toEqual({ ...receipt, replayed: true });
        await worker.tick();
        await worker.tick();
        expect(await count("crm_note_reply")).toBe(1);
        expect((await delivered(owner)).map((n) => n.kind)).toEqual(["mention"]);
        expect(await count("sec_notification")).toBe(2);
        const stage2 = await sql<{ status: string }>`SELECT status_event_outbox AS status FROM int_event_outbox WHERE aggregate_type_event_outbox='note' ORDER BY id_event_outbox`.execute(database());
        expect(stage2.rows.map((r) => r.status)).toEqual(["pending", "pending"]);
        const metadata = await sql<{ payload: unknown }>`SELECT payload_event_outbox AS payload FROM int_event_outbox UNION ALL SELECT after_payload AS payload FROM audit_probe_test`.execute(database());
        expect(JSON.stringify(metadata.rows)).not.toContain("Synthetic private reply");
        expect(JSON.stringify(metadata.rows)).not.toContain("Synthetic note body");
    }, 30000);

    it("revokes pending recipients before reinvite, so only the new invitation is delivered", async () => {
        const { noteId } = await create();
        await invite(noteId);
        const pendingClaim = await notifications.claim();
        expect(pendingClaim).not.toBeNull();
        await revoke(noteId, 2);
        await expect(collaboration.load(participant, noteId)).rejects.toMatchObject({ status: 404 });
        await invite(noteId, 3);
        if (!pendingClaim) throw new Error("Missing synthetic claim");
        await notifications.deliver(pendingClaim, authorize);
        await worker.tick();
        expect((await delivered(participant)).map((n) => n.kind)).toEqual(["shared"]);
        expect(await count("sec_notification")).toBe(1);
        const notice = await sql<{ version: number }>`SELECT e.aggregate_version_event_outbox AS version FROM sec_notification n JOIN int_event_outbox e ON e.id_event_outbox=n.source_event_id_notification`.execute(database());
        expect(notice.rows[0]?.version).toBe(4);
    }, 30000);

    it("keeps previously delivered notices suppressed after reinvite and blocks revoked receipt replay", async () => {
        const { noteId } = await create();
        await invite(noteId);
        await worker.tick();
        const reply: CollaborationCommand = { kind: "reply", operationId: operation(), text: "Synthetic invitee reply", mentionUserIds: [] };
        await command(participant, noteId, reply);
        await revoke(noteId, 3);
        await expect(command(participant, noteId, reply)).rejects.toMatchObject({ status: 404 });
        expect(await delivered(participant)).toEqual([]);
        await invite(noteId, 4);
        await worker.tick();
        expect(await delivered(participant)).toHaveLength(1);
        const statuses = await sql<{ status: string }>`SELECT status_notification AS status FROM sec_notification WHERE recipient_user_id_notification=2 ORDER BY id_notification`.execute(database());
        expect(statuses.rows.map((n) => n.status)).toEqual(["suppressed", "active"]);
    }, 30000);

    it("keeps read acknowledgements recipient-bound, idempotent and before the observed cutoff", async () => {
        const { noteId } = await create();
        await invite(noteId);
        await command(owner, noteId, { kind: "mentions", operationId: operation(), expectedCollaborationVersion: 2, userIds: [participant] });
        await worker.tick();
        const notices = await delivered(participant);
        expect(notices).toHaveLength(2);
        const ids = notices.map((n) => n.id);
        await sql`UPDATE sec_notification SET created_at_notification=CASE WHEN public_id_notification=${ids[0]} THEN '2026-01-01 10:00:00.000' ELSE '2026-01-01 12:00:00.000' END`.execute(database());
        const cutoff = "2026-01-01T11:00:00.000Z";
        await notifications.markRead(stranger, ids, through);
        expect((await delivered(participant)).every((n) => n.readAt === null)).toBe(true);
        await notifications.markRead(participant, ids, cutoff);
        const acknowledged = await delivered(participant);
        expect(acknowledged.find((n) => n.id === ids[0])?.readAt).not.toBeNull();
        expect(acknowledged.find((n) => n.id === ids[1])?.readAt).toBeNull();
        await notifications.markRead(participant, ids, cutoff);
        expect(await delivered(participant)).toEqual(acknowledged);
        expect((await notifications.candidates(participant, cutoff)).map((n) => n.id)).toEqual([ids[0]]);
    }, 30000);

    it.each(["audit", "outbox"] as const)(
        "rolls back invitation ACL, version, audit, outbox and receipt when %s fails",
        async (mode) => {
            const { noteId } = await create();
            const before = await counts();
            failure = mode;
            await expect(invite(noteId)).rejects.toThrow();
            expect(await counts()).toEqual(before);
            expect((await collaboration.load(owner, noteId)).collaborationVersion).toBe(1);
            await expect(collaboration.load(participant, noteId)).rejects.toMatchObject({ status: 404 });
            failure = undefined;
            await expect(invite(noteId)).resolves.toMatchObject({ collaborationVersion: 2, replayed: false });
        },
        30000,
    );

    it("retries a transient delivery atomically and fences stale claims without duplicate notifications", async () => {
        const { noteId } = await create();
        await invite(noteId);
        failure = "authorization";
        await worker.tick();
        expect(await count("sec_notification")).toBe(0);
        const pending = await sql<{ status: string; attempts: number }>`SELECT status_event_outbox AS status,attempts_event_outbox AS attempts FROM int_event_outbox WHERE aggregate_type_event_outbox='note_collaboration'`.execute(database());
        expect(pending.rows).toEqual([{ status: "pending", attempts: 1 }]);
        failure = undefined;
        await sql`UPDATE int_event_outbox SET available_at_event_outbox=UTC_TIMESTAMP(3) WHERE aggregate_type_event_outbox='note_collaboration'`.execute(database());
        const claim = await notifications.claim();
        if (!claim) throw new Error("Missing retried synthetic claim");
        expect(claim.attempt).toBe(2);
        await notifications.deliver(claim, authorize);
        await notifications.retry(claim);
        await notifications.deliver(claim, authorize);
        expect(await count("sec_notification")).toBe(1);
        const row = await sql<{ status: string }>`SELECT status_event_outbox AS status FROM int_event_outbox WHERE id_event_outbox=${claim.id}`.execute(database());
        expect(row.rows[0]?.status).toBe("delivered");
    }, 30000);
});
