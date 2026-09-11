import { ensureKapsoPhoneWebhooks } from "../../src/kapso-integrations/kapso-phone-webhook-ensure";
import { TEST_PHONE_NUMBER_ID } from "../common/kapso/fixtures";

const createRepositoryMock = (): {
    readonly findActive: jest.Mock;
} => ({
    findActive: jest.fn().mockResolvedValue([{ kapsoPhoneNumberId: TEST_PHONE_NUMBER_ID }]),
});

const createClientMock = (): {
    readonly ensureWhatsappWebhook: jest.Mock;
} => ({
    ensureWhatsappWebhook: jest.fn().mockResolvedValue({ action: "created", webhookId: "webhook-1" }),
});

describe("ensureKapsoPhoneWebhooks", () => {
    it("creates missing webhooks for active integrations", async () => {
        const repository = createRepositoryMock();
        const client = createClientMock();

        await expect(ensureKapsoPhoneWebhooks(repository, client)).resolves.toEqual({
            created: 1,
            existing: 0,
            total: 1,
            updated: 0,
        });
        expect(client.ensureWhatsappWebhook).toHaveBeenCalledWith(TEST_PHONE_NUMBER_ID);
    });

    it("returns zero when there are no active integrations", async () => {
        const repository = createRepositoryMock();
        repository.findActive.mockResolvedValue([]);
        const client = createClientMock();

        await expect(ensureKapsoPhoneWebhooks(repository, client)).resolves.toEqual({
            created: 0,
            existing: 0,
            total: 0,
            updated: 0,
        });
        expect(client.ensureWhatsappWebhook).not.toHaveBeenCalled();
    });

    it("counts existing webhooks without creating duplicates", async () => {
        const repository = createRepositoryMock();
        const client = createClientMock();
        client.ensureWhatsappWebhook.mockResolvedValue({
            action: "exists",
            webhookId: "webhook-existing",
        });

        await expect(ensureKapsoPhoneWebhooks(repository, client)).resolves.toEqual({
            created: 0,
            existing: 1,
            total: 1,
            updated: 0,
        });
    });

    it("counts updated webhooks when Kapso already has the URL with incomplete events", async () => {
        const repository = createRepositoryMock();
        const client = createClientMock();
        client.ensureWhatsappWebhook.mockResolvedValue({
            action: "updated",
            webhookId: "webhook-existing",
        });

        await expect(ensureKapsoPhoneWebhooks(repository, client)).resolves.toEqual({
            created: 0,
            existing: 0,
            total: 1,
            updated: 1,
        });
    });

    it("propagates Kapso errors for visibility", async () => {
        const repository = createRepositoryMock();
        const client = createClientMock();
        client.ensureWhatsappWebhook.mockRejectedValue(new Error("Kapso unavailable"));

        await expect(ensureKapsoPhoneWebhooks(repository, client)).rejects.toThrow("Kapso unavailable");
    });
});
