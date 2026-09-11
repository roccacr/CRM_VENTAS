import { INestApplication } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import request from "supertest";

import { createConfigServiceMock } from "../common/auth/mocks";
import { signJsonPayload } from "../common/crypto/hmac-sign";
import { createE2eApp } from "../common/nest/create-e2e-app";
import { httpServer } from "../common/nest/http";
import { KapsoWhatsappWebhookService } from "../../src/kapso-webhooks/kapso-whatsapp-webhook.service";

const secret = "whatsapp-e2e-secret";

describe("Kapso WhatsApp number webhook endpoint", () => {
    let app: INestApplication;
    const service = {
        process: jest.fn().mockResolvedValue({ processed: false, action: "ignored" }),
    };

    beforeAll(async () => {
        app = await createE2eApp({
            rawBody: true,
            configure: (builder) =>
                builder
                    .overrideProvider(ConfigService)
                    .useValue(
                        createConfigServiceMock({
                            KAPSO_PLATFORM_WEBHOOK_SECRET: "platform-secret",
                            KAPSO_WHATSAPP_WEBHOOK_SECRET: secret,
                        }),
                    )
                    .overrideProvider(KapsoWhatsappWebhookService)
                    .useValue(service),
        });
    });

    beforeEach(() => {
        service.process.mockClear();
        service.process.mockResolvedValue({ processed: false, action: "ignored" });
    });

    afterAll(async () => {
        await app.close();
    });

    it("accepts a signed WhatsApp message received event without persisting chats yet", async () => {
        const payload = { message: { id: "message-1" }, phone_number_id: "123456789012345" };

        const response = await request(httpServer(app)).post("/api/v1/webhooks/kapso/whatsapp").set("X-Webhook-Event", "whatsapp.message.received").set("X-Webhook-Signature", signJsonPayload(payload, secret)).set("X-Idempotency-Key", "message-idem-1").send(payload).expect(200);

        expect(response.body).toEqual({ ok: true, processed: false, action: "ignored" });
        expect(service.process).toHaveBeenCalledWith({
            event: "whatsapp.message.received",
            idempotencyKey: "message-idem-1",
            payload,
        });
    });

    it("returns the mapped customer response action from the service", async () => {
        service.process.mockResolvedValue({ processed: true, action: "accepted_info" });
        const payload = {
            message: {
                interactive: { button_reply: { title: "Sí, enviar información" } },
            },
            tracking: { biz_opaque_callback_data: "crm_lead:36640;template:saludo" },
        };

        const response = await request(httpServer(app)).post("/api/v1/webhooks/kapso/whatsapp").set("X-Webhook-Event", "whatsapp.message.received").set("X-Webhook-Signature", signJsonPayload(payload, secret)).set("X-Idempotency-Key", "message-idem-2").send(payload).expect(200);

        expect(response.body).toEqual({ ok: true, processed: true, action: "accepted_info" });
    });

    it("rejects an invalid WhatsApp webhook signature", async () => {
        await request(httpServer(app)).post("/api/v1/webhooks/kapso/whatsapp").set("X-Webhook-Event", "whatsapp.message.received").set("X-Webhook-Signature", "invalid").send({ phone_number_id: "123456789012345" }).expect(401);
    });

    it("rejects signed WhatsApp payloads without event header", async () => {
        const payload = { phone_number_id: "123456789012345" };

        await request(httpServer(app)).post("/api/v1/webhooks/kapso/whatsapp").set("X-Webhook-Signature", signJsonPayload(payload, secret)).send(payload).expect(400);
    });
});
