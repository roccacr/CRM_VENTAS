import { KapsoWhatsappWebhookService } from "../../src/kapso-webhooks/kapso-whatsapp-webhook.service";

type RepositoryMock = {
    readonly findBitacoraByIdempotencyKey: jest.MockedFunction<(key: string) => Promise<unknown>>;
    readonly findLeadForWhatsappResponse: jest.MockedFunction<
        (idLead: number) => Promise<{
            readonly estadoLead: number | null;
            readonly idEmpleadoLead: number | null;
            readonly idLead: number;
            readonly idinternoLead: number | null;
            readonly segiminetoLead: string | null;
        } | null>
    >;
    readonly registerWhatsappResponse: jest.MockedFunction<
        (
            idLead: number,
            leadUpdate: Record<string, unknown> | null,
            bitacora: {
                readonly detalleBit: string;
                readonly estadoBit: string;
                readonly estadoLead: number;
                readonly idAdminBit: number;
                readonly idCaidaBit?: number | null;
                readonly idLeadBit: number;
                readonly tipoDocumentoBit: string;
            },
        ) => Promise<void>
    >;
    readonly updateTemplateAttemptConversation: jest.MockedFunction<(idLead: number, conversationId: string) => Promise<void>>;
};

const createRepository = (): RepositoryMock => ({
    findBitacoraByIdempotencyKey: jest.fn().mockResolvedValue(null),
    findLeadForWhatsappResponse: jest.fn().mockResolvedValue({
        estadoLead: 2,
        idEmpleadoLead: 653055,
        idLead: 36640,
        idinternoLead: 6430001,
        segiminetoLead: "08-LEAD-SEGUIMIENTO",
    }),
    registerWhatsappResponse: jest.fn().mockResolvedValue(undefined),
    updateTemplateAttemptConversation: jest.fn().mockResolvedValue(undefined),
});

const createService = (repository = createRepository()): KapsoWhatsappWebhookService => new KapsoWhatsappWebhookService(repository as never);

function getLastRegisteredBitacora(repository: RepositoryMock): Parameters<RepositoryMock["registerWhatsappResponse"]>[2] {
    const call = repository.registerWhatsappResponse.mock.calls.at(-1);

    if (!call) {
        throw new Error("Expected registerWhatsappResponse to be called");
    }

    return call[2];
}

const createInteractivePayload = (title: string): Record<string, unknown> => ({
    message: {
        id: "wamid.inbound-1",
        interactive: {
            button_reply: {
                id: title,
                title,
            },
            type: "button_reply",
        },
        kapso: {
            content: title,
        },
        type: "interactive",
    },
    tracking: {
        biz_opaque_callback_data: "crm_lead:36640;template:saludo",
    },
});

const createInteractivePayloadWithConversation = (title: string): unknown => ({
    ...createInteractivePayload(title),
    conversation: {
        id: "conv_123",
    },
});

describe("KapsoWhatsappWebhookService", () => {
    it("registers accepted initial information responses with caida 69", async () => {
        const repository = createRepository();
        const service = createService(repository);

        await expect(
            service.process({
                event: "whatsapp.message.received",
                idempotencyKey: "idem-yes",
                payload: createInteractivePayloadWithConversation("Sí, enviar información"),
            }),
        ).resolves.toEqual({ action: "accepted_info", processed: true });

        expect(repository.registerWhatsappResponse).toHaveBeenCalledWith(36640, { idCaida: 69 }, expect.any(Object));
        const bitacora = getLastRegisteredBitacora(repository);
        expect(bitacora.detalleBit).toContain("cliente acepto recibir informacion por WhatsApp");
        expect(bitacora.idAdminBit).toBe(653055);
        expect(bitacora.idCaidaBit).toBe(69);
        expect(bitacora.idLeadBit).toBe(6430001);
        expect(repository.updateTemplateAttemptConversation).toHaveBeenCalledWith(36640, "conv_123");
    });

    it("registers rejected initial information responses with caida 67", async () => {
        const repository = createRepository();
        const service = createService(repository);

        await expect(
            service.process({
                event: "whatsapp.message.received",
                idempotencyKey: "idem-no",
                payload: createInteractivePayload("No, gracias"),
            }),
        ).resolves.toEqual({ action: "rejected_info", processed: true });

        expect(repository.registerWhatsappResponse).toHaveBeenCalledWith(36640, { idCaida: 67 }, expect.any(Object));
        const bitacora = getLastRegisteredBitacora(repository);
        expect(bitacora.detalleBit).toContain("cliente no quiso recibir informacion por WhatsApp");
        expect(bitacora.idCaidaBit).toBe(67);
    });

    it("registers unmapped customer responses without changing caida", async () => {
        const repository = createRepository();
        const service = createService(repository);

        await expect(
            service.process({
                event: "whatsapp.message.received",
                idempotencyKey: "idem-other",
                payload: createInteractivePayload("Mejor mañana"),
            }),
        ).resolves.toEqual({ action: "unmapped_response", processed: true });

        expect(repository.registerWhatsappResponse).toHaveBeenCalledWith(36640, null, expect.any(Object));
        const bitacora = getLastRegisteredBitacora(repository);
        expect(bitacora.detalleBit).toContain("no fue ninguna de las respuestas predeterminadas");
        expect(bitacora.idCaidaBit).toBeNull();
    });

    it("ignores duplicated idempotency keys without writing a second bitacora", async () => {
        const repository = createRepository();
        repository.findBitacoraByIdempotencyKey.mockResolvedValue({ idBitacoraBit: 99 });
        const service = createService(repository);

        await expect(
            service.process({
                event: "whatsapp.message.received",
                idempotencyKey: "idem-duplicate",
                payload: createInteractivePayload("Sí, enviar información"),
            }),
        ).resolves.toEqual({ action: "duplicate", processed: false });

        expect(repository.registerWhatsappResponse).not.toHaveBeenCalled();
    });

    it("ignores payloads that cannot be linked to a CRM lead", async () => {
        const repository = createRepository();
        const service = createService(repository);

        await expect(
            service.process({
                event: "whatsapp.message.received",
                payload: { message: { text: { body: "Sí, enviar información" } } },
            }),
        ).resolves.toEqual({ action: "ignored", processed: false });

        expect(repository.registerWhatsappResponse).not.toHaveBeenCalled();
    });

    it("ignores non-message.received events without touching the database", async () => {
        const repository = createRepository();
        const service = createService(repository);

        await expect(
            service.process({
                event: "whatsapp.message.sent",
                idempotencyKey: "idem-other-event",
                payload: createInteractivePayload("Sí, enviar información"),
            }),
        ).resolves.toEqual({ action: "ignored", processed: false });

        expect(repository.findBitacoraByIdempotencyKey).not.toHaveBeenCalled();
        expect(repository.registerWhatsappResponse).not.toHaveBeenCalled();
    });

    it("ignores a crm_lead marker when the lead no longer exists", async () => {
        const repository = createRepository();
        repository.findLeadForWhatsappResponse.mockResolvedValue(null);
        const service = createService(repository);

        await expect(
            service.process({
                event: "whatsapp.message.received",
                idempotencyKey: "idem-missing-lead",
                payload: createInteractivePayload("Sí, enviar información"),
            }),
        ).resolves.toEqual({ action: "ignored", processed: false });

        expect(repository.registerWhatsappResponse).not.toHaveBeenCalled();
    });

    it("processes a free-text body when the idempotency key is absent", async () => {
        const repository = createRepository();
        const service = createService(repository);

        await expect(
            service.process({
                event: "whatsapp.message.received",
                payload: {
                    message: { text: { body: "Sí, enviar información" } },
                    tracking: { biz_opaque_callback_data: "crm_lead:36640;template:saludo" },
                },
            }),
        ).resolves.toEqual({ action: "accepted_info", processed: true });

        expect(repository.findBitacoraByIdempotencyKey).not.toHaveBeenCalled();
        const bitacora = getLastRegisteredBitacora(repository);
        expect(bitacora.detalleBit).not.toContain("idem:");
        expect(repository.updateTemplateAttemptConversation).not.toHaveBeenCalled();
    });
});
