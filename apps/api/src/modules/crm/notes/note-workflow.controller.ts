import { Body, Controller, Get, Header, Inject, Param, Put, Query, Req } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";

import type { CookieRequest } from "../../../common/security/cookie-request.type.js";
import { SESSION_COOKIE_NAME } from "../../../common/security/http-security.constants.js";
import { RouteSecurity } from "../../../common/security/route-security.decorator.js";
import { NoteWorkflowService } from "./note-workflow.service.js";

/** Authenticated endpoints additionally enforce current module and note ACL in the service. */
@ApiTags("note-workflow")
@Controller("note-workflow")
export class NoteWorkflowController {
    /** Injects the note workflow application service. */
    constructor(@Inject(NoteWorkflowService) private readonly workflow: NoteWorkflowService) {}
    /** Loads the current reader's independent reminder and shared task metadata. */
    @Get("notes/:id")
    @RouteSecurity("authenticated")
    @Header("Cache-Control", "no-store")
    read(@Req() req: CookieRequest, @Param("id") id: string) {
        return this.workflow.read(req.cookies[SESSION_COOKIE_NAME], id);
    }
    /** Saves task metadata with author-only optimistic concurrency. */
    @Put("notes/:id/task")
    @RouteSecurity("authenticated")
    @Header("Cache-Control", "no-store")
    task(@Req() req: CookieRequest, @Param("id") id: string, @Body() body: unknown) {
        return this.workflow.task(req.cookies[SESSION_COOKIE_NAME], id, body);
    }
    /** Schedules, snoozes or cancels only the current reader's reminder. */
    @Put("notes/:id/reminder")
    @RouteSecurity("authenticated")
    @Header("Cache-Control", "no-store")
    reminder(@Req() req: CookieRequest, @Param("id") id: string, @Body() body: unknown) {
        return this.workflow.reminder(req.cookies[SESSION_COOKIE_NAME], id, body);
    }
    /** Returns authorization-filtered assigned task counts. */
    @Get("overview")
    @RouteSecurity("authenticated")
    @Header("Cache-Control", "no-store")
    overview(@Req() req: CookieRequest, @Query() query: unknown) {
        return this.workflow.overview(req.cookies[SESSION_COOKIE_NAME], query);
    }
}
