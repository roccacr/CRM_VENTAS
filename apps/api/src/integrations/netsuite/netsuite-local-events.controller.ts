import { BadRequestException, Body, Controller, Header, HttpCode, Inject, Logger, Post } from "@nestjs/common";

import { LocalServiceToken } from "../../common/security/local-service-token.guard.js";
import { RouteSecurity } from "../../common/security/route-security.decorator.js";
import { persistedOrderEvent, receiptOrderEvent } from "./netsuite-order-event.contract.js";
import { NetsuiteOrderEventService } from "./netsuite-order-event.service.js";

/**
 * Receptor Sandbox. `public` omite la sesion; el token de servicio es la prueba.
 * v2 se intenta primero y puede persistir. v1 solo acusa recibo y no escribe.
 * El tope de 500000 bytes se mide sobre el JSON ya validado. El log guarda
 * conteos, no el snapshot ni datos del cliente.
 */
@Controller("integrations/netsuite/local")
export class NetsuiteLocalEventsController {
    private readonly logger = new Logger(NetsuiteLocalEventsController.name);
    /** v1 no tiene escritor. La respuesta 200 y `no-store` no equivalen a un cambio comercial. */
    constructor(@Inject(NetsuiteOrderEventService) private readonly service: NetsuiteOrderEventService) {}
    /** Un sobre v2 invalido no cae en silencio a v1 si la forma v1 tampoco cierra. */
    @Post("order-events")
    @HttpCode(200)
    @Header("Cache-Control", "no-store")
    @RouteSecurity("public")
    @LocalServiceToken()
    receive(@Body() body: unknown) {
        const durable = persistedOrderEvent.safeParse(body);
        if (durable.success) {
            if (Buffer.byteLength(JSON.stringify(durable.data), "utf8") > 500000) throw new BadRequestException("Evento demasiado grande.");
            return this.service.receive(durable.data);
        }
        const parsed = receiptOrderEvent.safeParse(body);
        if (!parsed.success || Buffer.byteLength(JSON.stringify(parsed.data), "utf8") > 500000) throw new BadRequestException("Evento de orden de venta invalido.");
        const { event, snapshot } = parsed.data;
        // Solo metadatos. El snapshot, el cliente y las credenciales no entran al log.
        this.logger.log({ event: "netsuite_local_order_received", netsuiteId: event.netsuiteId, eventType: event.eventType, observedAt: event.observedAt, fields: Object.keys(snapshot.data.fields).length, itemLines: snapshot.data.sublists.item.length, persisted: false });
        return { schemaVersion: 1, received: true, persisted: false, netsuiteId: event.netsuiteId };
    }
}
