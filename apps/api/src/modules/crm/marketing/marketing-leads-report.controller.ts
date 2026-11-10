import { Controller, Get, Header, Inject, Query, Req } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";

import type { CookieRequest } from "../../../common/security/cookie-request.type.js";
import { SESSION_COOKIE_NAME } from "../../../common/security/http-security.constants.js";
import { RequirePermission } from "../../../common/security/require-permission.decorator.js";
import { RouteSecurity } from "../../../common/security/route-security.decorator.js";
import { MarketingLeadsReportService } from "./marketing-leads-report.service.js";

/**
 * Reporte de captación. La cookie identifica la sesión y la respuesta no se cachea.
 * El permiso de ruta es `mercadeo.leads.read`. El del inicio es otro y no abre esta consulta.
 */
@ApiTags("Marketing")
@Controller("marketing/leads")
export class MarketingLeadsReportController {
    /** Inyección explícita. El servicio vuelve a evaluar el permiso efectivo. */
    constructor(@Inject(MarketingLeadsReportService) private readonly service: MarketingLeadsReportService) {}
    /** Lee cohortes de leads captados. Lo nativo manda y la evidencia vieja entra solo si su puerto está activo. */
    @Get("report")
    @RouteSecurity("permission")
    @RequirePermission({ kind: "all", codes: ["mercadeo.leads.read"] })
    @Header("Cache-Control", "no-store")
    @ApiOperation({ summary: "Read captured lead cohorts by date, seller, project, campaign and ad" })
    report(@Req() request: CookieRequest, @Query() query: Record<string, string>) {
        return this.service.report(request.cookies[SESSION_COOKIE_NAME], query);
    }
}
