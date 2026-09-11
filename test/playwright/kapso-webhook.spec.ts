import "../../src/config/load-env";

import { expect, test } from "@playwright/test";

import { signJsonPayload } from "../common/crypto/hmac-sign";
import { requireEnv } from "../common/env/require-env";
import { TEST_PHONE_NUMBER_ID } from "../common/kapso/fixtures";

const signWithEnvSecret = (payload: unknown): string => signJsonPayload(payload, requireEnv("KAPSO_PLATFORM_WEBHOOK_SECRET"));

test.describe("Kapso platform webhook", () => {
    test("accepts a signed unsupported event without touching integrations", async ({ request }) => {
        const payload = { execution_id: "playwright-smoke" };
        const response = await request.post("/api/v1/webhooks/kapso/platform", {
            data: payload,
            headers: {
                "X-Idempotency-Key": "playwright-ignored-event",
                "X-Webhook-Event": "workflow.execution.failed",
                "X-Webhook-Signature": signWithEnvSecret(payload),
            },
        });
        const body = (await response.json()) as Record<string, unknown>;

        expect(response.ok()).toBe(true);
        expect(body).toEqual({ ok: true, processed: false, action: "ignored" });
    });

    test("rejects an invalid webhook signature", async ({ request }) => {
        const response = await request.post("/api/v1/webhooks/kapso/platform", {
            data: { phone_number_id: TEST_PHONE_NUMBER_ID },
            headers: {
                "X-Webhook-Event": "whatsapp.phone_number.created",
                "X-Webhook-Signature": "invalid",
            },
        });

        expect(response.status()).toBe(401);
    });

    test("rejects a signed payload without event header", async ({ request }) => {
        const payload = { phone_number_id: TEST_PHONE_NUMBER_ID };
        const response = await request.post("/api/v1/webhooks/kapso/platform", {
            data: payload,
            headers: {
                "X-Webhook-Signature": signWithEnvSecret(payload),
            },
        });

        expect(response.status()).toBe(400);
    });
});
