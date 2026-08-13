import { BadRequestException } from '@nestjs/common';

import { KapsoPlatformWebhookService } from '../src/kapso-webhooks/kapso-platform-webhook.service';

const createdPayload = {
  phone_number_id: '123456789012345',
  project: { id: 'project-1' },
  customer: { id: 'customer-1' },
};

type RepositoryMock = {
  readonly deleteByKapsoPhoneNumberId: jest.Mock;
  readonly upsertFromKapsoCreatedEvent: jest.Mock;
};

const createRepositoryMock = (): RepositoryMock => ({
  deleteByKapsoPhoneNumberId: jest.fn(),
  upsertFromKapsoCreatedEvent: jest.fn(),
});

describe('KapsoPlatformWebhookService', () => {
  it('creates or updates a WhatsApp number integration from a created event', async () => {
    const repository = createRepositoryMock();
    const service = new KapsoPlatformWebhookService(repository);

    await expect(
      service.process({
        event: 'whatsapp.phone_number.created',
        idempotencyKey: 'idem-1',
        payload: createdPayload,
      }),
    ).resolves.toEqual({ processed: true, action: 'created' });

    expect(repository.upsertFromKapsoCreatedEvent).toHaveBeenCalledWith({
      kapsoPhoneNumberId: '123456789012345',
      kapsoProjectId: 'project-1',
      kapsoCustomerId: 'customer-1',
      rawPayload: createdPayload,
    });
  });

  it('rejects a created event without phone_number_id', async () => {
    const repository = createRepositoryMock();
    const service = new KapsoPlatformWebhookService(repository);

    await expect(
      service.process({
        event: 'whatsapp.phone_number.created',
        idempotencyKey: 'idem-1',
        payload: { project: { id: 'project-1' } },
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(repository.upsertFromKapsoCreatedEvent).not.toHaveBeenCalled();
  });

  it('deletes the WhatsApp number integration from a deleted event', async () => {
    const repository = createRepositoryMock();
    const service = new KapsoPlatformWebhookService(repository);

    await expect(
      service.process({
        event: 'whatsapp.phone_number.deleted',
        idempotencyKey: 'idem-2',
        payload: { phone_number_id: '123456789012345' },
      }),
    ).resolves.toEqual({ processed: true, action: 'deleted' });

    expect(repository.deleteByKapsoPhoneNumberId).toHaveBeenCalledWith('123456789012345');
  });

  it('returns ignored for unsupported events without touching the database', async () => {
    const repository = createRepositoryMock();
    const service = new KapsoPlatformWebhookService(repository);

    await expect(
      service.process({
        event: 'workflow.execution.failed',
        idempotencyKey: 'idem-3',
        payload: { execution_id: 'execution-1' },
      }),
    ).resolves.toEqual({ processed: false, action: 'ignored' });

    expect(repository.upsertFromKapsoCreatedEvent).not.toHaveBeenCalled();
    expect(repository.deleteByKapsoPhoneNumberId).not.toHaveBeenCalled();
  });

  it('lets database errors bubble as controlled API errors', async () => {
    const repository = createRepositoryMock();
    repository.deleteByKapsoPhoneNumberId.mockRejectedValue(new Error('db unavailable'));
    const service = new KapsoPlatformWebhookService(repository);

    await expect(
      service.process({
        event: 'whatsapp.phone_number.deleted',
        idempotencyKey: 'idem-4',
        payload: { phone_number_id: '123456789012345' },
      }),
    ).rejects.toThrow('db unavailable');
  });
});
