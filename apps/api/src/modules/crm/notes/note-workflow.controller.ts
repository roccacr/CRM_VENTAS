import { Body, Controller, Get, Header, Inject, Param, Put, Query, Req } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";

import type { CookieRequest } from "../../../common/security/cookie-request.type.js";
import { SESSION_COOKIE_NAME } from "../../../common/security/http-security.constants.js";
import { RouteSecurity } from "../../../common/security/route-security.decorator.js";
import { NoteWorkflowService } from "./note-workflow.service.js";

/** Los endpoints autenticados vuelven a exigir en el servicio el módulo actual y la ACL de la nota. */
@ApiTags("note-workflow")
@Controller("note-workflow")
export class NoteWorkflowController {
    /** Servicio de flujo de la nota. */
    constructor(@Inject(NoteWorkflowService) private readonly workflow: NoteWorkflowService) {}
    /** Carga el recordatorio propio del lector y los metadatos compartidos de la tarea. */
    @Get("notes/:id")
    @RouteSecurity("authenticated")
    @Header("Cache-Control", "no-store")
    read(@Req() req: CookieRequest, @Param("id") id: string) {
        return this.workflow.read(req.cookies[SESSION_COOKIE_NAME], id);
    }
    /** Guarda metadatos de la tarea. Solo el autor, con la versión esperada. */
    @Put("notes/:id/task")
    @RouteSecurity("authenticated")
    @Header("Cache-Control", "no-store")
    task(@Req() req: CookieRequest, @Param("id") id: string, @Body() body: unknown) {
        return this.workflow.task(req.cookies[SESSION_COOKIE_NAME], id, body);
    }
    /** Programa, pospone o cancela solo el recordatorio de quien lee. */
    @Put("notes/:id/reminder")
    @RouteSecurity("authenticated")
    @Header("Cache-Control", "no-store")
    reminder(@Req() req: CookieRequest, @Param("id") id: string, @Body() body: unknown) {
        return this.workflow.reminder(req.cookies[SESSION_COOKIE_NAME], id, body);
    }
    /** Devuelve conteos de tareas asignadas ya filtrados por autorización. */
    @Get("overview")
    @RouteSecurity("authenticated")
    @Header("Cache-Control", "no-store")
    overview(@Req() req: CookieRequest, @Query() query: unknown) {
        return this.workflow.overview(req.cookies[SESSION_COOKIE_NAME], query);
    }
}
