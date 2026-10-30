import { Body, Controller, Get, Header, Inject, Param, Put, Query, Req } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";

import type { CookieRequest } from "../../../common/security/cookie-request.type.js";
import { SESSION_COOKIE_NAME } from "../../../common/security/http-security.constants.js";
import { RouteSecurity } from "../../../common/security/route-security.decorator.js";
import { NoteRelatedRecordsService } from "./note-related-records.service.js";

/** Resource captions and writes are additionally checked against note ACL and business permissions. */
@ApiTags("note-related-records")
@Controller()
export class NoteRelatedRecordsController {
    /** Injects the existing-note relation application service. */
    constructor(@Inject(NoteRelatedRecordsService) private readonly records: NoteRelatedRecordsService) {}
    /** Searches both configured sources without exposing database choices to users. */
    @Get("notes/related-record-options")
    @RouteSecurity("authenticated")
    @Header("Cache-Control", "no-store")
    options(@Req() req: CookieRequest, @Query() query: unknown) {
        return this.records.options(req.cookies[SESSION_COOKIE_NAME], query);
    }
    /** Returns only currently authorized related-record captions. */
    @Get("note-collaboration/notes/:id/related-records")
    @RouteSecurity("authenticated")
    @Header("Cache-Control", "no-store")
    read(@Req() req: CookieRequest, @Param("id") id: string) {
        return this.records.read(req.cookies[SESSION_COOKIE_NAME], id);
    }
    /** Changes an author's secondary business links atomically with version, audit and realtime intent. */
    @Put("note-collaboration/notes/:id/related-records")
    @RouteSecurity("authenticated")
    @Header("Cache-Control", "no-store")
    replace(@Req() req: CookieRequest, @Param("id") id: string, @Body() body: unknown) {
        return this.records.replace(req.cookies[SESSION_COOKIE_NAME], id, body);
    }
}
