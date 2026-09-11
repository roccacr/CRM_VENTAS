import "../../src/config/load-env";

import { expect, test } from "@playwright/test";

import { requireEnv } from "../common/env/require-env";

const bearerHeaders = (): { Authorization: string } => ({
    Authorization: `Bearer ${requireEnv("CRM_API_INTERNAL_TOKEN")}`,
});

test.describe("Kapso admin assignment internal API", () => {
    test("lists integrations with assigned admins using a valid token", async ({ request }) => {
        const response = await request.get("/api/v1/kapso/admin-integrations", {
            headers: bearerHeaders(),
        });
        const body = (await response.json()) as { data?: unknown };

        expect(response.ok()).toBe(true);
        expect(Array.isArray(body.data)).toBe(true);
    });

    test("lists active admin options using a valid token", async ({ request }) => {
        const response = await request.get("/api/v1/kapso/admins/options", {
            headers: bearerHeaders(),
        });
        const body = (await response.json()) as { data?: unknown };

        expect(response.ok()).toBe(true);
        expect(Array.isArray(body.data)).toBe(true);
    });

    test("lists CRM project options using a valid token", async ({ request }) => {
        const response = await request.get("/api/v1/kapso/projects/options", {
            headers: bearerHeaders(),
        });
        const body = (await response.json()) as { data?: unknown };

        expect(response.ok()).toBe(true);
        expect(Array.isArray(body.data)).toBe(true);
    });

    test("rejects assignment listing without token", async ({ request }) => {
        const response = await request.get("/api/v1/kapso/admin-integrations");

        expect(response.status()).toBe(401);
    });

    test("blocks assignment creation without token before touching data", async ({ request }) => {
        const response = await request.post("/api/v1/kapso/admin-integrations", {
            data: {
                idnetsuiteAdmin: 252150001,
                kapsoIntegracionNumeroWhatsappId: "1",
            },
        });

        expect(response.status()).toBe(401);
    });

    test("blocks cronjob config creation without token before touching data", async ({ request }) => {
        const response = await request.post("/api/v1/kapso/cronjob-configs", {
            data: {
                cronjobId: "kapso-sync-chats-rdg",
                isActive: true,
            },
        });

        expect(response.status()).toBe(401);
    });

    test("does not expose deleting a general cronjob config even with a valid token", async ({ request }) => {
        const response = await request.delete("/api/v1/kapso/cronjob-configs/1", {
            headers: bearerHeaders(),
        });

        expect(response.status()).toBe(404);
    });

    test("blocks cronjob project config creation without token before touching data", async ({ request }) => {
        const response = await request.post("/api/v1/kapso/cronjob-configs/1/projects", {
            data: {
                idnetsuiteAdmin: null,
                idproyectoLead: 8,
                isActive: true,
                kapsoIntegracionNumeroWhatsappId: "1",
            },
        });

        expect(response.status()).toBe(401);
    });
});
