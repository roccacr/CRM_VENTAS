import { Controller, Get, Header, Inject, Query, Req } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";

import type { CookieRequest } from "../../../common/security/cookie-request.type.js";
import { SESSION_COOKIE_NAME } from "../../../common/security/http-security.constants.js";
import { RequirePermission } from "../../../common/security/require-permission.decorator.js";
import { RouteSecurity } from "../../../common/security/route-security.decorator.js";
import { MarketingLeadsReportService } from "./marketing-leads-report.service.js";

/** Protected acquisition report; Marketing Home's independent contract stays intact. */
@ApiTags("Marketing")
@Controller("marketing/leads")
export class MarketingLeadsReportController {
    /** Explicit injection supports the tsx/Vitest runtime. */
    constructor(@Inject(MarketingLeadsReportService) private readonly service: MarketingLeadsReportService) {}
    /** Read captured-lead cohorts with native authority and optional legacy evidence. */
    @Get("report")
    @RouteSecurity("permission")
    @RequirePermission({ kind: "all", codes: ["mercadeo.leads.read"] })
    @Header("Cache-Control", "no-store")
    @ApiOperation({ summary: "Read captured lead cohorts by date, seller, project, campaign and ad" })
    report(@Req() request: CookieRequest, @Query() query: Record<string, string>) {
        return this.service.report(request.cookies[SESSION_COOKIE_NAME], query);
    }
}
