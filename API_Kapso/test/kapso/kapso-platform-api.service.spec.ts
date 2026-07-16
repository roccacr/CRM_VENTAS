// ============================================================================
// IMPORTS
// ============================================================================

import { HttpService } from "@nestjs/axios";
import { ConfigService } from "@nestjs/config";

import { KapsoPlatformApiService } from "../../src/modules/kapso/services/kapso-platform-api.service";

// ============================================================================
// CONSTANTES DE PRUEBA
// ============================================================================

const TEST_PHONE_NUMBER_ID = "1197677976762773";

// ============================================================================
// HELPERS DE TEST
// ============================================================================

/** Mock minimo de `ConfigService` con las claves usadas por el cliente Kapso. */
function createKapsoConfigServiceMock(): ConfigService {
  return {
    getOrThrow: jest.fn((key: string) => {
      switch (key) {
        case "kapso.apiBaseUrl":
          return "https://api.kapso.ai/platform/v1";
        case "kapso.apiKey":
          return "test-api-key";
        case "kapso.publicBaseUrl":
          return "https://crm.example.com";
        case "app.apiPrefix":
          return "api/v1";
        case "kapso.whatsappWebhookSecret":
          return "secret-whatsapp-123456";
        default:
          return "";
      }
    }),
    get: jest.fn(() => ({})),
  } as unknown as ConfigService;
}

/** Mock minimo del cliente HTTP: no se usa directo porque el spec pincha `request`. */
function createHttpServiceMock(): HttpService {
  return {
    request: jest.fn(),
  } as unknown as HttpService;
}

// ============================================================================
// TESTS
// ============================================================================

describe("KapsoPlatformApiService", () => {
  it("incluye secret_key al crear el webhook meta por numero", async () => {
    const configServiceMock = createKapsoConfigServiceMock();
    const httpServiceMock = createHttpServiceMock();
    const service = new KapsoPlatformApiService(httpServiceMock, configServiceMock);
    const requestSpy = jest.fn().mockResolvedValue({ data: { id: "meta-webhook-1" } });

    (service as unknown as { request: typeof requestSpy }).request = requestSpy;

    await service.createMetaPhoneNumberWebhook(TEST_PHONE_NUMBER_ID);

    expect(requestSpy).toHaveBeenCalledWith(
      `/whatsapp/phone_numbers/${TEST_PHONE_NUMBER_ID}/webhooks`,
      "post",
      {
        whatsapp_webhook: {
          kind: "meta",
          url: "https://crm.example.com/api/v1/webhooks/kapso/meta",
          active: true,
          secret_key: "secret-whatsapp-123456",
        },
      },
      undefined,
    );
  });
});
