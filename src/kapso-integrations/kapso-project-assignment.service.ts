import { Inject, Injectable } from "@nestjs/common";

import { KapsoProjectAssignmentRepository, KapsoProjectOptionRow } from "./kapso-project-assignment.repository";

type KapsoProjectAssignmentRepositoryPort = Pick<KapsoProjectAssignmentRepository, "listProjectOptions">;

export type KapsoProjectOptionDto = {
    readonly idproyectoLead: number;
    readonly proyectoLead: string | null;
};

/** Lista proyectos CRM desde leads para alimentar selectores de configuracion Kapso. */
@Injectable()
export class KapsoProjectAssignmentService {
    constructor(
        @Inject(KapsoProjectAssignmentRepository)
        private readonly repository: KapsoProjectAssignmentRepositoryPort,
    ) {}

    async listProjectOptions(search = "", idnetsuiteAdmin?: number): Promise<KapsoProjectOptionDto[]> {
        const projects = await this.repository.listProjectOptions(search, idnetsuiteAdmin);
        return projects.map((project) => this.toProjectOptionDto(project));
    }

    private toProjectOptionDto(project: KapsoProjectOptionRow): KapsoProjectOptionDto {
        return {
            idproyectoLead: Number(project.idproyectoLead),
            proyectoLead: project.proyectoLead,
        };
    }
}
