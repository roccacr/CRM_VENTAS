import { Body, Controller, Get, Header, Inject, Param, Put, Query, Req } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";

import type { CookieRequest } from "../../../common/security/cookie-request.type.js";
import { SESSION_COOKIE_NAME } from "../../../common/security/http-security.constants.js";
import { RouteSecurity } from "../../../common/security/route-security.decorator.js";
import { NoteRelatedRecordsService } from "./note-related-records.service.js";

/** Títulos y escrituras se vuelven a comprobar contra la ACL de la nota y el permiso de negocio. */
@ApiTags("note-related-records")
@Controller()
export class NoteRelatedRecordsController {
    /** Servicio de relaciones de una nota que ya existe. */
    constructor(@Inject(NoteRelatedRecordsService) private readonly records: NoteRelatedRecordsService) {}
    /** Busca en las dos fuentes configuradas. El usuario no ve qué base se eligió. */
    @Get("notes/related-record-options")
    @RouteSecurity("authenticated")
    @Header("Cache-Control", "no-store")
    options(@Req() req: CookieRequest, @Query() query: unknown) {
        return this.records.options(req.cookies[SESSION_COOKIE_NAME], query);
    }
    /** Devuelve solo los títulos de registros relacionados que ahora están autorizados. */
    @Get("note-collaboration/notes/:id/related-records")
    @RouteSecurity("authenticated")
    @Header("Cache-Control", "no-store")
    read(@Req() req: CookieRequest, @Param("id") id: string) {
        return this.records.read(req.cookies[SESSION_COOKIE_NAME], id);
    }
    /** Cambia los vínculos secundarios del autor en un commit, con versión, bitácora e intención de tiempo real. */
    @Put("note-collaboration/notes/:id/related-records")
    @RouteSecurity("authenticated")
    @Header("Cache-Control", "no-store")
    replace(@Req() req: CookieRequest, @Param("id") id: string, @Body() body: unknown) {
        return this.records.replace(req.cookies[SESSION_COOKIE_NAME], id, body);
    }
}
