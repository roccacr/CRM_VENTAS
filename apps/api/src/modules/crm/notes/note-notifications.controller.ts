import { Body, Controller, Get, Header, Inject, Param, Put, Query, Req } from "@nestjs/common";
import { ApiBody, ApiOperation, ApiTags, type SchemaObject } from "@nestjs/swagger";
import { z } from "zod";

import type { CookieRequest } from "../../../common/security/cookie-request.type.js";
import { SESSION_COOKIE_NAME } from "../../../common/security/http-security.constants.js";
import { RouteSecurity } from "../../../common/security/route-security.decorator.js";
import { notificationReadAllSchema } from "./note-notifications.contract.js";
import { NoteNotificationsService } from "./note-notifications.service.js";
/** BFF authenticated self-only endpoints; global CSRF protection applies to both PUT routes. */
@ApiTags("notifications")
@Controller("notifications")
export class NoteNotificationsController {
    /** Injects the native dependencies with explicit Nest tokens. */
    constructor(@Inject(NoteNotificationsService) private readonly notifications: NoteNotificationsService) {}
    /** Lists authorized metadata without implicitly marking it read. */
    @Get()
    @RouteSecurity("authenticated")
    @Header("Cache-Control", "no-store")
    @ApiOperation({ summary: "Notificaciones internas del usuario autenticado" })
    list(@Req() req: CookieRequest, @Query() query: unknown) {
        return this.notifications.list(req.cookies[SESSION_COOKIE_NAME], query);
    }
    /** Counts only currently authorized unread events for the session user. */
    @Get("unread-count")
    @RouteSecurity("authenticated")
    @Header("Cache-Control", "no-store")
    @ApiOperation({ summary: "Cantidad de notificaciones propias no leidas" })
    unreadCount(@Req() req: CookieRequest) {
        return this.notifications.unreadCount(req.cookies[SESSION_COOKIE_NAME]);
    }
    /** Explicit read-all acknowledges only the list snapshot requested by the caller. */
    @Put("read-all")
    @RouteSecurity("authenticated")
    @Header("Cache-Control", "no-store")
    @ApiBody({ schema: z.toJSONSchema(notificationReadAllSchema) as SchemaObject })
    @ApiOperation({ summary: "Marcar notificaciones propias hasta el corte observado" })
    readAll(@Req() req: CookieRequest, @Body() body: unknown) {
        return this.notifications.readAll(req.cookies[SESSION_COOKIE_NAME], body);
    }
    /** Recipient ownership and current note authorization are checked before acknowledgement. */
    @Put(":id/read")
    @RouteSecurity("authenticated")
    @Header("Cache-Control", "no-store")
    @ApiOperation({ summary: "Marcar una notificacion propia como leida" })
    read(@Req() req: CookieRequest, @Param("id") id: string) {
        return this.notifications.read(req.cookies[SESSION_COOKIE_NAME], id);
    }
}
