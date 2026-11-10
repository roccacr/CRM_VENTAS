import { BadRequestException, Controller, Get, Header, Inject, Injectable, NotFoundException, Param, Put, Req } from "@nestjs/common";
import { type RawBuilder, sql, type Transaction } from "kysely";
import { ulid } from "ulid";
import { z } from "zod";

import type { CookieRequest } from "../../../common/security/cookie-request.type.js";
import { SESSION_COOKIE_NAME } from "../../../common/security/http-security.constants.js";
import { RouteSecurity } from "../../../common/security/route-security.decorator.js";
import { DatabaseService } from "../../../database/database.service.js";
import type { CrmDatabase } from "../../../database/database.types.js";
import { IdentityService } from "../identity/identity.service.js";
import type { IdentityProfile } from "../identity/identity.types.js";
import { CALENDAR_MODULES, type CalendarModuleCode, type CalendarRow } from "./calendar.contract.js";
import { calendarAccess } from "./calendar-access.js";

/**
 * Aviso nativo en la misma transacción del evento. No es una invitación ni una respuesta de Exchange.
 * El organizador no se avisa a sí mismo. Un correo sin usuario no tiene campana.
 * Si la clave única ya existe, el aviso no se reescribe.
 */
export async function saveCalendarNotifications(tx: Transaction<CrmDatabase>, before: CalendarRow | null, after: CalendarRow, actorId: number): Promise<void> {
    const previous = new Set((before?.participants ?? []).flatMap((p) => (p.userId ? [p.userId] : [])));
    for (const userId of new Set((after.participants ?? []).flatMap((p) => (p.userId ? [p.userId] : [])))) {
        const kind = after.status === "cancelled" ? "event_cancelled" : previous.has(userId) ? "event_updated" : "invitation";
        await sql`INSERT INTO crm_calendar_notification (public_id_calendar_notification,event_id_calendar_notification,recipient_user_id_calendar_notification,kind_calendar_notification,dedupe_key_calendar_notification,visible_at_calendar_notification) SELECT ${ulid()},${after.internalId},u.id_user,${kind},${String(after.version)},UTC_TIMESTAMP(3) FROM sec_user u WHERE u.public_id_user=${userId} AND u.id_user<>${actorId} AND u.status_user IN ('active','inactive','pending') AND u.deleted_at_user IS NULL ON DUPLICATE KEY UPDATE id_calendar_notification=id_calendar_notification`.execute(
            tx,
        );
    }
}
export interface CalendarNotification {
    id: string;
    eventId: string;
    title: string;
    start: string;
    moduleCode: CalendarModuleCode;
    contextModule: CalendarModuleCode;
    organizer: string;
    kind: string;
    readAt: string | null;
}
/** La sesión determina el destinatario y cada consulta revalida participación y denies. */
@Injectable()
export class CalendarNotificationsService {
    /** Reutiliza sesión y conexión nativas. */
    constructor(
        @Inject(IdentityService) private readonly identity: IdentityService,
        @Inject(DatabaseService) private readonly database: DatabaseService,
    ) {}
    private visibility(profile: IdentityProfile): RawBuilder<unknown> {
        const denied = CALENDAR_MODULES.filter((module) => profile.permissions.some((p) => p.code === `${module}.calendar.read` && p.effect === "deny"));
        return sql`u.public_id_user=${profile.user.publicId} AND u.status_user='active' AND u.deleted_at_user IS NULL AND e.deleted_at_calendar_event IS NULL AND o.status_org_unit='active' AND o.deleted_at_org_unit IS NULL AND ${denied.length ? sql`o.code_org_unit NOT IN (${sql.join(denied)})` : sql`TRUE`} AND n.dismissed_at_calendar_notification IS NULL AND n.visible_at_calendar_notification<=UTC_TIMESTAMP(3) AND (n.expires_at_calendar_notification IS NULL OR n.expires_at_calendar_notification>UTC_TIMESTAMP(3)) AND EXISTS(SELECT 1 FROM crm_calendar_participant p WHERE p.event_id_calendar_participant=e.id_calendar_event AND p.user_id_calendar_participant=u.id_user AND p.status_calendar_participant='active' AND p.revoked_at_calendar_participant IS NULL)`;
    }
    /** Hasta cien avisos y el total de pendientes autorizados. Un deny de lectura del módulo oculta el aviso aunque la persona esté invitada. Si ese módulo no se puede abrir, el contexto es el primer módulo legible. */
    async list(session: string | undefined) {
        const profile = await this.identity.getCurrentUser(session);
        const readable = CALENDAR_MODULES.filter((module) => calendarAccess(profile, module, "read").allowed);
        if (!readable.length) return { items: [], unreadCount: 0 };
        const result = await sql<
            Omit<CalendarNotification, "contextModule"> & { unreadCount: number | string }
        >`SELECT n.public_id_calendar_notification AS id,e.public_id_calendar_event AS eventId,e.title_calendar_event AS title,DATE_FORMAT(e.starts_at_calendar_event,'%Y-%m-%dT%H:%i:%s.000Z') AS start,o.code_org_unit AS moduleCode,a.display_name_user AS organizer,n.kind_calendar_notification AS kind,DATE_FORMAT(n.read_at_calendar_notification,'%Y-%m-%dT%H:%i:%s.000Z') AS readAt,SUM(n.read_at_calendar_notification IS NULL) OVER() AS unreadCount FROM crm_calendar_notification n JOIN crm_calendar_event e ON e.id_calendar_event=n.event_id_calendar_notification JOIN sec_user u ON u.id_user=n.recipient_user_id_calendar_notification JOIN sec_user a ON a.id_user=e.organizer_user_id_calendar_event JOIN sec_org_unit o ON o.id_org_unit=e.origin_module_id_calendar_event WHERE ${this.visibility(profile)} ORDER BY (n.read_at_calendar_notification IS NULL) DESC,n.visible_at_calendar_notification DESC,n.id_calendar_notification DESC LIMIT 100`.execute(
            this.database.db,
        );
        return { items: result.rows.map(({ unreadCount: _count, ...item }) => ({ ...item, contextModule: readable.includes(item.moduleCode) ? item.moduleCode : readable[0] })), unreadCount: Number(result.rows[0]?.unreadCount ?? 0) };
    }
    /** Acuse de todos los avisos de ese evento, solo para esta sesión. Un id ajeno o inexistente responde igual: no revela si el aviso existe. */
    async acknowledge(session: string | undefined, eventId: string) {
        if (!/^[0-7][0-9A-HJKMNP-TV-Z]{25}$/.test(eventId)) throw new BadRequestException("Evento inválido.");
        const profile = await this.identity.getCurrentUser(session);
        if (!CALENDAR_MODULES.some((module) => calendarAccess(profile, module, "read").allowed)) throw new NotFoundException();
        await sql`UPDATE crm_calendar_notification n JOIN crm_calendar_event e ON e.id_calendar_event=n.event_id_calendar_notification JOIN sec_user u ON u.id_user=n.recipient_user_id_calendar_notification JOIN sec_org_unit o ON o.id_org_unit=e.origin_module_id_calendar_event SET n.read_at_calendar_notification=COALESCE(n.read_at_calendar_notification,UTC_TIMESTAMP(3)) WHERE e.public_id_calendar_event=${eventId} AND ${this.visibility(profile)}`.execute(this.database.db);
        return { ok: true };
    }
    /** Un solo aviso. Repetir el acuse no mueve la fecha de lectura. */
    async read(session: string | undefined, id: string) {
        if (
            !z
                .string()
                .regex(/^[0-7][0-9A-HJKMNP-TV-Z]{25}$/)
                .safeParse(id).success
        )
            throw new BadRequestException("Notificación inválida.");
        const profile = await this.identity.getCurrentUser(session);
        if (!CALENDAR_MODULES.some((module) => calendarAccess(profile, module, "read").allowed)) throw new NotFoundException();
        await sql`UPDATE crm_calendar_notification n JOIN crm_calendar_event e ON e.id_calendar_event=n.event_id_calendar_notification JOIN sec_user u ON u.id_user=n.recipient_user_id_calendar_notification JOIN sec_org_unit o ON o.id_org_unit=e.origin_module_id_calendar_event SET n.read_at_calendar_notification=COALESCE(n.read_at_calendar_notification,UTC_TIMESTAMP(3)) WHERE n.public_id_calendar_notification=${id} AND ${this.visibility(profile)}`.execute(this.database.db);
        return { ok: true };
    }
}
/** Campana de calendario autenticada; PUT conserva la protección CSRF global. */
@Controller("calendar/notifications")
export class CalendarNotificationsController {
    /** Reutiliza sesión y conexión nativas. */
    constructor(@Inject(CalendarNotificationsService) private readonly service: CalendarNotificationsService) {}
    /** Consulta sin marcar lectura. La respuesta no se guarda en caché. La ruta solo exige sesión; el servicio vuelve a mirar el permiso. */
    @Get()
    @Header("Cache-Control", "no-store")
    @RouteSecurity("authenticated")
    list(@Req() request: CookieRequest) {
        return this.service.list(request.cookies[SESSION_COOKIE_NAME]);
    }
    /** Abrir el detalle acusa todos los avisos del mismo evento, solo para esta sesión. */
    @Put("events/:eventId/read")
    @RouteSecurity("authenticated")
    acknowledge(@Req() request: CookieRequest, @Param("eventId") eventId: string) {
        return this.service.acknowledge(request.cookies[SESSION_COOKIE_NAME], eventId);
    }
    /** Acuse de un aviso. Va después de la ruta del evento para que `events` no se lea como un id. */
    @Put(":id/read")
    @RouteSecurity("authenticated")
    read(@Req() request: CookieRequest, @Param("id") id: string) {
        return this.service.read(request.cookies[SESSION_COOKIE_NAME], id);
    }
}
