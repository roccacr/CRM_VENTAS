import { parseTcpPort } from "../common/net/is-valid-tcp-port";
import { MYSQL_ENV_KEYS, MYSQL_URL_PROTOCOL } from "./mysql-env.constants";

/**
 * Configuracion de conexion a MySQL.
 *
 * Se admiten dos estrategias:
 *   1. `DATABASE_URL` → formato `mysql://user:pass@host:port/db`
 *   2. Variables `MYSQL_*` → host, port, user, password, database
 *
 * La precedencia NO vive aca: `readMysqlCredentials` / `formatMysqlUrl` son
 * primitivas. Quien decide el orden es `database-url.ts` (scripts vs runtime).
 *
 * En entornos gestionados (RDS, Railway) suele inyectarse un unico
 * `DATABASE_URL`. En local/CI es mas practico declarar `MYSQL_*` sueltas.
 */

/** Variables de entorno aceptadas para conectar a MySQL. */
export type MysqlEnv = {
    readonly DATABASE_URL?: string;
    readonly MYSQL_HOST?: string;
    readonly MYSQL_PORT?: string;
    readonly MYSQL_USER?: string;
    readonly MYSQL_PASSWORD?: string;
    readonly MYSQL_DATABASE?: string;
};

/** Credenciales MySQL ya normalizadas (sin URL). */
export type MysqlCredentials = {
    readonly database: string;
    readonly host: string;
    readonly password: string;
    readonly port: number;
    readonly user: string;
};

type CompleteMysqlEnv = MysqlEnv & {
    readonly MYSQL_HOST: string;
    readonly MYSQL_PORT: string;
    readonly MYSQL_USER: string;
    readonly MYSQL_PASSWORD: string;
    readonly MYSQL_DATABASE: string;
};

/**
 * Lee `MYSQL_*` como credenciales tipadas.
 *
 * @param env - Recorte de `process.env` o stub de test
 * @returns `undefined` si falta un campo obligatorio o `MYSQL_PORT` no es un puerto valido
 */
export function readMysqlCredentials(env: MysqlEnv): MysqlCredentials | undefined {
    if (!hasRequiredMysqlFields(env)) {
        return undefined;
    }

    // Presencia ≠ validez: `MYSQL_PORT="abc"` es truthy y produciria NaN.
    const port = parseTcpPort(env.MYSQL_PORT);

    if (port === undefined) {
        return undefined;
    }

    return {
        database: env.MYSQL_DATABASE,
        host: env.MYSQL_HOST,
        password: env.MYSQL_PASSWORD,
        port,
        user: env.MYSQL_USER,
    };
}

/**
 * Arma `mysql://...` desde credenciales.
 *
 * `encodeURIComponent` en user/pass/db es obligatorio: un password con `@`,
 * espacio o `/` romperia el parser de Prisma si se interpola crudo.
 */
export function formatMysqlUrl(credentials: MysqlCredentials): string {
    const user = encodeURIComponent(credentials.user);
    const password = encodeURIComponent(credentials.password);
    const database = encodeURIComponent(credentials.database);

    return `${MYSQL_URL_PROTOCOL}://${user}:${password}@${credentials.host}:${credentials.port}/${database}`;
}

function hasRequiredMysqlFields(env: MysqlEnv): env is CompleteMysqlEnv {
    return Boolean(env[MYSQL_ENV_KEYS.HOST] && env[MYSQL_ENV_KEYS.PORT] && env[MYSQL_ENV_KEYS.USER] && env[MYSQL_ENV_KEYS.PASSWORD] && env[MYSQL_ENV_KEYS.DATABASE]);
}
