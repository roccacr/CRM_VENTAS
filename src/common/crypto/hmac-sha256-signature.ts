import { createHmac } from "node:crypto";

import { timingSafeEqualBuffers } from "./timing-safe-equal";

const HMAC_ALGORITHM = "sha256";
const SIGNATURE_PREFIX = "sha256=";

/** Largo fijo del digest hex de SHA-256 (32 bytes → 64 chars hex). */
const SHA256_HEX_LENGTH = 64;
const SHA256_HEX_PATTERN = /^[0-9a-fA-F]+$/;

/**
 * Verificacion HMAC-SHA256 de firmas de webhook (primitiva compartida).
 *
 * No es especifica de Kapso: cualquier proveedor con header tipo
 * `sha256=<hex>` o hex crudo puede reutilizarla. El feature solo aporta
 * envKey / headerName / serviceLabel via `WebhookSignatureGuard`.
 *
 * Devuelve `false` (nunca lanza) ante inputs ausentes o mal formados;
 * el guard traduce `false` → 401 y secreto ausente → 503.
 *
 * @param rawBody - Payload UTF-8 tal como llego en el wire
 * @param signatureHeader - Header de firma, con o sin prefijo `sha256=`
 * @param secret - Secreto HMAC; `undefined` o `""` → `false`
 * @returns `true` solo si el digest coincide en tiempo constante
 */
export function verifyHmacSha256Signature(rawBody: string, signatureHeader: string | undefined, secret: string | undefined): boolean {
    if (!signatureHeader || !secret) {
        return false;
    }

    const receivedHex = parseSha256Hex(signatureHeader);

    if (!receivedHex) {
        return false;
    }

    return timingSafeEqualBuffers(Buffer.from(receivedHex, "hex"), Buffer.from(computeSha256Hex(rawBody, secret), "hex"));
}

/**
 * Acepta `sha256=<hex>` (formato GitHub/Stripe/Kapso) o hex crudo.
 * `Buffer.from(hex invalido)` en Node "traga" chars raros y acorta el buffer:
 * por eso se valida largo + charset ANTES de construir el Buffer.
 */
function parseSha256Hex(signatureHeader: string): string | null {
    const receivedHex = signatureHeader.startsWith(SIGNATURE_PREFIX) ? signatureHeader.slice(SIGNATURE_PREFIX.length) : signatureHeader;

    return isSha256Hex(receivedHex) ? receivedHex : null;
}

function computeSha256Hex(rawBody: string, secret: string): string {
    return createHmac(HMAC_ALGORITHM, secret).update(rawBody).digest("hex");
}

function isSha256Hex(value: string): boolean {
    return value.length === SHA256_HEX_LENGTH && SHA256_HEX_PATTERN.test(value);
}
