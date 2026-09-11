import { ServiceUnavailableException, UnauthorizedException } from "@nestjs/common";

import { KapsoWebhookSignatureGuard } from "../../src/kapso-webhooks/kapso-webhook-signature.guard";
import { signHmacSha256Hex } from "../common/crypto/hmac-sign";
import { createConfigServiceMock, createHttpExecutionContext, instantiateMixinGuard } from "../common/auth/mocks";

const secret = "platform-secret";
const rawBody = '{"phone_number_id":"123"}';
const parsedBody = { phone_number_id: "999" };

describe("KapsoWebhookSignatureGuard", () => {
    const createGuard = (configuredSecret: string | undefined): ReturnType<typeof instantiateMixinGuard> => instantiateMixinGuard(KapsoWebhookSignatureGuard, createConfigServiceMock({ KAPSO_PLATFORM_WEBHOOK_SECRET: configuredSecret }));

    it("allows a request signed over the rawBody bytes", () => {
        const guard = createGuard(secret);

        expect(
            guard.canActivate(
                createHttpExecutionContext({
                    body: parsedBody,
                    headers: { "x-webhook-signature": signHmacSha256Hex(rawBody, secret) },
                    rawBody: Buffer.from(rawBody),
                }),
            ),
        ).toBe(true);
    });

    it("rejects a signature that matches JSON.stringify(body) but not the wire bytes", () => {
        const guard = createGuard(secret);

        expect(() =>
            guard.canActivate(
                createHttpExecutionContext({
                    body: parsedBody,
                    headers: { "x-webhook-signature": signHmacSha256Hex(JSON.stringify(parsedBody), secret) },
                    rawBody: Buffer.from(rawBody),
                }),
            ),
        ).toThrow(UnauthorizedException);
    });

    it("fails closed with 503 when the webhook secret is not configured", () => {
        const guard = createGuard(undefined);

        expect(() =>
            guard.canActivate(
                createHttpExecutionContext({
                    headers: { "x-webhook-signature": signHmacSha256Hex(rawBody, secret) },
                    rawBody: Buffer.from(rawBody),
                }),
            ),
        ).toThrow(ServiceUnavailableException);
    });
});
