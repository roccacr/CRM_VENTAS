import { timingSafeEqual } from 'node:crypto';

/**
 * Comparaciones en tiempo constante para secretos/firmas.
 *
 * crypto.timingSafeEqual lanza si las longitudes difieren. Ese throw sería un
 * canal de timing (y un TypeError crudo). Por eso timingSafeEqualBuffers
 * corta en false ante lengths distintas ANTES de llamar a la primitiva.
 *
 * Usar siempre estas helpers en bordes de auth (tokens, HMAC), nunca ===.
 */

/**
 * Compara dos buffers en tiempo constante.
 * @returns false si las longitudes difieren o el contenido no coincide
 */
export function timingSafeEqualBuffers(a: Buffer, b: Buffer): boolean {
  if (a.length !== b.length) {
    return false;
  }

  return timingSafeEqual(a, b);
}

/**
 * Compara dos strings UTF-8 en tiempo constante.
 * Inversa conceptual de "serializar a Buffer y comparar"; no hay format
 * companion porque el dominio es comparación, no encode/decode.
 */
export function timingSafeEqualUtf8(received: string, expected: string): boolean {
  return timingSafeEqualBuffers(Buffer.from(received), Buffer.from(expected));
}
