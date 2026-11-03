import { BadRequestException, Body, Controller, Header, HttpCode, Inject, Logger, Post } from "@nestjs/common";

import { LocalServiceToken } from "../../common/security/local-service-token.guard.js";
import { RouteSecurity } from "../../common/security/route-security.decorator.js";
import { persistedOrderEvent, receiptOrderEvent } from "./netsuite-order-event.contract.js";
import { NetsuiteOrderEventService } from "./netsuite-order-event.service.js";

/** Receptor Sandbox: v1 solo recepcion; v2 persistencia durable explicita. */
@Controller("integrations/netsuite/local")
export class NetsuiteLocalEventsController {
    private readonly logger = new Logger(NetsuiteLocalEventsController.name);
    /** El pool y el escritor se resuelven mediante DI; v1 conserva su contrato sin escrituras. */
    constructor(@Inject(NetsuiteOrderEventService) private readonly service: NetsuiteOrderEventService) {}
    /** Valida el sobre antes de delegar cualquier escritura. */
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
        // Metadata only: no customer data, full snapshot or credentials in application logs.
        this.logger.log({ event: "netsuite_local_order_received", netsuiteId: event.netsuiteId, eventType: event.eventType, observedAt: event.observedAt, fields: Object.keys(snapshot.data.fields).length, itemLines: snapshot.data.sublists.item.length, persisted: false });
        return { schemaVersion: 1, received: true, persisted: false, netsuiteId: event.netsuiteId };
    }
}
