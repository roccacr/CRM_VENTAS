import { buildTypeOrmOptions } from "../../src/database/typeorm.options";

describe("buildTypeOrmOptions", () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("configura reintentos para fallas temporales de conexion MySQL", () => {
    process.env.MYSQL_HOST = "db.example.com";
    process.env.MYSQL_PORT = "3306";
    process.env.MYSQL_USER = "crm";
    process.env.MYSQL_PASSWORD = "secret";
    process.env.MYSQL_DATABASE = "crm_database";
    delete process.env.MYSQL_RETRY_ATTEMPTS;
    delete process.env.MYSQL_RETRY_DELAY_MS;

    const options = buildTypeOrmOptions();

    expect(options.retryAttempts).toBe(20);
    expect(options.retryDelay).toBe(5000);
    expect(options.verboseRetryLog).toBe(true);
  });

  it("permite ajustar la politica de reintentos desde el entorno", () => {
    process.env.MYSQL_RETRY_ATTEMPTS = "40";
    process.env.MYSQL_RETRY_DELAY_MS = "10000";

    const options = buildTypeOrmOptions();

    expect(options.retryAttempts).toBe(40);
    expect(options.retryDelay).toBe(10000);
  });
});
