import { ForbiddenException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

import { KapsoMediaUrlSignerService } from "../../src/modules/kapso/services/kapso-media-url-signer.service";

describe("KapsoMediaUrlSignerService", () => {
  const configValues: Record<string, unknown> = {
    "app.apiPrefix": "api/v1",
    "kapso.publicBaseUrl": "https://crm.example.com/",
    "kapso.mediaSigningSecret": "a-secure-test-secret-with-more-than-32-characters",
    "kapso.mediaSignedUrlTtlSeconds": 60,
  };

  const configServiceMock = {
    get: jest.fn((key: string, fallback?: unknown) => configValues[key] ?? fallback),
    getOrThrow: jest.fn((key: string) => {
      const value = configValues[key];

      if (value === undefined) {
        throw new Error(`Missing test config: ${key}`);
      }

      return value;
    }),
  };

  const service = new KapsoMediaUrlSignerService(configServiceMock as unknown as ConfigService);

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("genera una URL temporal que valida correctamente", () => {
    jest.spyOn(Date, "now").mockReturnValue(1_800_000_000_000);
    const signedUrl = new URL(service.createSignedUrl("media-file.jpg"));

    expect(signedUrl.origin).toBe("https://crm.example.com");
    expect(signedUrl.pathname).toBe("/api/v1/kapso/media/media-file.jpg");
    expect(() =>
      service.assertValid(
        "media-file.jpg",
        signedUrl.searchParams.get("expires") ?? undefined,
        signedUrl.searchParams.get("signature") ?? undefined,
      ),
    ).not.toThrow();
  });

  it("rechaza una firma alterada", () => {
    const signedUrl = new URL(service.createSignedUrl("media-file.jpg"));

    expect(() => service.assertValid("media-file.jpg", signedUrl.searchParams.get("expires") ?? undefined, "0".repeat(64))).toThrow(
      ForbiddenException,
    );
  });

  it("rechaza una URL vencida", () => {
    jest.spyOn(Date, "now").mockReturnValue(1_800_000_000_000);
    const signedUrl = new URL(service.createSignedUrl("media-file.jpg"));
    jest.spyOn(Date, "now").mockReturnValue(1_800_000_061_000);

    expect(() =>
      service.assertValid(
        "media-file.jpg",
        signedUrl.searchParams.get("expires") ?? undefined,
        signedUrl.searchParams.get("signature") ?? undefined,
      ),
    ).toThrow(ForbiddenException);
  });
});
