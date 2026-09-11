import { ConflictException, Inject, Injectable, NotFoundException, ServiceUnavailableException } from "@nestjs/common";
import { KapsoCronjobProyectoConfiguracion, Prisma } from "@prisma/client";

import { parseKapsoRouteId } from "./parse-kapso-route-id";
import { throwIfPrismaUniqueViolation } from "./throw-prisma-unique-conflict";
import { KapsoCronjobConfigInput, KapsoCronjobConfigRepository, KapsoCronjobConfigWithProjects, KapsoCronjobProjectConfigInput } from "./kapso-cronjob-config.repository";

type KapsoCronjobConfigRepositoryPort = Pick<KapsoCronjobConfigRepository, "countActiveAdminByIdnetsuite" | "countAdminAssignment" | "countIntegrationById" | "countProjectByIdproyecto" | "create" | "createProjectConfig" | "deleteProjectConfig" | "findById" | "findProjectConfigById" | "findProjectConfigDuplicate" | "list" | "update" | "updateProjectConfig">;

const CRONJOB_NOT_FOUND = "Kapso cronjob config not found";
const PROJECT_CONFIG_NOT_FOUND = "Kapso cronjob project config not found";
const INTEGRATION_NOT_FOUND = "Kapso WhatsApp number integration not found";
const ADMIN_NOT_FOUND = "Active CRM admin not found";
const ADMIN_ASSIGNMENT_NOT_FOUND = "CRM admin is not assigned to this Kapso integration";
const PROJECT_NOT_FOUND = "CRM project not found for the selected admin";
const DUPLICATE_CRONJOB_ID = "Kapso cronjob id already exists";
const DUPLICATE_PROJECT_CONFIG = "Kapso cronjob project config already exists";

export type KapsoCronjobProjectConfigDto = {
    readonly id: string;
    readonly config: unknown;
    readonly idnetsuiteAdmin: number | null;
    readonly idproyectoLead: number;
    readonly isActive: boolean;
    readonly kapsoCronjobConfiguracionId: string;
    readonly kapsoIntegracionNumeroWhatsappId: string;
    readonly createdAt: string;
    readonly updatedAt: string;
};

export type KapsoCronjobConfigDto = {
    readonly id: string;
    readonly config: unknown;
    readonly cronjobId: string;
    readonly isActive: boolean;
    readonly projectConfigs: KapsoCronjobProjectConfigDto[];
    readonly createdAt: string;
    readonly updatedAt: string;
};

export type KapsoCronjobConfigCommand = {
    readonly config?: Record<string, unknown>;
    readonly cronjobId: string;
    readonly isActive: boolean;
};

export type KapsoCronjobProjectConfigCommand = {
    readonly config?: Record<string, unknown>;
    readonly idnetsuiteAdmin?: number | null;
    readonly idproyectoLead: number;
    readonly isActive: boolean;
    readonly kapsoIntegracionNumeroWhatsappId: string;
};

/**
 * Caso de uso para administrar cronjobs Kapso y sus proyectos ejecutables.
 * El cronjob es general; los proyectos habilitados viven como configuracion hija.
 */
@Injectable()
export class KapsoCronjobConfigService {
    constructor(
        @Inject(KapsoCronjobConfigRepository)
        private readonly repository: KapsoCronjobConfigRepositoryPort,
    ) {}

    async listConfigs(): Promise<KapsoCronjobConfigDto[]> {
        return (await this.repository.list()).map((config) => this.toDto(config));
    }

    async createConfig(command: KapsoCronjobConfigCommand): Promise<KapsoCronjobConfigDto> {
        const input = this.toCronjobInput(command);

        try {
            const created = await this.repository.create(input);
            return this.toDto({ ...created, projectConfigs: [] });
        } catch (error) {
            throwIfPrismaUniqueViolation(error, DUPLICATE_CRONJOB_ID);
            throw error;
        }
    }

    async updateConfig(id: string, command: KapsoCronjobConfigCommand): Promise<KapsoCronjobConfigDto> {
        const parsedId = parseKapsoRouteId(id, CRONJOB_NOT_FOUND);

        if (!(await this.repository.findById(parsedId))) {
            throw new NotFoundException(CRONJOB_NOT_FOUND);
        }

        try {
            const updated = await this.repository.update(parsedId, this.toCronjobInput(command));

            if (updated === 0) {
                throw new NotFoundException(CRONJOB_NOT_FOUND);
            }
        } catch (error) {
            throwIfPrismaUniqueViolation(error, DUPLICATE_CRONJOB_ID);
            throw error;
        }

        return this.reloadCronjob(parsedId);
    }

    async createProjectConfig(cronjobConfigId: string, command: KapsoCronjobProjectConfigCommand): Promise<KapsoCronjobProjectConfigDto> {
        const parsedCronjobId = parseKapsoRouteId(cronjobConfigId, CRONJOB_NOT_FOUND);

        if (!(await this.repository.findById(parsedCronjobId))) {
            throw new NotFoundException(CRONJOB_NOT_FOUND);
        }

        const input = await this.toProjectConfigInput(parsedCronjobId, command);
        const duplicate = await this.repository.findProjectConfigDuplicate(input);

        // Evita que el mismo cronjob procese dos veces el mismo proyecto con la misma integracion.
        if (duplicate) {
            throw new ConflictException(DUPLICATE_PROJECT_CONFIG);
        }

        return this.toProjectConfigDto(await this.repository.createProjectConfig(input));
    }

    async updateProjectConfig(id: string, command: KapsoCronjobProjectConfigCommand): Promise<KapsoCronjobProjectConfigDto> {
        const parsedId = parseKapsoRouteId(id, PROJECT_CONFIG_NOT_FOUND);
        const current = await this.repository.findProjectConfigById(parsedId);

        if (!current) {
            throw new NotFoundException(PROJECT_CONFIG_NOT_FOUND);
        }

        const input = await this.toProjectConfigInput(current.kapsoCronjobConfiguracionId, command);
        const duplicate = await this.repository.findProjectConfigDuplicate(input);

        if (duplicate && duplicate.id !== parsedId) {
            throw new ConflictException(DUPLICATE_PROJECT_CONFIG);
        }

        const updated = await this.repository.updateProjectConfig(parsedId, input);

        if (updated === 0) {
            throw new NotFoundException(PROJECT_CONFIG_NOT_FOUND);
        }

        const refreshed = await this.repository.findProjectConfigById(parsedId);

        if (!refreshed) {
            throw new ServiceUnavailableException("Kapso cronjob project config could not be reloaded");
        }

        return this.toProjectConfigDto(refreshed);
    }

    async deleteProjectConfig(id: string): Promise<{ readonly deleted: boolean }> {
        const parsedId = parseKapsoRouteId(id, PROJECT_CONFIG_NOT_FOUND);
        const deleted = await this.repository.deleteProjectConfig(parsedId);

        if (deleted === 0) {
            throw new NotFoundException(PROJECT_CONFIG_NOT_FOUND);
        }

        return { deleted: true };
    }

    private toCronjobInput(command: KapsoCronjobConfigCommand): KapsoCronjobConfigInput {
        return {
            config: (command.config ?? {}) as Prisma.InputJsonValue,
            cronjobId: command.cronjobId.trim(),
            isActive: command.isActive,
        };
    }

    private async toProjectConfigInput(kapsoCronjobConfiguracionId: bigint, command: KapsoCronjobProjectConfigCommand): Promise<KapsoCronjobProjectConfigInput> {
        const integrationId = parseKapsoRouteId(command.kapsoIntegracionNumeroWhatsappId, INTEGRATION_NOT_FOUND);
        const idnetsuiteAdmin = command.idnetsuiteAdmin ? Number(command.idnetsuiteAdmin) : null;

        if ((await this.repository.countIntegrationById(integrationId)) === 0) {
            throw new NotFoundException(INTEGRATION_NOT_FOUND);
        }

        // El admin es opcional: si viene, debe existir y estar asignado a la integracion Kapso.
        if (idnetsuiteAdmin !== null) {
            if ((await this.repository.countActiveAdminByIdnetsuite(idnetsuiteAdmin)) === 0) {
                throw new NotFoundException(ADMIN_NOT_FOUND);
            }

            if ((await this.repository.countAdminAssignment(integrationId, idnetsuiteAdmin)) === 0) {
                throw new NotFoundException(ADMIN_ASSIGNMENT_NOT_FOUND);
            }
        }

        if ((await this.repository.countProjectByIdproyecto(command.idproyectoLead, idnetsuiteAdmin ?? undefined)) === 0) {
            throw new NotFoundException(PROJECT_NOT_FOUND);
        }

        return {
            config: (command.config ?? {}) as Prisma.InputJsonValue,
            idnetsuiteAdmin,
            idproyectoLead: command.idproyectoLead,
            isActive: command.isActive,
            kapsoCronjobConfiguracionId,
            kapsoIntegracionNumeroWhatsappId: integrationId,
        };
    }

    private async reloadCronjob(id: bigint): Promise<KapsoCronjobConfigDto> {
        const refreshed = await this.repository.findById(id);

        if (!refreshed) {
            throw new ServiceUnavailableException("Kapso cronjob config could not be reloaded");
        }

        return this.toDto(refreshed);
    }

    private toDto(config: KapsoCronjobConfigWithProjects): KapsoCronjobConfigDto {
        return {
            config: config.config,
            createdAt: config.createdAt.toISOString(),
            cronjobId: config.cronjobId,
            id: config.id.toString(),
            isActive: config.isActive,
            projectConfigs: config.projectConfigs.map((projectConfig) => this.toProjectConfigDto(projectConfig)),
            updatedAt: config.updatedAt.toISOString(),
        };
    }

    private toProjectConfigDto(config: KapsoCronjobProyectoConfiguracion): KapsoCronjobProjectConfigDto {
        return {
            config: config.config,
            createdAt: config.createdAt.toISOString(),
            id: config.id.toString(),
            idnetsuiteAdmin: config.idnetsuiteAdmin,
            idproyectoLead: config.idproyectoLead,
            isActive: config.isActive,
            kapsoCronjobConfiguracionId: config.kapsoCronjobConfiguracionId.toString(),
            kapsoIntegracionNumeroWhatsappId: config.kapsoIntegracionNumeroWhatsappId.toString(),
            updatedAt: config.updatedAt.toISOString(),
        };
    }
}
