import { EnvioTemplateInicialService } from "../../src/kapso-cronjobs/envio-template-inicial/envio-template-inicial.service";

const now = new Date("2026-09-10T20:00:00.000Z");

type ProjectConfig = {
    readonly idproyectoLead: number;
    readonly integration: {
        readonly adminAssignments: { readonly idnetsuiteAdmin: number }[];
        readonly id: bigint;
        readonly isActive: boolean;
        readonly kapsoPhoneNumberId: string;
    };
    readonly isActive: boolean;
};

type LeadSnapshot = {
    readonly accionLead: number;
    readonly estadoLead: number | null;
    readonly idCaida: number | null;
    readonly idEmpleadoLead: number | null;
    readonly idLead: number;
    readonly idinternoLead: number | null;
    readonly idproyectoLead: number | null;
    readonly nombreLead: string | null;
    readonly proyectoLead: string | null;
    readonly segiminetoLead: string | null;
    readonly telefonoLead: string | null;
    readonly whatsappTemplateContactSent: number;
};

type RepositoryMock = {
    readonly findActiveAdminByIdnetsuite: jest.MockedFunction<(idnetsuiteAdmin: number) => Promise<{ readonly idnetsuiteAdmin: number; readonly nameAdmin: string } | null>>;
    readonly hasTemplateAttemptForLead: jest.MockedFunction<(idLead: number) => Promise<boolean>>;
    readonly findCronjobConfig: jest.MockedFunction<(cronjobId: string) => Promise<{ readonly isActive: boolean; readonly projectConfigs: ProjectConfig[] } | null>>;
    readonly findPendingLeads: jest.MockedFunction<(projectIds: number[], limit: number) => Promise<LeadSnapshot[]>>;
    readonly registerTemplateAttempt: jest.MockedFunction<(input: { readonly idAdmin: number; readonly idLead: number; readonly idproyectoLead: number | null; readonly kapsoIntegracionNumeroWhatsappId: bigint | null; readonly kapsoPhoneNumberId: string | null; readonly normalizedPhoneNumber: string | null; readonly status: string }) => Promise<void>>;
    readonly updateTemplateAttemptResult: jest.MockedFunction<(input: { readonly errorMessage?: string | null; readonly idLead: number; readonly kapsoMessageIds?: readonly string[]; readonly rawResponse?: unknown; readonly status: string }) => Promise<void>>;
    readonly markLeadProcessedWithBitacora: jest.MockedFunction<
        (
            leadId: number,
            leadUpdate: Record<string, unknown>,
            bitacora: {
                readonly detalleBit: string;
                readonly estadoBit?: string;
                readonly estadoLead?: number;
                readonly idAdminBit: number;
                readonly idCaidaBit?: number | null;
                readonly idLeadBit?: number;
                readonly tipoDocumentoBit?: string;
            },
        ) => Promise<void>
    >;
};

type KapsoClientMock = {
    readonly sendSaludoTemplate: jest.MockedFunction<(input: unknown) => Promise<{ readonly messageIds: string[]; readonly rawResponse: unknown }>>;
};

const createLead = (overrides: Partial<LeadSnapshot> = {}): LeadSnapshot => ({
    accionLead: 0,
    estadoLead: 2,
    idCaida: 0,
    idEmpleadoLead: 653055,
    idLead: 36640,
    idinternoLead: 6430001,
    idproyectoLead: 4,
    nombreLead: "Cliente Uno",
    proyectoLead: "La Estefana",
    segiminetoLead: "01-LEAD-INTERESADO",
    telefonoLead: "7045-2222",
    whatsappTemplateContactSent: 2,
    ...overrides,
});

const createProjectConfig = (overrides: Partial<ProjectConfig> = {}): ProjectConfig => ({
    idproyectoLead: 4,
    integration: {
        adminAssignments: [{ idnetsuiteAdmin: 653055 }],
        id: 1n,
        isActive: true,
        kapsoPhoneNumberId: "1197677976762773",
    },
    isActive: true,
    ...overrides,
});

function createRepository(): RepositoryMock {
    return {
        findActiveAdminByIdnetsuite: jest.fn().mockResolvedValue({
            idnetsuiteAdmin: 653055,
            nameAdmin: "Roberto Carlos",
        }),
        hasTemplateAttemptForLead: jest.fn().mockResolvedValue(false),
        findCronjobConfig: jest.fn().mockResolvedValue({
            isActive: true,
            projectConfigs: [createProjectConfig()],
        }),
        findPendingLeads: jest.fn().mockResolvedValue([createLead()]),
        markLeadProcessedWithBitacora: jest.fn().mockResolvedValue(undefined),
        registerTemplateAttempt: jest.fn().mockResolvedValue(undefined),
        updateTemplateAttemptResult: jest.fn().mockResolvedValue(undefined),
    };
}

function createKapsoClient(): KapsoClientMock {
    return {
        sendSaludoTemplate: jest.fn<Promise<{ readonly messageIds: string[]; readonly rawResponse: unknown }>, [unknown]>().mockResolvedValue({ messageIds: ["wamid.123"], rawResponse: { messages: ["wamid.123"] } }),
    };
}

function createService(repository = createRepository(), kapsoClient?: KapsoClientMock): EnvioTemplateInicialService {
    return new EnvioTemplateInicialService(repository as never, (kapsoClient ?? createKapsoClient()) as never);
}

function getLastLeadUpdate(repository: RepositoryMock): Record<string, unknown> {
    const call = repository.markLeadProcessedWithBitacora.mock.calls.at(-1);

    if (!call) {
        throw new Error("Expected markLeadProcessedWithBitacora to be called");
    }

    return call[1];
}

function getLastBitacora(repository: RepositoryMock): {
    readonly detalleBit: string;
    readonly idAdminBit: number;
    readonly idCaidaBit?: number | null;
    readonly idLeadBit?: number;
} {
    const call = repository.markLeadProcessedWithBitacora.mock.calls.at(-1);

    if (!call) {
        throw new Error("Expected markLeadProcessedWithBitacora to be called");
    }

    return call[2];
}

describe("EnvioTemplateInicialService", () => {
    beforeAll(() => {
        jest.useFakeTimers({ now });
    });

    afterAll(() => {
        jest.useRealTimers();
    });

    it("does nothing when envio_template_inicial is not active", async () => {
        const repository = createRepository();
        repository.findCronjobConfig.mockResolvedValue({ isActive: false, projectConfigs: [] });
        const kapsoClient = createKapsoClient();
        const service = createService(repository, kapsoClient);

        await expect(service.runOnce(10)).resolves.toEqual({
            failed: 0,
            processed: 0,
            sent: 0,
            skipped: 0,
            status: "disabled",
        });
        expect(repository.findPendingLeads).not.toHaveBeenCalled();
        expect(kapsoClient.sendSaludoTemplate).not.toHaveBeenCalled();
    });

    it("does not process leads when no active project config can run", async () => {
        const repository = createRepository();
        repository.findPendingLeads.mockResolvedValue([]);
        repository.findCronjobConfig.mockResolvedValue({
            isActive: true,
            projectConfigs: [
                createProjectConfig({ isActive: false }),
                createProjectConfig({
                    idproyectoLead: 38,
                    integration: {
                        adminAssignments: [{ idnetsuiteAdmin: 653055 }],
                        id: 2n,
                        isActive: false,
                        kapsoPhoneNumberId: "1197677976762774",
                    },
                }),
            ],
        });
        const kapsoClient = createKapsoClient();
        const service = createService(repository, kapsoClient);

        await expect(service.runOnce(10)).resolves.toEqual({
            failed: 0,
            processed: 0,
            sent: 0,
            skipped: 0,
            status: "completed",
        });
        expect(repository.findPendingLeads).toHaveBeenCalledWith([], 10);
        expect(kapsoClient.sendSaludoTemplate).not.toHaveBeenCalled();
    });

    it("sends saludo template only for leads from active configured projects", async () => {
        const repository = createRepository();
        const kapsoClient = createKapsoClient();
        const service = createService(repository, kapsoClient);

        await expect(service.runOnce(10)).resolves.toEqual({
            failed: 0,
            processed: 1,
            sent: 1,
            skipped: 0,
            status: "completed",
        });
        expect(repository.findPendingLeads).toHaveBeenCalledWith([4], 10);
        expect(kapsoClient.sendSaludoTemplate).toHaveBeenCalledWith({
            adminName: "Roberto Carlos",
            leadId: 36640,
            leadName: "Cliente Uno",
            phoneNumberId: "1197677976762773",
            projectName: "La Estefana",
            to: "50670452222",
        });
        expect(repository.registerTemplateAttempt).toHaveBeenCalledWith({
            idAdmin: 653055,
            idLead: 36640,
            idproyectoLead: 4,
            kapsoIntegracionNumeroWhatsappId: 1n,
            kapsoPhoneNumberId: "1197677976762773",
            normalizedPhoneNumber: "50670452222",
            status: "processing",
        });
        expect(repository.updateTemplateAttemptResult).toHaveBeenCalledWith({
            idLead: 36640,
            kapsoMessageIds: ["wamid.123"],
            rawResponse: { messages: ["wamid.123"] },
            status: "sent",
        });
        expect(repository.markLeadProcessedWithBitacora.mock.calls.at(-1)?.[0]).toBe(36640);
        expect(getLastLeadUpdate(repository)).toEqual(
            expect.objectContaining({
                accionLead: 3,
                idCaida: 70,
                segiminetoLead: "08-LEAD-SEGUIMIENTO",
                telefonoLead: "50670452222",
                whatsappTemplateContactSent: 0,
            }) as Record<string, unknown>,
        );
        expect(getLastBitacora(repository).detalleBit).toContain("Template saludo inicial enviado con exito");
        expect(getLastBitacora(repository).idAdminBit).toBe(653055);
        expect(getLastBitacora(repository).idCaidaBit).toBe(70);
        expect(getLastBitacora(repository).idLeadBit).toBe(6430001);
    });

    it("marks the lead when the admin has no active Kapso integration for that project", async () => {
        const repository = createRepository();
        repository.findCronjobConfig.mockResolvedValue({
            isActive: true,
            projectConfigs: [
                createProjectConfig({
                    integration: {
                        adminAssignments: [{ idnetsuiteAdmin: 111111 }],
                        id: 1n,
                        isActive: true,
                        kapsoPhoneNumberId: "1197677976762773",
                    },
                }),
            ],
        });
        const kapsoClient = createKapsoClient();
        const service = createService(repository, kapsoClient);

        await expect(service.runOnce(10)).resolves.toEqual({
            failed: 0,
            processed: 1,
            sent: 0,
            skipped: 1,
            status: "completed",
        });
        expect(kapsoClient.sendSaludoTemplate).not.toHaveBeenCalled();
        expect(repository.registerTemplateAttempt).not.toHaveBeenCalled();
        expect(repository.markLeadProcessedWithBitacora.mock.calls.at(-1)?.[0]).toBe(36640);
        expect(getLastLeadUpdate(repository)).toEqual({ whatsappTemplateContactSent: 0 });
        expect(getLastBitacora(repository).detalleBit).toContain("no existe una integracion Kapso activa");
        expect(getLastBitacora(repository).idAdminBit).toBe(653055);
    });

    it("marks the lead when the CRM admin does not exist or is inactive", async () => {
        const repository = createRepository();
        repository.findActiveAdminByIdnetsuite.mockResolvedValue(null);
        const kapsoClient = createKapsoClient();
        const service = createService(repository, kapsoClient);

        await expect(service.runOnce(10)).resolves.toEqual({
            failed: 0,
            processed: 1,
            sent: 0,
            skipped: 1,
            status: "completed",
        });
        expect(kapsoClient.sendSaludoTemplate).not.toHaveBeenCalled();
        expect(repository.registerTemplateAttempt).not.toHaveBeenCalled();
        expect(getLastLeadUpdate(repository)).toEqual({ whatsappTemplateContactSent: 0 });
        expect(getLastBitacora(repository).detalleBit).toContain("no existe admin activo");
        expect(getLastBitacora(repository).idAdminBit).toBe(0);
    });

    it("marks invalid phone numbers with caida 68 and does not call Kapso", async () => {
        const repository = createRepository();
        repository.findPendingLeads.mockResolvedValue([createLead({ telefonoLead: "123" })]);
        const kapsoClient = createKapsoClient();
        const service = createService(repository, kapsoClient);

        await expect(service.runOnce(10)).resolves.toEqual({
            failed: 1,
            processed: 1,
            sent: 0,
            skipped: 0,
            status: "completed",
        });
        expect(kapsoClient.sendSaludoTemplate).not.toHaveBeenCalled();
        expect(repository.registerTemplateAttempt).toHaveBeenCalledWith({
            idAdmin: 653055,
            idLead: 36640,
            idproyectoLead: 4,
            kapsoIntegracionNumeroWhatsappId: 1n,
            kapsoPhoneNumberId: "1197677976762773",
            normalizedPhoneNumber: null,
            status: "invalid_phone",
        });
        expect(repository.markLeadProcessedWithBitacora.mock.calls.at(-1)?.[0]).toBe(36640);
        expect(getLastLeadUpdate(repository)).toEqual({
            idCaida: 68,
            whatsappTemplateContactSent: 0,
        });
        expect(getLastBitacora(repository).detalleBit).toContain("numero de telefono no valido");
        expect(getLastBitacora(repository).idCaidaBit).toBe(68);
    });

    it("logs Kapso errors in bitacora and marks the lead as processed", async () => {
        const repository = createRepository();
        const kapsoClient = createKapsoClient();
        kapsoClient.sendSaludoTemplate.mockRejectedValue(new Error("Kapso down"));
        const service = createService(repository, kapsoClient);

        await expect(service.runOnce(10)).resolves.toEqual({
            failed: 1,
            processed: 1,
            sent: 0,
            skipped: 0,
            status: "completed",
        });
        expect(repository.markLeadProcessedWithBitacora.mock.calls.at(-1)?.[0]).toBe(36640);
        expect(repository.registerTemplateAttempt).toHaveBeenCalledWith({
            idAdmin: 653055,
            idLead: 36640,
            idproyectoLead: 4,
            kapsoIntegracionNumeroWhatsappId: 1n,
            kapsoPhoneNumberId: "1197677976762773",
            normalizedPhoneNumber: "50670452222",
            status: "processing",
        });
        expect(repository.updateTemplateAttemptResult).toHaveBeenCalledWith({
            errorMessage: "Kapso down",
            idLead: 36640,
            kapsoMessageIds: [],
            status: "failed",
        });
        expect(getLastLeadUpdate(repository)).toEqual({ whatsappTemplateContactSent: 0 });
        expect(getLastBitacora(repository).detalleBit).toContain("Kapso down");
    });

    it("skips leads that already have a template attempt recorded", async () => {
        const repository = createRepository();
        repository.hasTemplateAttemptForLead.mockResolvedValue(true);
        const kapsoClient = createKapsoClient();
        const service = createService(repository, kapsoClient);

        await expect(service.runOnce(10)).resolves.toEqual({
            failed: 0,
            processed: 1,
            sent: 0,
            skipped: 1,
            status: "completed",
        });
        expect(kapsoClient.sendSaludoTemplate).not.toHaveBeenCalled();
        expect(repository.registerTemplateAttempt).not.toHaveBeenCalled();
        expect(repository.markLeadProcessedWithBitacora).toHaveBeenCalledWith(36640, { whatsappTemplateContactSent: 0 }, expect.any(Object));
        expect(getLastBitacora(repository).detalleBit).toContain("ya tiene un intento registrado");
    });

    it("does not start a second run while the first one is active", async () => {
        const repository = createRepository();
        let releaseCronjob: (value: unknown) => void = () => undefined;
        repository.findCronjobConfig.mockReturnValue(
            new Promise((resolve): void => {
                releaseCronjob = (): void => resolve({ isActive: false, projectConfigs: [] });
            }),
        );
        const service = createService(repository);
        const firstRun = service.runOnce(10);

        await expect(service.runOnce(10)).resolves.toEqual({
            failed: 0,
            processed: 0,
            sent: 0,
            skipped: 0,
            status: "already_running",
        });

        releaseCronjob(undefined);
        await expect(firstRun).resolves.toEqual({
            failed: 0,
            processed: 0,
            sent: 0,
            skipped: 0,
            status: "disabled",
        });
    });

    it("skips when idEmpleadoLead is null without looking up an admin", async () => {
        const repository = createRepository();
        repository.findPendingLeads.mockResolvedValue([createLead({ idEmpleadoLead: null })]);
        const kapsoClient = createKapsoClient();
        const service = createService(repository, kapsoClient);

        await expect(service.runOnce(10)).resolves.toEqual({
            failed: 0,
            processed: 1,
            sent: 0,
            skipped: 1,
            status: "completed",
        });
        expect(repository.findActiveAdminByIdnetsuite).not.toHaveBeenCalled();
        expect(kapsoClient.sendSaludoTemplate).not.toHaveBeenCalled();
        expect(getLastBitacora(repository).detalleBit).toContain("no existe admin activo");
        expect(getLastBitacora(repository).idAdminBit).toBe(0);
    });

    it("marks placeholder phones like 88888888 with caida 68", async () => {
        const repository = createRepository();
        repository.findPendingLeads.mockResolvedValue([createLead({ telefonoLead: "88888888" })]);
        const kapsoClient = createKapsoClient();
        const service = createService(repository, kapsoClient);

        await expect(service.runOnce(10)).resolves.toEqual({
            failed: 1,
            processed: 1,
            sent: 0,
            skipped: 0,
            status: "completed",
        });
        expect(kapsoClient.sendSaludoTemplate).not.toHaveBeenCalled();
        expect(getLastLeadUpdate(repository)).toEqual({
            idCaida: 68,
            whatsappTemplateContactSent: 0,
        });
    });

    it("uses template defaults when lead and admin names are blank", async () => {
        const repository = createRepository();
        repository.findPendingLeads.mockResolvedValue([createLead({ nombreLead: "   ", proyectoLead: null })]);
        repository.findActiveAdminByIdnetsuite.mockResolvedValue({
            idnetsuiteAdmin: 653055,
            nameAdmin: "",
        });
        const kapsoClient = createKapsoClient();
        const service = createService(repository, kapsoClient);

        await expect(service.runOnce(10)).resolves.toEqual({
            failed: 0,
            processed: 1,
            sent: 1,
            skipped: 0,
            status: "completed",
        });
        expect(kapsoClient.sendSaludoTemplate).toHaveBeenCalledWith(
            expect.objectContaining({
                adminName: "asesor CRM",
                leadName: "cliente",
                projectName: "Proyecto 4",
            }),
        );
    });
});
