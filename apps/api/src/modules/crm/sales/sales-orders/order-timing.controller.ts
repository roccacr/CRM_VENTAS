import { Controller, Get, Header, Inject, Param, Query, Req } from "@nestjs/common";

import type { CookieRequest } from "../../../../common/security/cookie-request.type.js";
import { SESSION_COOKIE_NAME } from "../../../../common/security/http-security.constants.js";
import { RequirePermission } from "../../../../common/security/require-permission.decorator.js";
import { RouteSecurity } from "../../../../common/security/route-security.decorator.js";
import { OrderTimingService } from "./order-timing.service.js";

/** Historia de solo lectura. Ni el GET ni la vista de tiempos registran entradas de estado inferidas. */
@Controller("formalization/orders")
export class OrderTimingController {
    /** El caso de uso es dueño de la autorización, la identidad del recurso y la página. */
    constructor(@Inject(OrderTimingService) private readonly service: OrderTimingService) {}
    /** Lista las visitas repetidas por separado y expone los totales del registro completo, sin depender del tamaño de página. */
    @Get(":source/:id/timing")
    @RouteSecurity("permission")
    @RequirePermission({ kind: "formalization-order-read" })
    @Header("Cache-Control", "no-store")
    read(@Req() request: CookieRequest, @Param("source") source: string, @Param("id") id: string, @Query() query: unknown) {
        return this.service.read(request.cookies[SESSION_COOKIE_NAME], { source, id }, query);
    }
}
