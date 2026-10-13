/**
 * Módulo del agregado de campañas.
 *
 * `crm_campaign` y `crm_campaign_external_reference` se guardan juntos. La
 * identidad y la auditoría entran como dependencias; este módulo no abre el
 * pool del CRM viejo. El adaptador legacy, si existe, se inyecta por el puerto opcional.
 */
import { Module } from "@nestjs/common";

import { AuditModule } from "../audit/audit.module.js";
import { IdentityModule } from "../identity/identity.module.js";
import { CampaignsController } from "./campaigns.controller.js";
import { CampaignsRepository } from "./campaigns.repository.js";
import { CampaignsService } from "./campaigns.service.js";

/**
 * Registers the independent Campaigns domain and its audited dependencies.
 */
@Module({
    imports: [AuditModule, IdentityModule],
    controllers: [CampaignsController],
    providers: [CampaignsRepository, CampaignsService],
})
export class CampaignsModule {}
