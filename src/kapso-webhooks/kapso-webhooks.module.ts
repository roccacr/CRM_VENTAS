import { Module } from '@nestjs/common';

import { KapsoIntegrationsModule } from '../kapso-integrations/kapso-integrations.module';
import { KapsoPlatformWebhookController } from './kapso-platform-webhook.controller';
import { KapsoPlatformWebhookService } from './kapso-platform-webhook.service';
import { KapsoWebhookSignatureService } from './kapso-webhook-signature.service';

/**
 * Webhooks Kapso Platform.
 * Importa KapsoIntegrationsModule para reusar el repository (upsert/delete).
 */
@Module({
  controllers: [KapsoPlatformWebhookController],
  imports: [KapsoIntegrationsModule],
  providers: [KapsoPlatformWebhookService, KapsoWebhookSignatureService],
})
export class KapsoWebhooksModule {}
