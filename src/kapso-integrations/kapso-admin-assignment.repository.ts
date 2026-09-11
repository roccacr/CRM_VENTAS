import { Inject, Injectable } from "@nestjs/common";
import { Admin, KapsoIntegracionAdminAsignacion, KapsoIntegracionNumeroWhatsapp, Prisma } from "@prisma/client";

import { PrismaService } from "../database/prisma.service";

export type KapsoIntegrationWithAssignments = KapsoIntegracionNumeroWhatsapp & {
    readonly adminAssignments: KapsoIntegracionAdminAsignacion[];
};

type AdminSafe = Pick<Admin, "emailAdmin" | "idAdmin" | "idnetsuiteAdmin" | "nameAdmin" | "statusAdmin">;

type KapsoAdminAssignmentPrismaPort = {
    readonly admin: {
        readonly count: (args: Prisma.AdminCountArgs) => Promise<number>;
        readonly findMany: (args: Prisma.AdminFindManyArgs) => Promise<AdminSafe[]>;
    };
    readonly kapsoIntegracionAdminAsignacion: {
        readonly create: (args: Prisma.KapsoIntegracionAdminAsignacionCreateArgs) => Promise<KapsoIntegracionAdminAsignacion>;
        readonly deleteMany: (args: Prisma.KapsoIntegracionAdminAsignacionDeleteManyArgs) => Promise<Prisma.BatchPayload>;
        readonly findFirst: (args: Prisma.KapsoIntegracionAdminAsignacionFindFirstArgs) => Promise<KapsoIntegracionAdminAsignacion | null>;
        readonly updateMany: (args: Prisma.KapsoIntegracionAdminAsignacionUpdateManyArgs) => Promise<Prisma.BatchPayload>;
    };
    readonly kapsoIntegracionNumeroWhatsapp: {
        readonly count: (args: Prisma.KapsoIntegracionNumeroWhatsappCountArgs) => Promise<number>;
        readonly findMany: (args: Prisma.KapsoIntegracionNumeroWhatsappFindManyArgs) => Promise<KapsoIntegrationWithAssignments[]>;
    };
    readonly kapsoCronjobProyectoConfiguracion: {
        readonly count: (args: Prisma.KapsoCronjobProyectoConfiguracionCountArgs) => Promise<number>;
    };
};

/**
 * Adaptador Prisma de asignaciones admin-integracion.
 * Expone solo consultas necesarias para no filtrar columnas sensibles de admins.
 */
@Injectable()
export class KapsoAdminAssignmentRepository {
    constructor(@Inject(PrismaService) private readonly prisma: KapsoAdminAssignmentPrismaPort) {}

    listActiveAdmins(search = "", includeInactive = false): Promise<AdminSafe[]> {
        const trimmedSearch = search.trim();
        const numericSearch = Number(trimmedSearch);
        const searchFilters: Prisma.AdminWhereInput[] = trimmedSearch ? [{ nameAdmin: { contains: trimmedSearch } }, { emailAdmin: { contains: trimmedSearch } }] : [];

        // El selector permite buscar por nombre/correo y tambien por idnetsuite exacto.
        if (trimmedSearch && !Number.isNaN(numericSearch)) {
            searchFilters.push({ idnetsuiteAdmin: numericSearch });
        }

        return this.prisma.admin.findMany({
            orderBy: { nameAdmin: "asc" },
            select: {
                emailAdmin: true,
                idAdmin: true,
                idnetsuiteAdmin: true,
                nameAdmin: true,
                statusAdmin: true,
            },
            take: 100,
            where: {
                idnetsuiteAdmin: { not: null },
                ...(includeInactive ? {} : { statusAdmin: 1 }),
                ...(searchFilters.length > 0 ? { OR: searchFilters } : {}),
            },
        });
    }

    listIntegrationsWithAssignments(): Promise<KapsoIntegrationWithAssignments[]> {
        return this.prisma.kapsoIntegracionNumeroWhatsapp.findMany({
            include: {
                adminAssignments: { orderBy: { createdAt: "desc" } },
            },
            orderBy: { createdAt: "desc" },
        });
    }

    listAdminsByIdnetsuite(ids: number[]): Promise<AdminSafe[]> {
        return this.prisma.admin.findMany({
            orderBy: [{ statusAdmin: "desc" }, { nameAdmin: "asc" }],
            select: {
                emailAdmin: true,
                idAdmin: true,
                idnetsuiteAdmin: true,
                nameAdmin: true,
                statusAdmin: true,
            },
            where: { idnetsuiteAdmin: { in: ids } },
        });
    }

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

    countCronjobConfigsByAdminAssignment(kapsoIntegracionNumeroWhatsappId: bigint, idnetsuiteAdmin: number): Promise<number> {
        // Protege configuraciones futuras que sigan amarradas a un admin especifico.
        return this.prisma.kapsoCronjobProyectoConfiguracion.count({
            where: {
                idnetsuiteAdmin,
                kapsoIntegracionNumeroWhatsappId,
            },
        });
    }

    findAssignmentById(id: bigint): Promise<KapsoIntegracionAdminAsignacion | null> {
        return this.prisma.kapsoIntegracionAdminAsignacion.findFirst({ where: { id } });
    }

    createAssignment(kapsoIntegracionNumeroWhatsappId: bigint, idnetsuiteAdmin: number): Promise<KapsoIntegracionAdminAsignacion> {
        return this.prisma.kapsoIntegracionAdminAsignacion.create({
            data: {
                idnetsuiteAdmin,
                kapsoIntegracionNumeroWhatsappId,
            },
        });
    }

    async updateAssignment(id: bigint, idnetsuiteAdmin: number): Promise<number> {
        const result = await this.prisma.kapsoIntegracionAdminAsignacion.updateMany({
            data: { idnetsuiteAdmin },
            where: { id },
        });

        return result.count;
    }

    async deleteAssignment(id: bigint): Promise<number> {
        const result = await this.prisma.kapsoIntegracionAdminAsignacion.deleteMany({ where: { id } });
        return result.count;
    }
}
