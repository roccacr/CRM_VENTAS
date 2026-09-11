/**
 * Prefijo RFC 6750 de `Authorization`. El espacio final es intencional:
 * `startsWith` + `slice(length)` deja el token limpio, sin un `split` que
 * romperia tokens con espacios (no deberian tenerlos, pero el trim posterior
 * ya cubre whitespace accidental).
 */
export const BEARER_PREFIX = "Bearer ";
