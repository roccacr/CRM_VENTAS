import { ConflictException, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaClientKnownRequestError } from "@prisma/client/runtime/library";

import { KapsoCronjobConfigService } from "../../src/kapso-integrations/kapso-cronjob-config.service";

const now = new Date("2026-09-04T22:00:00.000Z");

type ProjectConfigSnapshot = {
    readonly config: Prisma.JsonValue;
    readonly createdAt: Date;
    readonly id: bigint;
    readonly idnetsuiteAdmin: number | null;
    readonly idproyectoLead: number;
    readonly isActive: boolean;
    readonly kapsoCronjobConfiguracionId: bigint;
    readonly kapsoIntegracionNumeroWhatsappId: bigint;
    readonly updatedAt: Date;
};

type CronjobConfigSnapshot = {
    readonly config: Prisma.JsonValue;
    readonly createdAt: Date;
    readonly cronjobId: string;
    readonly id: bigint;
    readonly idnetsuiteAdmin: number | null;
    readonly idproyectoLead: number | null;
    readonly isActive: boolean;
    readonly kapsoIntegracionNumeroWhatsappId: bigint | null;
    readonly projectConfigs: ProjectConfigSnapshot[];
    readonly updatedAt: Date;
};

type RepositoryMock = {
    readonly countActiveAdminByIdnetsuite: jest.MockedFunction<(idnetsuiteAdmin: number) => Promise<number>>;
    readonly countAdminAssignment: jest.MockedFunction<(integrationId: bigint, idnetsuiteAdmin: number) => Promise<number>>;
    readonly countIntegrationById: jest.MockedFunction<(id: bigint) => Promise<number>>;
    readonly countProjectByIdproyecto: jest.MockedFunction<(idproyectoLead: number, idnetsuiteAdmin?: number) => Promise<number>>;
    readonly create: jest.MockedFunction<(input: unknown) => Promise<CronjobConfigSnapshot>>;
    readonly createProjectConfig: jest.MockedFunction<(input: unknown) => Promise<ProjectConfigSnapshot>>;
    readonly deleteProjectConfig: jest.MockedFunction<(id: bigint) => Promise<number>>;
    readonly findById: jest.MockedFunction<(id: bigint) => Promise<CronjobConfigSnapshot | null>>;
    readonly findProjectConfigById: jest.MockedFunction<(id: bigint) => Promise<ProjectConfigSnapshot | null>>;
    readonly findProjectConfigDuplicate: jest.MockedFunction<(input: unknown) => Promise<ProjectConfigSnapshot | null>>;
    readonly list: jest.MockedFunction<() => Promise<CronjobConfigSnapshot[]>>;
    readonly update: jest.MockedFunction<(id: bigint, input: unknown) => Promise<number>>;
    readonly updateProjectConfig: jest.MockedFunction<(id: bigint, input: unknown) => Promise<number>>;
};

const createProjectConfig = (overrides: Partial<ProjectConfigSnapshot> = {}): ProjectConfigSnapshot => ({
    config: {},
    createdAt: now,
    id: BigInt(50),
    idnetsuiteAdmin: null,
    idproyectoLead: 38,
    isActive: true,
    kapsoCronjobConfiguracionId: BigInt(30),
    kapsoIntegracionNumeroWhatsappId: BigInt(1),
    updatedAt: now,
    ...overrides,
});

const createCronjobConfig = (overrides: Partial<CronjobConfigSnapshot> = {}): CronjobConfigSnapshot => ({
    config: {},
    createdAt: now,
    cronjobId: "kapso-sync-chats-rdg",
    id: BigInt(30),
    idnetsuiteAdmin: null,
    idproyectoLead: null,
    isActive: true,
    kapsoIntegracionNumeroWhatsappId: null,
    projectConfigs: [],
    updatedAt: now,
    ...overrides,
});

function createRepository(): RepositoryMock {
    return {
        countActiveAdminByIdnetsuite: jest.fn<Promise<number>, [number]>(),
        countAdminAssignment: jest.fn<Promise<number>, [bigint, number]>(),
        countIntegrationById: jest.fn<Promise<number>, [bigint]>(),
        countProjectByIdproyecto: jest.fn<Promise<number>, [number, number?]>(),
        create: jest.fn(),
        createProjectConfig: jest.fn(),
        deleteProjectConfig: jest.fn<Promise<number>, [bigint]>(),
        findById: jest.fn(),
        findProjectConfigById: jest.fn(),
        findProjectConfigDuplicate: jest.fn(),
        list: jest.fn(),
        update: jest.fn<Promise<number>, [bigint, unknown]>(),
        updateProjectConfig: jest.fn<Promise<number>, [bigint, unknown]>(),
    };
}

function allowReferences(repository: RepositoryMock): void {
    repository.countIntegrationById.mockResolvedValue(1);
    repository.countActiveAdminByIdnetsuite.mockResolvedValue(1);
    repository.countAdminAssignment.mockResolvedValue(1);
    repository.countProjectByIdproyecto.mockResolvedValue(12);
}

describe("KapsoCronjobConfigService", () => {
    it("lists general cronjobs with project configs", async () => {
        const repository = createRepository();
        repository.list.mockResolvedValue([createCronjobConfig({ projectConfigs: [createProjectConfig()] })]);
        const service = new KapsoCronjobConfigService(repository);

        await expect(service.listConfigs()).resolves.toEqual([
            expect.objectContaining({
                cronjobId: "kapso-sync-chats-rdg",
                id: "30",
                isActive: true,
                projectConfigs: [expect.objectContaining({ id: "50", idnetsuiteAdmin: null })],
            }),
        ]);
    });

    it("creates a general cronjob without admin or project", async () => {
        const repository = createRepository();
        repository.create.mockResolvedValue(createCronjobConfig());
        const service = new KapsoCronjobConfigService(repository);

        await expect(
            service.createConfig({
                cronjobId: "kapso-sync-chats-rdg",
                isActive: true,
            }),
        ).resolves.toEqual(
            expect.objectContaining({
                cronjobId: "kapso-sync-chats-rdg",
                projectConfigs: [],
            }),
        );
        expect(repository.countIntegrationById).not.toHaveBeenCalled();
    });

    it("rejects duplicate cronjob ids", async () => {
        const repository = createRepository();
        repository.create.mockRejectedValue(
            new PrismaClientKnownRequestError("Unique constraint failed", {
                clientVersion: "6.19.3",
                code: "P2002",
            }),
        );
        const service = new KapsoCronjobConfigService(repository);

        await expect(
            service.createConfig({
                cronjobId: "kapso-sync-chats-rdg",
                isActive: true,
            }),
        ).rejects.toThrow(ConflictException);
    });

    it("creates a project config without optional admin", async () => {
        const repository = createRepository();
        allowReferences(repository);
        repository.findById.mockResolvedValue(createCronjobConfig());
        repository.findProjectConfigDuplicate.mockResolvedValue(null);
        repository.createProjectConfig.mockResolvedValue(createProjectConfig());
        const service = new KapsoCronjobConfigService(repository);

        await expect(
            service.createProjectConfig("30", {
                idproyectoLead: 38,
                isActive: true,
                kapsoIntegracionNumeroWhatsappId: "1",
            }),
        ).resolves.toEqual(expect.objectContaining({ id: "50", idnetsuiteAdmin: null }));
        expect(repository.countActiveAdminByIdnetsuite).not.toHaveBeenCalled();
        expect(repository.countProjectByIdproyecto).toHaveBeenCalledWith(38, undefined);
    });

    it("creates a project config with an assigned admin and filters project by admin", async () => {
        const repository = createRepository();
        allowReferences(repository);
        repository.findById.mockResolvedValue(createCronjobConfig());
        repository.findProjectConfigDuplicate.mockResolvedValue(null);
        repository.createProjectConfig.mockResolvedValue(createProjectConfig({ idnetsuiteAdmin: 653055 }));
        const service = new KapsoCronjobConfigService(repository);

        await expect(
            service.createProjectConfig("30", {
                idnetsuiteAdmin: 653055,
                idproyectoLead: 38,
                isActive: true,
                kapsoIntegracionNumeroWhatsappId: "1",
            }),
        ).resolves.toEqual(expect.objectContaining({ idnetsuiteAdmin: 653055 }));
        expect(repository.countAdminAssignment).toHaveBeenCalledWith(BigInt(1), 653055);
        expect(repository.countProjectByIdproyecto).toHaveBeenCalledWith(38, 653055);
    });

    it("rejects project config when selected admin is not assigned to integration", async () => {
        const repository = createRepository();
        allowReferences(repository);
        repository.findById.mockResolvedValue(createCronjobConfig());
        repository.countAdminAssignment.mockResolvedValue(0);
        const service = new KapsoCronjobConfigService(repository);

        await expect(
            service.createProjectConfig("30", {
                idnetsuiteAdmin: 653055,
                idproyectoLead: 38,
                isActive: true,
                kapsoIntegracionNumeroWhatsappId: "1",
            }),
        ).rejects.toThrow(NotFoundException);
        expect(repository.createProjectConfig).not.toHaveBeenCalled();
    });

    it("rejects project config when project is not found for selected admin", async () => {
        const repository = createRepository();
        allowReferences(repository);
        repository.findById.mockResolvedValue(createCronjobConfig());
        repository.countProjectByIdproyecto.mockResolvedValue(0);
        const service = new KapsoCronjobConfigService(repository);

        await expect(
            service.createProjectConfig("30", {
                idnetsuiteAdmin: 653055,
                idproyectoLead: 999,
                isActive: true,
                kapsoIntegracionNumeroWhatsappId: "1",
            }),
        ).rejects.toThrow(NotFoundException);
        expect(repository.createProjectConfig).not.toHaveBeenCalled();
    });

    it("updates an existing general cronjob", async () => {
        const repository = createRepository();
        repository.findById.mockResolvedValueOnce(createCronjobConfig()).mockResolvedValueOnce(createCronjobConfig({ isActive: false }));
        repository.update.mockResolvedValue(1);
        const service = new KapsoCronjobConfigService(repository);

        await expect(
            service.updateConfig("30", {
                cronjobId: "kapso-sync-chats-rdg",
                isActive: false,
            }),
        ).resolves.toEqual(expect.objectContaining({ id: "30", isActive: false }));
    });

    it("updates an existing project config", async () => {
        const repository = createRepository();
        allowReferences(repository);
        repository.findProjectConfigById.mockResolvedValueOnce(createProjectConfig()).mockResolvedValueOnce(createProjectConfig({ isActive: false }));
        repository.findProjectConfigDuplicate.mockResolvedValue(null);
        repository.updateProjectConfig.mockResolvedValue(1);
        const service = new KapsoCronjobConfigService(repository);

        await expect(
            service.updateProjectConfig("50", {
                idproyectoLead: 38,
                isActive: false,
                kapsoIntegracionNumeroWhatsappId: "1",
            }),
        ).resolves.toEqual(expect.objectContaining({ id: "50", isActive: false }));
    });

    it("deletes project configs independently", async () => {
        const repository = createRepository();
        repository.deleteProjectConfig.mockResolvedValue(1);
        const service = new KapsoCronjobConfigService(repository);

        await expect(service.deleteProjectConfig("50")).resolves.toEqual({ deleted: true });
    });

    it("rejects a duplicate project config before inserting", async () => {
        const repository = createRepository();
        allowReferences(repository);
        repository.findById.mockResolvedValue(createCronjobConfig());
        repository.findProjectConfigDuplicate.mockResolvedValue(createProjectConfig());
        const service = new KapsoCronjobConfigService(repository);

        await expect(
            service.createProjectConfig("30", {
                idproyectoLead: 38,
                isActive: true,
                kapsoIntegracionNumeroWhatsappId: "1",
            }),
        ).rejects.toThrow(ConflictException);
        expect(repository.createProjectConfig).not.toHaveBeenCalled();
    });

    it("rejects updating a project config onto another existing row", async () => {
        const repository = createRepository();
        allowReferences(repository);
        repository.findProjectConfigById.mockResolvedValue(createProjectConfig());
        repository.findProjectConfigDuplicate.mockResolvedValue(createProjectConfig({ id: BigInt(51) }));
        const service = new KapsoCronjobConfigService(repository);

        await expect(
            service.updateProjectConfig("50", {
                idproyectoLead: 39,
                isActive: true,
                kapsoIntegracionNumeroWhatsappId: "1",
            }),
        ).rejects.toThrow(ConflictException);
        expect(repository.updateProjectConfig).not.toHaveBeenCalled();
    });

    it("returns 404 when deleting a project config that does not exist", async () => {
        const repository = createRepository();
        repository.deleteProjectConfig.mockResolvedValue(0);
        const service = new KapsoCronjobConfigService(repository);

        await expect(service.deleteProjectConfig("50")).rejects.toThrow(NotFoundException);
    });

    it("returns 404 for a non-numeric cronjob route id", async () => {
        const repository = createRepository();
        const service = new KapsoCronjobConfigService(repository);

        await expect(
            service.updateConfig("abc", {
                cronjobId: "kapso-sync-chats-rdg",
                isActive: true,
            }),
        ).rejects.toThrow(NotFoundException);
        expect(repository.findById).not.toHaveBeenCalled();
    });
});
