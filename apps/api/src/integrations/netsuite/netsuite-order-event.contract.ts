import { z } from "zod";

const scalar = z.union([z.string().max(16000), z.number(), z.boolean(), z.null()]);
const values = z.record(z.string().max(150), scalar).refine((value) => Object.keys(value).length <= 300);
export const receiptOrderEvent = z
    .strictObject({
        schemaVersion: z.literal(1),
        source: z.strictObject({ system: z.literal("netsuite"), accountId: z.literal("4552704_SB1"), environment: z.literal("sandbox") }),
        event: z.strictObject({ recordType: z.literal("salesorder"), netsuiteId: z.string().regex(/^[1-9][0-9]{0,14}$/), eventType: z.enum(["create", "edit", "xedit", "approve", "cancel", "reject"]), observedAt: z.iso.datetime() }),
        snapshot: z.strictObject({ ...Object.fromEntries(["MOTIVO_COMPRA", "Expediente", "UNIDAD", "cli", "Subsidaria", "Departamento", "Clase", "Ubi", "Oportunidad", "CREADO", "vendedor", "socio", "CAMPANA", "METODO_PAGO", "FONDOS", "MOTIVO_CANCE"].map((name) => [name, scalar.optional()])), status: z.literal(200), data: z.strictObject({ type: z.literal("salesorder"), id: z.string(), fields: values, sublists: z.strictObject({ item: z.array(values).max(1000) }) }) }),
    })
    .refine((value) => value.snapshot.data.id === value.event.netsuiteId);

/** La version 2 exige identidad estable para distinguir reenvios de nuevas ediciones. */
const persistedEnvelope = z.strictObject({ ...receiptOrderEvent.shape, schemaVersion: z.literal(2), event: z.strictObject({ recordType: z.literal("salesorder"), netsuiteId: z.string().regex(/^[1-9][0-9]{0,14}$/), eventType: z.enum(["create", "edit", "xedit", "approve", "cancel", "reject"]), observedAt: z.iso.datetime(), eventId: z.uuid(), sourceModifiedAt: z.iso.datetime(), snapshotReadStartedAt: z.iso.datetime().optional(), snapshotReadCompletedAt: z.iso.datetime().optional() }) });
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
/** Production keeps all v2 ordering/window checks and binds its own account. */
export const productionOrderEvent = persistedEnvelope
    .extend({ source: z.strictObject({ system: z.literal("netsuite"), accountId: z.literal("4552704"), environment: z.literal("production") }) })
    .refine((value) => value.snapshot.data.id === value.event.netsuiteId)
    .refine((value) => validWindow(value.event), { message: "Ventana de lectura invalida." })
    .refine((value) => value.snapshot.data.fields.crm_sync_projection !== 1 || value.event.snapshotReadStartedAt !== undefined, { message: "La proyeccion ampliada requiere ventana de lectura verificada." });
export type PersistedOrderEvent = z.infer<typeof persistedOrderEvent> | z.infer<typeof productionOrderEvent>;
