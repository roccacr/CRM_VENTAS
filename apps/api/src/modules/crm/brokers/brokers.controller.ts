/**
 * HTTP de corredores.
 *
 * Recibe la cookie de sesión, el cuerpo ya validado y el contexto de auditoría.
 * No autoriza ni escribe SQL: el servicio vuelve a comprobar el permiso efectivo.
 */
import { Body, Controller, Get, Headers, HttpCode, Inject, Param, Patch, Post, Query, Req } from "@nestjs/common";
import { ApiBody, ApiOperation, ApiTags } from "@nestjs/swagger";

import type { CookieRequest } from "../../../common/security/cookie-request.type.js";
import { SESSION_COOKIE_NAME } from "../../../common/security/http-security.constants.js";
import { ListCatalogItemsQueryDto, UpdateCatalogItemStatusDto } from "../catalogs/dto/catalog-items.dto.js";
import { CreateBrokerDto, UpdateBrokerDto } from "./brokers.dto.js";
import { BrokersService } from "./brokers.service.js";

/**
 * Exposes Brokers routes using the established catalog API contract.
 */
@ApiTags("brokers")
@Controller("catalogs/brokers")
export class BrokersController {
    /** @param catalogs - Caso de uso. El nombre sigue el de los demás catálogos. */
    constructor(@Inject(BrokersService) private readonly catalogs: BrokersService) {}

    /**
     * Lista corredores nativas y, si el fallback está activo, los que aún no migraron.
     *
     * La cookie identifica la sesión. El permiso de lectura lo resuelve el servicio.
     */
    @Get("items")
    @ApiOperation({ summary: "Listar corredores." })
    async list(@Query() query: ListCatalogItemsQueryDto, @Req() request: CookieRequest) {
        return this.catalogs.listCatalogItems(request.cookies[SESSION_COOKIE_NAME], "brokers", query);
    }

    /**
     * Crea un corredor nativa.
     *
     * IP y user agent viajan solo para la auditoría. No se guardan como dato del corredor.
     */
    @Post("items")
    @ApiOperation({ summary: "Crear corredor." })
    @ApiBody({ type: CreateBrokerDto })
    async create(@Body() body: CreateBrokerDto, @Req() request: CookieRequest, @Headers("user-agent") userAgent?: string) {
        return this.catalogs.createCatalogItem(request.cookies[SESSION_COOKIE_NAME], "brokers", body, { ipAddress: request.ip, userAgent });
    }

    /**
     * Edita nombre, detalle y referencias.
     *
     * Un `itemPublicId` con forma `legacy:brokers:N` promueve esa fila al CRM nuevo.
     */
    @Patch("items/:itemPublicId")
    @HttpCode(200)
    @ApiOperation({ summary: "Editar corredor." })
    @ApiBody({ type: UpdateBrokerDto })
    async update(@Param("itemPublicId") itemPublicId: string, @Body() body: UpdateBrokerDto, @Req() request: CookieRequest, @Headers("user-agent") userAgent?: string) {
        return this.catalogs.updateCatalogItem(request.cookies[SESSION_COOKIE_NAME], "brokers", itemPublicId, body, { ipAddress: request.ip, userAgent });
    }

    /**
     * Activa o inactiva el corredor.
     *
     * El motivo va en el cuerpo porque el cambio queda auditado en la misma transacción.
     */
    @Patch("items/:itemPublicId/status")
    @HttpCode(200)
    @ApiOperation({ summary: "Cambiar estado de un corredor." })
    @ApiBody({ type: UpdateCatalogItemStatusDto })
    async updateStatus(@Param("itemPublicId") itemPublicId: string, @Body() body: UpdateCatalogItemStatusDto, @Req() request: CookieRequest, @Headers("user-agent") userAgent?: string) {
        return this.catalogs.updateCatalogItemStatus(request.cookies[SESSION_COOKIE_NAME], "brokers", itemPublicId, body, { ipAddress: request.ip, userAgent });
    }
}
