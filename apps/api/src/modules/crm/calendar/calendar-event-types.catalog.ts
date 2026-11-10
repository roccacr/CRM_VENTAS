import { z } from "zod";

import { CALENDAR_MODULES } from "./calendar.contract.js";
import definitions from "./calendar-event-types.json" with { type: "json" };

/** El JSON se valida al cargar. Una definición mal formada o un código repetido impiden arrancar. No se inventa un tipo. */
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

/** Una sola definición global. Que un módulo aparezca aquí dice que el tipo se ofrece ahí, no que la persona pueda usarlo. */
export const CALENDAR_EVENT_TYPES = Object.freeze(calendarEventTypesSchema.parse(definitions).map((type) => Object.freeze({ ...type, modulos: Object.freeze(type.modulos) })));

/** Solo el par código y módulo que sigue en el catálogo. Un tipo que salió de la lista puede leerse como evento; editarlo se rechaza en otro punto. */
export function findCalendarEventType(code: string, module: string) {
    return CALENDAR_EVENT_TYPES.find((type) => type.codigo === code && type.modulos.some((allowed) => allowed === module));
}
