import type { ConfigService } from "@nestjs/config";

/**
 * Compuerta de lectura del CRM viejo. Solo el booleano `true` enciende.
 * Un texto no cuenta. Leer no autoriza a escribir.
 */
export function isLegacyCrmEnabled(config: ConfigService): boolean {
    return config.get<unknown>("ENABLE_LEGACY_FALLBACK") === true;
}

/**
 * Escritura legado. Exige la lectura, `NODE_ENV=production`, el nombre exacto
 * `crmdatabase-api` y `ENABLE_LEGACY_WRITES`. En desarrollo esta compuerta
 * queda cerrada. Los escritores de contrato y de bancos no la usan: tienen
 * la suya y no heredan este cierre por entorno.
 */
export function isLegacyCrmWriteEnabled(config: ConfigService): boolean {
    return isLegacyCrmEnabled(config) && config.get<unknown>("NODE_ENV") === "production" && config.get<unknown>("LEGACY_CRM_DB_NAME") === "crmdatabase-api" && config.get<unknown>("ENABLE_LEGACY_WRITES") === true;
}
