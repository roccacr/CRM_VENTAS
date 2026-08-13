import { expect, test } from '@playwright/test';

test.describe('API health', () => {
  test('returns service status from the running server', async ({ request }) => {
    const response = await request.get('/api/v1/health');
    const body = (await response.json()) as Record<string, unknown>;

    expect(response.ok()).toBe(true);
    expect(body.status).toBe('ok');
    expect(body.service).toBe('api-kapso-git');
  });

  test('returns an ISO timestamp', async ({ request }) => {
    const response = await request.get('/api/v1/health');
    const body = (await response.json()) as Record<string, unknown>;

    expect(typeof body.timestamp).toBe('string');
    expect(Number.isNaN(Date.parse(body.timestamp as string))).toBe(false);
  });
});
