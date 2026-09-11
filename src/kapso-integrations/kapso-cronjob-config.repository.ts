import { Inject, Injectable } from "@nestjs/common";
import { KapsoCronjobConfiguracion, KapsoCronjobProyectoConfiguracion, Prisma } from "@prisma/client";

import { PrismaService } from "../database/prisma.service";

export type KapsoCronjobConfigWithProjects = KapsoCronjobConfiguracion & {
    readonly projectConfigs: KapsoCronjobProyectoConfiguracion[];
};

type KapsoCronjobConfigPrismaPort = {
    readonly admin: {
        readonly count: (args: Prisma.AdminCountArgs) => Promise<number>;
    };
    readonly kapsoCronjobConfiguracion: {
        readonly create: (args: Prisma.KapsoCronjobConfiguracionCreateArgs) => Promise<KapsoCronjobConfiguracion>;
        readonly findFirst: (args: Prisma.KapsoCronjobConfiguracionFindFirstArgs) => Promise<KapsoCronjobConfigWithProjects | KapsoCronjobConfiguracion | null>;
        readonly findMany: (args: Prisma.KapsoCronjobConfiguracionFindManyArgs) => Promise<KapsoCronjobConfigWithProjects[]>;
        readonly updateMany: (args: Prisma.KapsoCronjobConfiguracionUpdateManyArgs) => Promise<Prisma.BatchPayload>;
    };
    readonly kapsoCronjobProyectoConfiguracion: {
        readonly create: (args: Prisma.KapsoCronjobProyectoConfiguracionCreateArgs) => Promise<KapsoCronjobProyectoConfiguracion>;
        readonly deleteMany: (args: Prisma.KapsoCronjobProyectoConfiguracionDeleteManyArgs) => Promise<Prisma.BatchPayload>;
        readonly findFirst: (args: Prisma.KapsoCronjobProyectoConfiguracionFindFirstArgs) => Promise<KapsoCronjobProyectoConfiguracion | null>;
        readonly updateMany: (args: Prisma.KapsoCronjobProyectoConfiguracionUpdateManyArgs) => Promise<Prisma.BatchPayload>;
    };
    readonly kapsoIntegracionAdminAsignacion: {
        readonly count: (args: Prisma.KapsoIntegracionAdminAsignacionCountArgs) => Promise<number>;
    };
    readonly kapsoIntegracionNumeroWhatsapp: {
        readonly count: (args: Prisma.KapsoIntegracionNumeroWhatsappCountArgs) => Promise<number>;
    };
    readonly lead: {
        readonly count: (args: Prisma.LeadCountArgs) => Promise<number>;
    };
};

export type KapsoCronjobConfigInput = {
    readonly config?: Prisma.InputJsonValue;
    readonly cronjobId: string;
    readonly isActive: boolean;
};

export type KapsoCronjobProjectConfigInput = {
    readonly config?: Prisma.InputJsonValue;
    readonly idnetsuiteAdmin: number | null;
    readonly idproyectoLead: number;
    readonly isActive: boolean;
    readonly kapsoCronjobConfiguracionId: bigint;
    readonly kapsoIntegracionNumeroWhatsappId: bigint;
};

/**
 * Adaptador Prisma de configuraciones de cronjobs Kapso.
 * Mantiene las validaciones de existencia como conteos baratos antes de escribir en produccion.
 */
@Injectable()
export class KapsoCronjobConfigRepository {
    constructor(@Inject(PrismaService) private readonly prisma: KapsoCronjobConfigPrismaPort) {}

    countIntegrationById(id: bigint): Promise<number> {
        return this.prisma.kapsoIntegracionNumeroWhatsapp.count({ where: { id } });
    }

    countActiveAdminByIdnetsuite(idnetsuiteAdmin: number): Promise<number> {
        return this.prisma.admin.count({
            where: {
                idnetsuiteAdmin,
                statusAdmin: 1,
            },
        });
    }

    countAdminAssignment(kapsoIntegracionNumeroWhatsappId: bigint, idnetsuiteAdmin: number): Promise<number> {
        return this.prisma.kapsoIntegracionAdminAsignacion.count({
            where: {
                idnetsuiteAdmin,
                kapsoIntegracionNumeroWhatsappId,
            },
        });
    }

    countProjectByIdproyecto(idproyectoLead: number, idnetsuiteAdmin?: number): Promise<number> {
        // Si hay admin, el proyecto debe aparecer en leads de ese admin; sin admin se valida proyecto general.
        return this.prisma.lead.count({
            where: {
                idproyectoLead,
                ...(idnetsuiteAdmin ? { idEmpleadoLead: idnetsuiteAdmin } : {}),
            },
        });
    }

    findById(id: bigint): Promise<KapsoCronjobConfigWithProjects | null> {
        return this.prisma.kapsoCronjobConfiguracion.findFirst({
            include: { projectConfigs: { orderBy: { createdAt: "desc" } } },
            where: { id },
        }) as Promise<KapsoCronjobConfigWithProjects | null>;
    }

    findProjectConfigById(id: bigint): Promise<KapsoCronjobProyectoConfiguracion | null> {
        return this.prisma.kapsoCronjobProyectoConfiguracion.findFirst({ where: { id } });
    }

    findProjectConfigDuplicate(input: KapsoCronjobProjectConfigInput): Promise<KapsoCronjobProyectoConfiguracion | null> {
        // La unicidad funcional incluye admin nullable; Prisma/MySQL no cubre igual todos los NULL.
        return this.prisma.kapsoCronjobProyectoConfiguracion.findFirst({
            where: {
                idnetsuiteAdmin: input.idnetsuiteAdmin,
                idproyectoLead: input.idproyectoLead,
                kapsoCronjobConfiguracionId: input.kapsoCronjobConfiguracionId,
                kapsoIntegracionNumeroWhatsappId: input.kapsoIntegracionNumeroWhatsappId,
            },
        });
    }

    list(): Promise<KapsoCronjobConfigWithProjects[]> {
        return this.prisma.kapsoCronjobConfiguracion.findMany({
            include: { projectConfigs: { orderBy: { createdAt: "desc" } } },
            orderBy: { createdAt: "desc" },
        });
    }

    create(input: KapsoCronjobConfigInput): Promise<KapsoCronjobConfiguracion> {
        return this.prisma.kapsoCronjobConfiguracion.create({
            data: input,
        });
    }

    createProjectConfig(input: KapsoCronjobProjectConfigInput): Promise<KapsoCronjobProyectoConfiguracion> {
        return this.prisma.kapsoCronjobProyectoConfiguracion.create({
            data: input,
        });
    }

    async update(id: bigint, input: KapsoCronjobConfigInput): Promise<number> {
        const result = await this.prisma.kapsoCronjobConfiguracion.updateMany({
            data: input,
            where: { id },
        });

        return result.count;
    }

    async updateProjectConfig(id: bigint, input: KapsoCronjobProjectConfigInput): Promise<number> {
        const result = await this.prisma.kapsoCronjobProyectoConfiguracion.updateMany({
            data: input,
            where: { id },
        });

        return result.count;
    }

    async deleteProjectConfig(id: bigint): Promise<number> {
        const result = await this.prisma.kapsoCronjobProyectoConfiguracion.deleteMany({
            where: { id },
        });
        return result.count;
    }
}
