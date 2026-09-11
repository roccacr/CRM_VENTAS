import { ServiceUnavailableException, UnauthorizedException } from "@nestjs/common";

import { KapsoPlatformClient } from "../../src/kapso-integrations/kapso-platform.client";
import { createConfigServiceMock } from "../common/auth/mocks";
import { TEST_CUSTOMER_ID, TEST_PHONE_NUMBER_ID } from "../common/kapso/fixtures";

const createFetchResponse = (options: { readonly ok: boolean; readonly status: number; readonly body: unknown }): Response =>
    ({
        json: jest.fn().mockResolvedValue(options.body),
        ok: options.ok,
        status: options.status,
    }) as unknown as Response;

describe("KapsoPlatformClient", () => {
    it("lists phone numbers with the configured API key", async () => {
        const fetchMock = jest.fn().mockResolvedValue(
            createFetchResponse({
                ok: true,
                status: 200,
                body: {
                    data: [
                        {
                            business_account_id: "98765432109",
                            customer_id: TEST_CUSTOMER_ID,
                            display_name: "Support Line",
                            display_phone_number: "+1 555-123-4567",
                            display_phone_number_normalized: "15551234567",
                            phone_number_id: TEST_PHONE_NUMBER_ID,
                            status: "CONNECTED",
                            verified_name: "Acme Corp",
                        },
                    ],
                },
            }),
        );
        const client = new KapsoPlatformClient(createConfigServiceMock({ KAPSO_API_KEY: "kapso-key" }), fetchMock);

        await expect(client.listPhoneNumbers()).resolves.toEqual([
            expect.objectContaining({
                businessAccountId: "98765432109",
                businessName: "Acme Corp",
                displayPhoneNumber: "+1 555-123-4567",
                phoneNumber: "15551234567",
            }),
        ]);
        expect(fetchMock).toHaveBeenCalledWith("https://api.kapso.ai/platform/v1/whatsapp/phone_numbers?per_page=100&page=1", expect.objectContaining({ headers: { "X-API-Key": "kapso-key" }, method: "GET" }));
    });

    it("gets one phone number by id with the configured API key", async () => {
        const fetchMock = jest.fn().mockResolvedValue(
            createFetchResponse({
                ok: true,
                status: 200,
                body: {
                    data: {
                        business_account_id: "3174045732780123",
                        customer_id: TEST_CUSTOMER_ID,
                        display_phone_number: "+506 7045 2242",
                        display_phone_number_normalized: "50670452242",
                        phone_number_id: TEST_PHONE_NUMBER_ID,
                        status: "CONNECTED",
                        verified_name: "RDG Ventas",
                    },
                },
            }),
        );
        const client = new KapsoPlatformClient(createConfigServiceMock({ KAPSO_API_KEY: "kapso-key" }), fetchMock);

        await expect(client.getPhoneNumber(TEST_PHONE_NUMBER_ID)).resolves.toEqual(
            expect.objectContaining({
                businessAccountId: "3174045732780123",
                businessName: "RDG Ventas",
                displayPhoneNumber: "+506 7045 2242",
                phoneNumber: "50670452242",
            }),
        );
        expect(fetchMock).toHaveBeenCalledWith(`https://api.kapso.ai/platform/v1/whatsapp/phone_numbers/${TEST_PHONE_NUMBER_ID}`, expect.objectContaining({ headers: { "X-API-Key": "kapso-key" }, method: "GET" }));
    });

    it("fails closed when the API key is missing", async () => {
        const client = new KapsoPlatformClient(createConfigServiceMock(undefined));

        await expect(client.listPhoneNumbers()).rejects.toThrow(ServiceUnavailableException);
    });

    it("returns UnauthorizedException when Kapso rejects the API key", async () => {
        const client = new KapsoPlatformClient(createConfigServiceMock({ KAPSO_API_KEY: "bad-key" }), jest.fn().mockResolvedValue(createFetchResponse({ body: { error: "bad key" }, ok: false, status: 401 })));

        await expect(client.listPhoneNumbers()).rejects.toThrow(UnauthorizedException);
    });

    it("ignores invalid phone number items instead of writing unknown shapes", async () => {
        const client = new KapsoPlatformClient(
            createConfigServiceMock({ KAPSO_API_KEY: "kapso-key" }),
            jest.fn().mockResolvedValue(
                createFetchResponse({
                    ok: true,
                    status: 200,
                    body: { data: [{ display_phone_number: "+1 555-123-4567" }] },
                }),
            ),
        );

        await expect(client.listPhoneNumbers()).resolves.toEqual([]);
    });
});
