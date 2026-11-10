import { Body, Controller, Get, Header, HttpCode, Inject, Param, Patch, Post, Put, Query, Req } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";

import type { CookieRequest } from "../../../common/security/cookie-request.type.js";
import { SESSION_COOKIE_NAME } from "../../../common/security/http-security.constants.js";
import { RouteSecurity } from "../../../common/security/route-security.decorator.js";
import { NoteCollaborationService } from "./note-collaboration.service.js";
/** La autenticación es obligatoria. Cada operación vuelve a comprobar en el servicio la capacidad viva y la ACL persistida del recurso. */
@ApiTags("note-collaboration")
@Controller("note-collaboration")
export class NoteCollaborationController {
    /** Autorización existente y persistencia nativa. */
    constructor(@Inject(NoteCollaborationService) private readonly collaboration: NoteCollaborationService) {}
    /** Lista solo las notas que la sesión actual todavía puede leer. */
    @Get("inbox")
    @RouteSecurity("authenticated")
    @Header("Cache-Control", "no-store")
    inbox(@Req() req: CookieRequest, @Query() query: unknown) {
        return this.collaboration.inbox(req.cookies[SESSION_COOKIE_NAME], query);
    }
    /** Las opciones de autor salen de las notas que quien llama puede leer ahora. */
    @Get("inbox/authors")
    @RouteSecurity("authenticated")
    @Header("Cache-Control", "no-store")
    inboxAuthors(@Req() req: CookieRequest) {
        return this.collaboration.inboxAuthors(req.cookies[SESSION_COOKIE_NAME]);
    }
    /** Lee metadatos atribuidos del acceso actual. El contenido viejo de la nota no sale. */
    @Get("notes/:id/activity")
    @RouteSecurity("authenticated")
    @Header("Cache-Control", "no-store")
    activity(@Req() req: CookieRequest, @Param("id") id: string, @Query() query: unknown) {
        return this.collaboration.activity(req.cookies[SESSION_COOKIE_NAME], id, query);
    }
    /** Lee referencias de presentación del inicio, autorizadas por su lado. */
    @Get("notes/:id/locations")
    @RouteSecurity("authenticated")
    @Header("Cache-Control", "no-store")
    locations(@Req() req: CookieRequest, @Param("id") id: string) {
        return this.collaboration.locations(req.cookies[SESSION_COOKIE_NAME], id);
    }
    /** Reemplazo versionado solo del autor. La transacción vuelve a comprobar la invitación y el acceso al destino. */
    @Put("notes/:id/locations")
    @RouteSecurity("authenticated")
    @Header("Cache-Control", "no-store")
    replaceLocations(@Req() req: CookieRequest, @Param("id") id: string, @Body() body: unknown) {
        return this.collaboration.replaceLocations(req.cookies[SESSION_COOKIE_NAME], id, body);
    }
    /** Busca invitados de borrador. No concede acceso ni crea una nota. */
    @Get("eligible-users")
    @RouteSecurity("authenticated")
    @Header("Cache-Control", "no-store")
    eligibleDraftUsers(@Req() req: CookieRequest, @Query() query: unknown) {
        return this.collaboration.eligibleDraftUsers(req.cookies[SESSION_COOKIE_NAME], query);
    }
    /** Carga la conversación autorizada y las capacidades de este actor. */
    @Get("notes/:id")
    @RouteSecurity("authenticated")
    @Header("Cache-Control", "no-store")
    thread(@Req() req: CookieRequest, @Param("id") id: string, @Query() query: unknown) {
        return this.collaboration.thread(req.cookies[SESSION_COOKIE_NAME], id, query);
    }
    /** Directorio solo del dueño, con invitados activos o dormidos. Invitar no concede el recurso vinculado. */
    @Get("notes/:id/eligible-users")
    @RouteSecurity("authenticated")
    @Header("Cache-Control", "no-store")
    eligibleUsers(@Req() req: CookieRequest, @Param("id") id: string, @Query() query: unknown) {
        return this.collaboration.eligibleUsers(req.cookies[SESSION_COOKIE_NAME], id, query);
    }
    /** Reemplaza participantes solo después de autorizar al dueño y al destino. */
    @Put("notes/:id/participants")
    @RouteSecurity("authenticated")
    @Header("Cache-Control", "no-store")
    participants(@Req() req: CookieRequest, @Param("id") id: string, @Body() body: unknown) {
        return this.collaboration.participants(req.cookies[SESSION_COOKIE_NAME], id, body);
    }
    /** Actualiza menciones de la nota original. Mencionar no invita. */
    @Put("notes/:id/mentions")
    @RouteSecurity("authenticated")
    @Header("Cache-Control", "no-store")
    mentions(@Req() req: CookieRequest, @Param("id") id: string, @Body() body: unknown) {
        return this.collaboration.mentions(req.cookies[SESSION_COOKIE_NAME], id, body);
    }
    /** Agrega una respuesta atribuida. La misma clave de operación no la duplica. */
    @Post("notes/:id/replies")
    @HttpCode(200)
    @RouteSecurity("authenticated")
    @Header("Cache-Control", "no-store")
    reply(@Req() req: CookieRequest, @Param("id") id: string, @Body() body: unknown) {
        return this.collaboration.reply(req.cookies[SESSION_COOKIE_NAME], id, body);
    }
    /** Edita solo la respuesta del actor actual. */
    @Patch("notes/:id/replies/:replyId")
    @RouteSecurity("authenticated")
    @Header("Cache-Control", "no-store")
    editReply(@Req() req: CookieRequest, @Param("id") id: string, @Param("replyId") replyId: string, @Body() body: unknown) {
        return this.collaboration.editReply(req.cookies[SESSION_COOKIE_NAME], id, replyId, body);
    }
    /** Retira solo la respuesta del actor actual. La historia queda. */
    @Post("notes/:id/replies/:replyId/withdraw")
    @HttpCode(200)
    @RouteSecurity("authenticated")
    @Header("Cache-Control", "no-store")
    withdrawReply(@Req() req: CookieRequest, @Param("id") id: string, @Param("replyId") replyId: string, @Body() body: unknown) {
        return this.collaboration.withdrawReply(req.cookies[SESSION_COOKIE_NAME], id, replyId, body);
    }
    /** Cambia solo la preferencia de avisos de respuesta del actor actual. */
    @Put("notes/:id/my-following")
    @RouteSecurity("authenticated")
    @Header("Cache-Control", "no-store")
    following(@Req() req: CookieRequest, @Param("id") id: string, @Body() body: unknown) {
        return this.collaboration.following(req.cookies[SESSION_COOKIE_NAME], id, body);
    }
}
