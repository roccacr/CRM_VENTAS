import "../../src/config/load-env";

import { expect, test } from "@playwright/test";

import { signJsonPayload } from "../common/crypto/hmac-sign";
import { requireEnv } from "../common/env/require-env";
import { TEST_PHONE_NUMBER_ID } from "../common/kapso/fixtures";

const signWithEnvSecret = (payload: unknown): string => signJsonPayload(payload, requireEnv("KAPSO_WHATSAPP_WEBHOOK_SECRET"));

test.describe("Kapso WhatsApp webhook", () => {
    test("accepts a signed WhatsApp message event", async ({ request }) => {
        const payload = {
            message: { id: "playwright-message-1" },
            phone_number_id: TEST_PHONE_NUMBER_ID,
        };

        const response = await request.post("/api/v1/webhooks/kapso/whatsapp", {
            data: payload,
            headers: {
                "X-Idempotency-Key": "playwright-whatsapp-message",
                "X-Webhook-Event": "whatsapp.message.received",
                "X-Webhook-Signature": signWithEnvSecret(payload),
            },
        });
        const body = (await response.json()) as Record<string, unknown>;

        expect(response.ok()).toBe(true);
        expect(body).toEqual({ ok: true, processed: false, action: "ignored" });
    });

    test("rejects an invalid WhatsApp webhook signature", async ({ request }) => {
        const response = await request.post("/api/v1/webhooks/kapso/whatsapp", {
            data: { phone_number_id: TEST_PHONE_NUMBER_ID },
            headers: {
                "X-Webhook-Event": "whatsapp.message.received",
                "X-Webhook-Signature": "invalid",
            },
        });

        expect(response.status()).toBe(401);
    });

    test("rejects a signed WhatsApp payload without event header", async ({ request }) => {
        const payload = { phone_number_id: TEST_PHONE_NUMBER_ID };
        const response = await request.post("/api/v1/webhooks/kapso/whatsapp", {
            data: payload,
            headers: {
                "X-Webhook-Signature": signWithEnvSecret(payload),
            },
        });

        expect(response.status()).toBe(400);
    });
});
