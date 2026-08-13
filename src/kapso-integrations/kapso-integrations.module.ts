import { Module } from '@nestjs/common';

import { CrmInternalTokenGuard } from '../auth/crm-internal-token.guard';
import { KapsoWhatsappNumberRepository } from './kapso-whatsapp-number.repository';
import { KapsoWhatsappNumbersController } from './kapso-whatsapp-numbers.controller';
import { KapsoWhatsappNumbersService } from './kapso-whatsapp-numbers.service';

/**
 * Integraciones Kapso ↔ CRM: listado y activación de números WhatsApp.
 * Protegido con CrmInternalTokenGuard.
 */
@Module({
  controllers: [KapsoWhatsappNumbersController],
  exports: [KapsoWhatsappNumberRepository, KapsoWhatsappNumbersService],
  providers: [CrmInternalTokenGuard, KapsoWhatsappNumberRepository, KapsoWhatsappNumbersService],
})
export class KapsoIntegrationsModule {}
