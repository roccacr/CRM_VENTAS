import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { normalizeCaseInsensitiveIdentifier, transformCaseInsensitiveIdentifier } from "../../src/common/security/identifier-normalization.js";
import { earliestDate, hasUpdatedRows } from "../../src/modules/crm/identity/identity-repository.shared.js";

describe("hasUpdatedRows", () => {
    it.each([
        [undefined, false],
        [{}, false],
        [{ numUpdatedRows: 0 }, false],
        [{ numUpdatedRows: 0n }, false],
        [{ numUpdatedRows: -1 }, false],
        [{ numUpdatedRows: Number.NaN }, false],
        [{ numUpdatedRows: 1 }, true],
        [{ numUpdatedRows: 1n }, true],
        [{ numUpdatedRows: 9_007_199_254_740_993n }, true],
    ])("%# %o -> %s", (result, expected) => {
        expect(hasUpdatedRows(result)).toBe(expected);
    });
});

describe("earliestDate", () => {
    it("returns the earlier date and keeps the first on a tie", () => {
        const a = new Date("2026-01-01T00:00:00Z");
        const b = new Date("2026-01-02T00:00:00Z");
        expect(earliestDate(a, b)).toBe(a);
        expect(earliestDate(b, a)).toBe(a);
        const tie = new Date(a.getTime());
        expect(earliestDate(a, tie)).toBe(a);
    });

    it("property: never returns a date later than either input (session window cannot be extended)", () => {
        fc.assert(
            fc.property(fc.date({ noInvalidDate: true }), fc.date({ noInvalidDate: true }), (x, y) => {
                expect(earliestDate(x, y).getTime()).toBe(Math.min(x.getTime(), y.getTime()));
            }),
        );
    });
});

describe("identifier normalization", () => {
    it("trims and lowercases", () => {
        expect(normalizeCaseInsensitiveIdentifier("  User@Example.COM \t")).toBe("user@example.com");
    });

    it("property: idempotent and never throws for any unicode string", () => {
        fc.assert(
            fc.property(fc.string({ unit: "binary" }), (value) => {
                const once = normalizeCaseInsensitiveIdentifier(value);
                expect(normalizeCaseInsensitiveIdentifier(once)).toBe(once);
            }),
            { numRuns: 1000 },
        );
    });

    it.each([null, undefined, 42, true, {}, [], ["A@B.com"]])("class-transformer adapter passes non-strings through untouched: %j", (value) => {
        expect(transformCaseInsensitiveIdentifier({ value })).toBe(value);
    });

    it("class-transformer adapter normalizes strings", () => {
        expect(transformCaseInsensitiveIdentifier({ value: " A@B.com " })).toBe("a@b.com");
    });
});
