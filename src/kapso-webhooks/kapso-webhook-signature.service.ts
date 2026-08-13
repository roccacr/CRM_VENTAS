import { Injectable } from '@nestjs/common';
import { createHmac } from 'node:crypto';

import { timingSafeEqualBuffers } from '../common/crypto/timing-safe-equal';

/**
 * Verifica la firma HMAC-SHA256 de webhooks Kapso
 * (header `X-Webhook-Signature`, con o sin prefijo `sha256=`).
 */
@Injectable()
export class KapsoWebhookSignatureService {
  /**
   * @returns true solo si firma y secreto existen y coinciden
   */
  verify(
    rawBody: string,
    signatureHeader: string | undefined,
    secret: string | undefined,
  ): boolean {
    if (!signatureHeader || !secret) {
      return false;
    }

    const receivedHex = signatureHeader.startsWith('sha256=')
      ? signatureHeader.slice('sha256='.length)
      : signatureHeader;

    const expectedHex = createHmac('sha256', secret).update(rawBody).digest('hex');

    return timingSafeEqualBuffers(Buffer.from(receivedHex, 'hex'), Buffer.from(expectedHex, 'hex'));
  }
}
