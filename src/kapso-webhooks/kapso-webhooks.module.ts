import { Module } from "@nestjs/common";

import { KapsoIntegrationsModule } from "../kapso-integrations/kapso-integrations.module";
import { KapsoPlatformWebhookController } from "./kapso-platform-webhook.controller";
import { KapsoPlatformWebhookService } from "./kapso-platform-webhook.service";
import { KapsoWebhookSignatureGuard } from "./kapso-webhook-signature.guard";
import { KapsoWebhookSignatureService } from "./kapso-webhook-signature.service";
import { KapsoWhatsappWebhookController } from "./kapso-whatsapp-webhook.controller";
import { KapsoWhatsappWebhookRepository } from "./kapso-whatsapp-webhook.repository";
import { KapsoWhatsappWebhookSignatureGuard } from "./kapso-whatsapp-webhook-signature.guard";
import { KapsoWhatsappWebhookService } from "./kapso-whatsapp-webhook.service";

/**
 * Webhooks Kapso (Platform + WhatsApp por numero).
 *
 * Firma = guards de config sobre `WebhookSignatureGuard` (common).
 * Importa `KapsoIntegrationsModule` para reusar repo de numeros y el client
 * que asegura el webhook WhatsApp al crear un phone number.
 */
@Module({
    controllers: [KapsoPlatformWebhookController, KapsoWhatsappWebhookController],
    imports: [KapsoIntegrationsModule],
    providers: [KapsoPlatformWebhookService, KapsoWebhookSignatureGuard, KapsoWebhookSignatureService, KapsoWhatsappWebhookRepository, KapsoWhatsappWebhookSignatureGuard, KapsoWhatsappWebhookService],
})
export class KapsoWebhooksModule {}
