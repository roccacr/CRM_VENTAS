import { expect, test } from '@playwright/test';

test.describe('Swagger and OpenAPI', () => {
  test('serves the Swagger UI HTML', async ({ request }) => {
    const response = await request.get('/api/docs');
    const body = await response.text();

    expect(response.ok()).toBe(true);
    expect(response.headers()['content-type']).toContain('text/html');
    expect(body).toContain('Swagger UI');
  });

  test('serves the OpenAPI JSON document', async ({ request }) => {
    const response = await request.get('/api/docs-json');
    const body = (await response.json()) as {
      info?: { title?: string; version?: string };
      paths?: Record<string, unknown>;
    };

    expect(response.ok()).toBe(true);
    expect(body.info?.title).toBe('API Kapso GIT');
    expect(body.info?.version).toBe('0.1.0');
    expect(body.paths).toBeDefined();
  });
});
