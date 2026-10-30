import { Body, Controller, Get, Header, HttpCode, Inject, Param, Patch, Post, Put, Query, Req } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";

import type { CookieRequest } from "../../../common/security/cookie-request.type.js";
import { SESSION_COOKIE_NAME } from "../../../common/security/http-security.constants.js";
import { RouteSecurity } from "../../../common/security/route-security.decorator.js";
import { NoteCollaborationService } from "./note-collaboration.service.js";
/** Authentication is mandatory; every operation also rechecks live capability and persisted resource ACL in the service. */
@ApiTags("note-collaboration")
@Controller("note-collaboration")
export class NoteCollaborationController {
    /** Injects existing authorization and native persistence collaborators. */
    constructor(@Inject(NoteCollaborationService) private readonly collaboration: NoteCollaborationService) {}
    /** Lists only notes the current session can still read. */
    @Get("inbox")
    @RouteSecurity("authenticated")
    @Header("Cache-Control", "no-store")
    inbox(@Req() req: CookieRequest, @Query() query: unknown) {
        return this.collaboration.inbox(req.cookies[SESSION_COOKIE_NAME], query);
    }
    /** Author choices are scoped to the caller's currently readable notes. */
    @Get("inbox/authors")
    @RouteSecurity("authenticated")
    @Header("Cache-Control", "no-store")
    inboxAuthors(@Req() req: CookieRequest) {
        return this.collaboration.inboxAuthors(req.cookies[SESSION_COOKIE_NAME]);
    }
    /** Reads current-access attributed metadata without exposing old note contents. */
    @Get("notes/:id/activity")
    @RouteSecurity("authenticated")
    @Header("Cache-Control", "no-store")
    activity(@Req() req: CookieRequest, @Param("id") id: string, @Query() query: unknown) {
        return this.collaboration.activity(req.cookies[SESSION_COOKIE_NAME], id, query);
    }
    /** Reads independently authorized Home display references. */
    @Get("notes/:id/locations")
    @RouteSecurity("authenticated")
    @Header("Cache-Control", "no-store")
    locations(@Req() req: CookieRequest, @Param("id") id: string) {
        return this.collaboration.locations(req.cookies[SESSION_COOKIE_NAME], id);
    }
    /** Author-only versioned replacement; transaction rechecks invitation and target access. */
    @Put("notes/:id/locations")
    @RouteSecurity("authenticated")
    @Header("Cache-Control", "no-store")
    replaceLocations(@Req() req: CookieRequest, @Param("id") id: string, @Body() body: unknown) {
        return this.collaboration.replaceLocations(req.cookies[SESSION_COOKIE_NAME], id, body);
    }
    /** Searches draft invitees without granting access or creating a note. */
    @Get("eligible-users")
    @RouteSecurity("authenticated")
    @Header("Cache-Control", "no-store")
    eligibleDraftUsers(@Req() req: CookieRequest, @Query() query: unknown) {
        return this.collaboration.eligibleDraftUsers(req.cookies[SESSION_COOKIE_NAME], query);
    }
    /** Loads the authorized conversation and actor-specific capabilities. */
    @Get("notes/:id")
    @RouteSecurity("authenticated")
    @Header("Cache-Control", "no-store")
    thread(@Req() req: CookieRequest, @Param("id") id: string, @Query() query: unknown) {
        return this.collaboration.thread(req.cookies[SESSION_COOKIE_NAME], id, query);
    }
    /** Owner-only directory of active or dormant invitees; inviting never grants linked-resource access. */
    @Get("notes/:id/eligible-users")
    @RouteSecurity("authenticated")
    @Header("Cache-Control", "no-store")
    eligibleUsers(@Req() req: CookieRequest, @Param("id") id: string, @Query() query: unknown) {
        return this.collaboration.eligibleUsers(req.cookies[SESSION_COOKIE_NAME], id, query);
    }
    /** Replaces participants only after owner and target authorization. */
    @Put("notes/:id/participants")
    @RouteSecurity("authenticated")
    @Header("Cache-Control", "no-store")
    participants(@Req() req: CookieRequest, @Param("id") id: string, @Body() body: unknown) {
        return this.collaboration.participants(req.cookies[SESSION_COOKIE_NAME], id, body);
    }
    /** Updates original-note mentions without implicitly inviting anyone. */
    @Put("notes/:id/mentions")
    @RouteSecurity("authenticated")
    @Header("Cache-Control", "no-store")
    mentions(@Req() req: CookieRequest, @Param("id") id: string, @Body() body: unknown) {
        return this.collaboration.mentions(req.cookies[SESSION_COOKIE_NAME], id, body);
    }
    /** Adds an authored reply with an idempotent operation key. */
    @Post("notes/:id/replies")
    @HttpCode(200)
    @RouteSecurity("authenticated")
    @Header("Cache-Control", "no-store")
    reply(@Req() req: CookieRequest, @Param("id") id: string, @Body() body: unknown) {
        return this.collaboration.reply(req.cookies[SESSION_COOKIE_NAME], id, body);
    }
    /** Edits only the current actor’s own reply. */
    @Patch("notes/:id/replies/:replyId")
    @RouteSecurity("authenticated")
    @Header("Cache-Control", "no-store")
    editReply(@Req() req: CookieRequest, @Param("id") id: string, @Param("replyId") replyId: string, @Body() body: unknown) {
        return this.collaboration.editReply(req.cookies[SESSION_COOKIE_NAME], id, replyId, body);
    }
    /** Withdraws only the current actor’s own reply while preserving history. */
    @Post("notes/:id/replies/:replyId/withdraw")
    @HttpCode(200)
    @RouteSecurity("authenticated")
    @Header("Cache-Control", "no-store")
    withdrawReply(@Req() req: CookieRequest, @Param("id") id: string, @Param("replyId") replyId: string, @Body() body: unknown) {
        return this.collaboration.withdrawReply(req.cookies[SESSION_COOKIE_NAME], id, replyId, body);
    }
    /** Changes only the current actor’s response-notification preference. */
    @Put("notes/:id/my-following")
    @RouteSecurity("authenticated")
    @Header("Cache-Control", "no-store")
    following(@Req() req: CookieRequest, @Param("id") id: string, @Body() body: unknown) {
        return this.collaboration.following(req.cookies[SESSION_COOKIE_NAME], id, body);
    }
}
