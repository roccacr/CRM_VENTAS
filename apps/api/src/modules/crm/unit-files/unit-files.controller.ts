import { Controller, Get, Inject, Param, Query, Req, ValidationPipe } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";

import type { CookieRequest } from "../../../common/security/cookie-request.type.js";
import { SESSION_COOKIE_NAME } from "../../../common/security/http-security.constants.js";
import { RequirePermission } from "../../../common/security/require-permission.decorator.js";
import { RouteSecurity } from "../../../common/security/route-security.decorator.js";
import { UnitFilesContextDto, UnitFilesFacetsDto, UnitFilesOptionsDto, UnitFilesQueryDto } from "./unit-files.dto.js";
import { UnitFilesService } from "./unit-files.service.js";

/**
 * Solo lectura. No hay ruta para borrar ni para escribir el CRM viejo.
 * El permiso de ruta abre la puerta; el servicio vuelve a exigir `catalog_file.read`.
 */
@ApiTags("unit-files")
@Controller("unit-files")
export class UnitFilesController {
    /** Cada request lleva la cookie. La autorización de sesión la hace el servicio. El tipo esperado conserva la validación aunque el compilador no emita metadatos. */
    constructor(@Inject(UnitFilesService) private readonly units: UnitFilesService) {}

    /** Elegir proyecto no carga unidades. */
    @Get("projects")
    @RouteSecurity("permission")
    @RequirePermission({ kind: "unit-files" })
    projects(@Query(new ValidationPipe({ expectedType: UnitFilesContextDto, transform: true, whitelist: true, forbidNonWhitelisted: true })) query: UnitFilesContextDto, @Req() request: CookieRequest) {
        return this.units.projects(request.cookies[SESSION_COOKIE_NAME], query.moduleCode);
    }

    /** Las opciones buscan dentro de los proyectos pedidos y no devuelven el expediente completo. */
    @Get("options")
    @RouteSecurity("permission")
    @RequirePermission({ kind: "unit-files" })
    options(@Query(new ValidationPipe({ expectedType: UnitFilesOptionsDto, transform: true, whitelist: true, forbidNonWhitelisted: true })) query: UnitFilesOptionsDto, @Req() request: CookieRequest) {
        return this.units.options(request.cookies[SESSION_COOKIE_NAME], query);
    }

    /** Los agregados recorren el alcance pedido, con su propio tope y la misma sesión. */
    @Get("facets")
    @RouteSecurity("permission")
    @RequirePermission({ kind: "unit-files" })
    facets(@Query(new ValidationPipe({ expectedType: UnitFilesFacetsDto, transform: true, whitelist: true, forbidNonWhitelisted: true })) query: UnitFilesFacetsDto, @Req() request: CookieRequest) {
        return this.units.facets(request.cookies[SESSION_COOKIE_NAME], query);
    }

    /** Un inventario sin proyecto, o con un límite fuera de 1 a 500, no pasa la validación de la consulta. */
    @Get()
    @RouteSecurity("permission")
    @RequirePermission({ kind: "unit-files" })
    list(@Query(new ValidationPipe({ expectedType: UnitFilesQueryDto, transform: true, whitelist: true, forbidNonWhitelisted: true })) query: UnitFilesQueryDto, @Req() request: CookieRequest) {
        return this.units.list(request.cookies[SESSION_COOKIE_NAME], query);
    }

    /** El dato completo de negocio se lee solo al abrir un expediente. */
    @Get(":id")
    @RouteSecurity("permission")
    @RequirePermission({ kind: "unit-files" })
    detail(@Param("id") id: string, @Query(new ValidationPipe({ expectedType: UnitFilesContextDto, transform: true, whitelist: true, forbidNonWhitelisted: true })) query: UnitFilesContextDto, @Req() request: CookieRequest) {
        return this.units.detail(request.cookies[SESSION_COOKIE_NAME], id, query.moduleCode);
    }
}
