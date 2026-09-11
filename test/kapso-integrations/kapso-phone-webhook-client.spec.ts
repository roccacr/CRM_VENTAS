import { KAPSO_WHATSAPP_WEBHOOK_EVENTS, KapsoPhoneWebhookClient } from "../../src/kapso-integrations/kapso-phone-webhook.client";
import { createConfigServiceMock } from "../common/auth/mocks";
import { TEST_PHONE_NUMBER_ID } from "../common/kapso/fixtures";

const createFetchResponse = (options: { readonly ok: boolean; readonly status: number; readonly body: unknown }): Response =>
    ({
        json: jest.fn().mockResolvedValue(options.body),
        ok: options.ok,
        status: options.status,
    }) as unknown as Response;

const createClient = (
    fetchMock: jest.Mock,
    values: Record<string, string | undefined> = {
        KAPSO_API_KEY: "kapso-key",
        KAPSO_WHATSAPP_WEBHOOK_SECRET: "whatsapp-secret",
        KAPSO_WHATSAPP_WEBHOOK_URL: "https://example.test/api/v1/webhooks/kapso/whatsapp",
    },
): KapsoPhoneWebhookClient => new KapsoPhoneWebhookClient(createConfigServiceMock(values), fetchMock);

describe("KapsoPhoneWebhookClient", () => {
    it("creates a Kapso events webhook when the number has none configured", async () => {
        const fetchMock = jest
            .fn()
            .mockResolvedValueOnce(createFetchResponse({ body: { data: [] }, ok: true, status: 200 }))
            .mockResolvedValueOnce(createFetchResponse({ body: { data: { id: "webhook-1" } }, ok: true, status: 201 }));
        const client = createClient(fetchMock);

        await expect(client.ensureWhatsappWebhook(TEST_PHONE_NUMBER_ID)).resolves.toEqual({
            action: "created",
            webhookId: "webhook-1",
        });

        expect(fetchMock).toHaveBeenNthCalledWith(2, "https://api.kapso.ai/platform/v1/whatsapp/webhooks", {
            body: JSON.stringify({
                whatsapp_webhook: {
                    active: true,
                    events: KAPSO_WHATSAPP_WEBHOOK_EVENTS,
                    phone_number_id: TEST_PHONE_NUMBER_ID,
                    secret_key: "whatsapp-secret",
                    url: "https://example.test/api/v1/webhooks/kapso/whatsapp",
                },
            }),
            headers: { "Content-Type": "application/json", "X-API-Key": "kapso-key" },
            method: "POST",
        });
    });

    it("does not create a duplicate webhook when the same active URL already exists", async () => {
        const fetchMock = jest.fn().mockResolvedValue(
            createFetchResponse({
                body: {
                    data: [
                        {
                            active: true,
                            events: KAPSO_WHATSAPP_WEBHOOK_EVENTS,
                            id: "webhook-existing",
                            phone_number_id: TEST_PHONE_NUMBER_ID,
                            url: "https://example.test/api/v1/webhooks/kapso/whatsapp",
                        },
                    ],
                },
                ok: true,
                status: 200,
            }),
        );
        const client = createClient(fetchMock);

        await expect(client.ensureWhatsappWebhook(TEST_PHONE_NUMBER_ID)).resolves.toEqual({
            action: "exists",
            webhookId: "webhook-existing",
        });
        expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it("updates an existing webhook when it has the right URL but incomplete events", async () => {
        const fetchMock = jest
            .fn()
            .mockResolvedValueOnce(
                createFetchResponse({
                    body: {
                        data: [
                            {
                                active: true,
                                events: ["whatsapp.message.received"],
                                id: "webhook-existing",
                                phone_number_id: TEST_PHONE_NUMBER_ID,
                                url: "https://example.test/api/v1/webhooks/kapso/whatsapp",
                            },
                        ],
                    },
                    ok: true,
                    status: 200,
                }),
            )
            .mockResolvedValueOnce(createFetchResponse({ body: { data: {} }, ok: true, status: 200 }));
        const client = createClient(fetchMock);

        await expect(client.ensureWhatsappWebhook(TEST_PHONE_NUMBER_ID)).resolves.toEqual({
            action: "updated",
            webhookId: "webhook-existing",
        });

        expect(fetchMock).toHaveBeenNthCalledWith(2, "https://api.kapso.ai/platform/v1/whatsapp/webhooks/webhook-existing", {
            body: JSON.stringify({
                whatsapp_webhook: {
                    active: true,
                    events: KAPSO_WHATSAPP_WEBHOOK_EVENTS,
                    secret_key: "whatsapp-secret",
                    url: "https://example.test/api/v1/webhooks/kapso/whatsapp",
                },
            }),
            headers: { "Content-Type": "application/json", "X-API-Key": "kapso-key" },
            method: "PATCH",
        });
    });

    it("fails closed when webhook configuration is incomplete", async () => {
        const client = createClient(jest.fn(), { KAPSO_API_KEY: "kapso-key" });

        await expect(client.ensureWhatsappWebhook(TEST_PHONE_NUMBER_ID)).rejects.toThrow("Kapso WhatsApp webhook config is not configured");
    });

    it("propagates Kapso API errors before creating anything", async () => {
        const fetchMock = jest.fn().mockResolvedValue(createFetchResponse({ body: { error: "not found" }, ok: false, status: 404 }));
        const client = createClient(fetchMock);

        await expect(client.ensureWhatsappWebhook(TEST_PHONE_NUMBER_ID)).rejects.toThrow("Kapso webhook list failed with 404");
        expect(fetchMock).toHaveBeenCalledTimes(1);
    });
});
