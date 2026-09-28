import { describe, expect, it } from "vitest";

import { IdentityTokenService } from "../../src/modules/crm/identity/identity-token.service.js";

/**
 * Secreto estable solo para pruebas de HMAC.
 */
const TEST_AUTH_TOKEN_HASH_SECRET = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

/**
 * Fecha fija para que los vencimientos de sesion sean deterministas.
 */
const FIXED_NOW = new Date("2026-09-28T00:00:00.000Z");

/**
 * Vencimiento obligatorio aprobado: 8 horas exactas despues del login.
 */
const EXPECTED_EIGHT_HOUR_EXPIRATION = "2026-09-28T08:00:00.000Z";

/**
 * Crea el servicio con ConfigService minimo.
 */
const createTokenService = (): IdentityTokenService =>
    new IdentityTokenService({
        getOrThrow: (key: string) => {
            if (key !== "AUTH_TOKEN_HASH_SECRET") {
                throw new Error(`Config de prueba inesperada: ${key}`);
            }

            return TEST_AUTH_TOKEN_HASH_SECRET;
        },
    } as never);

describe("IdentityTokenService", () => {
    it("emite sesion inicial y refresh inicial con vencimiento absoluto de 8 horas", () => {
        const tokens = createTokenService().issueInitialTokens(FIXED_NOW);

        expect(tokens.sessionExpiresAt.toISOString()).toBe(EXPECTED_EIGHT_HOUR_EXPIRATION);
        expect(tokens.refreshExpiresAt.toISOString()).toBe(EXPECTED_EIGHT_HOUR_EXPIRATION);
    });

    it("emite refresh rotado con vencimiento maximo de 8 horas", () => {
        const refresh = createTokenService().rotateRefreshToken(FIXED_NOW);

        expect(refresh.refreshExpiresAt.toISOString()).toBe(EXPECTED_EIGHT_HOUR_EXPIRATION);
    });
});
