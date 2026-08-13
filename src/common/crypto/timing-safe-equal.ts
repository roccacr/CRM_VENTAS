import { timingSafeEqual } from 'node:crypto';

/**
 * Compara dos buffers en tiempo constante.
 * Si las longitudes difieren, retorna false sin llamar a timingSafeEqual.
 */
export function timingSafeEqualBuffers(a: Buffer, b: Buffer): boolean {
  if (a.length !== b.length) {
    return false;
  }

  return timingSafeEqual(a, b);
}

/** Compara dos strings UTF-8 en tiempo constante. */
export function timingSafeEqualUtf8(received: string, expected: string): boolean {
  return timingSafeEqualBuffers(Buffer.from(received), Buffer.from(expected));
}
