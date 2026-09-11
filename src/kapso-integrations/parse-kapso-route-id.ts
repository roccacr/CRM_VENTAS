import { NotFoundException } from "@nestjs/common";

import { parseNumericBigintId } from "../common/ids/parse-numeric-bigint-id";

/**
 * Path param → bigint.
 *
 * Ids invalidos (`abc`, vacio) responden 404 con el mismo mensaje que "no
 * existe": no filtramos el formato del id hacia el cliente. `0` es un id
 * numerico valido: comparar contra `null`, nunca `!parsedId` (`0n` es falsy).
 */
export function parseKapsoRouteId(id: string, notFoundMessage: string): bigint {
    const parsedId = parseNumericBigintId(id);

    // `0n` es falsy en JS: hay que comparar contra `null`, no usar `!parsedId`.
    if (parsedId === null) {
        throw new NotFoundException(notFoundMessage);
    }

    return parsedId;
}
