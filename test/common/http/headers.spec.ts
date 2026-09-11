import { firstHeaderValue, toNonEmptyHeader } from "../../../src/common/http/headers";

describe("firstHeaderValue", () => {
    it("returns the string when Express delivers a single value", () => {
        expect(firstHeaderValue("Bearer token")).toBe("Bearer token");
    });

    it("returns the first value when Express delivers a string[]", () => {
        expect(firstHeaderValue(["first", "second"])).toBe("first");
    });

    it("returns undefined for an empty array, same as a missing header", () => {
        expect(firstHeaderValue([])).toBeUndefined();
        expect(firstHeaderValue(undefined)).toBeUndefined();
    });
});

describe("toNonEmptyHeader", () => {
    it("trims usable values", () => {
        expect(toNonEmptyHeader("  token  ")).toBe("token");
    });

    it("treats whitespace-only as absent", () => {
        expect(toNonEmptyHeader("   ")).toBeUndefined();
        expect(toNonEmptyHeader("")).toBeUndefined();
        expect(toNonEmptyHeader(undefined)).toBeUndefined();
    });

    it("keeps token case because tokens are case-sensitive", () => {
        expect(toNonEmptyHeader("AbC")).toBe("AbC");
    });
});
