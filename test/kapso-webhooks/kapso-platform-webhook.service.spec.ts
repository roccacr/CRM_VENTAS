import { BadRequestException } from "@nestjs/common";

import { KapsoPlatformWebhookService } from "../../src/kapso-webhooks/kapso-platform-webhook.service";
import { createdPhoneNumberPayload, deletedPhoneNumberPayload, TEST_CUSTOMER_ID, TEST_PHONE_NUMBER_ID, TEST_PROJECT_ID } from "../common/kapso/fixtures";

type RepositoryMock = {
    readonly deleteByKapsoPhoneNumberId: jest.Mock;
    readonly upsertFromKapsoCreatedEvent: jest.Mock;
};

type PhoneWebhookClientMock = {
    readonly ensureWhatsappWebhook: jest.Mock;
};

const createRepositoryMock = (): RepositoryMock => ({
    deleteByKapsoPhoneNumberId: jest.fn(),
    upsertFromKapsoCreatedEvent: jest.fn(),
});

const createPhoneWebhookClientMock = (): PhoneWebhookClientMock => ({
    ensureWhatsappWebhook: jest.fn().mockResolvedValue({ action: "created", webhookId: "webhook-1" }),
});

describe("KapsoPlatformWebhookService", () => {
    it("creates or updates a WhatsApp number integration from a created event", async () => {
        const repository = createRepositoryMock();
        const phoneWebhookClient = createPhoneWebhookClientMock();
        const service = new KapsoPlatformWebhookService(repository, phoneWebhookClient);

        await expect(
            service.process({
                event: "whatsapp.phone_number.created",
                idempotencyKey: "idem-1",
                payload: createdPhoneNumberPayload,
            }),
        ).resolves.toEqual({ processed: true, action: "created" });

        expect(repository.upsertFromKapsoCreatedEvent).toHaveBeenCalledWith({
            kapsoPhoneNumberId: TEST_PHONE_NUMBER_ID,
            kapsoProjectId: TEST_PROJECT_ID,
            kapsoCustomerId: TEST_CUSTOMER_ID,
            rawPayload: createdPhoneNumberPayload,
        });
        expect(phoneWebhookClient.ensureWhatsappWebhook).toHaveBeenCalledWith(TEST_PHONE_NUMBER_ID);
    });

    it("rejects a created event without phone_number_id", async () => {
        const repository = createRepositoryMock();
        const phoneWebhookClient = createPhoneWebhookClientMock();
        const service = new KapsoPlatformWebhookService(repository, phoneWebhookClient);

        await expect(
            service.process({
                event: "whatsapp.phone_number.created",
                idempotencyKey: "idem-1",
                payload: { project: { id: TEST_PROJECT_ID } },
            }),
        ).rejects.toBeInstanceOf(BadRequestException);

        expect(repository.upsertFromKapsoCreatedEvent).not.toHaveBeenCalled();
        expect(phoneWebhookClient.ensureWhatsappWebhook).not.toHaveBeenCalled();
    });

    it("deletes the WhatsApp number integration from a deleted event", async () => {
        const repository = createRepositoryMock();
        const phoneWebhookClient = createPhoneWebhookClientMock();
        const service = new KapsoPlatformWebhookService(repository, phoneWebhookClient);

        await expect(
            service.process({
                event: "whatsapp.phone_number.deleted",
                idempotencyKey: "idem-2",
                payload: deletedPhoneNumberPayload,
            }),
        ).resolves.toEqual({ processed: true, action: "deleted" });

        expect(repository.deleteByKapsoPhoneNumberId).toHaveBeenCalledWith(TEST_PHONE_NUMBER_ID);
        expect(phoneWebhookClient.ensureWhatsappWebhook).not.toHaveBeenCalled();
    });

    it("returns ignored for unsupported events without touching the database", async () => {
        const repository = createRepositoryMock();
        const phoneWebhookClient = createPhoneWebhookClientMock();
        const service = new KapsoPlatformWebhookService(repository, phoneWebhookClient);

        await expect(
            service.process({
                event: "workflow.execution.failed",
                idempotencyKey: "idem-3",
                payload: { execution_id: "execution-1" },
            }),
        ).resolves.toEqual({ processed: false, action: "ignored" });

        expect(repository.upsertFromKapsoCreatedEvent).not.toHaveBeenCalled();
        expect(repository.deleteByKapsoPhoneNumberId).not.toHaveBeenCalled();
        expect(phoneWebhookClient.ensureWhatsappWebhook).not.toHaveBeenCalled();
    });

    it("lets database errors bubble as controlled API errors", async () => {
        const repository = createRepositoryMock();
        repository.deleteByKapsoPhoneNumberId.mockRejectedValue(new Error("db unavailable"));
        const phoneWebhookClient = createPhoneWebhookClientMock();
        const service = new KapsoPlatformWebhookService(repository, phoneWebhookClient);

        await expect(
            service.process({
                event: "whatsapp.phone_number.deleted",
                idempotencyKey: "idem-4",
                payload: deletedPhoneNumberPayload,
            }),
        ).rejects.toThrow("db unavailable");
    });

    it("lets Kapso webhook creation errors bubble after saving the integration", async () => {
        const repository = createRepositoryMock();
        const phoneWebhookClient = createPhoneWebhookClientMock();
        phoneWebhookClient.ensureWhatsappWebhook.mockRejectedValue(new Error("Kapso unavailable"));
        const service = new KapsoPlatformWebhookService(repository, phoneWebhookClient);

        await expect(
            service.process({
                event: "whatsapp.phone_number.created",
                idempotencyKey: "idem-5",
                payload: createdPhoneNumberPayload,
            }),
        ).rejects.toThrow("Kapso unavailable");

        expect(repository.upsertFromKapsoCreatedEvent).toHaveBeenCalled();
    });

    it("rejects an empty phone_number_id string", async () => {
        const repository = createRepositoryMock();
        const phoneWebhookClient = createPhoneWebhookClientMock();
        const service = new KapsoPlatformWebhookService(repository, phoneWebhookClient);

        await expect(
            service.process({
                event: "whatsapp.phone_number.created",
                payload: { phone_number_id: "" },
            }),
        ).rejects.toBeInstanceOf(BadRequestException);
        expect(repository.upsertFromKapsoCreatedEvent).not.toHaveBeenCalled();
    });

    it.each([null, "phone", []])("rejects a non-object payload root %s", async (payload) => {
        const repository = createRepositoryMock();
        const phoneWebhookClient = createPhoneWebhookClientMock();
        const service = new KapsoPlatformWebhookService(repository, phoneWebhookClient);

        await expect(
            service.process({
                event: "whatsapp.phone_number.deleted",
                payload,
            }),
        ).rejects.toBeInstanceOf(BadRequestException);
    });

    it("still upserts a created event that only has phone_number_id", async () => {
        const repository = createRepositoryMock();
        const phoneWebhookClient = createPhoneWebhookClientMock();
        const service = new KapsoPlatformWebhookService(repository, phoneWebhookClient);

        await expect(
            service.process({
                event: "whatsapp.phone_number.created",
                payload: { phone_number_id: TEST_PHONE_NUMBER_ID },
            }),
        ).resolves.toEqual({ processed: true, action: "created" });

        expect(repository.upsertFromKapsoCreatedEvent).toHaveBeenCalledWith({
            kapsoCustomerId: undefined,
            kapsoPhoneNumberId: TEST_PHONE_NUMBER_ID,
            kapsoProjectId: undefined,
            rawPayload: { phone_number_id: TEST_PHONE_NUMBER_ID },
        });
    });

    it("does not dedupe on a repeated idempotencyKey because platform persistence is not implemented yet", async () => {
        const repository = createRepositoryMock();
        const phoneWebhookClient = createPhoneWebhookClientMock();
        const service = new KapsoPlatformWebhookService(repository, phoneWebhookClient);
        const input = {
            event: "whatsapp.phone_number.created" as const,
            idempotencyKey: "same-key",
            payload: createdPhoneNumberPayload,
        };

        await service.process(input);
        await service.process(input);

        expect(repository.upsertFromKapsoCreatedEvent).toHaveBeenCalledTimes(2);
    });
});
