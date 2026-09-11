import { timingSafeEqual } from "node:crypto";

import { timingSafeEqualBuffers, timingSafeEqualUtf8 } from "../../../src/common/crypto/timing-safe-equal";

describe("timingSafeEqualBuffers", () => {
    it("returns true for identical buffers", () => {
        expect(timingSafeEqualBuffers(Buffer.from("secret"), Buffer.from("secret"))).toBe(true);
    });

    it("returns false for same-length different content", () => {
        expect(timingSafeEqualBuffers(Buffer.from("secret"), Buffer.from("secr3t"))).toBe(false);
    });

    it("returns false for unequal lengths without throwing", () => {
        expect(() => timingSafeEqualBuffers(Buffer.from("ab"), Buffer.from("abc"))).not.toThrow();
        expect(timingSafeEqualBuffers(Buffer.from("ab"), Buffer.from("abc"))).toBe(false);
    });

    it("does not leak a crypto length-mismatch error the way crypto.timingSafeEqual does", () => {
        expect(() => timingSafeEqual(Buffer.from("ab"), Buffer.from("abc"))).toThrow(/same byte length/);
        expect(timingSafeEqualBuffers(Buffer.from("ab"), Buffer.from("abc"))).toBe(false);
    });
});

describe("timingSafeEqualUtf8", () => {
    it("returns true for identical strings", () => {
        expect(timingSafeEqualUtf8("crm-token", "crm-token")).toBe(true);
    });

    it("returns false when UTF-8 byte lengths differ", () => {
        expect(() => timingSafeEqualUtf8("a", "á")).not.toThrow();
        expect(timingSafeEqualUtf8("a", "á")).toBe(false);
    });

    it("returns false for empty vs non-empty without throwing", () => {
        expect(timingSafeEqualUtf8("", "x")).toBe(false);
        expect(timingSafeEqualUtf8("x", "")).toBe(false);
    });
});
