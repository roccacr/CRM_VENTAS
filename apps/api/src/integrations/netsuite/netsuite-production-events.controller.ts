import { BadRequestException, Body, Controller, Header, HttpCode, Inject, Post } from "@nestjs/common";

import { LocalServiceToken } from "../../common/security/local-service-token.guard.js";
import { RouteSecurity } from "../../common/security/route-security.decorator.js";
import { productionOrderEvent } from "./netsuite-order-event.contract.js";
import { NetsuiteOrderEventService } from "./netsuite-order-event.service.js";

/**
 * Receptor de produccion. Solo el sobre v2 de la cuenta `4552704`.
 * `public` omite la sesion; el token de servicio de produccion es la prueba.
 * No hay camino v1. La respuesta no se guarda.
 */
@Controller("integrations/netsuite/production")
export class NetsuiteProductionEventsController {
    /** El mismo escritor que Sandbox. La cuenta la fija el sobre, no el llamador. */
    constructor(@Inject(NetsuiteOrderEventService) private readonly service: NetsuiteOrderEventService) {}
    /** El tope de 500000 bytes se mide sobre el JSON ya validado. Un sobre de Sandbox no entra. */
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
