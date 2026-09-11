import { ConflictException, NotFoundException } from "@nestjs/common";
import { PrismaClientKnownRequestError } from "@prisma/client/runtime/library";

import { KapsoAdminAssignmentService } from "../../src/kapso-integrations/kapso-admin-assignment.service";

const now = new Date("2026-09-04T16:00:00.000Z");

type AssignmentSnapshot = {
    readonly createdAt: Date;
    readonly id: bigint;
    readonly idnetsuiteAdmin: number;
    readonly kapsoIntegracionNumeroWhatsappId: bigint;
    readonly updatedAt: Date;
};

type IntegrationSnapshot = {
    readonly adminAssignments: AssignmentSnapshot[];
    readonly businessAccountId: string;
    readonly businessName: string;
    readonly connectedAt: Date;
    readonly createdAt: Date;
    readonly displayPhoneNumber: string;
    readonly id: bigint;
    readonly idnetsuiteAdminAsignado: null;
    readonly isActive: boolean;
    readonly kapsoCustomerId: string;
    readonly kapsoPhoneNumberId: string;
    readonly kapsoProjectId: string;
    readonly lastSyncAt: Date;
    readonly phoneNumber: string;
    readonly status: string;
    readonly ultimoPayloadKapso: null;
    readonly updatedAt: Date;
};

type RepositoryMock = {
    readonly countActiveAdminByIdnetsuite: jest.MockedFunction<(idnetsuiteAdmin: number) => Promise<number>>;
    readonly countCronjobConfigsByAdminAssignment: jest.MockedFunction<(integrationId: bigint, idnetsuiteAdmin: number) => Promise<number>>;
    readonly countIntegrationById: jest.MockedFunction<(id: bigint) => Promise<number>>;
    readonly createAssignment: jest.MockedFunction<(integrationId: bigint, idnetsuiteAdmin: number) => Promise<AssignmentSnapshot>>;
    readonly deleteAssignment: jest.MockedFunction<(id: bigint) => Promise<number>>;
    readonly findAssignmentById: jest.MockedFunction<(id: bigint) => Promise<AssignmentSnapshot | null>>;
    readonly listActiveAdmins: jest.MockedFunction<() => Promise<never[]>>;
    readonly listAdminsByIdnetsuite: jest.MockedFunction<
        (ids: number[]) => Promise<
            {
                readonly emailAdmin: string | null;
                readonly idAdmin: number;
                readonly idnetsuiteAdmin: number | null;
                readonly nameAdmin: string | null;
                readonly statusAdmin: number;
            }[]
        >
    >;
    readonly listIntegrationsWithAssignments: jest.MockedFunction<() => Promise<IntegrationSnapshot[]>>;
    readonly updateAssignment: jest.MockedFunction<(id: bigint, idnetsuiteAdmin: number) => Promise<number>>;
};

const createAssignment = (overrides: Partial<AssignmentSnapshot> = {}): AssignmentSnapshot => ({
    createdAt: now,
    id: BigInt(10),
    idnetsuiteAdmin: 252150001,
    kapsoIntegracionNumeroWhatsappId: BigInt(1),
    updatedAt: now,
    ...overrides,
});

const createIntegration = (overrides: Partial<IntegrationSnapshot> = {}): IntegrationSnapshot => ({
    adminAssignments: [createAssignment()],
    businessAccountId: "ba-1",
    businessName: "RDG Ventas",
    connectedAt: now,
    createdAt: now,
    displayPhoneNumber: "+506 7045 2242",
    id: BigInt(1),
    idnetsuiteAdminAsignado: null,
    isActive: true,
    kapsoCustomerId: "customer-1",
    kapsoPhoneNumberId: "1197677976762773",
    kapsoProjectId: "project-1",
    lastSyncAt: now,
    phoneNumber: "50670452242",
    status: "active",
    ultimoPayloadKapso: null,
    updatedAt: now,
    ...overrides,
});

function createRepository(): RepositoryMock {
    return {
        countActiveAdminByIdnetsuite: jest.fn<Promise<number>, [number]>(),
        countCronjobConfigsByAdminAssignment: jest.fn<Promise<number>, [bigint, number]>(),
        countIntegrationById: jest.fn<Promise<number>, [bigint]>(),
        createAssignment: jest.fn(),
        deleteAssignment: jest.fn<Promise<number>, [bigint]>(),
        findAssignmentById: jest.fn(),
        listActiveAdmins: jest.fn(),
        listAdminsByIdnetsuite: jest.fn(),
        listIntegrationsWithAssignments: jest.fn(),
        updateAssignment: jest.fn<Promise<number>, [bigint, number]>(),
    };
}

describe("KapsoAdminAssignmentService", () => {
    it("lists integrations with assigned admin names", async () => {
        const repository = createRepository();
        repository.listIntegrationsWithAssignments.mockResolvedValue([createIntegration()]);
        repository.listAdminsByIdnetsuite.mockResolvedValue([
            {
                emailAdmin: "angelica@example.com",
                idAdmin: 85,
                idnetsuiteAdmin: 252150001,
                nameAdmin: "Angelica Pacheco",
                statusAdmin: 1,
            },
        ]);
        const service = new KapsoAdminAssignmentService(repository);

        await expect(service.listAdminIntegrations()).resolves.toEqual([
            expect.objectContaining({
                assignedAdmins: [
                    expect.objectContaining({
                        assignmentId: "10",
                        emailAdmin: "angelica@example.com",
                        idnetsuiteAdmin: 252150001,
                        nameAdmin: "Angelica Pacheco",
                    }),
                ],
                id: "1",
            }),
        ]);
    });

    it("creates an assignment when integration and active admin exist", async () => {
        const repository = createRepository();
        repository.countIntegrationById.mockResolvedValue(1);
        repository.countActiveAdminByIdnetsuite.mockResolvedValue(1);
        repository.createAssignment.mockResolvedValue(createAssignment());
        const service = new KapsoAdminAssignmentService(repository);

        await expect(service.createAssignment("1", 252150001)).resolves.toEqual(
            expect.objectContaining({
                id: "10",
                idnetsuiteAdmin: 252150001,
                kapsoIntegracionNumeroWhatsappId: "1",
            }),
        );
    });

    it("rejects duplicate assignment pairs", async () => {
        const repository = createRepository();
        repository.countIntegrationById.mockResolvedValue(1);
        repository.countActiveAdminByIdnetsuite.mockResolvedValue(1);
        repository.createAssignment.mockRejectedValue(
            new PrismaClientKnownRequestError("Unique constraint failed", {
                clientVersion: "6.12.0",
                code: "P2002",
            }),
        );
        const service = new KapsoAdminAssignmentService(repository);

        await expect(service.createAssignment("1", 252150001)).rejects.toThrow(ConflictException);
    });

    it("rejects assignment creation for a missing integration", async () => {
        const repository = createRepository();
        repository.countIntegrationById.mockResolvedValue(0);
        const service = new KapsoAdminAssignmentService(repository);

        await expect(service.createAssignment("999", 252150001)).rejects.toThrow(NotFoundException);
        expect(repository.countActiveAdminByIdnetsuite).not.toHaveBeenCalled();
    });

    it("rejects assignment creation for a missing active admin", async () => {
        const repository = createRepository();
        repository.countIntegrationById.mockResolvedValue(1);
        repository.countActiveAdminByIdnetsuite.mockResolvedValue(0);
        const service = new KapsoAdminAssignmentService(repository);

        await expect(service.createAssignment("1", 999)).rejects.toThrow(NotFoundException);
        expect(repository.createAssignment).not.toHaveBeenCalled();
    });

    it("updates an existing assignment", async () => {
        const repository = createRepository();
        repository.findAssignmentById.mockResolvedValueOnce(createAssignment()).mockResolvedValueOnce(createAssignment({ idnetsuiteAdmin: 252150002 }));
        repository.countActiveAdminByIdnetsuite.mockResolvedValue(1);
        repository.updateAssignment.mockResolvedValue(1);
        const service = new KapsoAdminAssignmentService(repository);

        await expect(service.updateAssignment("10", 252150002)).resolves.toEqual(expect.objectContaining({ id: "10", idnetsuiteAdmin: 252150002 }));
    });

    it("deletes an existing assignment", async () => {
        const repository = createRepository();
        repository.findAssignmentById.mockResolvedValue(createAssignment());
        repository.countCronjobConfigsByAdminAssignment.mockResolvedValue(0);
        repository.deleteAssignment.mockResolvedValue(1);
        const service = new KapsoAdminAssignmentService(repository);

        await expect(service.deleteAssignment("10")).resolves.toEqual({ deleted: true });
    });

    it("rejects deleting an admin assignment with cronjob configs", async () => {
        const repository = createRepository();
        repository.findAssignmentById.mockResolvedValue(createAssignment());
        repository.countCronjobConfigsByAdminAssignment.mockResolvedValue(1);
        const service = new KapsoAdminAssignmentService(repository);

        await expect(service.deleteAssignment("10")).rejects.toThrow(ConflictException);
        expect(repository.deleteAssignment).not.toHaveBeenCalled();
    });

    it("returns 404 when deleting a missing assignment", async () => {
        const repository = createRepository();
        repository.findAssignmentById.mockResolvedValue(null);
        const service = new KapsoAdminAssignmentService(repository);

        await expect(service.deleteAssignment("10")).rejects.toThrow(NotFoundException);
    });
});
