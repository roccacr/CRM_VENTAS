import 'dotenv/config';

import { expect, test } from '@playwright/test';
import { createHmac } from 'node:crypto';

const sign = (payload: Record<string, unknown>): string => {
  const secret = process.env.KAPSO_PLATFORM_WEBHOOK_SECRET;

  if (!secret) {
    throw new Error('KAPSO_PLATFORM_WEBHOOK_SECRET is required for webhook Playwright tests');
  }

  return createHmac('sha256', secret).update(JSON.stringify(payload)).digest('hex');
};

test.describe('Kapso platform webhook', () => {
  test('accepts a signed unsupported event without touching integrations', async ({ request }) => {
    const payload = { execution_id: 'playwright-smoke' };
    const response = await request.post('/api/v1/webhooks/kapso/platform', {
      data: payload,
      headers: {
        'X-Idempotency-Key': 'playwright-ignored-event',
        'X-Webhook-Event': 'workflow.execution.failed',
        'X-Webhook-Signature': sign(payload),
      },
    });
    const body = (await response.json()) as Record<string, unknown>;

    expect(response.ok()).toBe(true);
    expect(body).toEqual({ ok: true, processed: false, action: 'ignored' });
  });

  test('rejects an invalid webhook signature', async ({ request }) => {
    const response = await request.post('/api/v1/webhooks/kapso/platform', {
      data: { phone_number_id: '123456789012345' },
      headers: {
        'X-Webhook-Event': 'whatsapp.phone_number.created',
        'X-Webhook-Signature': 'invalid',
      },
    });

    expect(response.status()).toBe(401);
  });

  test('rejects a signed payload without event header', async ({ request }) => {
    const payload = { phone_number_id: '123456789012345' };
    const response = await request.post('/api/v1/webhooks/kapso/platform', {
      data: payload,
      headers: {
        'X-Webhook-Signature': sign(payload),
      },
    });

    expect(response.status()).toBe(400);
  });
});
