import { Body, Controller, Get, Header, Inject, Param, Put, Query, Req } from "@nestjs/common";
import { ApiBody, ApiOperation, ApiTags, type SchemaObject } from "@nestjs/swagger";
import { z } from "zod";

import type { CookieRequest } from "../../../common/security/cookie-request.type.js";
import { SESSION_COOKIE_NAME } from "../../../common/security/http-security.constants.js";
import { RouteSecurity } from "../../../common/security/route-security.decorator.js";
import { notificationReadAllSchema } from "./note-notifications.contract.js";
import { NoteNotificationsService } from "./note-notifications.service.js";
/** Endpoints del BFF, autenticados y solo propios. El CSRF global cubre las dos rutas PUT. */
@ApiTags("notifications")
@Controller("notifications")
export class NoteNotificationsController {
    /** Dependencias nativas con tokens explícitos. */
    constructor(@Inject(NoteNotificationsService) private readonly notifications: NoteNotificationsService) {}
    /** Lista metadatos autorizados. Listar no los marca como leídos. */
    @Get()
    @RouteSecurity("authenticated")
    @Header("Cache-Control", "no-store")
    @ApiOperation({ summary: "Notificaciones internas del usuario autenticado" })
    list(@Req() req: CookieRequest, @Query() query: unknown) {
        return this.notifications.list(req.cookies[SESSION_COOKIE_NAME], query);
    }
    /** Cuenta solo los no leídos que la sesión tiene autorizados ahora. */
    @Get("unread-count")
    @RouteSecurity("authenticated")
    @Header("Cache-Control", "no-store")
    @ApiOperation({ summary: "Cantidad de notificaciones propias no leidas" })
    unreadCount(@Req() req: CookieRequest) {
        return this.notifications.unreadCount(req.cookies[SESSION_COOKIE_NAME]);
    }
    /** Marcar todo leído acusa solo la foto de la lista que pidió quien llama. */
    @Put("read-all")
    @RouteSecurity("authenticated")
    @Header("Cache-Control", "no-store")
    @ApiBody({ schema: z.toJSONSchema(notificationReadAllSchema) as SchemaObject })
    @ApiOperation({ summary: "Marcar notificaciones propias hasta el corte observado" })
    readAll(@Req() req: CookieRequest, @Body() body: unknown) {
        return this.notifications.readAll(req.cookies[SESSION_COOKIE_NAME], body);
    }
    /** Antes del acuse se comprueba que el aviso es de este destinatario y que la nota sigue autorizada. */
    @Put(":id/read")
    @RouteSecurity("authenticated")
    @Header("Cache-Control", "no-store")
    @ApiOperation({ summary: "Marcar una notificacion propia como leida" })
    read(@Req() req: CookieRequest, @Param("id") id: string) {
        return this.notifications.read(req.cookies[SESSION_COOKIE_NAME], id);
    }
}
