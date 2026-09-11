import { timingSafeEqual } from "node:crypto";

/**
 * Comparaciones en tiempo constante para secretos y firmas.
 *
 * `crypto.timingSafeEqual` lanza si las longitudes difieren. Ese throw seria
 * un canal de timing (y un `TypeError` crudo hacia el cliente). Por eso
 * `timingSafeEqualBuffers` corta en `false` ante lengths distintas ANTES de
 * llamar a la primitiva.
 *
 * Usar siempre estas helpers en bordes de auth (tokens, HMAC), nunca `===`.
 */

/**
 * Compara dos buffers en tiempo constante.
 *
 * @param a - Buffer recibido (firma, token serializado)
 * @param b - Buffer esperado (digest o secreto)
 * @returns `false` si las longitudes difieren o el contenido no coincide
 */
export function timingSafeEqualBuffers(a: Buffer, b: Buffer): boolean {
    if (a.length !== b.length) {
        return false;
    }

    return timingSafeEqual(a, b);
}

/**
 * Compara dos strings UTF-8 en tiempo constante.
 *
 * No hay "format companion" porque el dominio es comparacion, no encode/decode:
 * serializa a Buffer y delega en `timingSafeEqualBuffers`.
 *
 * @param received - Valor presentado por el cliente
 * @param expected - Secreto o token configurado en el server
 */
export function timingSafeEqualUtf8(received: string, expected: string): boolean {
    return timingSafeEqualBuffers(Buffer.from(received), Buffer.from(expected));
}
