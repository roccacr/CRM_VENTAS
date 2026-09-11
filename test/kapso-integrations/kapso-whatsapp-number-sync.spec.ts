import { KapsoWhatsappNumbersService } from "../../src/kapso-integrations/kapso-whatsapp-numbers.service";
import { TEST_CUSTOMER_ID, TEST_PHONE_NUMBER_ID } from "../common/kapso/fixtures";

type RepositoryMock = {
    readonly findAll: jest.Mock;
    readonly findById: jest.Mock;
    readonly setActiveById: jest.Mock;
    readonly upsertFromKapsoPhoneNumber: jest.Mock;
};

type ClientMock = {
    readonly getPhoneNumber: jest.Mock;
    readonly listPhoneNumbers: jest.Mock;
};

const createRepositoryMock = (): RepositoryMock => ({
    findAll: jest.fn().mockResolvedValue([]),
    findById: jest.fn().mockResolvedValue({
        id: BigInt(1),
        kapsoPhoneNumberId: TEST_PHONE_NUMBER_ID,
    }),
    setActiveById: jest.fn().mockResolvedValue(1),
    upsertFromKapsoPhoneNumber: jest.fn(),
});

const createClientMock = (): ClientMock => ({
    getPhoneNumber: jest.fn().mockResolvedValue({
        businessAccountId: "98765432109",
        businessName: "Acme Corp",
        displayPhoneNumber: "+1 555-123-4567",
        phoneNumber: "15551234567",
        kapsoCustomerId: TEST_CUSTOMER_ID,
        kapsoPhoneNumberId: TEST_PHONE_NUMBER_ID,
        status: "CONNECTED",
        rawPayload: { phone_number_id: TEST_PHONE_NUMBER_ID },
    }),
    listPhoneNumbers: jest.fn().mockResolvedValue([
        {
            businessAccountId: "98765432109",
            businessName: "Acme Corp",
            displayPhoneNumber: "+1 555-123-4567",
            phoneNumber: "15551234567",
            kapsoCustomerId: TEST_CUSTOMER_ID,
            kapsoPhoneNumberId: TEST_PHONE_NUMBER_ID,
            status: "CONNECTED",
            rawPayload: { phone_number_id: TEST_PHONE_NUMBER_ID },
        },
    ]),
});

describe("Kapso WhatsApp number sync", () => {
    it("syncs phone numbers from Kapso into the repository", async () => {
        const repository = createRepositoryMock();
        const client = createClientMock();
        const phoneWebhookClient = {
            ensureWhatsappWebhook: jest.fn().mockResolvedValue({ action: "created" }),
        };
        const service = new KapsoWhatsappNumbersService(repository, client, phoneWebhookClient);

        await expect(service.syncFromKapso()).resolves.toEqual({ synced: 1 });
        expect(repository.upsertFromKapsoPhoneNumber).toHaveBeenCalledWith(expect.objectContaining({ kapsoPhoneNumberId: TEST_PHONE_NUMBER_ID }));
        expect(phoneWebhookClient.ensureWhatsappWebhook).toHaveBeenCalledWith(TEST_PHONE_NUMBER_ID);
    });

    it("returns zero when Kapso has no phone numbers", async () => {
        const repository = createRepositoryMock();
        const client = createClientMock();
        client.listPhoneNumbers.mockResolvedValue([]);
        const phoneWebhookClient = { ensureWhatsappWebhook: jest.fn() };
        const service = new KapsoWhatsappNumbersService(repository, client, phoneWebhookClient);

        await expect(service.syncFromKapso()).resolves.toEqual({ synced: 0 });
        expect(repository.upsertFromKapsoPhoneNumber).not.toHaveBeenCalled();
        expect(phoneWebhookClient.ensureWhatsappWebhook).not.toHaveBeenCalled();
    });

    it("syncs one existing phone number from Kapso into the repository", async () => {
        const repository = createRepositoryMock();
        const client = createClientMock();
        const phoneWebhookClient = {
            ensureWhatsappWebhook: jest.fn().mockResolvedValue({ action: "complete" }),
        };
        const service = new KapsoWhatsappNumbersService(repository, client, phoneWebhookClient);

        await expect(service.syncOneFromKapso("1")).resolves.toEqual({ synced: 1 });
        expect(client.getPhoneNumber).toHaveBeenCalledWith(TEST_PHONE_NUMBER_ID);
        expect(repository.upsertFromKapsoPhoneNumber).toHaveBeenCalledWith(expect.objectContaining({ displayPhoneNumber: "+1 555-123-4567" }));
    });

    it("returns 404 when syncing a missing local integration", async () => {
        const repository = createRepositoryMock();
        repository.findById.mockResolvedValue(null);
        const client = createClientMock();
        const service = new KapsoWhatsappNumbersService(repository, client);

        await expect(service.syncOneFromKapso("999")).rejects.toThrow("Kapso WhatsApp number integration not found");
        expect(client.getPhoneNumber).not.toHaveBeenCalled();
    });

    it("propagates Kapso client errors without writing rows", async () => {
        const repository = createRepositoryMock();
        const client = createClientMock();
        client.listPhoneNumbers.mockRejectedValue(new Error("Kapso unavailable"));
        const phoneWebhookClient = { ensureWhatsappWebhook: jest.fn() };
        const service = new KapsoWhatsappNumbersService(repository, client, phoneWebhookClient);

        await expect(service.syncFromKapso()).rejects.toThrow("Kapso unavailable");
        expect(repository.upsertFromKapsoPhoneNumber).not.toHaveBeenCalled();
        expect(phoneWebhookClient.ensureWhatsappWebhook).not.toHaveBeenCalled();
    });

    it("propagates repository write errors after reading Kapso", async () => {
        const repository = createRepositoryMock();
        repository.upsertFromKapsoPhoneNumber.mockRejectedValue(new Error("db unavailable"));
        const client = createClientMock();
        const service = new KapsoWhatsappNumbersService(repository, client);

        await expect(service.syncFromKapso()).rejects.toThrow("db unavailable");
    });
});
