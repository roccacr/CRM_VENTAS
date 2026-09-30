import type { ConfigService } from "@nestjs/config";
import { describe, expect, it, vi } from "vitest";

import type { MicrosoftMsalCacheCryptoService } from "../../src/common/security/microsoft-msal-cache-crypto.service.js";
import { IdentityMicrosoftSessionService } from "../../src/modules/crm/identity/identity-microsoft-session.service.js";
import type { MicrosoftAuthProvider } from "../../src/modules/crm/identity/ports/microsoft-auth-provider.port.js";

const COOKIE_SECRET = "cookie-secret-for-tests-32-chars!!";
const ENCRYPTED_CACHE = {
    ciphertext: "cipher",
    iv: "iv",
    keyVersion: 1,
    tag: "tag",
};

/**
 * Crea el colaborador Microsoft con puerto mockeado.
 */
const createMicrosoftSessionService = () => {
    const microsoft = {
        acquireTokenSilent: vi.fn(),
        completeCallback: vi.fn(),
        readProfilePhoto: vi.fn(),
        startLogin: vi.fn().mockResolvedValue({
            authorizationUrl: "https://login.microsoftonline.com/tenant/oauth2/v2.0/authorize?state=estado",
            codeVerifier: "verifier-secreto",
            nonce: "nonce",
            state: "estado",
        }),
    } as unknown as MicrosoftAuthProvider;
    const cacheCrypto = {
        decrypt: vi.fn().mockReturnValue('{"cache":true}'),
        encrypt: vi.fn().mockReturnValue(ENCRYPTED_CACHE),
    } as unknown as MicrosoftMsalCacheCryptoService;
    const service = new IdentityMicrosoftSessionService(microsoft, cacheCrypto, {
        getOrThrow: vi.fn().mockReturnValue(COOKIE_SECRET),
    } as unknown as ConfigService);

    return {
        cacheCrypto: cacheCrypto as unknown as {
            decrypt: ReturnType<typeof vi.fn>;
            encrypt: ReturnType<typeof vi.fn>;
        },
        microsoft: microsoft as unknown as {
            acquireTokenSilent: ReturnType<typeof vi.fn>;
            completeCallback: ReturnType<typeof vi.fn>;
            readProfilePhoto: ReturnType<typeof vi.fn>;
            startLogin: ReturnType<typeof vi.fn>;
        },
        service,
    };
};

describe("IdentityMicrosoftSessionService", () => {
    it("emite challenge firmado sin exponer el verifier en la URL", async () => {
        const { service } = createMicrosoftSessionService();

        const result = await service.startLogin();

        expect(result.authorizationUrl).toContain("state=estado");
        expect(result.authorizationUrl).not.toContain("verifier-secreto");
        expect(result.challengeCookie).toContain(".");
        expect(result.challengeExpiresAt).toBeInstanceOf(Date);
    });

    it("valida challenge y devuelve cache MSAL cifrada durante callback", async () => {
        const { microsoft, service } = createMicrosoftSessionService();
        microsoft.completeCallback.mockResolvedValue({
            displayName: "Roberto",
            email: "roberto@roccacr.com",
            homeAccountId: "home.tenant",
            msalCacheSerialized: '{"cache":true}',
            oid: "oid",
            profilePhoto: null,
            subject: "oid",
            tenantId: "tenant",
        });
        const challenge = await service.startLogin();

        const result = await service.completeCallback({
            challengeCookie: challenge.challengeCookie,
            code: "codigo",
            state: "estado",
        });

        expect(microsoft.completeCallback).toHaveBeenCalledWith(expect.objectContaining({ code: "codigo", codeVerifier: "verifier-secreto", nonce: "nonce", state: "estado" }));
        expect(result.encryptedCache).toEqual(ENCRYPTED_CACHE);
    });

    it("rechaza callback si el challenge fue manipulado", async () => {
        const { service } = createMicrosoftSessionService();

        await expect(service.completeCallback({ challengeCookie: "payload.firma-mala", code: "codigo", state: "estado" })).rejects.toThrow("Challenge Microsoft invalido.");
    });

    it("devuelve null cuando Microsoft exige login interactivo en renovacion silenciosa", async () => {
        const { microsoft, service } = createMicrosoftSessionService();
        microsoft.acquireTokenSilent.mockResolvedValue({ interactionRequired: true, reason: "microsoft_interaction_required" });

        await expect(service.renewSilentToken({ cache: ENCRYPTED_CACHE, homeAccountId: "home.tenant" })).resolves.toBeNull();
    });

    it("relee la foto de perfil con token silencioso y devuelve cache cifrada nueva", async () => {
        const { microsoft, service } = createMicrosoftSessionService();
        microsoft.acquireTokenSilent.mockResolvedValue({
            accessToken: "access-token",
            interactionRequired: false,
            msalCacheSerialized: '{"cache":"next"}',
        });
        microsoft.readProfilePhoto.mockResolvedValue({
            bytes: Buffer.from("foto"),
            mimeType: "image/jpeg",
        });

        const result = await service.refreshProfilePhoto({ cache: ENCRYPTED_CACHE, homeAccountId: "home.tenant" });

        expect(microsoft.readProfilePhoto).toHaveBeenCalledWith("access-token");
        expect(result).toEqual({
            encryptedCache: ENCRYPTED_CACHE,
            profilePhoto: {
                bytes: Buffer.from("foto"),
                mimeType: "image/jpeg",
            },
        });
    });
});
