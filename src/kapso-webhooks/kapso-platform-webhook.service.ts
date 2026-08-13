import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { z } from 'zod';

import { KapsoWhatsappNumberRepository } from '../kapso-integrations/kapso-whatsapp-number.repository';

/** Payload de eventos created/deleted de número WhatsApp. */
const phoneNumberEventSchema = z.object({
  customer: z.object({ id: z.string().min(1).optional() }).optional(),
  phone_number_id: z.string().min(1),
  project: z.object({ id: z.string().min(1).optional() }).optional(),
});

export type KapsoPlatformWebhookInput = {
  readonly event: string;
  readonly idempotencyKey?: string | undefined;
  readonly payload: unknown;
};

export type KapsoPlatformWebhookResult = {
  readonly processed: boolean;
  readonly action: 'created' | 'deleted' | 'ignored';
};

type PhoneNumberEvent = z.infer<typeof phoneNumberEventSchema>;

/**
 * Enruta eventos Kapso Platform al repositorio de integraciones.
 * Eventos desconocidos → ignored (ack al emisor).
 */
@Injectable()
export class KapsoPlatformWebhookService {
  constructor(
    @Inject(KapsoWhatsappNumberRepository)
    private readonly repository: Pick<
      KapsoWhatsappNumberRepository,
      'deleteByKapsoPhoneNumberId' | 'upsertFromKapsoCreatedEvent'
    >,
  ) {}

  async process(input: KapsoPlatformWebhookInput): Promise<KapsoPlatformWebhookResult> {
    switch (input.event) {
      case 'whatsapp.phone_number.created':
        return this.createIntegration(input.payload);
      case 'whatsapp.phone_number.deleted':
        return this.deleteIntegration(input.payload);
      default:
        return { processed: false, action: 'ignored' };
    }
  }

  private async createIntegration(payload: unknown): Promise<KapsoPlatformWebhookResult> {
    const event = this.parsePhoneNumberEvent(payload);

    await this.repository.upsertFromKapsoCreatedEvent({
      kapsoCustomerId: event.customer?.id,
      kapsoPhoneNumberId: event.phone_number_id,
      kapsoProjectId: event.project?.id,
      rawPayload: event,
    });

    return { processed: true, action: 'created' };
  }

  private async deleteIntegration(payload: unknown): Promise<KapsoPlatformWebhookResult> {
    const event = this.parsePhoneNumberEvent(payload);
    await this.repository.deleteByKapsoPhoneNumberId(event.phone_number_id);
    return { processed: true, action: 'deleted' };
  }

  private parsePhoneNumberEvent(payload: unknown): PhoneNumberEvent {
    const result = phoneNumberEventSchema.safeParse(payload);
    if (!result.success) {
      throw new BadRequestException('Invalid Kapso phone number webhook payload');
    }

    return result.data;
  }
}
