import { ConflictException } from "@nestjs/common";
import { type Selectable, sql, type Transaction } from "kysely";
import { ulid } from "ulid";

import type { CrmDatabase } from "../../../database/database.types.js";
import type { CalendarInput, CalendarLink, CalendarParticipant, CalendarRow } from "./calendar.contract.js";
import type { CrmCalendarParticipantTable } from "./calendar.tables.js";

/** Batch reads identities only; linked records and participant labels are never joined. */
export async function readCalendarRelations(tx: Transaction<CrmDatabase>, rows: CalendarRow[]): Promise<CalendarRow[]> {
    if (!rows.length) return rows;
    const ids = rows.map((row) => row.internalId);
    const participants = (
        await sql<{ eventId: number; userId: string | null; email: string | null }>`SELECT p.event_id_calendar_participant AS eventId,u.public_id_user AS userId,p.external_email_calendar_participant AS email FROM crm_calendar_participant p LEFT JOIN sec_user u ON u.id_user=p.user_id_calendar_participant WHERE p.event_id_calendar_participant IN (${sql.join(ids)}) AND p.status_calendar_participant='active' AND p.revoked_at_calendar_participant IS NULL ORDER BY p.id_calendar_participant`.execute(
            tx,
        )
    ).rows;
    const links = (await sql<CalendarLink & { eventId: number }>`SELECT event_id_calendar_event_link AS eventId,entity_type_calendar_event_link AS entityType,source_calendar_event_link AS source,entity_public_id_calendar_event_link AS id FROM crm_calendar_event_link WHERE event_id_calendar_event_link IN (${sql.join(ids)}) AND deleted_at_calendar_event_link IS NULL ORDER BY id_calendar_event_link`.execute(tx)).rows;
    return rows.map((row) => ({ ...row, participants: participants.filter((p) => p.eventId === row.internalId).flatMap((p): CalendarParticipant[] => (p.userId ? [{ userId: p.userId }] : p.email ? [{ email: p.email }] : [])), links: links.filter((link) => link.eventId === row.internalId).map(({ entityType, source, id }) => ({ entityType, source, id })) }));
}

/** Replace supplied sets under the event lock; omitted sets preserve existing relations and RSVP. */
export async function saveCalendarRelations(tx: Transaction<CrmDatabase>, eventId: number, actorId: number, input: CalendarInput): Promise<void> {
    if (input.participants !== undefined) await saveParticipants(tx, eventId, actorId, input.participants);
    if (input.links !== undefined) {
        await tx
            .updateTable("crm_calendar_event_link")
            .set({ deleted_at_calendar_event_link: sql`UTC_TIMESTAMP(3)` })
            .where("event_id_calendar_event_link", "=", eventId)
            .where("deleted_at_calendar_event_link", "is", null)
            .execute();
        for (const link of input.links) await sql`INSERT INTO crm_calendar_event_link (event_id_calendar_event_link,entity_type_calendar_event_link,source_calendar_event_link,entity_public_id_calendar_event_link,created_by_user_id_calendar_event_link) VALUES (${eventId},${link.entityType},${link.source},${link.id},${actorId}) ON DUPLICATE KEY UPDATE deleted_at_calendar_event_link=NULL`.execute(tx);
    }
}

async function saveParticipants(tx: Transaction<CrmDatabase>, eventId: number, actorId: number, participants: CalendarParticipant[]): Promise<void> {
    const existing = await tx.selectFrom("crm_calendar_participant").selectAll().where("event_id_calendar_participant", "=", eventId).forUpdate().execute();
    const retained = new Set<number>();
    const seen = new Set<string>();
    for (const requested of participants) {
        const participant = await canonicalParticipant(tx, requested);
        const key = JSON.stringify(participant);
        // The picker and a typed email may identify the same person; retain the first invitation unchanged.
        if (seen.has(key)) continue;
        seen.add(key);
        const retainedId = await saveParticipant(tx, { eventId, actorId }, participant, existing);
        if (retainedId !== undefined) retained.add(retainedId);
    }
    for (const participant of existing)
        if (!retained.has(participant.id_calendar_participant) && participant.status_calendar_participant === "active")
            await tx
                .updateTable("crm_calendar_participant")
                .set({ status_calendar_participant: "revoked", revoked_at_calendar_participant: sql`UTC_TIMESTAMP(3)` })
                .where("id_calendar_participant", "=", participant.id_calendar_participant)
                .execute();
}

async function saveParticipant(tx: Transaction<CrmDatabase>, context: { eventId: number; actorId: number }, participant: CalendarParticipant, existing: Selectable<CrmCalendarParticipantTable>[]): Promise<number | undefined> {
    const { eventId, actorId } = context;
    const user = participant.userId ? await tx.selectFrom("sec_user").select("id_user").where("public_id_user", "=", participant.userId).where("deleted_at_user", "is", null).where("status_user", "in", ["active", "inactive", "pending"]).forUpdate().executeTakeFirst() : undefined;
    if (participant.userId && !user) throw new ConflictException("Participante no disponible.");
    const email = participant.email === undefined ? null : participant.email.toLowerCase();
    const previous = existing.find((p) => (user ? p.user_id_calendar_participant === user.id_user : p.external_email_calendar_participant === email));
    if (previous) {
        if (!isActiveParticipant(previous)) await tx.updateTable("crm_calendar_participant").set({ status_calendar_participant: "active", revoked_at_calendar_participant: null, response_calendar_participant: "pending", responded_at_calendar_participant: null, response_version_calendar_participant: null }).where("id_calendar_participant", "=", previous.id_calendar_participant).execute();
        return previous.id_calendar_participant;
    } else {
        await tx
            .insertInto("crm_calendar_participant")
            .values({ public_id_calendar_participant: ulid(), event_id_calendar_participant: eventId, user_id_calendar_participant: user ? user.id_user : null, external_email_calendar_participant: email, display_name_calendar_participant: null, invited_by_user_id_calendar_participant: actorId, responded_at_calendar_participant: null, response_version_calendar_participant: null, invitation_sent_at_calendar_participant: null, revoked_at_calendar_participant: null })
            .execute();
    }
    return undefined;
}

function isActiveParticipant(participant: Selectable<CrmCalendarParticipantTable>): boolean {
    return participant.status_calendar_participant === "active" && participant.revoked_at_calendar_participant === null;
}

/** A registered email grants invitation visibility to that existing account, never a new account or role. */
async function canonicalParticipant(tx: Transaction<CrmDatabase>, participant: CalendarParticipant): Promise<CalendarParticipant> {
    if (participant.userId) return participant;
    const email = participant.email?.trim().toLowerCase();
    if (!email) throw new ConflictException("Participante no disponible.");
    const user = await tx.selectFrom("sec_user").select(["public_id_user", "status_user", "deleted_at_user"]).where("normalized_email_user", "=", email).forUpdate().executeTakeFirst();
    if (!user) return { email };
    if (user.deleted_at_user !== null || !["active", "inactive", "pending"].includes(user.status_user)) throw new ConflictException("Participante no disponible.");
    return { userId: user.public_id_user };
}
