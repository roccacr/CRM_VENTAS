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
