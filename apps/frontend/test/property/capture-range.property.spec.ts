import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { validateCaptureRange } from "../../src/modules/marketing/capture-time-groups";

const day = fc.date({ min: new Date("2000-01-01T00:00:00Z"), max: new Date("2099-12-31T00:00:00Z"), noInvalidDate: true }).map((d) => d.toISOString().slice(0, 10));
const junk = fc.oneof(fc.string(), fc.string({ unit: "binary" }), fc.constantFrom("", "2026-02-30", "2026-13-01", "2026-1-1", "2026-01-01T00:00:00Z", " 2026-01-01", "0000-00-00", "9999-99-99", "NaN", "' OR 1=1--"));

describe("validateCaptureRange (propiedades)", () => {
    it("nunca lanza y siempre responde null o un mensaje, con entradas hostiles", () => {
        fc.assert(
            fc.property(junk, junk, junk, (from, to, today) => {
                const result = validateCaptureRange({ from, to }, today);
                expect(result === null || typeof result === "string").toBe(true);
            }),
            { numRuns: 2000 },
        );
    });

    it("acepta exactamente los rangos ordenados que no pasan de hoy", () => {
        fc.assert(
            fc.property(day, day, day, (a, b, today) => {
                const [from, to] = a <= b ? [a, b] : [b, a];
                const result = validateCaptureRange({ from, to }, today);
                expect(result === null).toBe(to <= today);
            }),
            { numRuns: 1000 },
        );
    });

    it("un rango invertido siempre se rechaza", () => {
        fc.assert(
            fc.property(day, day, (a, b) => {
                fc.pre(a !== b);
                const [from, to] = a > b ? [a, b] : [b, a];
                expect(validateCaptureRange({ from, to }, "2099-12-31")).not.toBeNull();
            }),
        );
    });

    it.each(["2026-02-30", "2026-02-29", "2026-13-01", "2026-00-10", "2026-04-31"])("rechaza el día de calendario inexistente %s", (bad) => {
        expect(validateCaptureRange({ from: bad, to: "2026-12-31" }, "2026-12-31")).not.toBeNull();
        expect(validateCaptureRange({ from: "2026-01-01", to: bad }, "2026-12-31")).not.toBeNull();
    });

    it("acepta el 29 de febrero solo en años bisiestos", () => {
        expect(validateCaptureRange({ from: "2028-02-29", to: "2028-02-29" }, "2028-12-31")).toBeNull();
        expect(validateCaptureRange({ from: "2100-02-29", to: "2100-02-29" }, "2100-12-31")).not.toBeNull();
    });
});
