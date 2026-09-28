import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

import { CSRF_TOKEN_BYTES, CSRF_TOKEN_SEPARATOR, isValidCsrfTokenFormat } from "./http-security.constants.js";

// ============================================================================
// Tokens CSRF firmados para el patron BFF.
//
// El frontend lee el token solo para repetirlo en el header. La firma evita que
// un valor plantado por cliente sea aceptado aunque coincida cookie/header, y el
// binding a la sesion hace que un CSRF anonimo no sirva despues del login.
// ============================================================================

const ANONYMOUS_CSRF_BINDING = "anonymous";

/**
 * Devuelve el binding estable que se usa al firmar CSRF.
 */
const resolveCsrfBinding = (sessionToken?: string): string => sessionToken ?? ANONYMOUS_CSRF_BINDING;

/**
 * Firma el nonce CSRF con secreto de servidor y binding de sesion.
 */
const signCsrfNonce = (nonce: string, secret: string, sessionToken?: string): string =>
    createHmac("sha256", secret)
        .update(`${resolveCsrfBinding(sessionToken)}:${nonce}`)
        .digest("base64url");

/**
 * Compara firmas sin filtrar diferencias de timing.
 */
const signaturesMatch = (left: string, right: string): boolean => {
    const leftBuffer = Buffer.from(left);
    const rightBuffer = Buffer.from(right);

    if (leftBuffer.length !== rightBuffer.length) {
        return false;
    }

    return timingSafeEqual(leftBuffer, rightBuffer);
};

/**
 * Crea un token CSRF firmado, opcionalmente atado al token de sesion BFF.
 */
export const createSignedCsrfToken = (secret: string, sessionToken?: string): string => {
    const nonce = randomBytes(CSRF_TOKEN_BYTES).toString("base64url");
    return `${nonce}${CSRF_TOKEN_SEPARATOR}${signCsrfNonce(nonce, secret, sessionToken)}`;
};

/**
 * Valida formato y firma del token CSRF esperado para una sesion concreta.
 */
export const isValidSignedCsrfToken = (token: string, secret: string, sessionToken?: string): boolean => {
    if (!isValidCsrfTokenFormat(token)) {
        return false;
    }

    const [nonce, signature] = token.split(CSRF_TOKEN_SEPARATOR);

    if (!nonce || !signature) {
        return false;
    }

    return signaturesMatch(signature, signCsrfNonce(nonce, secret, sessionToken));
};
