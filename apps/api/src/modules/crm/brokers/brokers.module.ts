/**
 * Módulo del agregado de corredores.
 *
 * `crm_broker` y `crm_broker_external_reference` se guardan juntos. La
 * identidad y la auditoría entran como dependencias; este módulo no abre el
 * pool del CRM viejo. El adaptador legacy, si existe, se inyecta por el puerto opcional.
 */
import { Module } from "@nestjs/common";

import { AuditModule } from "../audit/audit.module.js";
import { IdentityModule } from "../identity/identity.module.js";
import { BrokersController } from "./brokers.controller.js";
import { BrokersRepository } from "./brokers.repository.js";
import { BrokersService } from "./brokers.service.js";

/**
 * Registers the independent Brokers domain and its audited dependencies.
 */
@Module({
    imports: [AuditModule, IdentityModule],
    controllers: [BrokersController],
    providers: [BrokersRepository, BrokersService],
})
export class BrokersModule {}
