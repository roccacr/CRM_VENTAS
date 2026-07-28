import { validateEnv } from "../../src/config/validate-env";

describe("validateEnv", () => {
  const validBaseEnv = {
    API_PREFIX: "api/v1",
    CORS_ALLOWED_ORIGINS: "http://localhost:5173",
    CRM_JWT_SECRET: "crm-test-secret",
    KAPSO_MEDIA_SIGNING_SECRET: "media-signing-secret-with-more-than-32-chars",
    KAPSO_PLATFORM_WEBHOOK_SECRET: "platform-secret-123",
    KAPSO_PUBLIC_BASE_URL: "https://kapso.example.com",
    KAPSO_WHATSAPP_WEBHOOK_SECRET: "whatsapp-secret-123",
    MYSQL_DATABASE: "crmdatabase-api",
    MYSQL_HOST: "127.0.0.1",
    MYSQL_PASSWORD: "",
    MYSQL_PORT: "3306",
    MYSQL_USER: "crm_user",
    NODE_ENV: "test",
    PORT: "8002",
    KAPSO_JOBS_DRIVER: "local",
  };

  it("permite arrancar con token CRM sin configurar Microsoft Entra", () => {
    const config = validateEnv({
      ...validBaseEnv,
      ENTRA_ALLOWED_CLIENT_IDS: "",
      ENTRA_API_AUDIENCE: "",
      ENTRA_TENANT_ID: "",
    });

    expect(config).toMatchObject({
      CRM_JWT_SECRET: "crm-test-secret",
      ENTRA_ALLOWED_CLIENT_IDS: "",
      ENTRA_API_AUDIENCE: "",
      ENTRA_TENANT_ID: "",
    });
  });

  it("exige al menos un secreto JWT compatible con la sesion CRM", () => {
    const envWithoutCrmSecret = { ...validBaseEnv } as Partial<typeof validBaseEnv>;
    delete envWithoutCrmSecret.CRM_JWT_SECRET;

    expect(() => validateEnv(envWithoutCrmSecret)).toThrow(/CRM_JWT_SECRET|JWT_SECRET/);
  });

  it("permite arrancar en modo local sin Redis", () => {
    const config = validateEnv(validBaseEnv);

    expect(config).toMatchObject({
      KAPSO_JOBS_DRIVER: "local",
    });
  });

  it("permite configurar Redis por host y puerto cuando BullMQ esta activo", () => {
    const envWithRedisHost = { ...validBaseEnv } as Record<string, string>;
    envWithRedisHost.KAPSO_JOBS_DRIVER = "bullmq";
    envWithRedisHost.REDIS_HOST = "127.0.0.1";
    envWithRedisHost.REDIS_PORT = "6379";

    const config = validateEnv(envWithRedisHost);

    expect(config).toMatchObject({
      REDIS_HOST: "127.0.0.1",
      REDIS_PORT: 6379,
    });
  });

  it("rechaza BullMQ sin REDIS_URL ni REDIS_HOST", () => {
    const envWithoutRedis = {
      ...validBaseEnv,
      KAPSO_JOBS_DRIVER: "bullmq",
    } as Record<string, string>;

    expect(() => validateEnv(envWithoutRedis)).toThrow(/REDIS_URL|REDIS_HOST/);
  });

  it("rechaza Microsoft Entra configurado sin clientes autorizados", () => {
    expect(() =>
      validateEnv({
        ...validBaseEnv,
        ENTRA_ALLOWED_CLIENT_IDS: "",
        ENTRA_API_AUDIENCE: "api://kapso-test",
        ENTRA_TENANT_ID: "00000000-0000-4000-8000-000000000001",
      }),
    ).toThrow(/ENTRA_ALLOWED_CLIENT_IDS/);
  });
});
