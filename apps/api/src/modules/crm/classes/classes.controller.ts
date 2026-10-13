/**
 * HTTP de clases.
 *
 * Recibe la cookie de sesión, el cuerpo ya validado y el contexto de auditoría.
 * No autoriza ni escribe SQL: el servicio vuelve a comprobar el permiso efectivo.
 */
import { Body, Controller, Get, Headers, HttpCode, Inject, Param, Patch, Post, Query, Req } from "@nestjs/common";
import { ApiBody, ApiOperation, ApiTags } from "@nestjs/swagger";

import type { CookieRequest } from "../../../common/security/cookie-request.type.js";
import { SESSION_COOKIE_NAME } from "../../../common/security/http-security.constants.js";
import { CreateCatalogItemDto, ListCatalogItemsQueryDto, UpdateCatalogItemDto, UpdateCatalogItemStatusDto } from "../catalogs/dto/catalog-items.dto.js";
import { ClassesService } from "./classes.service.js";

/**
 * Exposes Classes routes using the established catalog API contract.
 */
@ApiTags("classes")
@Controller("catalogs/classes")
export class ClassesController {
    /** @param catalogs - Caso de uso. El nombre sigue el de los demás catálogos. */
    constructor(@Inject(ClassesService) private readonly catalogs: ClassesService) {}

    /**
     * Lista clases nativas y, si el fallback está activo, los que aún no migraron.
     *
     * La cookie identifica la sesión. El permiso de lectura lo resuelve el servicio.
     */
    @Get("items")
    @ApiOperation({ summary: "Listar clases." })
    async list(@Query() query: ListCatalogItemsQueryDto, @Req() request: CookieRequest) {
        return this.catalogs.listCatalogItems(request.cookies[SESSION_COOKIE_NAME], "classes", query);
    }

    /**
     * Crea una clase nativa.
     *
     * IP y user agent viajan solo para la auditoría. No se guardan como dato de la clase.
     */
    @Post("items")
    @ApiOperation({ summary: "Crear clase." })
    @ApiBody({ type: CreateCatalogItemDto })
    async create(@Body() body: CreateCatalogItemDto, @Req() request: CookieRequest, @Headers("user-agent") userAgent?: string) {
        return this.catalogs.createCatalogItem(request.cookies[SESSION_COOKIE_NAME], "classes", body, { ipAddress: request.ip, userAgent });
    }

    /**
     * Edita nombre, detalle y referencias.
     *
     * Un `itemPublicId` con forma `legacy:classes:N` promueve esa fila al CRM nuevo.
     */
    @Patch("items/:itemPublicId")
    @HttpCode(200)
    @ApiOperation({ summary: "Editar clase." })
    @ApiBody({ type: UpdateCatalogItemDto })
    async update(@Param("itemPublicId") itemPublicId: string, @Body() body: UpdateCatalogItemDto, @Req() request: CookieRequest, @Headers("user-agent") userAgent?: string) {
        return this.catalogs.updateCatalogItem(request.cookies[SESSION_COOKIE_NAME], "classes", itemPublicId, body, { ipAddress: request.ip, userAgent });
    }

    /**
     * Activa o inactiva la clase.
     *
     * El motivo va en el cuerpo porque el cambio queda auditado en la misma transacción.
     */
    @Patch("items/:itemPublicId/status")
    @HttpCode(200)
    @ApiOperation({ summary: "Cambiar estado de una clase." })
    @ApiBody({ type: UpdateCatalogItemStatusDto })
    async updateStatus(@Param("itemPublicId") itemPublicId: string, @Body() body: UpdateCatalogItemStatusDto, @Req() request: CookieRequest, @Headers("user-agent") userAgent?: string) {
        return this.catalogs.updateCatalogItemStatus(request.cookies[SESSION_COOKIE_NAME], "classes", itemPublicId, body, { ipAddress: request.ip, userAgent });
    }
}
