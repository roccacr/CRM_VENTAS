import { Inject, Injectable } from "@nestjs/common";
import { sql, type Transaction } from "kysely";
import { ulid } from "ulid";

import { DatabaseService } from "../../../database/database.service.js";
import type { CrmDatabase } from "../../../database/database.types.js";
import { deduplicateNoteRecipients, type NoteNotification, type NoteNotificationEvent, notificationEventSchema } from "./note-notifications.contract.js";
import { NotesRealtimeEventsRepository } from "./notes-realtime.repository.js";
type Tx = Transaction<CrmDatabase>;
export interface ClaimedNoteNotificationEvent {
    id: number;
    attempt: number;
    payload: unknown;
    noteId: string;
}
const recipientId = (publicId: string) => sql`(SELECT id_user FROM sec_user WHERE public_id_user=${publicId} AND status_user='active' AND deleted_at_user IS NULL)`;
const MAX_ATTEMPTS = 5;
/** Metadatos nativos de la campana y bandeja solo de colaboración. La transacción la abre quien llama. */
@Injectable()
export class NoteNotificationsRepository {
    /** Dependencias nativas con tokens explícitos. */
    constructor(
        @Inject(DatabaseService) private readonly database: DatabaseService,
        @Inject(NotesRealtimeEventsRepository) private readonly realtime: NotesRealtimeEventsRepository,
    ) {}
    /** Agrega un solo sobre por comando de colaboración. No abre otra transacción. */
    async enqueue(tx: Tx, event: NoteNotificationEvent): Promise<void> {
        const payload = { ...event, recipients: deduplicateNoteRecipients(event.actorPublicId, event.recipients) };
        notificationEventSchema.parse(payload);

        await sql`INSERT INTO int_event_outbox (public_id_event_outbox,aggregate_type_event_outbox,aggregate_public_id_event_outbox,aggregate_version_event_outbox,event_type_event_outbox,destination_code_event_outbox,payload_event_outbox) VALUES (${ulid()},'note_collaboration',${event.noteId},${event.version},'collaboration_changed','notification',${JSON.stringify(payload)})`.execute(tx);
    }
    /** También quita destinatarios pendientes. Revocar no revive un aviso viejo al volver a invitar. */
    async suppressForNote(tx: Tx, noteId: string, userPublicIds: readonly string[]): Promise<void> {
        if (!userPublicIds.length) return;
        await sql`UPDATE sec_notification SET status_notification='suppressed' WHERE note_id_notification=(SELECT id_note FROM crm_note WHERE public_id_note=${noteId}) AND recipient_user_id_notification IN (SELECT id_user FROM sec_user WHERE public_id_user IN (${sql.join(userPublicIds)}))`.execute(tx);
        for (const userId of new Set(userPublicIds)) await this.realtime.enqueueUserEvent(tx, userId, { kind: "notifications.changed" });
        // El bloqueo de la nota, tomado por el comando de colaboración, serializa esto con la entrega.
        const events = await sql<{ id: number; payload: unknown }>`SELECT id_event_outbox AS id,payload_event_outbox AS payload FROM int_event_outbox WHERE aggregate_type_event_outbox='note_collaboration' AND aggregate_public_id_event_outbox=${noteId} AND destination_code_event_outbox='notification' AND status_event_outbox IN ('pending','processing') FOR UPDATE`.execute(tx);
        for (const event of events.rows) {
            const payload = notificationEventSchema.parse(typeof event.payload === "string" ? JSON.parse(event.payload) : event.payload);
            payload.recipients = payload.recipients.filter((r) => !userPublicIds.includes(r.publicId));
            await sql`UPDATE int_event_outbox SET payload_event_outbox=${JSON.stringify(payload)},updated_at_event_outbox=UTC_TIMESTAMP(3) WHERE id_event_outbox=${event.id}`.execute(tx);
        }
    }
    /** Si falta la migración, el worker interno no arranca. */
    async schemaReady(): Promise<boolean> {
        const result = await sql<{ ready: number }>`SELECT COUNT(*) AS ready FROM conf_schema_migration WHERE migration_name_schema_migration IN ('202610270044_notes_collaboration','202610280046_notes_realtime')`.execute(this.database.db);
        return Number(result.rows[0]?.ready) === 2;
    }
    /** Un bloqueo corto y un vencimiento permiten workers concurrentes y recuperar un proceso caído. */
    async claim(): Promise<ClaimedNoteNotificationEvent | null> {
        return this.database.db.transaction().execute(async (tx) => {
            // Un proceso puede caer en su último arrendamiento. Una fila agotada y vencida queda terminal.
            await sql`UPDATE int_event_outbox SET status_event_outbox='failed',last_error_code_event_outbox='internal_notification_lease_exhausted',updated_at_event_outbox=UTC_TIMESTAMP(3) WHERE aggregate_type_event_outbox='note_collaboration' AND destination_code_event_outbox='notification' AND status_event_outbox='processing' AND attempts_event_outbox>=${MAX_ATTEMPTS} AND available_at_event_outbox<=UTC_TIMESTAMP(3)`.execute(tx);
            const result = await sql<{
                id: number;
                attempt: number;
                payload: unknown;
                noteId: string;
            }>`SELECT id_event_outbox AS id,attempts_event_outbox AS attempt,payload_event_outbox AS payload,aggregate_public_id_event_outbox AS noteId FROM int_event_outbox WHERE aggregate_type_event_outbox='note_collaboration' AND destination_code_event_outbox='notification' AND status_event_outbox IN ('pending','processing') AND attempts_event_outbox<${MAX_ATTEMPTS} AND available_at_event_outbox<=UTC_TIMESTAMP(3) ORDER BY id_event_outbox LIMIT 1 FOR UPDATE SKIP LOCKED`.execute(tx);
            const row = result.rows[0];
            if (!row) return null;
            await sql`UPDATE int_event_outbox SET status_event_outbox='processing',attempts_event_outbox=attempts_event_outbox+1,available_at_event_outbox=DATE_ADD(UTC_TIMESTAMP(3),INTERVAL 60 SECOND),updated_at_event_outbox=UTC_TIMESTAMP(3) WHERE id_event_outbox=${row.id}`.execute(tx);
            return { ...row, attempt: row.attempt + 1 };
        });
    }
    /** Bloquea la nota antes del sobre, en el mismo orden que la mutación. Vuelve a leer el contenido después de una revocación. */
    async deliver(event: ClaimedNoteNotificationEvent, authorize: (userId: string, noteId: string) => Promise<unknown>): Promise<void> {
        await this.database.db
            .transaction()
            .setIsolationLevel("read committed")
            .execute(async (tx) => {
                await sql`SELECT id_note FROM crm_note WHERE public_id_note=${event.noteId} FOR UPDATE`.execute(tx);
                const current = await sql<{ payload: unknown }>`SELECT payload_event_outbox AS payload FROM int_event_outbox WHERE id_event_outbox=${event.id} AND aggregate_type_event_outbox='note_collaboration' AND destination_code_event_outbox='notification' AND status_event_outbox='processing' AND attempts_event_outbox=${event.attempt} FOR UPDATE`.execute(tx);
                if (!current.rows[0]) return;
                const raw = current.rows[0].payload;
                const payload = notificationEventSchema.parse(typeof raw === "string" ? JSON.parse(raw) : raw);
                if (payload.noteId !== event.noteId) throw new Error("Invalid collaboration envelope");
                for (const recipient of deduplicateNoteRecipients(payload.actorPublicId, payload.recipients)) {
                    if (!(await authorize(recipient.publicId, payload.noteId)) && !(await this.dormantMember(tx, recipient.publicId, payload.noteId))) continue;
                    const notificationId = ulid();
                    const inserted =
                        await sql`INSERT INTO sec_notification (public_id_notification,recipient_user_id_notification,actor_user_id_notification,source_event_id_notification,note_id_notification,module_code_notification,kind_notification,created_at_notification) SELECT ${notificationId},r.id_user,a.id_user,e.id_event_outbox,n.id_note,${payload.moduleCode},${recipient.kind},e.created_at_event_outbox FROM sec_user r JOIN sec_user a ON a.public_id_user=${payload.actorPublicId} JOIN crm_note n ON n.public_id_note=${payload.noteId} JOIN int_event_outbox e ON e.id_event_outbox=${event.id} WHERE r.public_id_user=${recipient.publicId} AND r.status_user IN ('active','inactive','pending') AND r.deleted_at_user IS NULL AND NOT EXISTS (SELECT 1 FROM sec_notification existing WHERE existing.source_event_id_notification=e.id_event_outbox AND existing.recipient_user_id_notification=r.id_user)`.execute(
                            tx,
                        );
                    if (Number(inserted.numAffectedRows) > 0) await this.realtime.enqueueUserEvent(tx, recipient.publicId, { kind: "notification.created", noteId: payload.noteId, notificationId, collaborationVersion: payload.version });
                }
                await sql`UPDATE int_event_outbox SET status_event_outbox='delivered',delivered_at_event_outbox=UTC_TIMESTAMP(3),updated_at_event_outbox=UTC_TIMESTAMP(3),last_error_code_event_outbox=NULL WHERE id_event_outbox=${event.id} AND attempts_event_outbox=${event.attempt}`.execute(tx);
            });
    }
    /** Guarda el metadato no leído de un invitado dormido. Verlo y el socket siguen exigiendo una cuenta activa. */
    private async dormantMember(tx: Tx, userId: string, noteId: string): Promise<boolean> {
        const rows = await sql`SELECT u.id_user FROM sec_user u JOIN crm_note n ON n.public_id_note=${noteId} WHERE u.public_id_user=${userId} AND u.status_user IN ('inactive','pending') AND u.deleted_at_user IS NULL AND (n.author_user_id_note=u.id_user OR EXISTS (SELECT 1 FROM crm_note_participant p WHERE p.note_id_note_participant=n.id_note AND p.user_id_note_participant=u.id_user AND p.status_note_participant='active' AND p.revoked_at_note_participant IS NULL))`.execute(tx);
        return rows.rows.length === 1;
    }
    /** Un fallo cercado no pisa un arrendamiento más nuevo ni una entrega completada. El texto del error se queda adentro. */
    async retry(event: ClaimedNoteNotificationEvent): Promise<void> {
        await sql`UPDATE int_event_outbox SET status_event_outbox=${event.attempt >= MAX_ATTEMPTS ? "failed" : "pending"},available_at_event_outbox=DATE_ADD(UTC_TIMESTAMP(3),INTERVAL 30 SECOND),last_error_code_event_outbox='internal_notification_delivery_failed',updated_at_event_outbox=UTC_TIMESTAMP(3) WHERE id_event_outbox=${event.id} AND aggregate_type_event_outbox='note_collaboration' AND destination_code_event_outbox='notification' AND status_event_outbox='processing' AND attempts_event_outbox=${event.attempt}`.execute(
            this.database.db,
        );
    }
    /** Solo se carga el metadato de este destinatario nativo activo. El servicio revalida cada nota. */
    async candidates(userId: string, through: string): Promise<NoteNotification[]> {
        const rows = await sql<
            Omit<NoteNotification, "actor" | "note"> & { actorId: string; actorName: string; noteTitle: string | null; noteExcerpt: string | null }
        >`SELECT x.public_id_notification AS id,x.kind_notification AS kind,a.public_id_user AS actorId,a.display_name_user AS actorName,n.public_id_note AS noteId,n.title_note AS noteTitle,LEFT(n.plain_text_note,160) AS noteExcerpt,(SELECT LEFT(r.plain_text_note_reply,240) FROM crm_note_reply r WHERE x.kind_notification IN ('reply','mention') AND r.note_id_note_reply=n.id_note AND r.author_user_id_note_reply=x.actor_user_id_notification AND r.withdrawn_at_note_reply IS NULL AND r.created_at_note_reply<=DATE_ADD(x.created_at_notification,INTERVAL 1 SECOND) ORDER BY r.id_note_reply DESC LIMIT 1) AS replyExcerpt,x.module_code_notification AS moduleCode,DATE_FORMAT(x.created_at_notification,'%Y-%m-%dT%H:%i:%s.%fZ') AS createdAt,DATE_FORMAT(x.read_at_notification,'%Y-%m-%dT%H:%i:%s.%fZ') AS readAt FROM sec_notification x JOIN sec_user a ON a.id_user=x.actor_user_id_notification JOIN crm_note n ON n.id_note=x.note_id_notification WHERE x.recipient_user_id_notification=${recipientId(userId)} AND x.status_notification='active' AND x.created_at_notification<=${this.mysqlDate(through)} ORDER BY x.created_at_notification DESC,x.id_notification DESC`.execute(
            this.database.db,
        );
        return rows.rows.map(({ actorId, actorName, noteTitle, noteExcerpt, replyExcerpt, ...item }) => ({ ...item, actor: { publicId: actorId, displayName: actorName }, note: { title: noteTitle, excerpt: noteExcerpt ?? "" }, replyExcerpt: replyExcerpt ?? null }));
    }
    /** La actualización propia es idempotente. Conserva la primera lectura y deja fuera eventos posteriores al corte observado. */
    async markRead(userId: string, ids: readonly string[], through: string): Promise<void> {
        if (!ids.length) return;
        await this.database.db.transaction().execute(async (tx) => {
            await sql`UPDATE sec_notification SET read_at_notification=COALESCE(read_at_notification,UTC_TIMESTAMP(3)) WHERE recipient_user_id_notification=${recipientId(userId)} AND public_id_notification IN (${sql.join(ids)}) AND status_notification='active' AND created_at_notification<=${this.mysqlDate(through)}`.execute(tx);
            await this.realtime.enqueueUserEvent(tx, userId, { kind: "notifications.changed" });
        });
    }
    private mysqlDate(value: string): string {
        return new Date(value).toISOString().slice(0, 23).replace("T", " ");
    }
}
