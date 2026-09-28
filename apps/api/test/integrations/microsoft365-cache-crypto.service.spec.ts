import type { ConfigService } from "@nestjs/config";
import { describe, expect, it } from "vitest";

import { MicrosoftMsalCacheCryptoService } from "../../src/common/security/microsoft-msal-cache-crypto.service.js";

const TEST_MICROSOFT_CACHE_KEY = Buffer.alloc(32, 7).toString("base64");

/**
 * Crea el cifrador con ConfigService minimo.
 */
const createCryptoService = (): MicrosoftMsalCacheCryptoService =>
    new MicrosoftMsalCacheCryptoService({
        getOrThrow: (key: string) => {
            if (key !== "MICROSOFT_MSAL_CACHE_ENCRYPTION_KEY") {
                throw new Error(`Config inesperada: ${key}`);
            }

            return TEST_MICROSOFT_CACHE_KEY;
        },
    } as unknown as ConfigService);

describe("MicrosoftMsalCacheCryptoService", () => {
    it("cifra cache MSAL sin persistir el texto plano", () => {
        const service = createCryptoService();
        const cache = '{"RefreshToken":"token-msal-no-debe-verse"}';

        const encrypted = service.encrypt(cache);

        expect(encrypted.ciphertext).not.toContain("token-msal-no-debe-verse");
        expect(service.decrypt(encrypted)).toBe(cache);
    });

    it("rechaza cache MSAL alterada por autenticacion GCM", () => {
        const service = createCryptoService();
        const encrypted = service.encrypt('{"cache":true}');

        expect(() => service.decrypt({ ...encrypted, ciphertext: `${encrypted.ciphertext.slice(0, -2)}AA` })).toThrow();
    });
});
