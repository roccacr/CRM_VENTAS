import "../../src/config/load-env";

import { expect, test } from "@playwright/test";

import { requireEnv } from "../common/env/require-env";

const bearerHeaders = (): { Authorization: string } => ({
    Authorization: `Bearer ${requireEnv("CRM_API_INTERNAL_TOKEN")}`,
});

test.describe("Kapso WhatsApp numbers internal API", () => {
    test("lists integrations with a valid internal token", async ({ request }) => {
        const response = await request.get("/api/v1/kapso/whatsapp-numbers", {
            headers: bearerHeaders(),
        });
        const body = (await response.json()) as { data?: unknown };

        expect(response.ok()).toBe(true);
        expect(Array.isArray(body.data)).toBe(true);
    });

    test("rejects list requests without token", async ({ request }) => {
        const response = await request.get("/api/v1/kapso/whatsapp-numbers");

        expect(response.status()).toBe(401);
    });

    test("rejects list requests with an invalid token", async ({ request }) => {
        const response = await request.get("/api/v1/kapso/whatsapp-numbers", {
            headers: {
                Authorization: "Bearer invalid",
            },
        });

        expect(response.status()).toBe(401);
    });

    test("blocks activation requests without token before touching data", async ({ request }) => {
        const response = await request.patch("/api/v1/kapso/whatsapp-numbers/1/activate");

        expect(response.status()).toBe(401);
    });
});
