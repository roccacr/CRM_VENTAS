import { Body, Controller, Get, Header, HttpCode, Inject, Param, Patch, Post, Put, Query, Req } from "@nestjs/common";
import type { SchemaObject } from "@nestjs/swagger";
import { ApiBody, ApiOperation, ApiQuery, ApiTags } from "@nestjs/swagger";
import { z } from "zod";

import type { CookieRequest } from "../../../common/security/cookie-request.type.js";
import { SESSION_COOKIE_NAME } from "../../../common/security/http-security.constants.js";
import { RequirePermission } from "../../../common/security/require-permission.decorator.js";
import { RouteSecurity } from "../../../common/security/route-security.decorator.js";
import { CATALOG_CONTEXT_MODULES } from "../catalogs/catalogs.constants.js";
import { createNoteSchema, editNoteSchema, noteStateSchema, placementSchema } from "./notes.contract.js";
import { NotesService } from "./notes.service.js";

/** Every handler uses the BFF cookie and resource checks; no caller-selected author or SQL target. */
@ApiTags("notes")
@Controller("notes")
export class NotesController {
    /** Injects the native notes use case. */
    constructor(@Inject(NotesService) private readonly notes: NotesService) {}

    /** Lists only the authenticated actor's authorized context. */
    @Get()
    @RouteSecurity("permission")
    @RequirePermission({ kind: "notes", action: "read" })
    @Header("Cache-Control", "no-store")
    @ApiOperation({ summary: "Listar notas autorizadas en un contexto; paginacion limitada." })
    @ApiQuery({ name: "moduleCode", enum: CATALOG_CONTEXT_MODULES })
    @ApiQuery({ name: "contextType", enum: ["personal", "view", "sales_order"], required: false })
    @ApiQuery({ name: "viewCode", type: String, required: false, description: "Codigo de vista registrada; nunca una URL arbitraria." })
    @ApiQuery({ name: "recordSource", enum: ["native", "legacy"], required: false })
    @ApiQuery({ name: "recordId", type: String, required: false, description: "ULID nativo o identificador decimal legacy, segun recordSource." })
    list(@Req() req: CookieRequest, @Query() query: unknown) {
        return this.notes.list(req.cookies[SESSION_COOKIE_NAME], query);
    }

    /** Reads bounded metadata history after resource authorization. */
    @Get(":id/history")
    @RouteSecurity("permission")
    @RequirePermission({ kind: "notes", action: "read", allowCrossModuleRead: true })
    @Header("Cache-Control", "no-store")
    @ApiOperation({ summary: "Historial autorizado de metadata; no restaura texto privado." })
    @ApiQuery({ name: "moduleCode", enum: CATALOG_CONTEXT_MODULES })
    history(@Req() req: CookieRequest, @Param("id") id: string, @Query() query: unknown) {
        return this.notes.history(req.cookies[SESSION_COOKIE_NAME], id, query);
    }

    /** Loads private content and personal layout without cache. */
    @Get(":id")
    @RouteSecurity("permission")
    @RequirePermission({ kind: "notes", action: "read", allowCrossModuleRead: true })
    @Header("Cache-Control", "no-store")
    @ApiOperation({ summary: "Consultar una nota con capabilities y layout propio." })
    @ApiQuery({ name: "moduleCode", enum: CATALOG_CONTEXT_MODULES })
    read(@Req() req: CookieRequest, @Param("id") id: string, @Query() query: unknown) {
        return this.notes.read(req.cookies[SESSION_COOKIE_NAME], id, query);
    }

    /** Creates a private note using server-derived authorship. */
    @Post()
    @RouteSecurity("permission")
    @RequirePermission({ kind: "notes", action: "create" })
    @Header("Cache-Control", "no-store")
    @ApiOperation({ summary: "Crear nota privada nativa; recibo y eventos pendientes atomicos." })
    @ApiBody({ schema: z.toJSONSchema(createNoteSchema) as SchemaObject })
    create(@Req() req: CookieRequest, @Body() body: unknown) {
        return this.notes.create(req.cookies[SESSION_COOKIE_NAME], body);
    }

    /** Updates author-owned content with an explicit version. */
    @Patch(":id")
    @RouteSecurity("permission")
    @RequirePermission({ kind: "notes", action: "edit_own" })
    @Header("Cache-Control", "no-store")
    @ApiOperation({ summary: "Editar nota propia abierta con version e idempotencia." })
    @ApiBody({ schema: z.toJSONSchema(editNoteSchema) as SchemaObject })
    edit(@Req() req: CookieRequest, @Param("id") id: string, @Body() body: unknown) {
        return this.notes.edit(req.cookies[SESSION_COOKIE_NAME], id, body);
    }

    /** Completes an open note without deleting its conversation. */
    @Post(":id/complete")
    @HttpCode(200)
    @RouteSecurity("permission")
    @RequirePermission({ kind: "notes", action: "resolve_own" })
    @Header("Cache-Control", "no-store")
    @ApiOperation({ summary: "Completar nota propia sin borrar su contenido." })
    @ApiBody({ schema: z.toJSONSchema(noteStateSchema) as SchemaObject })
    complete(@Req() req: CookieRequest, @Param("id") id: string, @Body() body: unknown) {
        return this.notes.lifecycle(req.cookies[SESSION_COOKIE_NAME], id, body, "complete");
    }

    /** Reopens a completed note with optimistic concurrency. */
    @Post(":id/reopen")
    @HttpCode(200)
    @RouteSecurity("permission")
    @RequirePermission({ kind: "notes", action: "resolve_own" })
    @Header("Cache-Control", "no-store")
    @ApiOperation({ summary: "Reabrir una nota propia completada." })
    @ApiBody({ schema: z.toJSONSchema(noteStateSchema) as SchemaObject })
    reopen(@Req() req: CookieRequest, @Param("id") id: string, @Body() body: unknown) {
        return this.notes.lifecycle(req.cookies[SESSION_COOKIE_NAME], id, body, "reopen");
    }

    /** Archives the author's note; never performs a physical deletion. */
    @Post(":id/archive")
    @HttpCode(200)
    @RouteSecurity("permission")
    @RequirePermission({ kind: "notes", action: "archive_own" })
    @Header("Cache-Control", "no-store")
    @ApiOperation({ summary: "Archivar nota propia; no existe borrado fisico HTTP." })
    @ApiBody({ schema: z.toJSONSchema(noteStateSchema) as SchemaObject })
    archive(@Req() req: CookieRequest, @Param("id") id: string, @Body() body: unknown) {
        return this.notes.lifecycle(req.cookies[SESSION_COOKIE_NAME], id, body, "archive");
    }

    /** Saves only the authenticated caller's placement and PIN. */
    @Put(":id/my-placement")
    @RouteSecurity("permission")
    @RequirePermission({ kind: "notes", action: "read", source: "body", allowCrossModuleRead: true })
    @Header("Cache-Control", "no-store")
    @ApiOperation({ summary: "Guardar posicion y PIN propios, sin modificar contenido o notificar." })
    @ApiBody({ schema: z.toJSONSchema(placementSchema) as SchemaObject })
    move(@Req() req: CookieRequest, @Param("id") id: string, @Body() body: unknown) {
        return this.notes.move(req.cookies[SESSION_COOKIE_NAME], id, body);
    }
}
