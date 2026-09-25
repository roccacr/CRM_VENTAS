import { readFileSync } from "node:fs";

import type { PoolOptions } from "mysql2";

/** Puerto MySQL usado cuando `DB_PORT` no viene definido. */
export const DEFAULT_MYSQL_PORT = 3306;

export interface MysqlPoolOptionsInput {
    database: string;
    host: string;
    password: string;
    port: number;
    user: string;
    connectionLimit: number;
    ssl: boolean;
    sslCaPath?: string;
}

/**
 * Construye la configuracion TLS para MySQL.
 *
 * Para RDS se debe usar el bundle CA oficial y mantener
 * `rejectUnauthorized: true`. Bajar la verificacion a `false` queda prohibido:
 * resolveria el handshake ocultando MITM o certificados incorrectos.
 */
const buildSslOptions = (input: MysqlPoolOptionsInput): PoolOptions["ssl"] => {
    if (!input.ssl) {
        return undefined;
    }

    if (!input.sslCaPath) {
        return { rejectUnauthorized: true };
    }

    return {
        ca: readFileSync(input.sslCaPath, "utf8"),
        rejectUnauthorized: true,
    };
};

/**
 * Construye opciones mysql2 comunes para runtime y runner schema-only.
 *
 * Mantener `multipleStatements: false` aqui evita que cada consumidor tenga
 * que recordar el guardrail contra statement-stacking.
 */
export const buildMysqlPoolOptions = (input: MysqlPoolOptionsInput): PoolOptions => {
    const poolOptions: PoolOptions = {
        host: input.host,
        port: input.port,
        user: input.user,
        password: input.password,
        database: input.database,
        waitForConnections: true,
        connectionLimit: input.connectionLimit,
        multipleStatements: false,
    };

    const sslOptions = buildSslOptions(input);

    if (sslOptions) {
        poolOptions.ssl = sslOptions;
    }

    return poolOptions;
};
