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
 * Ficha de formalizacion. La sesion sale de la cookie. Sincronizar no acepta cuerpo:
 * el navegador no elige campos del proveedor. Importar responde 202 y queda en cola.
 * Los avisos son del usuario autenticado, no de un permiso de orden.
 */
@Controller("formalization/orders")
export class NetsuiteSalesOrderController {
    /** La ficha y la cola son distintas: una lee una orden ya abierta y la otra encola una extraccion. */
    constructor(
        @Inject(NetsuiteSalesOrderService) private readonly service: NetsuiteSalesOrderService,
        @Inject(NetsuiteOrderImportQueue) private readonly importQueue: NetsuiteOrderImportQueue,
    ) {}
    /** Foto de la base. No pide referencia ni credenciales de NetSuite. */
    @Get(":source/:id/database")
    @RouteSecurity("permission")
    @RequirePermission({ kind: "formalization-order-read" })
    @Header("Cache-Control", "no-store")
    readDatabase(@Req() request: CookieRequest, @Param("source") source: string, @Param("id") id: string, @Query() query: unknown) {
        return this.service.readDatabase(request.cookies[SESSION_COOKIE_NAME], { source, id }, query);
    }
    /** La bitacora solo sale con la autorizacion de esa orden. */
    @Get(":source/:id/history")
    @RouteSecurity("permission")
    @RequirePermission({ kind: "formalization-order-read" })
    @Header("Cache-Control", "no-store")
    readHistory(@Req() request: CookieRequest, @Param("source") source: string, @Param("id") id: string, @Query() query: unknown) {
        return this.service.readHistory(request.cookies[SESSION_COOKIE_NAME], { source, id }, query);
    }
    /** Entorno configurado y si la escritura manual esta disponible. No llama al proveedor. */
    @Get(":source/:id/netsuite/context")
    @RouteSecurity("permission")
    @RequirePermission({ kind: "formalization-order-read" })
    @Header("Cache-Control", "no-store")
    synchronizationContext(@Req() request: CookieRequest, @Param("source") source: string, @Param("id") id: string) {
        return this.service.synchronizationContext(request.cookies[SESSION_COOKIE_NAME], { source, id });
    }
    /** Cualquier campo en el cuerpo se rechaza. La sesion, el CSRF y el permiso de etapa corren antes de llamar al proveedor. */
    @Post(":source/:id/netsuite/sync")
    @RouteSecurity("permission")
    @RequirePermission({ kind: "all", codes: ["formalizacion.orders.read", "formalizacion.orders.stage.update"] })
    @Header("Cache-Control", "no-store")
    synchronize(@Req() request: CookieRequest, @Param("source") source: string, @Param("id") id: string, @Body() body: unknown) {
        if (body !== undefined && (body === null || typeof body !== "object" || Array.isArray(body) || Object.keys(body).length)) throw new BadRequestException("La sincronizacion no acepta datos del proveedor desde el navegador.");
        return this.service.synchronize(request.cookies[SESSION_COOKIE_NAME], { source, id });
    }
    /** La extraccion es distinta del webhook y de la sincronizacion de una orden ya abierta. 202 significa encolada, no importada. */
    @Post("netsuite/import")
    @HttpCode(202)
    @RouteSecurity("permission")
    @RequirePermission({ kind: "all", codes: ["formalizacion.orders.read", "formalizacion.orders.stage.update"] })
    @Header("Cache-Control", "no-store")
    importOrder(@Req() request: CookieRequest, @Body() body: unknown) {
        return this.importQueue.enqueue(request.cookies[SESSION_COOKIE_NAME], body);
    }
    /** Avisos del usuario de la sesion. No exige el permiso de una orden concreta. */
    @Get("netsuite/import/notices")
    @RouteSecurity("authenticated")
    @Header("Cache-Control", "no-store")
    importNotices(@Req() request: CookieRequest) {
        return this.importQueue.notices(request.cookies[SESSION_COOKIE_NAME]);
    }

    /** Solo marca leido. No reintenta la importacion. */
    @Post("netsuite/import/notices/:id/read")
    @RouteSecurity("authenticated")
    markImportNotice(@Req() request: CookieRequest, @Param("id") id: string) {
        return this.importQueue.markRead(request.cookies[SESSION_COOKIE_NAME], id);
    }

    /** La lectura del proveedor no es la foto de la base. Esta no se guarda en el navegador. */
    @Get(":source/:id/netsuite")
    @RouteSecurity("permission")
    @RequirePermission({ kind: "formalization-order-read" })
    @Header("Cache-Control", "no-store")
    read(@Req() request: CookieRequest, @Param("source") source: string, @Param("id") id: string) {
        return this.service.read(request.cookies[SESSION_COOKIE_NAME], { source, id });
    }
}
/** El puerto de aprobacion es el mismo cliente RESTlet. El repositorio sale de aqui para que otros modulos resuelvan la orden sin abrir otro pool. */
@Global()
@Module({
    exports: [FORMALIZATION_APPROVAL_ERP, NetsuiteOrderRepository],
    imports: [IdentityModule, AuditModule],
    controllers: [NetsuiteSalesOrderController, NetsuiteLocalEventsController, NetsuiteProductionEventsController],
    providers: [NetsuiteOrderImportQueue, NetsuiteOrderEventService, NetsuiteOrderEventRepository, LocalServiceTokenGuard, NetsuiteOrderRepository, NetsuiteRestletClient, { provide: FORMALIZATION_APPROVAL_ERP, useExisting: NetsuiteRestletClient }, NetsuiteSalesOrderService, OrderTimingRepository, HomeSummaryRepository],
})
export class NetsuiteModule {}
