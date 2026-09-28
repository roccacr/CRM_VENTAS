import type { ConfigService } from "@nestjs/config";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { Microsoft365AuthService } from "../../src/integrations/microsoft365/microsoft365-auth.service.js";

const acquireTokenByCode = vi.fn();
const getAuthCodeUrl = vi.fn();
const serializeCache = vi.fn();
const deserializeCache = vi.fn();
const getAccountByHomeId = vi.fn();
const acquireTokenSilent = vi.fn();

vi.mock("@azure/msal-node", () => ({
    ConfidentialClientApplication: vi.fn().mockImplementation(function createConfidentialClientApplicationMock() {
        return {
            acquireTokenByCode,
            acquireTokenSilent,
            getAuthCodeUrl,
            getTokenCache: () => ({
                deserialize: deserializeCache,
                getAccountByHomeId,
                serialize: serializeCache,
            }),
        };
    }),
    CryptoProvider: vi.fn().mockImplementation(function createCryptoProviderMock() {
        return {
            createNewGuid: () => "guid",
            generatePkceCodes: () =>
                Promise.resolve({
                    challenge: "pkce-challenge",
                    verifier: "pkce-verifier",
                }),
        };
    }),
    InteractionRequiredAuthError: class InteractionRequiredAuthError extends Error {},
}));

const TEST_CONFIG = {
    MICROSOFT_CLIENT_ID: "client",
    MICROSOFT_CLIENT_SECRET: "secret",
    MICROSOFT_REDIRECT_URI: "http://localhost:3000/identity/microsoft/callback",
    MICROSOFT_SCOPES: "openid profile email offline_access User.Read",
    MICROSOFT_TENANT_ID: "tenant",
} as const;

/**
 * Crea ConfigService minimo para el adapter Microsoft sin leer `.env`.
 */
const createConfigService = (): Pick<ConfigService, "getOrThrow"> => ({
    getOrThrow: (key: string) => TEST_CONFIG[key as keyof typeof TEST_CONFIG],
});

describe("Microsoft365AuthService", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        serializeCache.mockReturnValue('{"cache":true}');
    });

    it("lee foto de Graph con timeout y no expone tokens Microsoft", async () => {
        acquireTokenByCode.mockResolvedValue({
            accessToken: "access-token-msal",
            account: {
                homeAccountId: "home.tenant",
                localAccountId: "oid",
                name: "Roberto",
                tenantId: "tenant",
                username: "roberto@roccacr.com",
            },
        });
        const fetchMock = vi.fn().mockResolvedValue({
            arrayBuffer: () => Promise.resolve(Buffer.from("foto").buffer),
            headers: {
                get: () => "image/jpeg",
            },
            ok: true,
            status: 200,
        });
        vi.stubGlobal("fetch", fetchMock);
        const service = new Microsoft365AuthService(createConfigService() as ConfigService);

        const result = await service.completeCallback({
            code: "codigo",
            codeVerifier: "verifier",
            nonce: "nonce",
            state: "state",
        });

        const [fetchUrl, fetchOptions] = fetchMock.mock.calls[0] as [string, RequestInit];

        expect(fetchUrl).toBe("https://graph.microsoft.com/v1.0/me/photo/$value");
        expect(fetchOptions.headers).toEqual({
            Authorization: "Bearer access-token-msal",
        });
        expect(fetchOptions.signal).toBeInstanceOf(AbortSignal);
        expect(result.profilePhoto?.mimeType).toBe("image/jpeg");
        expect(result.msalCacheSerialized).toBe('{"cache":true}');
        expect(JSON.stringify(result)).not.toContain("access-token-msal");
    });
});
