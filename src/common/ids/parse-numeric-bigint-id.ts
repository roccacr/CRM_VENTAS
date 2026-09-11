const NUMERIC_ID_PATTERN = /^\d+$/;

/**
 * Convierte ids de ruta a `bigint` solo cuando son estrictamente numericos.
 *
 * Devuelve `null` para que cada caso de uso decida si responde 404, 400 u
 * otro error: este helper no conoce HTTP. `Number` no sirve aca — ids de
 * MySQL BIGINT se salen de `Number.MAX_SAFE_INTEGER`.
 *
 * @param value - Segmento de ruta (`:id`) o query param
 * @returns El id como `bigint`, o `null` si hay letras, signos o queda vacio
 */
export function parseNumericBigintId(value: string): bigint | null {
    const trimmed = value.trim();

    if (!NUMERIC_ID_PATTERN.test(trimmed)) {
        return null;
    }

    return BigInt(trimmed);
}
