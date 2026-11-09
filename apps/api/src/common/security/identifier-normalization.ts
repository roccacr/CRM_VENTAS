// ============================================================================
// Normalizacion de identificadores sensibles.
//
// Correos y otros identificadores case-insensitive deben normalizarse igual en
// validacion, auditoria y rate limit. Centralizar esta regla evita drift entre
// capas cuando se cambie el criterio canonico del CRM.
// ============================================================================

/**
 * Normaliza identificadores donde mayusculas/minusculas y espacios externos no
 * deben crear identidades distintas.
 */
export const normalizeCaseInsensitiveIdentifier = (value: string): string => value.trim().toLowerCase();

/**
 * Adaptador para `class-transformer`.
 */
export const transformCaseInsensitiveIdentifier = ({ value }: { value: unknown }): unknown => (typeof value === "string" ? normalizeCaseInsensitiveIdentifier(value) : value);

/**
 * Rechaza caracteres de control y de formato Unicode (zero-width, marcas bidi, BOM) dentro de un identificador.
 * `trim()` no los elimina y `@IsEmail()` los acepta: sin este filtro un correo con un zero-width space (U+200B) al final
 * seria una identidad distinta (otra llave de rate limit, otro HMAC de auditoria) que parece identica al ojo.
 */
export const NO_INVISIBLE_CHARACTERS = /^[^\p{Cc}\p{Cf}]*$/u;
