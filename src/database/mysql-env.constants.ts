/**
 * Nombres de env vars de MySQL, centralizados para no repetir literales.
 *
 * Dos estrategias de conexion, evaluadas segun la funcion:
 *   - `buildDatabaseUrlFromMysqlEnv`: `DATABASE_URL` gana (scripts / orquestador).
 *   - `buildRuntimeDatabaseUrl`: `MYSQL_*` gana (Nest/Prisma, password crudo).
 */
export const MYSQL_ENV_KEYS = {
    DATABASE_URL: "DATABASE_URL",
    HOST: "MYSQL_HOST",
    PORT: "MYSQL_PORT",
    USER: "MYSQL_USER",
    PASSWORD: "MYSQL_PASSWORD",
    DATABASE: "MYSQL_DATABASE",
} as const;

/** Protocolo que Prisma espera en `datasources.db.url`. */
export const MYSQL_URL_PROTOCOL = "mysql";
