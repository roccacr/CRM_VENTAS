import { BadRequestException, Body, Controller, Header, HttpCode, Inject, Post } from "@nestjs/common";

import { LocalServiceToken } from "../../common/security/local-service-token.guard.js";
import { RouteSecurity } from "../../common/security/route-security.decorator.js";
import { productionOrderEvent } from "./netsuite-order-event.contract.js";
import { NetsuiteOrderEventService } from "./netsuite-order-event.service.js";

/** Production only accepts durable v2 events from the bound NetSuite account. */
@Controller("integrations/netsuite/production")
export class NetsuiteProductionEventsController {
    /** Reuses the transactional v2 writer. */
    constructor(@Inject(NetsuiteOrderEventService) private readonly service: NetsuiteOrderEventService) {}
    /** Validates the production envelope before any durable operation. */
    @Post("order-events")
    @HttpCode(200)
    @Header("Cache-Control", "no-store")
    @RouteSecurity("public")
    @LocalServiceToken("production")
    receive(@Body() body: unknown) {
        const parsed = productionOrderEvent.safeParse(body);
        if (!parsed.success || Buffer.byteLength(JSON.stringify(parsed.data), "utf8") > 500000) throw new BadRequestException("Evento de orden de venta invalido.");
        return this.service.receive(parsed.data);
    }
}
