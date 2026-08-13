import { createHmac } from 'node:crypto';

import { KapsoWebhookSignatureService } from '../src/kapso-webhooks/kapso-webhook-signature.service';

const secret = 'test-secret';
const rawBody = JSON.stringify({
  phone_number_id: '123456789012345',
  project: { id: 'project-1' },
});

const sign = (body: string): string => createHmac('sha256', secret).update(body).digest('hex');

describe('KapsoWebhookSignatureService', () => {
  const service = new KapsoWebhookSignatureService();

  it('accepts a valid HMAC SHA256 signature', () => {
    expect(service.verify(rawBody, sign(rawBody), secret)).toBe(true);
  });

  it('accepts a valid signature with sha256 prefix', () => {
    expect(service.verify(rawBody, `sha256=${sign(rawBody)}`, secret)).toBe(true);
  });

  it('rejects an invalid signature', () => {
    expect(service.verify(rawBody, 'bad-signature', secret)).toBe(false);
  });

  it('rejects missing signature or secret', () => {
    expect(service.verify(rawBody, undefined, secret)).toBe(false);
    expect(service.verify(rawBody, sign(rawBody), undefined)).toBe(false);
  });
});
