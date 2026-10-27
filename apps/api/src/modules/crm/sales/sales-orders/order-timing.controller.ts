import { Controller, Get, Header, Inject, Param, Query, Req } from "@nestjs/common";

import type { CookieRequest } from "../../../../common/security/cookie-request.type.js";
import { SESSION_COOKIE_NAME } from "../../../../common/security/http-security.constants.js";
import { RequirePermission } from "../../../../common/security/require-permission.decorator.js";
import { FORMALIZATION_STAGE_READ_PERMISSION } from "../../../../common/security/route-permission.js";
import { RouteSecurity } from "../../../../common/security/route-security.decorator.js";
import { OrderTimingService } from "./order-timing.service.js";

/** Read-only history; neither a GET nor the timing view records inferred state entries. */
@Controller("formalization/orders")
export class OrderTimingController {
    /** The use case owns authorization, resource identity and paging. */
    constructor(@Inject(OrderTimingService) private readonly service: OrderTimingService) {}
    /** Lists repeat visits separately and exposes full-record totals independent of page size. */
    @Get(":source/:id/timing")
    @RouteSecurity("permission")
    @RequirePermission({ kind: "active-role", code: "formalizacion", permissionCodes: [FORMALIZATION_STAGE_READ_PERMISSION] })
    @Header("Cache-Control", "no-store")
    read(@Req() request: CookieRequest, @Param("source") source: string, @Param("id") id: string, @Query() query: unknown) {
        return this.service.read(request.cookies[SESSION_COOKIE_NAME], { source, id }, query);
    }
}
