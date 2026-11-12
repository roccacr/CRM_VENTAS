import { randomUUID } from "node:crypto";

import { BadGatewayException } from "@nestjs/common";
import { z } from "zod";

const scalar = z.union([z.string().max(16000), z.number(), z.boolean(), z.null()]);
const values = z.record(z.string().max(150), scalar).refine((value) => Object.keys(value).length <= 300);
/** Sobre v1 de Sandbox, cuenta `4552704_SB1`. El id del snapshot tiene que ser el de la orden. No admite campos extra. */
export const receiptOrderEvent = z
    .strictObject({
        schemaVersion: z.literal(1),
        source: z.strictObject({ system: z.literal("netsuite"), accountId: z.literal("4552704_SB1"), environment: z.literal("sandbox") }),
        event: z.strictObject({ recordType: z.literal("salesorder"), netsuiteId: z.string().regex(/^[1-9][0-9]{0,14}$/), eventType: z.enum(["create", "edit", "xedit", "approve", "cancel", "reject"]), observedAt: z.iso.datetime() }),
        snapshot: z.strictObject({ ...Object.fromEntries(["MOTIVO_COMPRA", "Expediente", "UNIDAD", "cli", "Subsidaria", "Departamento", "Clase", "Ubi", "Oportunidad", "CREADO", "vendedor", "socio", "CAMPANA", "METODO_PAGO", "FONDOS", "MOTIVO_CANCE"].map((name) => [name, scalar.optional()])), status: z.literal(200), data: z.strictObject({ type: z.literal("salesorder"), id: z.string(), fields: values, sublists: z.strictObject({ item: z.array(values).max(1000) }) }) }),
    })
    .refine((value) => value.snapshot.data.id === value.event.netsuiteId);

/** v2 agrega `eventId`, la hora de modificacion y una ventana de lectura opcional. Las dos marcas van juntas o no van. */
const persistedEnvelope = z.strictObject({ ...receiptOrderEvent.shape, schemaVersion: z.literal(2), event: z.strictObject({ recordType: z.literal("salesorder"), netsuiteId: z.string().regex(/^[1-9][0-9]{0,14}$/), eventType: z.enum(["create", "edit", "xedit", "approve", "cancel", "reject"]), observedAt: z.iso.datetime(), eventId: z.uuid(), sourceModifiedAt: z.iso.datetime(), snapshotReadStartedAt: z.iso.datetime().optional(), snapshotReadCompletedAt: z.iso.datetime().optional() }) });
/** La ventana, si viene, dura entre 0 y 60 segundos. Una sola marca no alcanza. */
function validWindow(event: z.infer<typeof persistedEnvelope>["event"]): boolean {
    if (event.snapshotReadStartedAt === undefined) return event.snapshotReadCompletedAt === undefined;
    if (event.snapshotReadCompletedAt === undefined) return false;
    const duration = Date.parse(event.snapshotReadCompletedAt) - Date.parse(event.snapshotReadStartedAt);
    return duration >= 0 && duration <= 60000;
}
export const persistedOrderEvent = persistedEnvelope
    .refine((value) => value.snapshot.data.id === value.event.netsuiteId)
    .refine((value) => validWindow(value.event), { message: "Ventana de lectura invalida." })
    .refine((value) => value.snapshot.data.fields.crm_sync_projection !== 1 || value.event.snapshotReadStartedAt !== undefined, { message: "La proyeccion ampliada requiere ventana de lectura verificada." });
/** Produccion repite las reglas de v2 y ata la cuenta `4552704`. No acepta el sobre de Sandbox. */
export const productionOrderEvent = persistedEnvelope
    .extend({ source: z.strictObject({ system: z.literal("netsuite"), accountId: z.literal("4552704"), environment: z.literal("production") }) })
    .refine((value) => value.snapshot.data.id === value.event.netsuiteId)
    .refine((value) => validWindow(value.event), { message: "Ventana de lectura invalida." })
    .refine((value) => value.snapshot.data.fields.crm_sync_projection !== 1 || value.event.snapshotReadStartedAt !== undefined, { message: "La proyeccion ampliada requiere ventana de lectura verificada." });
export type PersistedOrderEvent = z.infer<typeof persistedOrderEvent> | z.infer<typeof productionOrderEvent>;

/** La sincronización manual y la recuperación operativa comparten identidad, ventana y validación del snapshot fresco. */
export function verifiedOrderEventFromSnapshot(raw: unknown, netsuiteId: string, context: { environment: "production" | "sandbox"; accountId: string }): PersistedOrderEvent {
    const metadata = z.looseObject({ sourceModifiedAt: z.iso.datetime(), snapshotReadStartedAt: z.iso.datetime(), snapshotReadCompletedAt: z.iso.datetime() }).safeParse(raw);
    if (!metadata.success) throw new BadGatewayException("Actualiza la libreria NetSuite: no devolvio una lectura verificada para sincronizar.");
    const { sourceModifiedAt, snapshotReadStartedAt, snapshotReadCompletedAt, ...snapshot } = metadata.data;
    const envelope = { schemaVersion: 2, source: { system: "netsuite", ...context }, event: { recordType: "salesorder", netsuiteId, eventType: "edit", eventId: randomUUID(), observedAt: new Date().toISOString(), sourceModifiedAt, snapshotReadStartedAt, snapshotReadCompletedAt }, snapshot };
    const parsed = (context.environment === "production" ? productionOrderEvent : persistedOrderEvent).safeParse(envelope);
    if (!parsed.success || parsed.data.snapshot.data.fields.crm_sync_projection !== 1) throw new BadGatewayException("NetSuite no devolvio la proyeccion completa y valida de esta orden.");
    return parsed.data;
}
