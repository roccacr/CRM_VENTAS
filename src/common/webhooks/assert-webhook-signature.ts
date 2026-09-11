import { UnauthorizedException } from "@nestjs/common";

import { verifyHmacSha256Signature } from "../crypto/hmac-sha256-signature";
import { requireConfiguredSecret } from "../security/require-configured-secret";

/**
 * Entrada de la politica HMAC, ya desacoplada de Nest HTTP.
 * El guard solo traduce `ConfigService` + headers + rawBody a estos campos.
 */
export type AssertWebhookSignatureInput = {
    /** Bytes del wire (o JSON de fallback en tests). */
    readonly rawBody: string;
    /** Valor crudo de la env var; `requireConfiguredSecret` decide si es 503. */
    readonly secret: string | undefined;
    /** Label para el mensaje (ej. `Kapso`). */
    readonly serviceLabel: string;
    /** Header de firma (`sha256=<hex>` o hex crudo). */
    readonly signatureHeader: string | undefined;
};

/**
 * Politica unica de firma HMAC de webhooks.
 *
 * Fail-closed, en este orden:
 *   1. Secreto ausente o `""` en el server → 503 (misconfig de ops).
 *   2. Firma ausente, mal formada o distinta → 401.
 *
 * `verifyHmacSha256Signature` nunca lanza: traduce inputs invalidos a `false`.
 * Este assert es quien mapea `false` → 401.
 *
 * @throws {ServiceUnavailableException} Si el server no tiene el secreto
 * @throws {UnauthorizedException} Si la firma no verifica
 */
export function assertWebhookSignature(input: AssertWebhookSignatureInput): void {
    const secret = requireConfiguredSecret(input.secret, `${input.serviceLabel} webhook secret`);

    if (!verifyHmacSha256Signature(input.rawBody, input.signatureHeader, secret)) {
        throw new UnauthorizedException(`Invalid ${input.serviceLabel} webhook signature`);
    }
}
