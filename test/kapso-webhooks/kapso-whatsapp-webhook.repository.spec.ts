import { KapsoWhatsappWebhookRepository } from "../../src/kapso-webhooks/kapso-whatsapp-webhook.repository";

type PrismaMock = {
    readonly bitacora: {
        readonly create: jest.Mock;
        readonly findFirst: jest.Mock;
    };
    readonly kapsoEnvioTemplateInicialIntento: {
        readonly findFirst: jest.Mock;
        readonly updateMany: jest.Mock;
    };
    readonly lead: {
        readonly findUnique: jest.Mock;
        readonly updateMany: jest.Mock;
    };
    readonly transaction: jest.Mock;
};

const createPrismaMock = (): PrismaMock => {
    const prisma: PrismaMock = {
        bitacora: {
            create: jest.fn(),
            findFirst: jest.fn(),
        },
        kapsoEnvioTemplateInicialIntento: {
            findFirst: jest.fn(),
            updateMany: jest.fn(),
        },
        lead: {
            findUnique: jest.fn(),
            updateMany: jest.fn(),
        },
        transaction: jest.fn(async (callback: (tx: PrismaMock) => Promise<unknown>) => callback(prisma)),
    };

    return prisma;
};

const createRepository = (prisma = createPrismaMock()): KapsoWhatsappWebhookRepository => new KapsoWhatsappWebhookRepository(prisma as never);

describe("KapsoWhatsappWebhookRepository", () => {
    it("finds a template attempt by WhatsApp message id inside kapso_message_ids JSON", async () => {
        const prisma = createPrismaMock();
        prisma.kapsoEnvioTemplateInicialIntento.findFirst.mockResolvedValue({ idLead: 36640 });
        const repository = createRepository(prisma);

        await expect(repository.findTemplateAttemptByMessageId("wamid.failed-1")).resolves.toEqual({ idLead: 36640 });

        expect(prisma.kapsoEnvioTemplateInicialIntento.findFirst).toHaveBeenCalledWith({
            select: { idLead: true },
            where: {
                kapsoMessageIds: {
                    array_contains: "wamid.failed-1",
                },
                status: { in: ["sent", "delivered"] },
            },
        });
    });

    it("finds an open template attempt by lead id before accepting a customer response marker", async () => {
        const prisma = createPrismaMock();
        prisma.kapsoEnvioTemplateInicialIntento.findFirst.mockResolvedValue({ idLead: 36640 });
        const repository = createRepository(prisma);

        await expect(repository.findOpenTemplateAttemptByLeadId(36640)).resolves.toEqual({ idLead: 36640 });

        expect(prisma.kapsoEnvioTemplateInicialIntento.findFirst).toHaveBeenCalledWith({
            select: { idLead: true },
            where: {
                idLead: 36640,
                status: { in: ["sent", "delivered"] },
            },
        });
    });

    it("finds the latest sent or delivered template attempt by customer phone and Kapso number", async () => {
        const prisma = createPrismaMock();
        prisma.kapsoEnvioTemplateInicialIntento.findFirst.mockResolvedValue({ idLead: 36640 });
        const repository = createRepository(prisma);

        await expect(
            repository.findTemplateAttemptByPhone({
                phoneNumber: "50688325933",
                phoneNumberId: "1197677976762773",
            }),
        ).resolves.toEqual({ idLead: 36640 });

        expect(prisma.kapsoEnvioTemplateInicialIntento.findFirst).toHaveBeenCalledWith({
            orderBy: { updatedAt: "desc" },
            select: { idLead: true },
            where: {
                kapsoPhoneNumberId: "1197677976762773",
                status: { in: ["sent", "delivered"] },
                toPhoneNumber: "50688325933",
            },
        });
    });

    it("finds a template attempt by customer phone when Kapso omits phone_number_id", async () => {
        const prisma = createPrismaMock();
        const repository = createRepository(prisma);

        await repository.findTemplateAttemptByPhone({
            phoneNumber: "50688325933",
            phoneNumberId: null,
        });

        expect(prisma.kapsoEnvioTemplateInicialIntento.findFirst).toHaveBeenCalledWith({
            orderBy: { updatedAt: "desc" },
            select: { idLead: true },
            where: {
                status: { in: ["sent", "delivered"] },
                toPhoneNumber: "50688325933",
            },
        });
    });

    it("marks a template attempt as failed and stores the conversation id", async () => {
        const prisma = createPrismaMock();
        const repository = createRepository(prisma);

        await repository.updateTemplateAttemptFailure(36640, {
            conversationId: "0ca1d18f-fe78-47d6-a148-87a6420a1af3",
            errorMessage: "User's number is part of an experiment",
        });

        expect(prisma.kapsoEnvioTemplateInicialIntento.updateMany).toHaveBeenCalledWith({
            data: {
                errorMessage: "User's number is part of an experiment",
                kapsoConversationId: "0ca1d18f-fe78-47d6-a148-87a6420a1af3",
                status: "failed",
            },
            where: { idLead: 36640 },
        });
    });

    it("marks a template attempt as delivered and stores the conversation id", async () => {
        const prisma = createPrismaMock();
        const repository = createRepository(prisma);

        await repository.updateTemplateAttemptDelivered(36640, "0ca1d18f-fe78-47d6-a148-87a6420a1af3");

        expect(prisma.kapsoEnvioTemplateInicialIntento.updateMany).toHaveBeenCalledWith({
            data: {
                kapsoConversationId: "0ca1d18f-fe78-47d6-a148-87a6420a1af3",
                status: "delivered",
            },
            where: { idLead: 36640 },
        });
    });

    it("marks the initial template attempt as response registered when saving the first customer response", async () => {
        const prisma = createPrismaMock();
        const repository = createRepository(prisma);

        await repository.registerWhatsappResponse(
            36640,
            { idCaida: 69 },
            {
                detalleBit: "El cliente acepto recibir informacion por WhatsApp.",
                estadoBit: "08-LEAD-SEGUIMIENTO",
                estadoLead: 2,
                idAdminBit: 653055,
                idCaidaBit: 69,
                idLeadBit: 6430001,
                tipoDocumentoBit: "WhatsApp Kapso",
            },
            { markTemplateAttemptResponseRegistered: true },
        );

        expect(prisma.kapsoEnvioTemplateInicialIntento.updateMany).toHaveBeenCalledWith({
            data: { status: "response_registered" },
            where: {
                idLead: 36640,
                status: { in: ["sent", "delivered"] },
            },
        });
    });
});
