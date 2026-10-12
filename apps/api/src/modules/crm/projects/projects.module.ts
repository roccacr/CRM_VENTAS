/**
 * Módulo del agregado de proyectos.
 *
 * `crm_project` y `crm_project_external_reference` se guardan juntos. La
 * identidad y la auditoría entran como dependencias; este módulo no abre el
 * pool del CRM viejo. El adaptador legacy, si existe, se inyecta por el puerto opcional.
 */
import { Module } from "@nestjs/common";

import { AuditModule } from "../audit/audit.module.js";
import { IdentityModule } from "../identity/identity.module.js";
import { ProjectsController } from "./projects.controller.js";
import { ProjectsRepository } from "./projects.repository.js";
import { ProjectsService } from "./projects.service.js";

@Module({
    imports: [AuditModule, IdentityModule],
    controllers: [ProjectsController],
    providers: [ProjectsRepository, ProjectsService],
})
export class ProjectsModule {}
