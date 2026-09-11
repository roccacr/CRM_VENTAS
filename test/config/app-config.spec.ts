import { parseAppConfig } from "../../src/config/app-config";

describe("parseAppConfig", () => {
    it("uses port 8002 when PORT is not provided", () => {
        const config = parseAppConfig({});

        expect(config.port).toBe(8002);
    });

    it("accepts explicit environment values without exposing secrets", () => {
        const config = parseAppConfig({
            PORT: "8100",
            NODE_ENV: "test",
            LOG_LEVEL: "debug",
            KAPSO_API_KEY: "secret-value",
            KAPSO_PLATFORM_WEBHOOK_SECRET: "webhook-secret",
            KAPSO_WHATSAPP_WEBHOOK_SECRET: "whatsapp-secret",
            KAPSO_WHATSAPP_WEBHOOK_URL: "https://example.test/api/v1/webhooks/kapso/whatsapp",
            CRM_API_INTERNAL_TOKEN: "internal-token",
        });

        expect(config).toMatchObject({
            port: 8100,
            nodeEnv: "test",
            logLevel: "debug",
            kapsoApiKeyConfigured: true,
            kapsoPlatformWebhookSecretConfigured: true,
            kapsoWhatsappWebhookSecretConfigured: true,
            kapsoWhatsappWebhookUrlConfigured: true,
            crmApiInternalTokenConfigured: true,
        });
        expect(config).not.toHaveProperty("kapsoApiKey");
        expect(config).not.toHaveProperty("kapsoPlatformWebhookSecret");
        expect(config).not.toHaveProperty("kapsoWhatsappWebhookSecret");
        expect(config).not.toHaveProperty("kapsoWhatsappWebhookUrl");
        expect(config).not.toHaveProperty("crmApiInternalToken");
    });

    it("rejects invalid ports before the API starts", () => {
        expect(() => parseAppConfig({ PORT: "abc" })).toThrow("Invalid environment configuration");
    });

    it.each(["0", "65536", "-1"])("rejects out-of-range PORT %s", (port) => {
        expect(() => parseAppConfig({ PORT: port })).toThrow("Invalid environment configuration");
    });

    it("rejects invalid NODE_ENV and LOG_LEVEL", () => {
        expect(() => parseAppConfig({ NODE_ENV: "staging" })).toThrow("Invalid environment configuration");
        expect(() => parseAppConfig({ LOG_LEVEL: "verbose" })).toThrow("Invalid environment configuration");
    });

    it("treats empty secret strings as not configured", () => {
        const config = parseAppConfig({
            KAPSO_API_KEY: "",
            KAPSO_PLATFORM_WEBHOOK_SECRET: "",
            CRM_API_INTERNAL_TOKEN: "",
        });

        expect(config.kapsoApiKeyConfigured).toBe(false);
        expect(config.kapsoPlatformWebhookSecretConfigured).toBe(false);
        expect(config.crmApiInternalTokenConfigured).toBe(false);
    });
});
