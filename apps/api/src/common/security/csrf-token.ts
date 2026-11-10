import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

import { CSRF_TOKEN_BYTES, CSRF_TOKEN_SEPARATOR, isValidCsrfTokenFormat } from "./http-security.constants.js";

/**
 * CSRF firmado del BFF.
 *
 * Repetir la cookie en el header no basta: quien pueda plantar una cookie
 * podria plantar el mismo valor en ambos lados. La firma HMAC exige el secreto
 * del servidor. El binding de sesion impide que un token emitido en anonimo
 * siga valiendo despues del login, cuando la cookie de sesion ya es otra.
 */

/** Binding de quien todavia no tiene sesion. No es un token de sesion vacio: vacio y ausente tienen que firmar igual. */
const ANONYMOUS_CSRF_BINDING = "anonymous";

/** Sesion presente o el binding anonimo. El nonce nunca se firma solo. */
const resolveCsrfBinding = (sessionToken?: string): string => sessionToken ?? ANONYMOUS_CSRF_BINDING;

/** HMAC del par binding:nonce. El secreto no viaja al cliente; solo viaja el resultado en base64url. */
const signCsrfNonce = (nonce: string, secret: string, sessionToken?: string): string =>
    createHmac("sha256", secret)
        .update(`${resolveCsrfBinding(sessionToken)}:${nonce}`)
        .digest("base64url");

/**
 * Comparacion de longitud fija. `timingSafeEqual` lanza si los buffers difieren
 * de tamano, y esa excepcion distinguiria un formato malo de una firma mala.
 * La longitud se rechaza antes, en tiempo constante respecto del secreto.
 */
const signaturesMatch = (left: string, right: string): boolean => {
    const leftBuffer = Buffer.from(left);
    const rightBuffer = Buffer.from(right);

    if (leftBuffer.length !== rightBuffer.length) {
        return false;
    }

    return timingSafeEqual(leftBuffer, rightBuffer);
};

/** Nonce aleatorio de 32 bytes mas su firma. El cliente no elige ninguna de las dos partes. */
export const createSignedCsrfToken = (secret: string, sessionToken?: string): string => {
    const nonce = randomBytes(CSRF_TOKEN_BYTES).toString("base64url");
    return `${nonce}${CSRF_TOKEN_SEPARATOR}${signCsrfNonce(nonce, secret, sessionToken)}`;
};

/**
 * Formato cerrado y luego firma. Un token que no tiene la longitud emitida por
 * el BFF no se divide ni se compara: no hay forma de colar una segunda firma
 * detras del separador.
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
