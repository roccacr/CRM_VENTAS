/**
 * Módulo del agregado de subsidiarias.
 *
 * `crm_subsidiary` y `crm_subsidiary_external_reference` se guardan juntos. La
 * identidad y la auditoría entran como dependencias; este módulo no abre el
 * pool del CRM viejo. El adaptador legacy, si existe, se inyecta por el puerto opcional.
 */
import { Module } from "@nestjs/common";

import { AuditModule } from "../audit/audit.module.js";
import { IdentityModule } from "../identity/identity.module.js";
import { SubsidiariesController } from "./subsidiaries.controller.js";
import { SubsidiariesRepository } from "./subsidiaries.repository.js";
import { SubsidiariesService } from "./subsidiaries.service.js";

/**
 * Agregado propio. Identidad y bitácora entran como dependencias.
 * Este módulo no registra el lector ni el escritor del CRM viejo, y no exporta otro pool.
 */
@Module({
    imports: [AuditModule, IdentityModule],
    controllers: [SubsidiariesController],
    providers: [SubsidiariesRepository, SubsidiariesService],
})
export class SubsidiariesModule {}
