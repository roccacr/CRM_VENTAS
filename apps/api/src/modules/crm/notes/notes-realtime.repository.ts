import { Inject, Injectable } from "@nestjs/common";
import { sql, type Transaction } from "kysely";
import { ulid } from "ulid";

import { DatabaseService } from "../../../database/database.service.js";
import type { CrmDatabase } from "../../../database/database.types.js";
import { type NotesRealtimeActivity, notesRealtimeActivitySchema } from "./notes-realtime.contract.js";
type Tx = Transaction<CrmDatabase>;
export interface ClaimedNotesRealtimeEvent {
    id: number;
    attempt: number;
    recipientUserId: string;
    activity: NotesRealtimeActivity;
}
const MAX_ATTEMPTS = 5;
/** Separate durable metadata destination: never consumes stage2 or legacy projection envelopes. */
@Injectable()
export class NotesRealtimeEventsRepository {
    /** Injects existing native application dependencies. */
    constructor(@Inject(DatabaseService) private readonly database: DatabaseService) {}
    /** Caller owns the note/receipt/audit transaction. Recipient authorization is checked again at publication. */
    async enqueueNoteChange(tx: Tx, input: { noteId: string; actorPublicId: string; revokedUserIds?: readonly string[] }): Promise<void> {
        const result = await sql<{
            userId: string;
            version: number;
            collaborationVersion: number;
        }>`SELECT DISTINCT u.public_id_user AS userId,n.version_note AS version,n.collaboration_version_note AS collaborationVersion FROM crm_note n JOIN sec_user u ON (u.id_user=n.author_user_id_note OR EXISTS (SELECT 1 FROM crm_note_participant p WHERE p.note_id_note_participant=n.id_note AND p.user_id_note_participant=u.id_user AND p.status_note_participant='active')) WHERE n.public_id_note=${input.noteId} AND u.status_user='active' AND u.deleted_at_user IS NULL`.execute(tx);
        for (const row of result.rows) await this.enqueueUserEvent(tx, row.userId, { kind: "note.changed", noteId: input.noteId, version: row.version, collaborationVersion: row.collaborationVersion });
        for (const userId of new Set(input.revokedUserIds ?? [])) await this.enqueueUserEvent(tx, userId, { kind: "note.access_revoked", noteId: input.noteId });
    }
    /** Same transaction as notification insertion, explicit read state or suppression. Contains no private text. */
    async enqueueUserEvent(tx: Tx, userId: string, input: Pick<NotesRealtimeActivity, "kind" | "noteId" | "notificationId" | "version" | "collaborationVersion">): Promise<void> {
        const activity = notesRealtimeActivitySchema.parse({ schemaVersion: 1, eventId: ulid(), occurredAt: new Date().toISOString(), ...input });
        await sql`INSERT INTO crm_note_realtime_event (public_id_note_realtime_event,recipient_user_id_note_realtime_event,note_id_note_realtime_event,notification_id_note_realtime_event,kind_note_realtime_event,version_note_realtime_event,collaboration_version_note_realtime_event,occurred_at_note_realtime_event) SELECT ${activity.eventId},u.id_user,(SELECT id_note FROM crm_note WHERE public_id_note=${activity.noteId ?? null}),(SELECT id_notification FROM sec_notification WHERE public_id_notification=${activity.notificationId ?? null}),${activity.kind},${activity.version ?? null},${activity.collaborationVersion ?? null},${activity.occurredAt.slice(0, 23).replace("T", " ")} FROM sec_user u WHERE u.public_id_user=${userId} AND u.status_user='active' AND u.deleted_at_user IS NULL`.execute(
            tx,
        );
    }
    /** Schema registration is the activation gate; existing application startup remains safe before046. */
    async schemaReady(): Promise<boolean> {
        const r = await sql<{ ready: number }>`SELECT COUNT(*) AS ready FROM conf_schema_migration WHERE migration_name_schema_migration='202610280046_notes_realtime'`.execute(this.database.db);
        return Number(r.rows[0]?.ready) === 1;
    }
    /** Revoked notices stay suppressed across reinvitation even while their transport intention is pending. */
    async notificationActive(userId: string, notificationId: string, noteId: string): Promise<boolean> {
        const rows = await sql`SELECT x.id_notification FROM sec_notification x JOIN sec_user u ON u.id_user=x.recipient_user_id_notification JOIN crm_note n ON n.id_note=x.note_id_notification WHERE x.public_id_notification=${notificationId} AND u.public_id_user=${userId} AND n.public_id_note=${noteId} AND x.status_notification='active' AND u.status_user='active' AND u.deleted_at_user IS NULL`.execute(this.database.db);
        return rows.rows.length === 1;
    }
    /** Claims are bounded and fenced by monotonically increasing attempts, including expired final leases. */
    async claim(): Promise<ClaimedNotesRealtimeEvent | null> {
        return this.database.db.transaction().execute(async (tx) => {
            await sql`UPDATE crm_note_realtime_event SET status_note_realtime_event='failed',last_error_code_note_realtime_event='realtime_lease_exhausted' WHERE status_note_realtime_event='processing' AND attempts_note_realtime_event>=${MAX_ATTEMPTS} AND available_at_note_realtime_event<=UTC_TIMESTAMP(3)`.execute(tx);
            // Lock only the queue row. Joining users/notes under FOR UPDATE inverted delivery's note -> user lock order.
            // Scalar subqueries are nonlocking reads; session, note ACL and notification state are rechecked before emission.
            const r = await sql<{
                id: number;
                attempt: number;
                recipientUserId: string;
                eventId: string;
                kind: NotesRealtimeActivity["kind"];
                occurredAt: string;
                noteId: string | null;
                notificationId: string | null;
                version: number | null;
                collaborationVersion: number | null;
            }>`SELECT e.id_note_realtime_event AS id,e.attempts_note_realtime_event AS attempt,(SELECT public_id_user FROM sec_user WHERE id_user=e.recipient_user_id_note_realtime_event) AS recipientUserId,e.public_id_note_realtime_event AS eventId,e.kind_note_realtime_event AS kind,DATE_FORMAT(e.occurred_at_note_realtime_event,'%Y-%m-%dT%H:%i:%s.%fZ') AS occurredAt,(SELECT public_id_note FROM crm_note WHERE id_note=e.note_id_note_realtime_event) AS noteId,(SELECT public_id_notification FROM sec_notification WHERE id_notification=e.notification_id_note_realtime_event) AS notificationId,e.version_note_realtime_event AS version,e.collaboration_version_note_realtime_event AS collaborationVersion FROM crm_note_realtime_event e WHERE e.status_note_realtime_event IN ('pending','processing') AND e.attempts_note_realtime_event<${MAX_ATTEMPTS} AND e.available_at_note_realtime_event<=UTC_TIMESTAMP(3) AND (e.kind_note_realtime_event<>'note.changed' OR NOT EXISTS (SELECT 1 FROM int_event_outbox o WHERE o.aggregate_type_event_outbox='note_collaboration' AND o.destination_code_event_outbox='notification' AND o.aggregate_public_id_event_outbox=(SELECT public_id_note FROM crm_note WHERE id_note=e.note_id_note_realtime_event) AND o.status_event_outbox IN ('pending','processing'))) ORDER BY (e.kind_note_realtime_event='notification.created') DESC,e.id_note_realtime_event LIMIT 1 FOR UPDATE SKIP LOCKED`.execute(
                tx,
            );
            const row = r.rows[0];
            if (!row) return null;
            await sql`UPDATE crm_note_realtime_event SET status_note_realtime_event='processing',attempts_note_realtime_event=attempts_note_realtime_event+1,available_at_note_realtime_event=DATE_ADD(UTC_TIMESTAMP(3),INTERVAL 60 SECOND) WHERE id_note_realtime_event=${row.id}`.execute(tx);
            const activity = notesRealtimeActivitySchema.parse({ schemaVersion: 1, eventId: row.eventId, kind: row.kind, occurredAt: row.occurredAt, ...(row.noteId ? { noteId: row.noteId } : {}), ...(row.notificationId ? { notificationId: row.notificationId } : {}), ...(row.version ? { version: row.version } : {}), ...(row.collaborationVersion ? { collaborationVersion: row.collaborationVersion } : {}) });
            return { id: row.id, attempt: row.attempt + 1, recipientUserId: row.recipientUserId, activity };
        });
    }
    /** Published means transport attempt only, never seen/read. Stale leases cannot acknowledge newer claims. */
    async complete(event: ClaimedNotesRealtimeEvent): Promise<void> {
        await sql`UPDATE crm_note_realtime_event SET status_note_realtime_event='published',published_at_note_realtime_event=UTC_TIMESTAMP(3),last_error_code_note_realtime_event=NULL WHERE id_note_realtime_event=${event.id} AND attempts_note_realtime_event=${event.attempt} AND status_note_realtime_event='processing' AND available_at_note_realtime_event>UTC_TIMESTAMP(3)`.execute(this.database.db);
    }
    /** Retry errors use safe codes; original SQL/network errors never enter client packets. */
    async retry(event: ClaimedNotesRealtimeEvent): Promise<void> {
        await sql`UPDATE crm_note_realtime_event SET status_note_realtime_event=${event.attempt >= MAX_ATTEMPTS ? "failed" : "pending"},available_at_note_realtime_event=DATE_ADD(UTC_TIMESTAMP(3),INTERVAL 5 SECOND),last_error_code_note_realtime_event='realtime_publish_failed' WHERE id_note_realtime_event=${event.id} AND attempts_note_realtime_event=${event.attempt} AND status_note_realtime_event='processing' AND available_at_note_realtime_event>UTC_TIMESTAMP(3)`.execute(this.database.db);
    }
}
