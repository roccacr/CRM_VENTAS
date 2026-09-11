import { ServiceUnavailableException, UnauthorizedException } from "@nestjs/common";

import { KapsoTemplateMessageClient } from "../../src/kapso-cronjobs/envio-template-inicial/kapso-template-message.client";
import { createConfigServiceMock } from "../common/auth/mocks";

const createFetchResponse = (options: { readonly body: unknown; readonly ok: boolean; readonly status: number }): Response =>
    ({
        json: jest.fn().mockResolvedValue(options.body),
        ok: options.ok,
        status: options.status,
    }) as unknown as Response;

const input = {
    adminName: "Roberto Carlos",
    leadId: 36640,
    leadName: "Cliente Uno",
    phoneNumberId: "1197677976762773",
    projectName: "La Estefana",
    to: "50670452222",
};

type TemplatePayload = {
    readonly template?: {
        readonly components?: {
            readonly parameters?: { readonly text?: string; readonly type?: string }[];
            readonly type?: string;
        }[];
        readonly language?: { readonly code?: string };
        readonly name?: string;
    };
    readonly to?: string;
};

describe("KapsoTemplateMessageClient", () => {
    it("sends saludo template through Kapso marketing messages API", async () => {
        const fetchMock = jest.fn().mockResolvedValue(
            createFetchResponse({
                body: { messages: [{ id: "wamid.123" }] },
                ok: true,
                status: 200,
            }),
        );
        const client = new KapsoTemplateMessageClient(createConfigServiceMock({ KAPSO_API_KEY: "kapso-key" }), fetchMock);

        await expect(client.sendSaludoTemplate(input)).resolves.toEqual({
            messageIds: ["wamid.123"],
            rawResponse: { messages: [{ id: "wamid.123" }] },
        });
        expect(fetchMock).toHaveBeenCalledWith(
            "https://api.kapso.ai/meta/whatsapp/v24.0/1197677976762773/marketing_messages",
            expect.objectContaining({
                headers: { "Content-Type": "application/json", "X-API-Key": "kapso-key" },
                method: "POST",
            }),
        );
        const calls = fetchMock.mock.calls as [string, RequestInit][];
        const request = calls[0]?.[1];
        expect(typeof request?.body).toBe("string");
        const requestBody = typeof request?.body === "string" ? request.body : "";
        const parsedBody = JSON.parse(requestBody) as unknown as TemplatePayload;

        expect(parsedBody.to).toBe("50670452222");
        expect(parsedBody.template?.name).toBe("saludo");
        expect(parsedBody.template?.language?.code).toBe("es_ES");
        expect(parsedBody.template?.components?.[0]?.type).toBe("body");
        expect(parsedBody.template?.components?.[0]?.parameters).toEqual([
            { text: "Cliente Uno", type: "text" },
            { text: "Roberto Carlos", type: "text" },
            { text: "La Estefana", type: "text" },
        ]);
    });

    it("fails closed when KAPSO_API_KEY is missing", async () => {
        const client = new KapsoTemplateMessageClient(createConfigServiceMock(undefined));

        await expect(client.sendSaludoTemplate(input)).rejects.toThrow(ServiceUnavailableException);
    });

    it("returns UnauthorizedException when Kapso rejects the API key", async () => {
        const client = new KapsoTemplateMessageClient(createConfigServiceMock({ KAPSO_API_KEY: "bad-key" }), jest.fn().mockResolvedValue(createFetchResponse({ body: { error: "bad key" }, ok: false, status: 401 })));

        await expect(client.sendSaludoTemplate(input)).rejects.toThrow(UnauthorizedException);
    });

    it("keeps the Kapso error message for diagnostics", async () => {
        const client = new KapsoTemplateMessageClient(
            createConfigServiceMock({ KAPSO_API_KEY: "kapso-key" }),
            jest.fn().mockResolvedValue(
                createFetchResponse({
                    body: { error: { message: "Invalid phone number format" } },
                    ok: false,
                    status: 400,
                }),
            ),
        );

        await expect(client.sendSaludoTemplate(input)).rejects.toThrow("Invalid phone number format");
    });

    it("rejects unusable accepted responses", async () => {
        const client = new KapsoTemplateMessageClient(createConfigServiceMock({ KAPSO_API_KEY: "kapso-key" }), jest.fn().mockResolvedValue(createFetchResponse({ body: { messages: [] }, ok: true, status: 200 })));

        await expect(client.sendSaludoTemplate(input)).rejects.toThrow("Kapso template response is not usable");
    });
});
