import { createHmac } from "node:crypto";

import { normalizeCaseInsensitiveIdentifier } from "../../../common/security/identifier-normalization.js";

/**
 * HMAC de identificadores para correlacionar sin guardar el dato en claro.
 * No es hash de clave ni sustituye la retencion. La version permite rotar el
 * secreto y saber cual produjo cada valor.
 */
export const AUDIT_HASH_KEY_VERSION = 1;

/** El mismo normalizador de identificadores: el HMAC no cambia si solo cambia el caso. */
export const normalizeAuditIdentifier = normalizeCaseInsensitiveIdentifier;

/**
 * HMAC-SHA256 con el secreto de auditoria. Un SHA-256 sin clave no sirve para
 * un correo corporativo: se puede adivinar con un diccionario.
 */
export const createAuditIdentifierHmac = (value: string, secret: string): string => createHmac("sha256", secret).update(normalizeAuditIdentifier(value)).digest("hex");
