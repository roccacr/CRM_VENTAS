import { parseNumericBigintId } from "../../../src/common/ids/parse-numeric-bigint-id";

describe("parseNumericBigintId", () => {
    it("returns a bigint when the input only contains digits", () => {
        expect(parseNumericBigintId("123")).toBe(123n);
    });

    it("returns null when the input has letters or symbols", () => {
        expect(parseNumericBigintId("abc")).toBeNull();
        expect(parseNumericBigintId("12-3")).toBeNull();
    });

    it("returns null for blank values because route ids must be explicit", () => {
        expect(parseNumericBigintId("")).toBeNull();
        expect(parseNumericBigintId("   ")).toBeNull();
    });

    it("keeps large ids safe as bigint instead of number", () => {
        expect(parseNumericBigintId("90071992547409931234")).toBe(90071992547409931234n);
    });

    it.each(["-1", "+1", "12.3", "1e3", "0x10"])("returns null for signed, decimal or encoded id %s", (value) => {
        expect(parseNumericBigintId(value)).toBeNull();
    });

    it("trims surrounding whitespace and keeps leading zeros as the numeric value", () => {
        expect(parseNumericBigintId("  42  ")).toBe(42n);
        expect(parseNumericBigintId("0123")).toBe(123n);
        expect(parseNumericBigintId("0")).toBe(0n);
    });
});
