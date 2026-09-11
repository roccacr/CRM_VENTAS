import { INestApplication } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import request from "supertest";

import { KapsoPlatformWebhookService } from "../../src/kapso-webhooks/kapso-platform-webhook.service";
import { createConfigServiceMock } from "../common/auth/mocks";
import { signJsonPayload } from "../common/crypto/hmac-sign";
import { deletedPhoneNumberPayload, TEST_PHONE_NUMBER_ID, TEST_PROJECT_ID } from "../common/kapso/fixtures";
import { createE2eApp } from "../common/nest/create-e2e-app";
import { httpServer } from "../common/nest/http";

const secret = "e2e-webhook-secret";

describe("Kapso platform webhook endpoint", () => {
    let app: INestApplication;
    const webhookService = {
        process: jest.fn(),
    };

    beforeAll(async () => {
        app = await createE2eApp({
            rawBody: true,
            configure: (builder) => builder.overrideProvider(ConfigService).useValue(createConfigServiceMock(secret)).overrideProvider(KapsoPlatformWebhookService).useValue(webhookService),
        });
    });

    beforeEach(() => {
        webhookService.process.mockReset();
        webhookService.process.mockResolvedValue({ processed: true, action: "created" });
    });

    afterAll(async () => {
        await app.close();
    });

    it("returns 200 and processes a signed created event", async () => {
        const payload = {
            phone_number_id: TEST_PHONE_NUMBER_ID,
            project: { id: TEST_PROJECT_ID },
        };

        const response = await request(httpServer(app)).post("/api/v1/webhooks/kapso/platform").set("X-Webhook-Event", "whatsapp.phone_number.created").set("X-Webhook-Signature", signJsonPayload(payload, secret)).set("X-Idempotency-Key", "idem-1").send(payload).expect(200);

        expect(response.body).toEqual({ ok: true, processed: true, action: "created" });
        expect(webhookService.process).toHaveBeenCalledWith({
            event: "whatsapp.phone_number.created",
            idempotencyKey: "idem-1",
            payload,
        });
    });

    it("returns 200 and processes a signed deleted event", async () => {
        webhookService.process.mockResolvedValueOnce({ processed: true, action: "deleted" });

        const response = await request(httpServer(app)).post("/api/v1/webhooks/kapso/platform").set("X-Webhook-Event", "whatsapp.phone_number.deleted").set("X-Webhook-Signature", signJsonPayload(deletedPhoneNumberPayload, secret)).set("X-Idempotency-Key", "idem-2").send(deletedPhoneNumberPayload).expect(200);

        expect(response.body).toEqual({ ok: true, processed: true, action: "deleted" });
        expect(webhookService.process).toHaveBeenCalledWith({
            event: "whatsapp.phone_number.deleted",
            idempotencyKey: "idem-2",
            payload: deletedPhoneNumberPayload,
        });
    });

    it("returns 401 when the signature is invalid", async () => {
        await request(httpServer(app)).post("/api/v1/webhooks/kapso/platform").set("X-Webhook-Event", "whatsapp.phone_number.created").set("X-Webhook-Signature", "invalid").send(deletedPhoneNumberPayload).expect(401);

        expect(webhookService.process).not.toHaveBeenCalled();
    });

    it("returns 400 when the event header is missing", async () => {
        await request(httpServer(app)).post("/api/v1/webhooks/kapso/platform").set("X-Webhook-Signature", signJsonPayload(deletedPhoneNumberPayload, secret)).send(deletedPhoneNumberPayload).expect(400);

        expect(webhookService.process).not.toHaveBeenCalled();
    });

    it("returns 200 and ignored when the signed event is unsupported", async () => {
        const payload = { execution_id: "execution-1" };
        webhookService.process.mockResolvedValueOnce({ processed: false, action: "ignored" });

        const response = await request(httpServer(app)).post("/api/v1/webhooks/kapso/platform").set("X-Webhook-Event", "workflow.execution.failed").set("X-Webhook-Signature", signJsonPayload(payload, secret)).send(payload).expect(200);

        expect(response.body).toEqual({ ok: true, processed: false, action: "ignored" });
    });
});
