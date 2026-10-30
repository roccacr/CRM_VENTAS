import { z } from "zod";

import { CALENDAR_MODULES } from "./calendar.contract.js";
import definitions from "./calendar-event-types.json" with { type: "json" };

/** Configuration is validated before queries; malformed or duplicate definitions fail closed. */
export const calendarEventTypesSchema = z
    .array(
        z.strictObject({
            codigo: z.string().regex(/^[a-z][a-z0-9_]{0,79}$/),
            tipo: z.string().trim().min(1).max(250),
            color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
            modulos: z
                .array(z.enum(CALENDAR_MODULES))
                .min(1)
                .max(CALENDAR_MODULES.length)
                .refine((modules) => new Set(modules).size === modules.length, "Módulos duplicados"),
        }),
    )
    .min(1)
    .max(100)
    .refine((types) => new Set(types.map((type) => type.codigo)).size === types.length, "Códigos duplicados");

/** Single global definition. A module entry describes availability, never user authorization. */
export const CALENDAR_EVENT_TYPES = Object.freeze(calendarEventTypesSchema.parse(definitions).map((type) => Object.freeze({ ...type, modulos: Object.freeze(type.modulos) })));

/** Resolve only the exact configured type/module pair; historical types remain readable. */
export function findCalendarEventType(code: string, module: string) {
    return CALENDAR_EVENT_TYPES.find((type) => type.codigo === code && type.modulos.some((allowed) => allowed === module));
}
