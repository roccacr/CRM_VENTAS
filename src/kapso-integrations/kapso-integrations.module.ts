import { Module } from "@nestjs/common";

import { CrmInternalTokenGuard } from "../auth/crm-internal-token.guard";
import { KapsoAdminAssignmentController } from "./kapso-admin-assignment.controller";
import { KapsoAdminAssignmentRepository } from "./kapso-admin-assignment.repository";
import { KapsoAdminAssignmentService } from "./kapso-admin-assignment.service";
import { KapsoCronjobConfigController } from "./kapso-cronjob-config.controller";
import { KapsoCronjobConfigRepository } from "./kapso-cronjob-config.repository";
import { KapsoCronjobConfigService } from "./kapso-cronjob-config.service";
import { KapsoPhoneWebhookClient } from "./kapso-phone-webhook.client";
import { KapsoPlatformClient } from "./kapso-platform.client";
import { KapsoProjectAssignmentController } from "./kapso-project-assignment.controller";
import { KapsoProjectAssignmentRepository } from "./kapso-project-assignment.repository";
import { KapsoProjectAssignmentService } from "./kapso-project-assignment.service";
import { KapsoWhatsappNumberRepository } from "./kapso-whatsapp-number.repository";
import { KapsoWhatsappNumbersController } from "./kapso-whatsapp-numbers.controller";
import { KapsoWhatsappNumbersService } from "./kapso-whatsapp-numbers.service";

/**
 * Integraciones Kapso ↔ CRM (números WhatsApp).
 *
 * Exporta repository + service para que KapsoWebhooksModule reutilice la
 * persistencia sin duplicar providers. CrmInternalTokenGuard es config sobre
 * InternalTokenGuard (common/auth); webhooks usan firma HMAC, no token CRM.
 */
@Module({
    controllers: [KapsoAdminAssignmentController, KapsoCronjobConfigController, KapsoProjectAssignmentController, KapsoWhatsappNumbersController],
    exports: [KapsoPhoneWebhookClient, KapsoWhatsappNumberRepository, KapsoWhatsappNumbersService],
    providers: [CrmInternalTokenGuard, KapsoAdminAssignmentRepository, KapsoAdminAssignmentService, KapsoCronjobConfigRepository, KapsoCronjobConfigService, KapsoPhoneWebhookClient, KapsoPlatformClient, KapsoProjectAssignmentRepository, KapsoProjectAssignmentService, KapsoWhatsappNumberRepository, KapsoWhatsappNumbersService],
})
export class KapsoIntegrationsModule {}
