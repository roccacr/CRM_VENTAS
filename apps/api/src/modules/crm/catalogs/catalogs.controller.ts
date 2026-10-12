import { Body, Controller, Get, Headers, HttpCode, Inject, Param, Patch, Post, Query, Req } from "@nestjs/common";
import { ApiBody, ApiOperation, ApiTags } from "@nestjs/swagger";

import type { CookieRequest } from "../../../common/security/cookie-request.type.js";
import { SESSION_COOKIE_NAME } from "../../../common/security/http-security.constants.js";
import { CatalogsService } from "./catalogs.service.js";
import { CreateCatalogItemDto, ListCatalogItemsQueryDto, UpdateCatalogItemDto, UpdateCatalogItemStatusDto } from "./dto/catalog-items.dto.js";

/**
 * HTTP de los catálogos compartidos.
 *
 * Entrega la cookie de sesión, el código de ruta y el contexto de auditoría.
 * No autoriza: el servicio vuelve a leer el permiso efectivo del módulo de contexto.
 */
@ApiTags("catalogs")
@Controller("catalogs")
export class CatalogsController {
    /** @param catalogs - Caso de uso compartido. Proyectos no se atienden por esta ruta. */
    constructor(@Inject(CatalogsService) private readonly catalogs: CatalogsService) {}

    /** Lista valores del catálogo indicado. El módulo de la query decide el permiso de lectura. */
    @Get(":catalogCode/items")
    @ApiOperation({ summary: "Listar valores de un catálogo administrativo." })
    async list(@Param("catalogCode") catalogCode: string, @Query() query: ListCatalogItemsQueryDto, @Req() request: CookieRequest) {
        return this.catalogs.listCatalogItems(request.cookies[SESSION_COOKIE_NAME], catalogCode, query);
    }

    /** Crea un valor nativo. IP y user agent viajan solo a la auditoría. */
    @Post(":catalogCode/items")
    @ApiOperation({ summary: "Crear valor de catálogo administrativo." })
    @ApiBody({ type: CreateCatalogItemDto })
    async create(@Param("catalogCode") catalogCode: string, @Body() body: CreateCatalogItemDto, @Req() request: CookieRequest, @Headers("user-agent") userAgent?: string) {
        return this.catalogs.createCatalogItem(request.cookies[SESSION_COOKIE_NAME], catalogCode, body, { ipAddress: request.ip, userAgent });
    }

    /** Edita nombre, detalle y referencias. Un id `legacy:` se rechaza antes de escribir. */
    // eslint-disable-next-line max-params -- Handler Nest: los parametros vienen de decoradores HTTP separados.
    @Patch(":catalogCode/items/:itemPublicId")
    @HttpCode(200)
    @ApiOperation({ summary: "Editar valor de catálogo administrativo." })
    @ApiBody({ type: UpdateCatalogItemDto })
    async update(@Param("catalogCode") catalogCode: string, @Param("itemPublicId") itemPublicId: string, @Body() body: UpdateCatalogItemDto, @Req() request: CookieRequest, @Headers("user-agent") userAgent?: string) {
        return this.catalogs.updateCatalogItem(request.cookies[SESSION_COOKIE_NAME], catalogCode, itemPublicId, body, { ipAddress: request.ip, userAgent });
    }

    /** Activa o inactiva. El motivo del cuerpo queda en el evento de auditoría. */
    // eslint-disable-next-line max-params -- Handler Nest: los parametros vienen de decoradores HTTP separados.
    @Patch(":catalogCode/items/:itemPublicId/status")
    @HttpCode(200)
    @ApiOperation({ summary: "Cambiar estado de un valor de catálogo administrativo." })
    @ApiBody({ type: UpdateCatalogItemStatusDto })
    async updateStatus(@Param("catalogCode") catalogCode: string, @Param("itemPublicId") itemPublicId: string, @Body() body: UpdateCatalogItemStatusDto, @Req() request: CookieRequest, @Headers("user-agent") userAgent?: string) {
        return this.catalogs.updateCatalogItemStatus(request.cookies[SESSION_COOKIE_NAME], catalogCode, itemPublicId, body, { ipAddress: request.ip, userAgent });
    }
}
