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
    readonly findTemplateAttemptByMessageId: jest.MockedFunction<(messageId: string) => Promise<{ readonly idLead: number } | null>>;
    readonly findTemplateAttemptByPhone: jest.MockedFunction<(input: { readonly phoneNumber: string; readonly phoneNumberId: string | null }) => Promise<{ readonly idLead: number } | null>>;
    readonly findOpenTemplateAttemptByLeadId: jest.MockedFunction<(idLead: number) => Promise<{ readonly idLead: number } | null>>;
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
            options?: { readonly markTemplateAttemptResponseRegistered?: boolean },
        ) => Promise<void>
    >;
    readonly updateTemplateAttemptConversation: jest.MockedFunction<(idLead: number, conversationId: string) => Promise<void>>;
    readonly updateTemplateAttemptDelivered: jest.MockedFunction<(idLead: number, conversationId: string | null) => Promise<void>>;
    readonly updateTemplateAttemptFailure: jest.MockedFunction<(idLead: number, input: { readonly conversationId: string | null; readonly errorMessage: string }) => Promise<void>>;
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
    findTemplateAttemptByMessageId: jest.fn().mockResolvedValue({ idLead: 36640 }),
    findTemplateAttemptByPhone: jest.fn().mockResolvedValue({ idLead: 36640 }),
    findOpenTemplateAttemptByLeadId: jest.fn().mockResolvedValue({ idLead: 36640 }),
    registerWhatsappResponse: jest.fn().mockResolvedValue(undefined),
    updateTemplateAttemptConversation: jest.fn().mockResolvedValue(undefined),
    updateTemplateAttemptDelivered: jest.fn().mockResolvedValue(undefined),
    updateTemplateAttemptFailure: jest.fn().mockResolvedValue(undefined),
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

const createInteractivePayloadWithoutLeadMarker = (title: string): unknown => ({
    conversation: {
        id: "conv_new_24h_window",
        phone_number: "50688325933",
    },
    message: {
        context: {
            id: "wamid.outbound-template-1",
        },
        interactive: {
            button_reply: {
                id: "accepted_info",
                title,
            },
            type: "button_reply",
        },
        type: "interactive",
    },
    phone_number_id: "1197677976762773",
});

const createInteractivePayloadWithPhoneOnly = (title: string): unknown => ({
    conversation: {
        id: "conv_new_without_context",
        phone_number: "+506 8832 5933",
        phone_number_id: "1197677976762773",
    },
    message: {
        interactive: {
            button_reply: {
                title,
            },
            type: "button_reply",
        },
        type: "interactive",
    },
});

const createFailedPayload = (): unknown => ({
    conversation: {
        id: "0ca1d18f-fe78-47d6-a148-87a6420a1af3",
    },
    message: {
        failure_reason: "User's number is part of an experiment",
        id: "wamid.failed-1",
        to: "50687515938",
        type: "template",
    },
    phone_number_id: "1197677976762773",
    type: "whatsapp.message.failed",
});

const createDeliveredPayload = (): unknown => ({
    conversation: {
        id: "0ca1d18f-fe78-47d6-a148-87a6420a1af3",
    },
    message: {
        id: "wamid.delivered-1",
        to: "50688325933",
        type: "template",
    },
    phone_number_id: "1197677976762773",
    type: "whatsapp.message.delivered",
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

        expect(repository.findOpenTemplateAttemptByLeadId).toHaveBeenCalledWith(36640);
        expect(repository.registerWhatsappResponse).toHaveBeenCalledWith(36640, { idCaida: 69 }, expect.any(Object), { markTemplateAttemptResponseRegistered: true });
        const bitacora = getLastRegisteredBitacora(repository);
        expect(bitacora.detalleBit).toContain("cliente acepto recibir informacion por WhatsApp");
        expect(bitacora.idAdminBit).toBe(653055);
        expect(bitacora.idCaidaBit).toBe(69);
        expect(bitacora.idLeadBit).toBe(6430001);
        expect(repository.updateTemplateAttemptConversation).toHaveBeenCalledWith(36640, "conv_123");
    });

    it("registers a button response linked by the outbound template context id", async () => {
        const repository = createRepository();
        const service = createService(repository);

        await expect(
            service.process({
                event: "whatsapp.message.received",
                idempotencyKey: "idem-context-reply",
                payload: createInteractivePayloadWithoutLeadMarker("Sí, enviar información"),
            }),
        ).resolves.toEqual({ action: "accepted_info", processed: true });

        expect(repository.findTemplateAttemptByMessageId).toHaveBeenCalledWith("wamid.outbound-template-1");
        expect(repository.findTemplateAttemptByPhone).not.toHaveBeenCalled();
        expect(repository.registerWhatsappResponse).toHaveBeenCalledWith(36640, { idCaida: 69 }, expect.any(Object), { markTemplateAttemptResponseRegistered: true });
        const bitacora = getLastRegisteredBitacora(repository);
        expect(bitacora.detalleBit).toContain('Respuesta: "Sí, enviar información".');
        expect(repository.updateTemplateAttemptConversation).toHaveBeenCalledWith(36640, "conv_new_24h_window");
    });

    it("registers a button response linked by phone when Kapso opens another conversation window", async () => {
        const repository = createRepository();
        repository.findTemplateAttemptByMessageId.mockResolvedValue(null);
        const service = createService(repository);

        await expect(
            service.process({
                event: "whatsapp.message.received",
                idempotencyKey: "idem-phone-reply",
                payload: createInteractivePayloadWithPhoneOnly("Sí, enviar información"),
            }),
        ).resolves.toEqual({ action: "accepted_info", processed: true });

        expect(repository.findTemplateAttemptByPhone).toHaveBeenCalledWith({
            phoneNumber: "50688325933",
            phoneNumberId: "1197677976762773",
        });
        expect(repository.registerWhatsappResponse).toHaveBeenCalledWith(36640, { idCaida: 69 }, expect.any(Object), { markTemplateAttemptResponseRegistered: true });
        expect(repository.updateTemplateAttemptConversation).toHaveBeenCalledWith(36640, "conv_new_without_context");
    });

    it("registers rejected initial information responses as lost leads with caida 67", async () => {
        const repository = createRepository();
        const service = createService(repository);

        await expect(
            service.process({
                event: "whatsapp.message.received",
                idempotencyKey: "idem-no",
                payload: createInteractivePayload("No, gracias"),
            }),
        ).resolves.toEqual({ action: "rejected_info", processed: true });

        expect(repository.registerWhatsappResponse).toHaveBeenCalledWith(
            36640,
            {
                estadoLead: 0,
                idCaida: 67,
                segiminetoLead: "07-LEAD-PERDIDO",
            },
            expect.any(Object),
            { markTemplateAttemptResponseRegistered: true },
        );
        const bitacora = getLastRegisteredBitacora(repository);
        expect(bitacora.detalleBit).toContain("cliente no quiso recibir informacion por WhatsApp");
        expect(bitacora.estadoBit).toBe("07-LEAD-PERDIDO");
        expect(bitacora.estadoLead).toBe(0);
        expect(bitacora.idCaidaBit).toBe(67);
    });

    it("registers unmapped customer responses as accepted because the client opened the WhatsApp thread", async () => {
        const repository = createRepository();
        const service = createService(repository);

        await expect(
            service.process({
                event: "whatsapp.message.received",
                idempotencyKey: "idem-other",
                payload: createInteractivePayload("Mejor mañana"),
            }),
        ).resolves.toEqual({ action: "unmapped_response", processed: true });

        expect(repository.registerWhatsappResponse).toHaveBeenCalledWith(36640, { idCaida: 69 }, expect.any(Object), { markTemplateAttemptResponseRegistered: true });
        const bitacora = getLastRegisteredBitacora(repository);
        expect(bitacora.detalleBit).toContain("no fue ninguna de las respuestas predeterminadas");
        expect(bitacora.idCaidaBit).toBe(69);
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

    it("registers a late template failure from whatsapp.message.failed", async () => {
        const repository = createRepository();
        const service = createService(repository);

        await expect(
            service.process({
                event: "whatsapp.message.failed",
                idempotencyKey: "failed-idem-1",
                payload: createFailedPayload(),
            }),
        ).resolves.toEqual({ action: "template_failed", processed: true });

        expect(repository.findTemplateAttemptByMessageId).toHaveBeenCalledWith("wamid.failed-1");
        expect(repository.updateTemplateAttemptFailure).toHaveBeenCalledWith(36640, {
            conversationId: "0ca1d18f-fe78-47d6-a148-87a6420a1af3",
            errorMessage: "User's number is part of an experiment",
        });
        expect(repository.registerWhatsappResponse).toHaveBeenCalledWith(36640, { idCaida: 68 }, expect.any(Object));
        const bitacora = getLastRegisteredBitacora(repository);
        expect(bitacora.detalleBit).toContain("No se pudo entregar el template saludo inicial por WhatsApp.");
        expect(bitacora.detalleBit).toContain("failed-idem-1");
        expect(bitacora.idCaidaBit).toBe(68);
        expect(bitacora.idLeadBit).toBe(6430001);
    });

    it("registers a delivered template status from whatsapp.message.delivered", async () => {
        const repository = createRepository();
        const service = createService(repository);

        await expect(
            service.process({
                event: "whatsapp.message.delivered",
                idempotencyKey: "delivered-idem-1",
                payload: createDeliveredPayload(),
            }),
        ).resolves.toEqual({ action: "template_delivered", processed: true });

        expect(repository.findTemplateAttemptByMessageId).toHaveBeenCalledWith("wamid.delivered-1");
        expect(repository.updateTemplateAttemptDelivered).toHaveBeenCalledWith(36640, "0ca1d18f-fe78-47d6-a148-87a6420a1af3");
        expect(repository.registerWhatsappResponse).toHaveBeenCalledWith(36640, { idCaida: 70 }, expect.any(Object));
        const bitacora = getLastRegisteredBitacora(repository);
        expect(bitacora.detalleBit).toContain("WhatsApp confirmo que el cliente recibio el template inicial.");
        expect(bitacora.detalleBit).toContain("delivered-idem-1");
        expect(bitacora.idCaidaBit).toBe(70);
    });

    it("does not duplicate a delivered template status with the same idempotency key", async () => {
        const repository = createRepository();
        repository.findBitacoraByIdempotencyKey.mockResolvedValue({ idBitacoraBit: 99 });
        const service = createService(repository);

        await expect(
            service.process({
                event: "whatsapp.message.delivered",
                idempotencyKey: "delivered-idem-duplicate",
                payload: createDeliveredPayload(),
            }),
        ).resolves.toEqual({ action: "duplicate", processed: false });

        expect(repository.findTemplateAttemptByMessageId).not.toHaveBeenCalled();
        expect(repository.updateTemplateAttemptDelivered).not.toHaveBeenCalled();
        expect(repository.registerWhatsappResponse).not.toHaveBeenCalled();
    });

    it("does not duplicate a late template failure with the same idempotency key", async () => {
        const repository = createRepository();
        repository.findBitacoraByIdempotencyKey.mockResolvedValue({ idBitacoraBit: 99 });
        const service = createService(repository);

        await expect(
            service.process({
                event: "whatsapp.message.failed",
                idempotencyKey: "failed-idem-duplicate",
                payload: createFailedPayload(),
            }),
        ).resolves.toEqual({ action: "duplicate", processed: false });

        expect(repository.findTemplateAttemptByMessageId).not.toHaveBeenCalled();
        expect(repository.updateTemplateAttemptFailure).not.toHaveBeenCalled();
        expect(repository.registerWhatsappResponse).not.toHaveBeenCalled();
    });

    it("ignores a template failure that cannot be linked to a known template attempt", async () => {
        const repository = createRepository();
        repository.findTemplateAttemptByMessageId.mockResolvedValue(null);
        const service = createService(repository);

        await expect(
            service.process({
                event: "whatsapp.message.failed",
                idempotencyKey: "failed-idem-missing",
                payload: createFailedPayload(),
            }),
        ).resolves.toEqual({ action: "ignored", processed: false });

        expect(repository.updateTemplateAttemptFailure).not.toHaveBeenCalled();
        expect(repository.registerWhatsappResponse).not.toHaveBeenCalled();
    });

    it("ignores a template failure without a WhatsApp message id", async () => {
        const repository = createRepository();
        const service = createService(repository);

        await expect(
            service.process({
                event: "whatsapp.message.failed",
                idempotencyKey: "failed-idem-no-message",
                payload: { message: { id: "local-message" } },
            }),
        ).resolves.toEqual({ action: "ignored", processed: false });

        expect(repository.findTemplateAttemptByMessageId).not.toHaveBeenCalled();
        expect(repository.updateTemplateAttemptFailure).not.toHaveBeenCalled();
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

    it("ignores a later customer message when the initial template response was already registered", async () => {
        const repository = createRepository();
        repository.findOpenTemplateAttemptByLeadId.mockResolvedValue(null);
        const service = createService(repository);

        await expect(
            service.process({
                event: "whatsapp.message.received",
                idempotencyKey: "idem-second-message",
                payload: createInteractivePayload("Otra pregunta despues de responder"),
            }),
        ).resolves.toEqual({ action: "ignored", processed: false });

        expect(repository.findOpenTemplateAttemptByLeadId).toHaveBeenCalledWith(36640);
        expect(repository.findLeadForWhatsappResponse).not.toHaveBeenCalled();
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
        expect(repository.registerWhatsappResponse).toHaveBeenCalledWith(36640, { idCaida: 69 }, expect.any(Object), { markTemplateAttemptResponseRegistered: true });
    });
});
