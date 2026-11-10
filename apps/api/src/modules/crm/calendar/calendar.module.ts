import { Body, Controller, Get, Header, HttpCode, Inject, Module, Param, Patch, Post, Query, Req } from "@nestjs/common";

import type { CookieRequest } from "../../../common/security/cookie-request.type.js";
import { SESSION_COOKIE_NAME } from "../../../common/security/http-security.constants.js";
import { RequirePermission } from "../../../common/security/require-permission.decorator.js";
import { RouteSecurity } from "../../../common/security/route-security.decorator.js";
import { AuditModule } from "../audit/audit.module.js";
import { IdentityModule } from "../identity/identity.module.js";
import { SalesOrderAddendumModule } from "../sales/sales-orders/sales-order-addendum.js";
import { CalendarRepository } from "./calendar.repository.js";
import { CalendarService } from "./calendar.service.js";
import { CalendarExternalService } from "./calendar-external.service.js";
import { CalendarLookupService } from "./calendar-lookup.service.js";
import { CalendarNotificationsController, CalendarNotificationsService } from "./calendar-notifications.js";

/** Un contrato para todos los módulos. El dueño del evento sale de la fila, no de un rol que pinte el navegador. El cuerpo llega sin tipo y el servicio lo cierra. */
@Controller("calendar")
export class CalendarController {
    /** Identidad, persistencia y bitácora ya existentes. Este controlador no abre la base vieja. */
    constructor(
        @Inject(CalendarService) private readonly service: CalendarService,
        @Inject(CalendarExternalService) private readonly external: CalendarExternalService,
    ) {}
    /** Calendarios y tipos que el perfil puede leer. La respuesta no se guarda en caché. */
    @Get("calendars")
    @Header("Cache-Control", "no-store")
    @RouteSecurity("permission")
    @RequirePermission({ kind: "calendar", action: "read" })
    calendars(@Req() request: CookieRequest) {
        return this.service.calendars(request.cookies[SESSION_COOKIE_NAME]);
    }
    /** Eventos del intervalo visible. Cada módulo pedido se vuelve a autorizar. */
    @Get("events")
    @Header("Cache-Control", "no-store")
    @RouteSecurity("permission")
    @RequirePermission({ kind: "calendar", action: "read" })
    events(@Req() request: CookieRequest, @Query() query: unknown) {
        return this.service.list(request.cookies[SESSION_COOKIE_NAME], query);
    }
    /** Detalle CRM de un evento visible; cada vínculo conserva su autorización independiente. */
    @Get("events/:id/detail")
    @Header("Cache-Control", "no-store")
    @RouteSecurity("permission")
    @RequirePermission({ kind: "calendar", action: "read" })
    detail(@Req() request: CookieRequest, @Param("id") id: string) {
        return this.service.detail(request.cookies[SESSION_COOKIE_NAME], id);
    }
    /** Sugerencias acotadas. El permiso del calendario no sustituye el de la nota, el lead o la orden. */
    @Get("lookup")
    @Header("Cache-Control", "no-store")
    @RouteSecurity("permission")
    @RequirePermission({ kind: "calendar", action: "read" })
    lookup(@Req() request: CookieRequest, @Query() query: unknown) {
        return this.service.lookup(request.cookies[SESSION_COOKIE_NAME], query);
    }
    /** Consulta delegada sin almacenar datos externos en el calendario CRM. */
    @Post("availability")
    @HttpCode(200)
    @Header("Cache-Control", "no-store")
    @RouteSecurity("permission")
    @RequirePermission({ kind: "calendar", action: "read" })
    availability(@Req() request: CookieRequest, @Body() body: unknown) {
        return this.external.availability(request.cookies[SESSION_COOKIE_NAME], body);
    }
    /** Salas disponibles del tenant del usuario autenticado. */
    @Get("rooms")
    @Header("Cache-Control", "no-store")
    @RouteSecurity("permission")
    @RequirePermission({ kind: "calendar", action: "read" })
    rooms(@Req() request: CookieRequest, @Query() query: unknown) {
        return this.external.rooms(request.cookies[SESSION_COOKIE_NAME], query);
    }
    /** Alta nativa. El actor sale de la sesión y la bitácora va en la misma transacción. Responde 200: el cuerpo trae el resultado, no solo el alta. */
    @Post("events")
    @HttpCode(200)
    @Header("Cache-Control", "no-store")
    @RouteSecurity("permission")
    @RequirePermission({ kind: "calendar", action: "create" })
    create(@Req() request: CookieRequest, @Body() body: unknown) {
        return this.service.save(request.cookies[SESSION_COOKIE_NAME], body);
    }
    /** Edita una cita propia del buzón; Graph verifica organizador y versión. */
    @Patch("outlook-events/:id")
    @RouteSecurity("permission")
    @RequirePermission({ kind: "calendar", action: "update" })
    updateOutlook(@Req() request: CookieRequest, @Param("id") id: string, @Body() body: unknown) {
        return this.external.updateOwnEvent(request.cookies[SESSION_COOKIE_NAME], id, body);
    }
    /** Cambia el ciclo de vida. Va antes de `events/:id` para que `status` no se lea como el id del evento. */
    @Patch("events/:id/status")
    @Header("Cache-Control", "no-store")
    @RouteSecurity("permission")
    @RequirePermission({ kind: "calendar", action: "update" })
    changeStatus(@Req() request: CookieRequest, @Param("id") id: string, @Body() body: unknown) {
        return this.service.changeStatus(request.cookies[SESSION_COOKIE_NAME], id, body);
    }
    /** Edita campos. El estado se cambia por su propia ruta. */
    @Patch("events/:id")
    @Header("Cache-Control", "no-store")
    @RouteSecurity("permission")
    @RequirePermission({ kind: "calendar", action: "update" })
    update(@Req() request: CookieRequest, @Param("id") id: string, @Body() body: unknown) {
        return this.service.save(request.cookies[SESSION_COOKIE_NAME], body, id);
    }
}
/**
 * Calendario nativo con identidad, bitácora y el marcador de adéndum.
 * El lector legado y el puerto de Outlook no se registran aquí: llegan por su token.
 */
@Module({ imports: [IdentityModule, AuditModule, SalesOrderAddendumModule], controllers: [CalendarController, CalendarNotificationsController], providers: [CalendarNotificationsService, CalendarExternalService, CalendarRepository, CalendarService, CalendarLookupService] })
export class CalendarModule {}
