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

    it("pide siempre selector de cuenta al iniciar Microsoft", async () => {
        getAuthCodeUrl.mockResolvedValue("https://login.microsoftonline.com/tenant/oauth2/v2.0/authorize?prompt=select_account");
        const service = new Microsoft365AuthService(createConfigService() as ConfigService);

        await expect(service.startLogin()).resolves.toEqual({
            authorizationUrl: "https://login.microsoftonline.com/tenant/oauth2/v2.0/authorize?prompt=select_account",
            codeVerifier: "pkce-verifier",
            nonce: "guid",
            state: "guid",
        });
        expect(getAuthCodeUrl).toHaveBeenCalledWith(
            expect.objectContaining({
                codeChallenge: "pkce-challenge",
                codeChallengeMethod: "S256",
                nonce: "guid",
                prompt: "select_account",
                redirectUri: "http://localhost:3000/identity/microsoft/callback",
                scopes: ["openid", "profile", "email", "offline_access", "User.Read"],
                state: "guid",
            }),
        );
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

    it("no falla el login si Graph rechaza la foto del perfil", async () => {
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
        vi.stubGlobal(
            "fetch",
            vi.fn().mockResolvedValue({
                ok: false,
                status: 500,
            }),
        );
        const service = new Microsoft365AuthService(createConfigService() as ConfigService);

        await expect(
            service.completeCallback({
                code: "codigo",
                codeVerifier: "verifier",
                nonce: "nonce",
                state: "state",
            }),
        ).resolves.toEqual(expect.objectContaining({ profilePhoto: null }));
    });

    it("descarta fotos con MIME no permitido por defensa en profundidad", async () => {
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
        vi.stubGlobal(
            "fetch",
            vi.fn().mockResolvedValue({
                arrayBuffer: () => Promise.resolve(Buffer.from("<svg />").buffer),
                headers: {
                    get: () => "image/svg+xml",
                },
                ok: true,
                status: 200,
            }),
        );
        const service = new Microsoft365AuthService(createConfigService() as ConfigService);

        await expect(
            service.completeCallback({
                code: "codigo",
                codeVerifier: "verifier",
                nonce: "nonce",
                state: "state",
            }),
        ).resolves.toEqual(expect.objectContaining({ profilePhoto: null }));
    });

    it("no falla el login si la lectura de foto agota timeout o red", async () => {
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
        vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("Graph timeout")));
        const service = new Microsoft365AuthService(createConfigService() as ConfigService);

        await expect(
            service.completeCallback({
                code: "codigo",
                codeVerifier: "verifier",
                nonce: "nonce",
                state: "state",
            }),
        ).resolves.toEqual(expect.objectContaining({ profilePhoto: null }));
    });

    it("rechaza cuentas invitadas EXT aunque Microsoft entregue tokens", async () => {
        acquireTokenByCode.mockResolvedValue({
            accessToken: "access-token-msal",
            account: {
                homeAccountId: "home.tenant",
                localAccountId: "oid",
                name: "Invitado",
                tenantId: "tenant",
                username: "usuario_dominio.com#EXT#@tenant.onmicrosoft.com",
            },
        });
        const service = new Microsoft365AuthService(createConfigService() as ConfigService);

        await expect(
            service.completeCallback({
                code: "codigo",
                codeVerifier: "verifier",
                nonce: "nonce",
                state: "state",
            }),
        ).rejects.toThrow("Microsoft no devolvio una cuenta valida.");
    });

    it("rechaza tokens Microsoft de otro tenant", async () => {
        acquireTokenByCode.mockResolvedValue({
            accessToken: "access-token-msal",
            account: {
                homeAccountId: "home.otro-tenant",
                localAccountId: "oid",
                name: "Roberto",
                tenantId: "otro-tenant",
                username: "roberto@roccacr.com",
            },
        });
        const service = new Microsoft365AuthService(createConfigService() as ConfigService);

        await expect(
            service.completeCallback({
                code: "codigo",
                codeVerifier: "verifier",
                nonce: "nonce",
                state: "state",
            }),
        ).rejects.toThrow("Microsoft no devolvio una cuenta valida.");
    });
});
