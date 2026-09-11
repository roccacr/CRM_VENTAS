import { EnvioTemplateInicialRepository } from "../../src/kapso-cronjobs/envio-template-inicial/envio-template-inicial.repository";

type PrismaMock = {
    readonly admin: {
        readonly findFirst: jest.Mock;
    };
    readonly bitacora: {
        readonly create: jest.Mock;
    };
    readonly kapsoCronjobConfiguracion: {
        readonly findFirst: jest.Mock;
    };
    readonly kapsoEnvioTemplateInicialIntento: {
        readonly create: jest.Mock;
        readonly findUnique: jest.Mock;
        readonly updateMany: jest.Mock;
    };
    readonly lead: {
        readonly findMany: jest.Mock;
        readonly updateMany: jest.Mock;
    };
    readonly transaction: jest.Mock;
};

const createPrismaMock = (): PrismaMock => ({
    admin: {
        findFirst: jest.fn(),
    },
    bitacora: {
        create: jest.fn(),
    },
    kapsoCronjobConfiguracion: {
        findFirst: jest.fn(),
    },
    kapsoEnvioTemplateInicialIntento: {
        create: jest.fn(),
        findUnique: jest.fn(),
        updateMany: jest.fn(),
    },
    lead: {
        findMany: jest.fn(),
        updateMany: jest.fn(),
    },
    transaction: jest.fn(async (callback: (tx: PrismaMock) => Promise<unknown>) => callback(createPrismaMock())),
});

const createRepository = (prisma = createPrismaMock()): EnvioTemplateInicialRepository => new EnvioTemplateInicialRepository(prisma as never);

describe("EnvioTemplateInicialRepository", () => {
    it("loads the cronjob with active project configs and admin assignments", async () => {
        const prisma = createPrismaMock();
        prisma.kapsoCronjobConfiguracion.findFirst.mockResolvedValue(null);
        const repository = createRepository(prisma);

        await repository.findCronjobConfig("envio_template_inicial");

        expect(prisma.kapsoCronjobConfiguracion.findFirst).toHaveBeenCalledWith({
            include: {
                projectConfigs: {
                    include: {
                        integration: {
                            include: { adminAssignments: true },
                        },
                    },
                    orderBy: { createdAt: "asc" },
                    where: { isActive: true },
                },
            },
            where: { cronjobId: "envio_template_inicial" },
        });
    });

    it("does not query leads when the cronjob has no configured projects", async () => {
        const prisma = createPrismaMock();
        const repository = createRepository(prisma);

        await expect(repository.findPendingLeads([], 10)).resolves.toEqual([]);
        expect(prisma.lead.findMany).not.toHaveBeenCalled();
    });

    it("finds only pending interested leads from configured projects", async () => {
        const prisma = createPrismaMock();
        prisma.lead.findMany.mockResolvedValue([]);
        const repository = createRepository(prisma);

        await repository.findPendingLeads([4, 38], 25);

        expect(prisma.lead.findMany).toHaveBeenCalledWith({
            orderBy: { idLead: "asc" },
            select: {
                accionLead: true,
                estadoLead: true,
                idCaida: true,
                idEmpleadoLead: true,
                idLead: true,
                idinternoLead: true,
                idproyectoLead: true,
                nombreLead: true,
                proyectoLead: true,
                segiminetoLead: true,
                telefonoLead: true,
                whatsappTemplateContactSent: true,
            },
            take: 25,
            where: {
                estadoLead: 2,
                idproyectoLead: { in: [4, 38] },
                segiminetoLead: "01-LEAD-INTERESADO",
                whatsappTemplateContactSent: 2,
            },
        });
    });

    it("detects whether a lead already has a template attempt", async () => {
        const prisma = createPrismaMock();
        prisma.kapsoEnvioTemplateInicialIntento.findUnique.mockResolvedValue({ id: 1n });
        const repository = createRepository(prisma);

        await expect(repository.hasTemplateAttemptForLead(36640)).resolves.toBe(true);

        expect(prisma.kapsoEnvioTemplateInicialIntento.findUnique).toHaveBeenCalledWith({
            select: { id: true },
            where: { idLead: 36640 },
        });
    });

    it("registers and updates one technical template attempt per lead", async () => {
        const prisma = createPrismaMock();
        const repository = createRepository(prisma);

        await repository.registerTemplateAttempt({
            idAdmin: 653055,
            idLead: 36640,
            idproyectoLead: 4,
            kapsoIntegracionNumeroWhatsappId: 1n,
            kapsoPhoneNumberId: "1197677976762773",
            normalizedPhoneNumber: "50670452222",
            status: "processing",
        });
        await repository.updateTemplateAttemptResult({
            idLead: 36640,
            kapsoMessageIds: ["wamid.123"],
            rawResponse: { messages: [{ id: "wamid.123" }] },
            status: "sent",
        });

        expect(prisma.kapsoEnvioTemplateInicialIntento.create).toHaveBeenCalledWith({
            data: {
                idAdmin: 653055,
                idLead: 36640,
                idproyectoLead: 4,
                kapsoIntegracionNumeroWhatsappId: 1n,
                kapsoMessageIds: [],
                kapsoPhoneNumberId: "1197677976762773",
                status: "processing",
                toPhoneNumber: "50670452222",
            },
        });
        expect(prisma.kapsoEnvioTemplateInicialIntento.updateMany).toHaveBeenCalledWith({
            data: {
                errorMessage: null,
                kapsoMessageIds: ["wamid.123"],
                rawResponse: { messages: [{ id: "wamid.123" }] },
                status: "sent",
            },
            where: { idLead: 36640 },
        });
    });

    it("updates the lead and writes bitacora in one transaction", async () => {
        let transactionClient: PrismaMock = createPrismaMock();
        const prisma = createPrismaMock();
        prisma.transaction.mockImplementation(async (callback: (tx: PrismaMock) => Promise<unknown>) => {
            transactionClient = createPrismaMock();
            return callback(transactionClient);
        });
        const repository = createRepository(prisma);

        await repository.markLeadProcessedWithBitacora(
            36640,
            { whatsappTemplateContactSent: 0 },
            {
                detalleBit: "Template saludo inicial enviado con exito por Kapso.",
                estadoBit: "08-LEAD-SEGUIMIENTO",
                estadoLead: 2,
                idAdminBit: 653055,
                idCaidaBit: 70,
                idLeadBit: 6430001,
                tipoDocumentoBit: "WhatsApp Kapso",
            },
        );

        expect(prisma.transaction).toHaveBeenCalledTimes(1);
        expect(transactionClient.lead.updateMany).toHaveBeenCalledWith({
            data: { whatsappTemplateContactSent: 0 },
            where: { idLead: 36640 },
        });
        expect(transactionClient.bitacora.create).toHaveBeenCalledWith({
            data: {
                detalleBit: "Template saludo inicial enviado con exito por Kapso.",
                estadoBit: "08-LEAD-SEGUIMIENTO",
                estadoLead: 2,
                fechSegBit: "",
                idAdminBit: 653055,
                idCaidaBit: 70,
                idLeadBit: 6430001,
                tipoDocumentoBit: "WhatsApp Kapso",
            },
        });
    });
});
