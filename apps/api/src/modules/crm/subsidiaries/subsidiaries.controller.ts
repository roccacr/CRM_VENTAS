/**
 * HTTP de subsidiarias.
 *
 * Recibe la cookie de sesión, el cuerpo ya validado y el contexto de auditoría.
 * No autoriza ni escribe SQL: el servicio vuelve a comprobar el permiso efectivo.
 */
import { Body, Controller, Get, Headers, HttpCode, Inject, Param, Patch, Post, Query, Req } from "@nestjs/common";
import { ApiBody, ApiOperation, ApiTags } from "@nestjs/swagger";

import type { CookieRequest } from "../../../common/security/cookie-request.type.js";
import { SESSION_COOKIE_NAME } from "../../../common/security/http-security.constants.js";
import { ListCatalogItemsQueryDto, UpdateCatalogItemStatusDto } from "../catalogs/dto/catalog-items.dto.js";
import { CreateSubsidiaryDto, UpdateSubsidiaryDto } from "./subsidiaries.dto.js";
import { SubsidiariesService } from "./subsidiaries.service.js";

/**
 * Exposes Subsidiaries routes using the established catalog API contract.
 */
@ApiTags("subsidiaries")
@Controller("catalogs/subsidiaries")
export class SubsidiariesController {
    /** @param catalogs - Caso de uso. El nombre sigue el de los demás catálogos. */
    constructor(@Inject(SubsidiariesService) private readonly catalogs: SubsidiariesService) {}

    /**
     * Lista subsidiarias nativas y, si el fallback está activo, los que aún no migraron.
     *
     * La cookie identifica la sesión. El permiso de lectura lo resuelve el servicio.
     */
    @Get("items")
    @ApiOperation({ summary: "Listar subsidiarias." })
    async list(@Query() query: ListCatalogItemsQueryDto, @Req() request: CookieRequest) {
        return this.catalogs.listCatalogItems(request.cookies[SESSION_COOKIE_NAME], "subsidiaries", query);
    }

    /**
     * Crea una subsidiaria nativa.
     *
     * IP y user agent viajan solo para la auditoría. No se guardan como dato de la subsidiaria.
     */
    @Post("items")
    @ApiOperation({ summary: "Crear subsidiaria." })
    @ApiBody({ type: CreateSubsidiaryDto })
    async create(@Body() body: CreateSubsidiaryDto, @Req() request: CookieRequest, @Headers("user-agent") userAgent?: string) {
        return this.catalogs.createCatalogItem(request.cookies[SESSION_COOKIE_NAME], "subsidiaries", body, { ipAddress: request.ip, userAgent });
    }

    /**
     * Edita nombre, detalle y referencias.
     *
     * Un `itemPublicId` con forma `legacy:subsidiaries:N` promueve esa fila al CRM nuevo.
     */
    @Patch("items/:itemPublicId")
    @HttpCode(200)
    @ApiOperation({ summary: "Editar subsidiaria." })
    @ApiBody({ type: UpdateSubsidiaryDto })
    async update(@Param("itemPublicId") itemPublicId: string, @Body() body: UpdateSubsidiaryDto, @Req() request: CookieRequest, @Headers("user-agent") userAgent?: string) {
        return this.catalogs.updateCatalogItem(request.cookies[SESSION_COOKIE_NAME], "subsidiaries", itemPublicId, body, { ipAddress: request.ip, userAgent });
    }

    /**
     * Activa o inactiva la subsidiaria.
     *
     * El motivo va en el cuerpo porque el cambio queda auditado en la misma transacción.
     */
    @Patch("items/:itemPublicId/status")
    @HttpCode(200)
    @ApiOperation({ summary: "Cambiar estado de una subsidiaria." })
    @ApiBody({ type: UpdateCatalogItemStatusDto })
    async updateStatus(@Param("itemPublicId") itemPublicId: string, @Body() body: UpdateCatalogItemStatusDto, @Req() request: CookieRequest, @Headers("user-agent") userAgent?: string) {
        return this.catalogs.updateCatalogItemStatus(request.cookies[SESSION_COOKIE_NAME], "subsidiaries", itemPublicId, body, { ipAddress: request.ip, userAgent });
    }
}
