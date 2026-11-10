import { HttpCode } from "@nestjs/common";
import { BadRequestException, Body, Controller, Get, Global, Header, Inject, Module, Param, Post, Query, Req } from "@nestjs/common";

import type { CookieRequest } from "../../common/security/cookie-request.type.js";
import { SESSION_COOKIE_NAME } from "../../common/security/http-security.constants.js";
import { LocalServiceTokenGuard } from "../../common/security/local-service-token.guard.js";
import { RequirePermission } from "../../common/security/require-permission.decorator.js";
import { RouteSecurity } from "../../common/security/route-security.decorator.js";
import { AuditModule } from "../../modules/crm/audit/audit.module.js";
import { IdentityModule } from "../../modules/crm/identity/identity.module.js";
import { FORMALIZATION_APPROVAL_ERP } from "../../modules/crm/sales/sales-orders/formalization-approval.port.js";
import { HomeSummaryRepository } from "../../modules/crm/sales/sales-orders/home-summary.repository.js";
import { OrderTimingRepository } from "../../modules/crm/sales/sales-orders/order-timing.repository.js";
import { NetsuiteLocalEventsController } from "./netsuite-local-events.controller.js";
import { NetsuiteOrderRepository } from "./netsuite-order.repository.js";
import { NetsuiteOrderEventRepository } from "./netsuite-order-event.repository.js";
import { NetsuiteOrderEventService } from "./netsuite-order-event.service.js";
import { NetsuiteOrderImportQueue } from "./netsuite-order-import.queue.js";
import { NetsuiteProductionEventsController } from "./netsuite-production-events.controller.js";
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
    constructor(
        @Inject(NetsuiteSalesOrderService) private readonly service: NetsuiteSalesOrderService,
        @Inject(NetsuiteOrderImportQueue) private readonly importQueue: NetsuiteOrderImportQueue,
    ) {}
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
    /** Returns the configured ERP environment and manual-write availability. */
    @Get(":source/:id/netsuite/context")
    @RouteSecurity("permission")
    @RequirePermission({ kind: "formalization-order-read" })
    @Header("Cache-Control", "no-store")
    synchronizationContext(@Req() request: CookieRequest, @Param("source") source: string, @Param("id") id: string) {
        return this.service.synchronizationContext(request.cookies[SESSION_COOKIE_NAME], { source, id });
    }
    /** Session, CSRF and independent mutation permission are enforced before any provider call. */
    @Post(":source/:id/netsuite/sync")
    @RouteSecurity("permission")
    @RequirePermission({ kind: "all", codes: ["formalizacion.orders.read", "formalizacion.orders.stage.update"] })
    @Header("Cache-Control", "no-store")
    synchronize(@Req() request: CookieRequest, @Param("source") source: string, @Param("id") id: string, @Body() body: unknown) {
        if (body !== undefined && (body === null || typeof body !== "object" || Array.isArray(body) || Object.keys(body).length)) throw new BadRequestException("La sincronizacion no acepta datos del proveedor desde el navegador.");
        return this.service.synchronize(request.cookies[SESSION_COOKIE_NAME], { source, id });
    }
    /** Explicit import is separate from the webhook and manual updates. */
    @Post("netsuite/import")
    @HttpCode(202)
    @RouteSecurity("permission")
    @RequirePermission({ kind: "all", codes: ["formalizacion.orders.read", "formalizacion.orders.stage.update"] })
    @Header("Cache-Control", "no-store")
    importOrder(@Req() request: CookieRequest, @Body() body: unknown) {
        return this.importQueue.enqueue(request.cookies[SESSION_COOKIE_NAME], body);
    }
    /**
     *
     */
    @Get("netsuite/import/notices")
    @RouteSecurity("authenticated")
    @Header("Cache-Control", "no-store")
    importNotices(@Req() request: CookieRequest) {
        return this.importQueue.notices(request.cookies[SESSION_COOKIE_NAME]);
    }

    /**
     *
     */
    @Post("netsuite/import/notices/:id/read")
    @RouteSecurity("authenticated")
    markImportNotice(@Req() request: CookieRequest, @Param("id") id: string) {
        return this.importQueue.markRead(request.cookies[SESSION_COOKIE_NAME], id);
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
@Module({
    exports: [FORMALIZATION_APPROVAL_ERP, NetsuiteOrderRepository],
    imports: [IdentityModule, AuditModule],
    controllers: [NetsuiteSalesOrderController, NetsuiteLocalEventsController, NetsuiteProductionEventsController],
    providers: [NetsuiteOrderImportQueue, NetsuiteOrderEventService, NetsuiteOrderEventRepository, LocalServiceTokenGuard, NetsuiteOrderRepository, NetsuiteRestletClient, { provide: FORMALIZATION_APPROVAL_ERP, useExisting: NetsuiteRestletClient }, NetsuiteSalesOrderService, OrderTimingRepository, HomeSummaryRepository],
})
export class NetsuiteModule {}
