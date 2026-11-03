import { describe, expect, it } from "vitest";

import { CALENDAR_EVENT_TYPES, calendarEventTypesSchema, findCalendarEventType } from "../../src/modules/crm/calendar/calendar-event-types.catalog.js";

const definition = { codigo: "nuevo_tipo", tipo: "Nuevo tipo", color: "#123456", modulos: ["formalizacion"] };
describe("global event type configuration", () => {
    it("contains the requested stable codes and order", () => {
        expect(CALENDAR_EVENT_TYPES.map((type) => type.codigo)).toEqual(["tarea", "reunion", "cita", "seguimiento", "formalizacion_bancaria", "adendum"]);
    });
    it("restricts the five Formalización types without changing other modules", () => {
        expect(
            CALENDAR_EVENT_TYPES.filter((type) => type.modulos.some((module) => module === "formalizacion"))
                .map((type) => type.codigo)
                .sort(),
        ).toEqual(["adendum", "formalizacion_bancaria", "reunion", "seguimiento", "tarea"]);
        for (const module of ["ventas", "mercadeo", "contabilidad"]) {
            expect(CALENDAR_EVENT_TYPES.filter((type) => type.modulos.some((allowed) => allowed === module)).map((type) => type.codigo)).toEqual(["tarea", "reunion", "cita", "seguimiento"]);
        }
    });
    it("uses a single color for each type in all its configured modules", () => {
        for (const type of CALENDAR_EVENT_TYPES) for (const module of type.modulos) expect(findCalendarEventType(type.codigo, module)?.color).toBe(type.color);
    });
    it("fails closed for unavailable types and modules, including historical general", () => {
        expect(findCalendarEventType("general", "formalizacion")).toBeUndefined();
        expect(findCalendarEventType("reunion", "sistemas")).toBeUndefined();
    });
    it("permits a future type restricted to one module", () => {
        expect(calendarEventTypesSchema.parse([definition])[0]?.modulos).toEqual(["formalizacion"]);
    });
    it.each([[{ ...definition, color: "#5656523" }], [{ ...definition, modulos: ["Formalización"] }], [{ ...definition, modulos: ["formalizacion", "formalizacion"] }], [{ ...definition, modulos: [] }], [{ ...definition, tipo: " " }], [definition, definition]].map((entries) => ({ entries })))("rejects invalid or ambiguous definitions %j", ({ entries }) => {
        expect(calendarEventTypesSchema.safeParse(entries).success).toBe(false);
    });
});
