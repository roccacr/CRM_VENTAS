import { ServiceUnavailableException, UnauthorizedException } from "@nestjs/common";

import { assertWebhookSignature } from "../../../src/common/webhooks/assert-webhook-signature";
import { signHmacSha256Hex } from "../crypto/hmac-sign";

const secret = "webhook-secret";
const rawBody = '{"phone_number_id":"1"}';

describe("assertWebhookSignature", () => {
    it("accepts a valid HMAC signature", () => {
        expect(() =>
            assertWebhookSignature({
                rawBody,
                secret,
                serviceLabel: "Kapso",
                signatureHeader: signHmacSha256Hex(rawBody, secret),
            }),
        ).not.toThrow();
    });

    it("fails closed with 503 when the server secret is missing", () => {
        expect(() =>
            assertWebhookSignature({
                rawBody,
                secret: undefined,
                serviceLabel: "Kapso",
                signatureHeader: signHmacSha256Hex(rawBody, secret),
            }),
        ).toThrow(ServiceUnavailableException);
    });

    it("fails closed with 503 when the server secret is empty", () => {
        expect(() =>
            assertWebhookSignature({
                rawBody,
                secret: "",
                serviceLabel: "Kapso",
                signatureHeader: signHmacSha256Hex(rawBody, secret),
            }),
        ).toThrow(ServiceUnavailableException);
    });

    it("rejects a missing signature with 401, not 503", () => {
        expect(() =>
            assertWebhookSignature({
                rawBody,
                secret,
                serviceLabel: "Kapso",
                signatureHeader: undefined,
            }),
        ).toThrow(UnauthorizedException);
    });

    it("rejects a valid hex signed over a tampered body", () => {
        expect(() =>
            assertWebhookSignature({
                rawBody: '{"phone_number_id":"2"}',
                secret,
                serviceLabel: "Kapso",
                signatureHeader: signHmacSha256Hex(rawBody, secret),
            }),
        ).toThrow(UnauthorizedException);
    });
});
