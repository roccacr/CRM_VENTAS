import { verifyHmacSha256Signature } from "../../../src/common/crypto/hmac-sha256-signature";
import { signHmacSha256Hex } from "./hmac-sign";

const secret = "test-secret";
const rawBody = JSON.stringify({
    phone_number_id: "123456789012345",
    project: { id: "project-1" },
});

/**
 * Specs de la primitiva HMAC (common).
 * KapsoWebhookSignatureService solo delega — no duplicar casos allá.
 */
describe("verifyHmacSha256Signature", () => {
    it("accepts a valid HMAC SHA256 signature", () => {
        expect(verifyHmacSha256Signature(rawBody, signHmacSha256Hex(rawBody, secret), secret)).toBe(true);
    });

    it("accepts a valid signature with sha256 prefix", () => {
        const hex = signHmacSha256Hex(rawBody, secret);
        expect(verifyHmacSha256Signature(rawBody, `sha256=${hex}`, secret)).toBe(true);
    });

    it("rejects an invalid signature", () => {
        expect(verifyHmacSha256Signature(rawBody, "bad-signature", secret)).toBe(false);
    });

    it("rejects missing signature or secret", () => {
        expect(verifyHmacSha256Signature(rawBody, undefined, secret)).toBe(false);
        expect(verifyHmacSha256Signature(rawBody, signHmacSha256Hex(rawBody, secret), undefined)).toBe(false);
    });

    it("rejects an empty secret string", () => {
        expect(verifyHmacSha256Signature(rawBody, signHmacSha256Hex(rawBody, secret), "")).toBe(false);
    });

    it("rejects a well-formed hex digest signed over a different body", () => {
        const otherBody = JSON.stringify({ phone_number_id: "tampered" });

        expect(verifyHmacSha256Signature(otherBody, signHmacSha256Hex(rawBody, secret), secret)).toBe(false);
    });

    it("rejects hex of the wrong length even if charset looks valid", () => {
        const hex = signHmacSha256Hex(rawBody, secret);

        expect(verifyHmacSha256Signature(rawBody, hex.slice(0, 63), secret)).toBe(false);
        expect(verifyHmacSha256Signature(rawBody, `${hex}aa`, secret)).toBe(false);
    });

    it("rejects a 64-char value with non-hex characters", () => {
        expect(verifyHmacSha256Signature(rawBody, `${"a".repeat(63)}g`, secret)).toBe(false);
        expect(verifyHmacSha256Signature(rawBody, `${"a".repeat(63)}z`, secret)).toBe(false);
    });

    it("accepts an uppercase hex digest", () => {
        expect(verifyHmacSha256Signature(rawBody, signHmacSha256Hex(rawBody, secret).toUpperCase(), secret)).toBe(true);
    });
});
