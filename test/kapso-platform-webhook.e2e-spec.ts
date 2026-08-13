import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { createHmac } from 'node:crypto';
import request from 'supertest';

import { AppModule } from '../src/app.module';
import { KapsoPlatformWebhookService } from '../src/kapso-webhooks/kapso-platform-webhook.service';

const secret = 'e2e-webhook-secret';

const createSignature = (payload: Record<string, unknown>): string =>
  createHmac('sha256', secret).update(JSON.stringify(payload)).digest('hex');

describe('Kapso platform webhook endpoint', () => {
  let app: INestApplication;
  const webhookService = {
    process: jest.fn(),
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(ConfigService)
      .useValue({ get: () => secret })
      .overrideProvider(KapsoPlatformWebhookService)
      .useValue(webhookService)
      .compile();

    app = moduleRef.createNestApplication({ rawBody: true });
    app.setGlobalPrefix('api/v1');
    await app.init();
  });

  beforeEach(() => {
    webhookService.process.mockReset();
    webhookService.process.mockResolvedValue({ processed: true, action: 'created' });
  });

  afterAll(async () => {
    await app.close();
  });

  it('returns 200 and processes a signed created event', async () => {
    const payload = { phone_number_id: '123456789012345', project: { id: 'project-1' } };

    const response = await request(app.getHttpServer() as Parameters<typeof request>[0])
      .post('/api/v1/webhooks/kapso/platform')
      .set('X-Webhook-Event', 'whatsapp.phone_number.created')
      .set('X-Webhook-Signature', createSignature(payload))
      .set('X-Idempotency-Key', 'idem-1')
      .send(payload)
      .expect(200);

    expect(response.body).toEqual({ ok: true, processed: true, action: 'created' });
    expect(webhookService.process).toHaveBeenCalledWith({
      event: 'whatsapp.phone_number.created',
      idempotencyKey: 'idem-1',
      payload,
    });
  });

  it('returns 200 and processes a signed deleted event', async () => {
    const payload = { phone_number_id: '123456789012345' };
    webhookService.process.mockResolvedValueOnce({ processed: true, action: 'deleted' });

    const response = await request(app.getHttpServer() as Parameters<typeof request>[0])
      .post('/api/v1/webhooks/kapso/platform')
      .set('X-Webhook-Event', 'whatsapp.phone_number.deleted')
      .set('X-Webhook-Signature', createSignature(payload))
      .set('X-Idempotency-Key', 'idem-2')
      .send(payload)
      .expect(200);

    expect(response.body).toEqual({ ok: true, processed: true, action: 'deleted' });
    expect(webhookService.process).toHaveBeenCalledWith({
      event: 'whatsapp.phone_number.deleted',
      idempotencyKey: 'idem-2',
      payload,
    });
  });

  it('returns 401 when the signature is invalid', async () => {
    const payload = { phone_number_id: '123456789012345' };

    await request(app.getHttpServer() as Parameters<typeof request>[0])
      .post('/api/v1/webhooks/kapso/platform')
      .set('X-Webhook-Event', 'whatsapp.phone_number.created')
      .set('X-Webhook-Signature', 'invalid')
      .send(payload)
      .expect(401);

    expect(webhookService.process).not.toHaveBeenCalled();
  });

  it('returns 400 when the event header is missing', async () => {
    const payload = { phone_number_id: '123456789012345' };

    await request(app.getHttpServer() as Parameters<typeof request>[0])
      .post('/api/v1/webhooks/kapso/platform')
      .set('X-Webhook-Signature', createSignature(payload))
      .send(payload)
      .expect(400);

    expect(webhookService.process).not.toHaveBeenCalled();
  });

  it('returns 200 and ignored when the signed event is unsupported', async () => {
    const payload = { execution_id: 'execution-1' };
    webhookService.process.mockResolvedValueOnce({ processed: false, action: 'ignored' });

    const response = await request(app.getHttpServer() as Parameters<typeof request>[0])
      .post('/api/v1/webhooks/kapso/platform')
      .set('X-Webhook-Event', 'workflow.execution.failed')
      .set('X-Webhook-Signature', createSignature(payload))
      .send(payload)
      .expect(200);

    expect(response.body).toEqual({ ok: true, processed: false, action: 'ignored' });
  });
});
