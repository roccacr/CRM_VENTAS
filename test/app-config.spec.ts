import { parseAppConfig } from '../src/config/app-config';

describe('parseAppConfig', () => {
  it('uses port 8002 when PORT is not provided', () => {
    const config = parseAppConfig({});

    expect(config.port).toBe(8002);
  });

  it('accepts explicit environment values without exposing secrets', () => {
    const config = parseAppConfig({
      PORT: '8100',
      NODE_ENV: 'test',
      LOG_LEVEL: 'debug',
      KAPSO_API_KEY: 'secret-value',
      KAPSO_PLATFORM_WEBHOOK_SECRET: 'webhook-secret',
      CRM_API_INTERNAL_TOKEN: 'internal-token',
    });

    expect(config).toMatchObject({
      port: 8100,
      nodeEnv: 'test',
      logLevel: 'debug',
      kapsoApiKeyConfigured: true,
      kapsoPlatformWebhookSecretConfigured: true,
      crmApiInternalTokenConfigured: true,
    });
    expect(config).not.toHaveProperty('kapsoApiKey');
    expect(config).not.toHaveProperty('kapsoPlatformWebhookSecret');
    expect(config).not.toHaveProperty('crmApiInternalToken');
  });

  it('rejects invalid ports before the API starts', () => {
    expect(() => parseAppConfig({ PORT: 'abc' })).toThrow('Invalid environment configuration');
  });
});
