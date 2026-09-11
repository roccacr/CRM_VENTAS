import { Injectable } from "@nestjs/common";

import { verifyHmacSha256Signature } from "../common/crypto/hmac-sha256-signature";

/**
 * Thin wrapper Kapso sobre la primitiva HMAC compartida.
 * Preferir `KapsoWebhookSignatureGuard` en HTTP; este service queda para
 * callers que solo necesitan un boolean (tests unitarios, scripts).
 */
@Injectable()
export class KapsoWebhookSignatureService {
    verify(rawBody: string, signatureHeader: string | undefined, secret: string | undefined): boolean {
        return verifyHmacSha256Signature(rawBody, signatureHeader, secret);
    }
}
