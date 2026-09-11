import { Inject, Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";

import { PrismaService } from "../database/prisma.service";

export type KapsoProjectOptionRow = {
    readonly idproyectoLead: number;
    readonly proyectoLead: string | null;
};

type KapsoProjectAssignmentPrismaPort = {
    readonly lead: {
        readonly findMany: (args: Prisma.LeadFindManyArgs) => Promise<KapsoProjectOptionRow[]>;
    };
};

/** Lee proyectos desde `leads`, que en esta BD funciona como fuente practica de proyectos CRM. */
@Injectable()
export class KapsoProjectAssignmentRepository {
    constructor(@Inject(PrismaService) private readonly prisma: KapsoProjectAssignmentPrismaPort) {}

    listProjectOptions(search = "", idnetsuiteAdmin?: number): Promise<KapsoProjectOptionRow[]> {
        const trimmedSearch = search.trim();
        const numericSearch = Number(trimmedSearch);
        const searchFilters: Prisma.LeadWhereInput[] = trimmedSearch ? [{ proyectoLead: { contains: trimmedSearch } }] : [];

        if (trimmedSearch && !Number.isNaN(numericSearch)) {
            searchFilters.push({ idproyectoLead: numericSearch });
        }

        return this.prisma.lead.findMany({
            distinct: ["idproyectoLead"],
            orderBy: { proyectoLead: "asc" },
            select: {
                idproyectoLead: true,
                proyectoLead: true,
            },
            take: 100,
            where: {
                idproyectoLead: { gt: 0 },
                // Con admin seleccionado, el selector debe mostrar solo proyectos encontrados para ese admin.
                ...(idnetsuiteAdmin ? { idEmpleadoLead: idnetsuiteAdmin } : {}),
                ...(searchFilters.length > 0 ? { OR: searchFilters } : {}),
            },
        });
    }
}
