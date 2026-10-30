import { Controller, Get, Global, Header, Inject, Module, Param, Query, Req } from "@nestjs/common";

import type { CookieRequest } from "../../common/security/cookie-request.type.js";
import { SESSION_COOKIE_NAME } from "../../common/security/http-security.constants.js";
import { LocalServiceTokenGuard } from "../../common/security/local-service-token.guard.js";
import { RequirePermission } from "../../common/security/require-permission.decorator.js";
import { RouteSecurity } from "../../common/security/route-security.decorator.js";
import { IdentityModule } from "../../modules/crm/identity/identity.module.js";
import { FORMALIZATION_APPROVAL_ERP } from "../../modules/crm/sales/sales-orders/formalization-approval.port.js";
import { HomeSummaryRepository } from "../../modules/crm/sales/sales-orders/home-summary.repository.js";
import { OrderTimingRepository } from "../../modules/crm/sales/sales-orders/order-timing.repository.js";
import { NetsuiteLocalEventsController } from "./netsuite-local-events.controller.js";
import { NetsuiteOrderRepository } from "./netsuite-order.repository.js";
import { NetsuiteRestletClient } from "./netsuite-restlet.client.js";
import { NetsuiteSalesOrderService } from "./netsuite-sales-order.service.js";

/**
 *
 */
@Controller("formalization/orders")
export class NetsuiteSalesOrderController {
    /**
     *
     */
    constructor(@Inject(NetsuiteSalesOrderService) private readonly service: NetsuiteSalesOrderService) {}
    /**
     *
     */
    @Get(":source/:id/database")
    @RouteSecurity("permission")
    @RequirePermission({ kind: "formalization-order-read" })
    @Header("Cache-Control", "no-store")
    readDatabase(@Req() request: CookieRequest, @Param("source") source: string, @Param("id") id: string, @Query() query: unknown) {
        return this.service.readDatabase(request.cookies[SESSION_COOKIE_NAME], { source, id }, query);
    }
    /** Order audit is exposed only through the order's resource authorization. */
    @Get(":source/:id/history")
    @RouteSecurity("permission")
    @RequirePermission({ kind: "formalization-order-read" })
    @Header("Cache-Control", "no-store")
    readHistory(@Req() request: CookieRequest, @Param("source") source: string, @Param("id") id: string, @Query() query: unknown) {
        return this.service.readHistory(request.cookies[SESSION_COOKIE_NAME], { source, id }, query);
    }
    /** Provider read stays separate from the canonical database snapshot. */
    @Get(":source/:id/netsuite")
    @RouteSecurity("permission")
    @RequirePermission({ kind: "formalization-order-read" })
    @Header("Cache-Control", "no-store")
    read(@Req() request: CookieRequest, @Param("source") source: string, @Param("id") id: string) {
        return this.service.read(request.cookies[SESSION_COOKIE_NAME], { source, id });
    }
}
/**
 *
 */
@Global()
@Module({ exports: [FORMALIZATION_APPROVAL_ERP], imports: [IdentityModule], controllers: [NetsuiteSalesOrderController, NetsuiteLocalEventsController], providers: [LocalServiceTokenGuard, NetsuiteOrderRepository, NetsuiteRestletClient, { provide: FORMALIZATION_APPROVAL_ERP, useExisting: NetsuiteRestletClient }, NetsuiteSalesOrderService, OrderTimingRepository, HomeSummaryRepository] })
export class NetsuiteModule {}
