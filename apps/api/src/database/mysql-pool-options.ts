import { readFileSync } from "node:fs";

import type { PoolOptions } from "mysql2";

/**
 * Mismas opciones de mysql2 para el runtime, el migrador y los scripts.
 *
 * Este archivo no elige la base. El servicio de la API solo acepta
 * `CRM_THINK_V2`; un script puede pasar otro nombre y aun asi hereda TLS
 * verificado y `multipleStatements: false`.
 */

/** Mismo puerto que el default de `DB_PORT`. Quien arma un pool fuera de Zod no inventa otro. */
export const DEFAULT_MYSQL_PORT = 3306;

export interface MysqlPoolOptionsInput {
    database: string;
    host: string;
    password: string;
    port: number;
    user: string;
    connectionLimit: number;
    /** Tope de la cola. Si no se envia, no se escribe la opcion y mysql2 deja su default, que es cola sin limite. */
    queueLimit?: number;
    ssl: boolean;
    sslCaPath?: string;
}

/**
 * TLS solo cuando el llamador lo pidio. Sin TLS la opcion no se escribe: el
 * driver abre en claro y no recibe un objeto SSL vacio.
 *
 * Con TLS, `rejectUnauthorized` queda en true con o sin CA. Sin archivo se usan
 * las CA del proceso; con archivo, el PEM se lee una vez al armar el pool. Un
 * path inexistente falla aqui, antes de abrir conexiones. Bajar la verificacion
 * ocultaria un certificado distinto o un intermediario.
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
 * Pool comun. `multipleStatements: false` rechaza varias sentencias en un solo
 * string, tambien en los scripts que reutilizan esta funcion.
 *
 * `queueLimit` solo se copia si el llamador lo trajo. El API manda el suyo; un
 * script de una conexion no hereda el cupo del proceso HTTP.
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

    if (input.queueLimit !== undefined) {
        poolOptions.queueLimit = input.queueLimit;
    }

    const sslOptions = buildSslOptions(input);

    if (sslOptions) {
        poolOptions.ssl = sslOptions;
    }

    return poolOptions;
};
