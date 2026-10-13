/**
 * Módulo del agregado de clases.
 *
 * `crm_class` y `crm_class_external_reference` se guardan juntos. La
 * identidad y la auditoría entran como dependencias; este módulo no abre el
 * pool del CRM viejo. El adaptador legacy, si existe, se inyecta por el puerto opcional.
 */
import { Module } from "@nestjs/common";

import { AuditModule } from "../audit/audit.module.js";
import { IdentityModule } from "../identity/identity.module.js";
import { ClassesController } from "./classes.controller.js";
import { ClassesRepository } from "./classes.repository.js";
import { ClassesService } from "./classes.service.js";

/**
 * Registers the independent Classes domain and its audited dependencies.
 */
@Module({
    imports: [AuditModule, IdentityModule],
    controllers: [ClassesController],
    providers: [ClassesRepository, ClassesService],
})
export class ClassesModule {}
