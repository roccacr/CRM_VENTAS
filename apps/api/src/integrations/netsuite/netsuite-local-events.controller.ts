import { BadRequestException, Body, Controller, Header, HttpCode, Logger, Post } from "@nestjs/common";
import { z } from "zod";

import { LocalServiceToken } from "../../common/security/local-service-token.guard.js";
import { RouteSecurity } from "../../common/security/route-security.decorator.js";

const scalar = z.union([z.string().max(16000), z.number(), z.boolean(), z.null()]);
const values = z.record(z.string().max(150), scalar).refine((value) => Object.keys(value).length <= 300);
const orderEvent = z
    .strictObject({
        schemaVersion: z.literal(1),
        source: z.strictObject({ system: z.literal("netsuite"), accountId: z.literal("4552704_SB1"), environment: z.literal("sandbox") }),
        event: z.strictObject({ recordType: z.literal("salesorder"), netsuiteId: z.string().regex(/^[1-9][0-9]{0,14}$/), eventType: z.enum(["create", "edit", "xedit", "approve", "cancel", "reject"]), observedAt: z.iso.datetime() }),
        snapshot: z.strictObject({ ...Object.fromEntries(["MOTIVO_COMPRA", "Expediente", "UNIDAD", "cli", "Subsidaria", "Departamento", "Clase", "Ubi", "Oportunidad", "CREADO", "vendedor", "socio", "CAMPANA", "METODO_PAGO", "FONDOS", "MOTIVO_CANCE"].map((name) => [name, scalar.optional()])), status: z.literal(200), data: z.strictObject({ type: z.literal("salesorder"), id: z.string(), fields: values, sublists: z.strictObject({ item: z.array(values).max(1000) }) }) }),
    })
    .refine((value) => value.snapshot.data.id === value.event.netsuiteId);

/** Development receipt only. Does not mutate either DB or claim durable synchronization. */
@Controller("integrations/netsuite/local")
export class NetsuiteLocalEventsController {
    private readonly logger = new Logger(NetsuiteLocalEventsController.name);
    /** Acknowledges a validated snapshot without persisting customer information. */
    @Post("order-events")
    @HttpCode(200)
    @Header("Cache-Control", "no-store")
    @RouteSecurity("public")
    @LocalServiceToken()
    receive(@Body() body: unknown) {
        const parsed = orderEvent.safeParse(body);
        if (!parsed.success || JSON.stringify(parsed.data).length > 500000) throw new BadRequestException("Evento de orden de venta invalido.");
        const { event, snapshot } = parsed.data;
        // Metadata only: no customer data, full snapshot or credentials in application logs.
        this.logger.log({ event: "netsuite_local_order_received", netsuiteId: event.netsuiteId, eventType: event.eventType, observedAt: event.observedAt, fields: Object.keys(snapshot.data.fields).length, itemLines: snapshot.data.sublists.item.length, persisted: false });
        return { schemaVersion: 1, received: true, persisted: false, netsuiteId: event.netsuiteId };
    }
}
