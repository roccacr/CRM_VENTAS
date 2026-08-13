import { Module } from '@nestjs/common';

import { CrmInternalTokenGuard } from '../auth/crm-internal-token.guard';
import { KapsoWhatsappNumberRepository } from './kapso-whatsapp-number.repository';
import { KapsoWhatsappNumbersController } from './kapso-whatsapp-numbers.controller';
import { KapsoWhatsappNumbersService } from './kapso-whatsapp-numbers.service';

/**
 * Integraciones Kapso ↔ CRM (números WhatsApp).
 *
 * Exporta repository + service para que KapsoWebhooksModule reutilice la
 * persistencia sin duplicar providers. El guard vive aquí porque solo esta
 * API HTTP lo usa hoy (webhooks usan firma HMAC, no token CRM).
 */
@Module({
  controllers: [KapsoWhatsappNumbersController],
  exports: [KapsoWhatsappNumberRepository, KapsoWhatsappNumbersService],
  providers: [CrmInternalTokenGuard, KapsoWhatsappNumberRepository, KapsoWhatsappNumbersService],
})
export class KapsoIntegrationsModule {}
