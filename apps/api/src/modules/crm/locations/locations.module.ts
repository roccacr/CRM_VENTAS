/**
 * Módulo del agregado de ubicaciones.
 *
 * `crm_location` y `crm_location_external_reference` se guardan juntos. La
 * identidad y la auditoría entran como dependencias; este módulo no abre el
 * pool del CRM viejo. El adaptador legacy, si existe, se inyecta por el puerto opcional.
 */
import { Module } from "@nestjs/common";

import { AuditModule } from "../audit/audit.module.js";
import { IdentityModule } from "../identity/identity.module.js";
import { LocationsController } from "./locations.controller.js";
import { LocationsRepository } from "./locations.repository.js";
import { LocationsService } from "./locations.service.js";

/**
 * Registers the independent Locations domain and its audited dependencies.
 */
@Module({
    imports: [AuditModule, IdentityModule],
    controllers: [LocationsController],
    providers: [LocationsRepository, LocationsService],
})
export class LocationsModule {}
