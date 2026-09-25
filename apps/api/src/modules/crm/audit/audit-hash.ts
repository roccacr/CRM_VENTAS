import { createHmac } from "node:crypto";

import { normalizeCaseInsensitiveIdentifier } from "../../../common/security/identifier-normalization.js";

// ============================================================================
// Hashes de auditoria para identificadores sensibles.
//
// Estos helpers permiten correlacionar eventos sin guardar PII cruda en
// metadata. No son hashes de password ni reemplazan controles de retencion.
// ============================================================================

/** Version del secreto usado para poder rotarlo sin perder trazabilidad. */
export const AUDIT_HASH_KEY_VERSION = 1;

/**
 * Normaliza identificadores antes de aplicar HMAC.
 */
export const normalizeAuditIdentifier = normalizeCaseInsensitiveIdentifier;

/**
 * Calcula HMAC-SHA256 para valores sensibles de auditoria.
 *
 * HMAC requiere un secreto de servidor dedicado. SHA-256 plano no basta para
 * correos corporativos porque son faciles de adivinar con diccionarios.
 */
export const createAuditIdentifierHmac = (value: string, secret: string): string => createHmac("sha256", secret).update(normalizeAuditIdentifier(value)).digest("hex");
