import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { z } from 'zod';

import { KapsoWhatsappNumberRepository } from '../kapso-integrations/kapso-whatsapp-number.repository';

/** Nombres de evento Kapso que esta API procesa (el resto → ignored). */
const EVENT_PHONE_NUMBER_CREATED = 'whatsapp.phone_number.created';
const EVENT_PHONE_NUMBER_DELETED = 'whatsapp.phone_number.deleted';

/**
 * Payload mínimo de created/deleted.
 * phone_number_id es obligatorio y no vacío (min(1) ≠ solo truthy).
 */
const phoneNumberEventSchema = z.object({
  customer: z.object({ id: z.string().min(1).optional() }).optional(),
  phone_number_id: z.string().min(1),
  project: z.object({ id: z.string().min(1).optional() }).optional(),
});

export type KapsoPlatformWebhookInput = {
  readonly event: string;
  /** Aceptado pero aún no usado para deduplicar (ver process). */
  readonly idempotencyKey?: string | undefined;
  readonly payload: unknown;
};

export type KapsoPlatformWebhookResult = {
  readonly processed: boolean;
  readonly action: 'created' | 'deleted' | 'ignored';
};

type PhoneNumberEvent = z.infer<typeof phoneNumberEventSchema>;

/**
 * Orquesta eventos Kapso Platform → repositorio de integraciones.
 *
 * Eventos desconocidos: { processed: false, action: 'ignored' } (HTTP 200).
 * Así Kapso no reintenta por eventos que aún no soportamos.
 *
 * idempotencyKey: hoy se ignora a propósito. Cuando se implemente, persistir
 * la clave y short-circuit antes del switch.
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
      case EVENT_PHONE_NUMBER_CREATED:
        return this.createIntegration(input.payload);
      case EVENT_PHONE_NUMBER_DELETED:
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

  /**
   * @throws {BadRequestException} si el payload no cumple el schema
   */
  private parsePhoneNumberEvent(payload: unknown): PhoneNumberEvent {
    const result = phoneNumberEventSchema.safeParse(payload);

    if (!result.success) {
      throw new BadRequestException('Invalid Kapso phone number webhook payload');
    }

    return result.data;
  }
}
