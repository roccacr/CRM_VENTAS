import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { aggregateNumber } from "../../src/modules/crm/sales/sales-orders/home-summary.types.js";
import { timingPerson } from "../../src/modules/crm/sales/sales-orders/order-timing.contract.js";

describe("aggregateNumber (propiedades)", () => {
    it("acepta enteros seguros no negativos, como número o como cadena decimal canónica", () => {
        fc.assert(
            fc.property(fc.integer({ min: 0, max: Number.MAX_SAFE_INTEGER }), (n) => {
                expect(aggregateNumber(n)).toBe(n);
                expect(aggregateNumber(String(n))).toBe(n);
            }),
        );
    });

    it("NULL cuenta como 0", () => {
        expect(aggregateNumber(null)).toBe(0);
    });

    it("rechaza negativos, decimales, NaN e infinitos", () => {
        fc.assert(
            fc.property(fc.oneof(fc.integer({ min: -1_000_000, max: -1 }), fc.double({ noInteger: true, noNaN: true, noDefaultInfinity: true }), fc.constantFrom(Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, Number.MAX_SAFE_INTEGER + 1)), (value) => {
                expect(() => aggregateNumber(value)).toThrow("Invalid Home aggregate count");
            }),
        );
    });

    it.each(["", " 1", "1 ", "01", "00", "-1", "+1", "1.0", "1e3", "0x10", "９", "1,000", "NaN", "Infinity", "' OR 1=1--", "9007199254740993", "99999999999999999999"])("rechaza la cadena no canónica o con pérdida de precisión %j", (value) => {
        expect(() => aggregateNumber(value)).toThrow("Invalid Home aggregate count");
    });
});

describe("timingPerson (propiedades)", () => {
    it("con objetos arbitrarios nunca lanza y devuelve null o una persona con nombre", () => {
        fc.assert(
            fc.property(fc.anything(), fc.anything(), (snapshot, reference) => {
                fc.pre(typeof snapshot !== "string");
                const person = timingPerson(snapshot, reference);
                if (person !== null) expect(person.name.length).toBeGreaterThan(0);
            }),
            { numRuns: 1000 },
        );
    });

    it("sin nombre ni id no atribuye a nadie", () => {
        expect(timingPerson({}, null)).toBeNull();
        expect(timingPerson({ name: "   " }, "otra-cosa")).toBeNull();
    });

    it("una referencia que no es de CRM_THINK_V2 no se usa como id", () => {
        expect(timingPerson({ name: "Ana" }, "LEGACY:99")).toEqual({ id: null, name: "Ana" });
        expect(timingPerson(null, "CRM_THINK_V2:01ABC")).toEqual({ id: "01ABC", name: "Nombre histórico no registrado" });
    });

    it("el snapshot gana sobre la referencia", () => {
        expect(timingPerson({ publicId: "P1", name: "Ana" }, "CRM_THINK_V2:P2")).toEqual({ id: "P1", name: "Ana" });
    });

    it("un snapshot JSON en texto malformado no debe tumbar la lectura del historial", () => {
        expect(() => timingPerson("{not json", null)).not.toThrow();
    });
});
