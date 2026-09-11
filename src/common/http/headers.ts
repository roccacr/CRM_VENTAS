/**
 * Helpers HTTP compartidos (headers).
 *
 * Regla del proyecto: whitespace-only = ausente. Cualquier guard/controller
 * que lea headers de auth, eventos webhook o idempotency keys debe usar estas
 * funciones, no reinventar `trim` + truthy-check.
 */

/** Request HTTP minimo (solo headers) para no acoplar a Express. */
export type RequestWithHeaders = {
    readonly headers: Record<string, string | string[] | undefined>;
};

/**
 * Primer valor usable de un header HTTP.
 *
 * Express puede entregar `string | string[]`; un truthy-check sobre el array
 * no garantiza contenido — hay que tomar el primer elemento. Un array vacio
 * produce `undefined`, igual que un header ausente.
 *
 * @param value - Valor crudo de `request.headers[name]`
 */
export function firstHeaderValue(value: string | string[] | undefined): string | undefined {
    return Array.isArray(value) ? value[0] : value;
}

/**
 * Recorta espacios y trata `""` como ausente.
 *
 * Misma regla para tokens, eventos webhook, idempotency keys, etc.
 * No hace lowercase: los tokens son case-sensitive.
 *
 * @param value - Header ya reducido a un solo string (usar `firstHeaderValue` antes)
 */
export function toNonEmptyHeader(value: string | undefined): string | undefined {
    const trimmed = value?.trim();
    return trimmed ? trimmed : undefined;
}
