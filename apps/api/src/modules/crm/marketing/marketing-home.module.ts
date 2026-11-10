import { Controller, Get, Header, Inject, Module, Query, Req } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";

import type { CookieRequest } from "../../../common/security/cookie-request.type.js";
import { SESSION_COOKIE_NAME } from "../../../common/security/http-security.constants.js";
import { RequirePermission } from "../../../common/security/require-permission.decorator.js";
import { RouteSecurity } from "../../../common/security/route-security.decorator.js";
import { IdentityModule } from "../identity/identity.module.js";
import { MarketingHomeRepository } from "./marketing-home.repository.js";
import { MarketingHomeService } from "./marketing-home.service.js";
import { MarketingLeadsReportController } from "./marketing-leads-report.controller.js";
import { MarketingLeadsReportRepository } from "./marketing-leads-report.repository.js";
import { MarketingLeadsReportService } from "./marketing-leads-report.service.js";

/**
 * Inicio de Mercadeo. La cookie identifica la sesión y la respuesta no se cachea.
 * El permiso de ruta es `mercadeo.home.read`. El de captación es otro y no abre este resumen.
 */
@ApiTags("Marketing")
@Controller("marketing/home")
export class MarketingHomeController {
    /** Inyección explícita. El servicio vuelve a evaluar el permiso efectivo y el alcance. */
    constructor(@Inject(MarketingHomeService) private readonly service: MarketingHomeService) {}
    /** El periodo llega como texto. El servicio cierra la forma; un campo de más se rechaza. */
    @Get("summary")
    @RouteSecurity("permission")
    @RequirePermission({ kind: "all", codes: ["mercadeo.home.read"] })
    @Header("Cache-Control", "no-store")
    @ApiOperation({ summary: "Read native-first lead and appointment aggregates for Marketing Home" })
    summary(@Req() request: CookieRequest, @Query() query: Record<string, string>) {
        return this.service.summary(request.cookies[SESSION_COOKIE_NAME], query);
    }
}
/**
 * Identidad entra como dependencia. Este módulo no registra los lectores del CRM viejo y no exporta otro pool.
 * El inicio y la captación comparten el módulo, con permisos distintos.
 */
@Module({ imports: [IdentityModule], controllers: [MarketingHomeController, MarketingLeadsReportController], providers: [MarketingHomeRepository, MarketingHomeService, MarketingLeadsReportRepository, MarketingLeadsReportService] })
export class MarketingHomeModule {}
