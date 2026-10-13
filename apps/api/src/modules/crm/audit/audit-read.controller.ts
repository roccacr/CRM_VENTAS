import { Controller, Get, Inject, Param, Query, Req, ValidationPipe } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";

import type { CookieRequest } from "../../../common/security/cookie-request.type.js";
import { SESSION_COOKIE_NAME } from "../../../common/security/http-security.constants.js";
import { AuditQueryDto } from "./audit-read.contract.js";
import { AuditReadService } from "./audit-read.service.js";

/** Scoped audit reads only: no mutation or unbounded export endpoint. */
@ApiTags("audit")
@Controller("audit")
export class AuditReadController {
    /** Auth and query ownership are delegated to the dedicated read service. */
    constructor(@Inject(AuditReadService) private readonly audit: AuditReadService) {}
    /** Load navigation choices without downloading audit history. */
    @Get("options")
    @ApiOperation({ summary: "Consultar módulos y secciones de auditoría." })
    options(@Req() request: CookieRequest) {
        return this.audit.options(request.cookies[SESSION_COOKIE_NAME]);
    }
    /** Lazy immutable detail with the same session and permission checks as the list. */
    @Get(":publicId")
    @ApiOperation({ summary: "Consultar detalle seguro y cambios registrados de un evento." })
    detail(@Req() request: CookieRequest, @Param("publicId") publicId: string) {
        return this.audit.detail(request.cookies[SESSION_COOKIE_NAME], publicId);
    }
    /** Required scope, validated cursor and bounded batch size. */
    @Get()
    @ApiOperation({ summary: "Consultar una página de auditoría por módulo y sección." })
    list(@Req() request: CookieRequest, @Query(new ValidationPipe({ expectedType: AuditQueryDto, transform: true, whitelist: true, forbidNonWhitelisted: true })) query: AuditQueryDto) {
        return this.audit.list(request.cookies[SESSION_COOKIE_NAME], query);
    }
}
