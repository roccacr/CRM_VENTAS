import { firstHeaderValue, toNonEmptyHeader } from "../http/headers";
import type { RequestWithHeaders } from "../http/headers";
import { BEARER_PREFIX } from "./internal-token.constants";

/**
 * Extrae el token servicio-a-servicio de los headers, en este orden:
 *   1. `Authorization: Bearer <token>`
 *   2. Header custom indicado por `fallbackHeaderName`
 *
 * No autentica: solo parsea. La comparacion timing-safe y los 401/503 viven
 * en `assertInternalToken`. Cualquier guard interno del proyecto debe llamar
 * esta funcion en vez de reimplementar el parsing.
 *
 * @param headers - Headers HTTP (Express o el shape minimo `RequestWithHeaders`)
 * @param fallbackHeaderName - Header custom si Bearer no viene o no es usable
 * @returns Token recortado, o `undefined` si ambos origenes estan vacios
 */
export function extractBearerOrHeaderToken(headers: RequestWithHeaders["headers"], fallbackHeaderName: string): string | undefined {
    const authorization = firstHeaderValue(headers.authorization);
    const bearerToken = readBearerToken(authorization);

    if (bearerToken) {
        return bearerToken;
    }

    return toNonEmptyHeader(firstHeaderValue(headers[fallbackHeaderName]));
}

/**
 * Devuelve el token de un `Authorization: Bearer ...` usable.
 * Otros esquemas (`Basic`, `Digest`) se ignoran a proposito: este borde
 * solo acepta Bearer o el header fallback, nunca un scheme inventado.
 */
function readBearerToken(authorization: string | undefined): string | undefined {
    if (!authorization?.startsWith(BEARER_PREFIX)) {
        return undefined;
    }

    return toNonEmptyHeader(authorization.slice(BEARER_PREFIX.length));
}
