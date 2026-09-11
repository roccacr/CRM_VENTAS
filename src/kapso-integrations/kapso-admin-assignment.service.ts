import { ConflictException, Inject, Injectable, NotFoundException, ServiceUnavailableException } from "@nestjs/common";
import { KapsoIntegracionAdminAsignacion } from "@prisma/client";

import { parseKapsoRouteId } from "./parse-kapso-route-id";
import { throwIfPrismaUniqueViolation } from "./throw-prisma-unique-conflict";
import { KapsoAdminAssignmentRepository, KapsoIntegrationWithAssignments } from "./kapso-admin-assignment.repository";

type KapsoAdminAssignmentRepositoryPort = Pick<KapsoAdminAssignmentRepository, "countActiveAdminByIdnetsuite" | "countCronjobConfigsByAdminAssignment" | "countIntegrationById" | "createAssignment" | "deleteAssignment" | "findAssignmentById" | "listActiveAdmins" | "listAdminsByIdnetsuite" | "listIntegrationsWithAssignments" | "updateAssignment">;

const INTEGRATION_NOT_FOUND = "Kapso WhatsApp number integration not found";
const ASSIGNMENT_NOT_FOUND = "Kapso admin assignment not found";
const ADMIN_NOT_FOUND = "Active CRM admin not found";
const DUPLICATE_ASSIGNMENT = "CRM admin is already assigned to this Kapso integration";
const ADMIN_ASSIGNMENT_HAS_CRONJOBS = "CRM admin assignment has Kapso cronjob configs";

export type KapsoAdminOptionDto = {
    readonly idAdmin: number;
    readonly idnetsuiteAdmin: number;
    readonly nameAdmin: string | null;
    readonly emailAdmin: string | null;
    readonly statusAdmin: number;
};

type KapsoAssignedAdminDto = {
    readonly assignmentId: string;
    readonly idnetsuiteAdmin: number;
    readonly nameAdmin: string | null;
    readonly emailAdmin: string | null;
    readonly createdAt: string;
    readonly updatedAt: string;
};

export type KapsoAdminIntegrationDto = {
    readonly id: string;
    readonly kapsoPhoneNumberId: string;
    readonly displayPhoneNumber: string | null;
    readonly phoneNumber: string | null;
    readonly businessName: string | null;
    readonly status: string;
    readonly isActive: boolean;
    readonly assignedAdmins: KapsoAssignedAdminDto[];
    readonly createdAt: string;
    readonly updatedAt: string;
};

export type KapsoAdminAssignmentDto = {
    readonly id: string;
    readonly kapsoIntegracionNumeroWhatsappId: string;
    readonly idnetsuiteAdmin: number;
    readonly createdAt: string;
    readonly updatedAt: string;
};

/**
 * Caso de uso para relacionar integraciones Kapso con admins CRM.
 * La relacion admin-integracion es la autorizacion base para que cronjobs puedan enviar a nombre de un asesor.
 */
@Injectable()
export class KapsoAdminAssignmentService {
    constructor(
        @Inject(KapsoAdminAssignmentRepository)
        private readonly repository: KapsoAdminAssignmentRepositoryPort,
    ) {}

    async listAdminOptions(search = "", includeInactive = false): Promise<KapsoAdminOptionDto[]> {
        const admins = await this.repository.listActiveAdmins(search, includeInactive);
        return admins
            .filter((admin) => admin.idnetsuiteAdmin !== null)
            .map((admin) => ({
                emailAdmin: admin.emailAdmin,
                idAdmin: admin.idAdmin,
                idnetsuiteAdmin: Number(admin.idnetsuiteAdmin),
                nameAdmin: admin.nameAdmin,
                statusAdmin: admin.statusAdmin,
            }));
    }

    async listPhoneNumberOptions(search = "", includeInactive = false): Promise<KapsoAdminIntegrationDto[]> {
        const integrations = await this.repository.listIntegrationsWithAssignments();
        const normalizedSearch = search.trim().toLowerCase();
        const adminMap = await this.getAdminMap(integrations);

        return this.hydrateAssignments(integrations, adminMap)
            .filter((integration) => includeInactive || integration.isActive)
            .filter((integration) => matchesIntegrationSearch(integration, normalizedSearch));
    }

    listAdminIntegrations(search = "", includeInactive = false): Promise<KapsoAdminIntegrationDto[]> {
        return this.listPhoneNumberOptions(search, includeInactive);
    }

    async createAssignment(integrationId: string, idnetsuiteAdmin: number): Promise<KapsoAdminAssignmentDto> {
        const parsedIntegrationId = parseKapsoRouteId(integrationId, INTEGRATION_NOT_FOUND);
        await this.assertIntegrationExists(parsedIntegrationId);
        await this.assertActiveAdminExists(idnetsuiteAdmin);

        try {
            return this.toAssignmentDto(await this.repository.createAssignment(parsedIntegrationId, idnetsuiteAdmin));
        } catch (error) {
            throwIfPrismaUniqueViolation(error, DUPLICATE_ASSIGNMENT);
            throw error;
        }
    }

    async updateAssignment(assignmentId: string, idnetsuiteAdmin: number): Promise<KapsoAdminAssignmentDto> {
        const parsedAssignmentId = parseKapsoRouteId(assignmentId, ASSIGNMENT_NOT_FOUND);
        const current = await this.repository.findAssignmentById(parsedAssignmentId);

        if (!current) {
            throw new NotFoundException(ASSIGNMENT_NOT_FOUND);
        }

        await this.assertActiveAdminExists(idnetsuiteAdmin);

        try {
            const updated = await this.repository.updateAssignment(parsedAssignmentId, idnetsuiteAdmin);

            if (updated === 0) {
                throw new NotFoundException(ASSIGNMENT_NOT_FOUND);
            }
        } catch (error) {
            throwIfPrismaUniqueViolation(error, DUPLICATE_ASSIGNMENT);
            throw error;
        }

        const refreshed = await this.repository.findAssignmentById(parsedAssignmentId);

        if (!refreshed) {
            throw new ServiceUnavailableException("Kapso admin assignment could not be reloaded");
        }

        return this.toAssignmentDto(refreshed);
    }

    async deleteAssignment(assignmentId: string): Promise<{ readonly deleted: boolean }> {
        const parsedAssignmentId = parseKapsoRouteId(assignmentId, ASSIGNMENT_NOT_FOUND);
        const current = await this.repository.findAssignmentById(parsedAssignmentId);

        if (!current) {
            throw new NotFoundException(ASSIGNMENT_NOT_FOUND);
        }

        const cronjobConfigs = await this.repository.countCronjobConfigsByAdminAssignment(current.kapsoIntegracionNumeroWhatsappId, current.idnetsuiteAdmin);

        // No se elimina una asignacion si algun flujo configurado todavia depende de ella.
        if (cronjobConfigs > 0) {
            throw new ConflictException(ADMIN_ASSIGNMENT_HAS_CRONJOBS);
        }

        const deleted = await this.repository.deleteAssignment(parsedAssignmentId);

        if (deleted === 0) {
            throw new NotFoundException(ASSIGNMENT_NOT_FOUND);
        }

        return { deleted: true };
    }

    private async assertIntegrationExists(id: bigint): Promise<void> {
        if ((await this.repository.countIntegrationById(id)) === 0) {
            throw new NotFoundException(INTEGRATION_NOT_FOUND);
        }
    }

    private async assertActiveAdminExists(idnetsuiteAdmin: number): Promise<void> {
        if ((await this.repository.countActiveAdminByIdnetsuite(idnetsuiteAdmin)) === 0) {
            throw new NotFoundException(ADMIN_NOT_FOUND);
        }
    }

    private async getAdminMap(integrations: KapsoIntegrationWithAssignments[]): Promise<Map<number, { readonly emailAdmin: string | null; readonly nameAdmin: string | null }>> {
        const adminIds = [...new Set(integrations.flatMap((integration) => integration.adminAssignments.map((assignment) => assignment.idnetsuiteAdmin)))];

        if (adminIds.length === 0) {
            return new Map();
        }

        const admins = await this.repository.listAdminsByIdnetsuite(adminIds);
        const map = new Map<number, { readonly emailAdmin: string | null; readonly nameAdmin: string | null }>();

        for (const admin of admins) {
            // Produccion puede tener idnetsuite duplicado; se conserva el admin activo/primero ordenado por repository.
            if (admin.idnetsuiteAdmin === null || map.has(admin.idnetsuiteAdmin)) {
                continue;
            }

            map.set(admin.idnetsuiteAdmin, {
                emailAdmin: admin.emailAdmin,
                nameAdmin: admin.nameAdmin,
            });
        }

        return map;
    }

    private hydrateAssignments(integrations: KapsoIntegrationWithAssignments[], adminMap: Map<number, { readonly emailAdmin: string | null; readonly nameAdmin: string | null }>): KapsoAdminIntegrationDto[] {
        return integrations.map((integration) => ({
            assignedAdmins: integration.adminAssignments.map((assignment) => ({
                assignmentId: assignment.id.toString(),
                createdAt: assignment.createdAt.toISOString(),
                emailAdmin: adminMap.get(assignment.idnetsuiteAdmin)?.emailAdmin ?? null,
                idnetsuiteAdmin: assignment.idnetsuiteAdmin,
                nameAdmin: adminMap.get(assignment.idnetsuiteAdmin)?.nameAdmin ?? null,
                updatedAt: assignment.updatedAt.toISOString(),
            })),
            businessName: integration.businessName,
            createdAt: integration.createdAt.toISOString(),
            displayPhoneNumber: integration.displayPhoneNumber,
            id: integration.id.toString(),
            isActive: integration.isActive,
            kapsoPhoneNumberId: integration.kapsoPhoneNumberId,
            phoneNumber: integration.phoneNumber,
            status: integration.status,
            updatedAt: integration.updatedAt.toISOString(),
        }));
    }

    private toAssignmentDto(assignment: KapsoIntegracionAdminAsignacion): KapsoAdminAssignmentDto {
        return {
            createdAt: assignment.createdAt.toISOString(),
            id: assignment.id.toString(),
            idnetsuiteAdmin: assignment.idnetsuiteAdmin,
            kapsoIntegracionNumeroWhatsappId: assignment.kapsoIntegracionNumeroWhatsappId.toString(),
            updatedAt: assignment.updatedAt.toISOString(),
        };
    }
}

function matchesIntegrationSearch(integration: KapsoAdminIntegrationDto, normalizedSearch: string): boolean {
    if (!normalizedSearch) {
        return true;
    }

    const haystack = [integration.businessName, integration.displayPhoneNumber, integration.phoneNumber, integration.kapsoPhoneNumberId, ...integration.assignedAdmins.map((admin) => admin.nameAdmin), ...integration.assignedAdmins.map((admin) => String(admin.idnetsuiteAdmin))];

    return haystack.filter(Boolean).some((value) => String(value).toLowerCase().includes(normalizedSearch));
}
