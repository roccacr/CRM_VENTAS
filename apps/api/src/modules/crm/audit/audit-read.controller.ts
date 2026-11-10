import { Controller, Get, Inject, Param, Query, Req, ValidationPipe } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";

import type { CookieRequest } from "../../../common/security/cookie-request.type.js";
import { SESSION_COOKIE_NAME } from "../../../common/security/http-security.constants.js";
import { RequirePermission } from "../../../common/security/require-permission.decorator.js";
import { RouteSecurity } from "../../../common/security/route-security.decorator.js";
import { AuditQueryDto } from "./audit-read.contract.js";
import { AuditReadService } from "./audit-read.service.js";

/**
 * Solo lectura, con permiso de auditoria. No hay alta, cambio ni exportacion sin tope.
 * Las rutas concretas van antes de `/:publicId` para que `options` no se lea como un id.
 */
@ApiTags("audit")
@Controller("audit")
export class AuditReadController {
    /** La sesion sale de la cookie. Quien puede leer lo decide el servicio, con el deny incluido. */
    constructor(@Inject(AuditReadService) private readonly audit: AuditReadService) {}
    /** Menu estatico. No descarga eventos. */
    @Get("options")
    @RouteSecurity("permission")
    @RequirePermission({ kind: "audit" })
    @ApiOperation({ summary: "Consultar módulos y secciones de auditoría." })
    options(@Req() request: CookieRequest) {
        return this.audit.options(request.cookies[SESSION_COOKIE_NAME]);
    }

    /** Historia del lead solo con evidencia nativa. No consulta la base vieja. */
    @Get("records/:recordId/timeline")
    @RouteSecurity("permission")
    @RequirePermission({ kind: "audit" })
    @ApiOperation({ summary: "Consultar historia unificada de un expediente de lead." })
    leadTimeline(@Req() request: CookieRequest, @Param("recordId") recordId: string, @Query() query: Record<string, string>) {
        return this.audit.leadTimeline(request.cookies[SESSION_COOKIE_NAME], recordId, query);
    }
    /** El detalle usa el mismo permiso que la lista. No es una segunda autorizacion mas laxa. */
    @Get(":publicId")
    @RouteSecurity("permission")
    @RequirePermission({ kind: "audit" })
    @ApiOperation({ summary: "Consultar detalle seguro y cambios registrados de un evento." })
    detail(@Req() request: CookieRequest, @Param("publicId") publicId: string) {
        return this.audit.detail(request.cookies[SESSION_COOKIE_NAME], publicId);
    }
    /** Alcance obligatorio, cursor validado y pagina acotada. Un campo de mas en el query se rechaza. */
    @Get()
    @RouteSecurity("permission")
    @RequirePermission({ kind: "audit" })
    @ApiOperation({ summary: "Consultar una página de auditoría por módulo y sección." })
    list(@Req() request: CookieRequest, @Query(new ValidationPipe({ expectedType: AuditQueryDto, transform: true, whitelist: true, forbidNonWhitelisted: true })) query: AuditQueryDto) {
        return this.audit.list(request.cookies[SESSION_COOKIE_NAME], query);
    }
}
