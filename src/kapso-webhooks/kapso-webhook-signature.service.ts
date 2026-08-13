import { Injectable } from '@nestjs/common';
import { createHmac } from 'node:crypto';

import { timingSafeEqualBuffers } from '../common/crypto/timing-safe-equal';

const HMAC_ALGORITHM = 'sha256';
const SIGNATURE_PREFIX = 'sha256=';
/** Largo fijo del digest hex de SHA-256 (32 bytes → 64 chars hex). */
const SHA256_HEX_LENGTH = 64;
const SHA256_HEX_PATTERN = /^[0-9a-fA-F]+$/;

/**
 * Verificación de firma HMAC-SHA256 de webhooks Kapso.
 *
 * Header esperado: X-Webhook-Signature, con o sin prefijo "sha256=".
 * Devuelve false (nunca lanza) ante inputs ausentes o mal formados: el
 * controller traduce false → 401. Así el borde HTTP queda en un solo sitio.
 */
@Injectable()
export class KapsoWebhookSignatureService {
  /**
   * Compara HMAC(secret, rawBody) con la firma recibida en tiempo constante.
   *
   * @returns true solo si secreto, firma y hex son válidos y coinciden
   */
  verify(
    rawBody: string,
    signatureHeader: string | undefined,
    secret: string | undefined,
  ): boolean {
    // Presencia ≠ validez: también rechazamos strings vacíos
    if (!signatureHeader || !secret) {
      return false;
    }

    const receivedHex = signatureHeader.startsWith(SIGNATURE_PREFIX)
      ? signatureHeader.slice(SIGNATURE_PREFIX.length)
      : signatureHeader;

    // Buffer.from(hex inválido) en Node "traga" chars raros y acorta el buffer;
    // eso podría comparar basura. Exigimos hex completo de SHA-256.
    if (!isSha256Hex(receivedHex)) {
      return false;
    }

    const expectedHex = createHmac(HMAC_ALGORITHM, secret).update(rawBody).digest('hex');

    return timingSafeEqualBuffers(
      Buffer.from(receivedHex, 'hex'),
      Buffer.from(expectedHex, 'hex'),
    );
  }
}

/** True si el string es exactamente un digest SHA-256 en hex. */
function isSha256Hex(value: string): boolean {
  return value.length === SHA256_HEX_LENGTH && SHA256_HEX_PATTERN.test(value);
}
