import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { mapReservationApplied } from "../../src/integrations/netsuite/netsuite-order-event.mapper.js";

describe("Reserva Aplicada: proyección exclusiva", () => {
    it.each([true, "T"])("interpreta %s como reserva confirmada", (value) => {
        expect(mapReservationApplied({ custbody209: value }, "native", {})).toEqual([{ field: "custbody209", column: "reservation_applied_sales_order", before: null, after: "yes" }]);
        expect(mapReservationApplied({ custbody209: value }, "legacy", {})).toEqual([{ field: "custbody209", column: "reserva_ov", before: null, after: 1 }]);
    });
    it.each([false, "F"])("interpreta %s como reserva no aplicada", (value) => {
        expect(mapReservationApplied({ custbody209: value }, "native", {})[0]?.after).toBe("no");
        expect(mapReservationApplied({ custbody209: value }, "legacy", {})[0]?.after).toBe(0);
    });
    it("conserva el dato si el productor anterior no manda el campo", () => {
        expect(mapReservationApplied({}, "native", { reservation_applied_sales_order: "yes" })).toEqual([]);
    });
    it("repetir la misma observación no genera cambios", () => {
        expect(mapReservationApplied({ custbody209: "F", custbody43: true }, "native", { reservation_applied_sales_order: "no", cancelled_sales_order: "no" })).toEqual([]);
    });
    it("la reserva legacy existente manda aunque la columna añadida tenga otro valor", () => {
        expect(mapReservationApplied({ custbody209: "T" }, "legacy", { reserva_ov: 1, reserva_aplicada_ov: 0 })).toEqual([]);
        expect(mapReservationApplied({ custbody209: "F" }, "legacy", { reserva_ov: 1, reserva_aplicada_ov: 0 })).toEqual([{ field: "custbody209", column: "reserva_ov", before: 1, after: 0 }]);
        expect(mapReservationApplied({ custbody209: "T" }, "legacy", { reserva_ov: 0, reserva_aplicada_ov: 1 })).toEqual([{ field: "custbody209", column: "reserva_ov", before: 0, after: 1 }]);
        expect(mapReservationApplied({}, "legacy", { reserva_ov: 1 })).toEqual([]);
    });
    it.each([null, "", "false", 0, 1, {}, []])("rechaza un checkbox ambiguo %j", (value) => {
        expect(() => mapReservationApplied({ custbody209: value }, "native", {})).toThrow();
    });
    it("propiedad: el diff toca exclusivamente Reserva Aplicada y es idempotente", () => {
        fc.assert(
            fc.property(fc.boolean(), fc.constantFrom("native" as const, "legacy" as const), fc.jsonValue(), (value, destination, unrelated) => {
                const changes = mapReservationApplied({ custbody209: value, unrelated }, destination, { unrelated });
                expect(changes).toHaveLength(1);
                const change = changes[0];
                if (!change) throw new Error("Falta el diff de reserva.");
                expect(mapReservationApplied({ custbody209: value }, destination, { [change.column]: change.after, unrelated })).toEqual([]);
                expect(change.field).toBe("custbody209");
                expect(change.column).toBe(destination === "native" ? "reservation_applied_sales_order" : "reserva_ov");
            }),
            { seed: 209, numRuns: 200 },
        );
    });
    it("fuzz: otros valores JSON no se convierten con truthiness", () => {
        fc.assert(
            fc.property(
                fc.jsonValue().filter((value) => ![true, false, "T", "F"].includes(value as boolean | string)),
                (value) => {
                    expect(() => mapReservationApplied({ custbody209: value }, "native", {})).toThrow();
                },
            ),
            { seed: 209, numRuns: 200 },
        );
    });
});
