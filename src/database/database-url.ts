import { MYSQL_ENV_KEYS } from "./mysql-env.constants";
import { formatMysqlUrl, MysqlEnv, readMysqlCredentials } from "./mysql-env";

/**
 * Construye (o reutiliza) una `DATABASE_URL` a partir del entorno.
 *
 * Dos funciones, dos precedencias. No son intercambiables:
 *
 *   - `buildDatabaseUrlFromMysqlEnv` — scripts / orquestador.
 *     Si ya hay `DATABASE_URL`, se respeta. No reescribe una URL inyectada.
 *
 *   - `buildRuntimeDatabaseUrl` — Nest / Prisma en este proyecto.
 *     `MYSQL_*` gana porque `DATABASE_URL` a veces llega mal encodeada,
 *     mientras que `MYSQL_PASSWORD` conserva el valor crudo.
 *
 * Ninguna lanza: `undefined` significa "Prisma usara el env de schema.prisma".
 */

/**
 * Scripts y `db:check`: `DATABASE_URL` tiene prioridad.
 *
 * @returns URL lista para Prisma, o `undefined` si no hay ninguna fuente usable
 */
export function buildDatabaseUrlFromMysqlEnv(env: MysqlEnv): string | undefined {
    return readExistingDatabaseUrl(env) ?? formatUrlFromMysqlEnv(env);
}

/**
 * Runtime Nest/Prisma: `MYSQL_*` tiene prioridad sobre `DATABASE_URL`.
 *
 * @returns URL lista para el factory, o `undefined` si no hay fuente usable
 */
export function buildRuntimeDatabaseUrl(env: MysqlEnv): string | undefined {
    return formatUrlFromMysqlEnv(env) ?? readExistingDatabaseUrl(env);
}

function readExistingDatabaseUrl(env: MysqlEnv): string | undefined {
    return env[MYSQL_ENV_KEYS.DATABASE_URL] || undefined;
}

function formatUrlFromMysqlEnv(env: MysqlEnv): string | undefined {
    const credentials = readMysqlCredentials(env);
    return credentials ? formatMysqlUrl(credentials) : undefined;
}
