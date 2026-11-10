import { Inject, Injectable, type OnModuleDestroy } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Kysely, MysqlDialect } from "kysely";
import { createPool, type PoolOptions } from "mysql2";

import { APPROVED_DATABASE_NAME } from "../config/product.constants.js";
import type { CrmDatabase } from "./database.types.js";
import { buildMysqlPoolOptions } from "./mysql-pool-options.js";

/**
 * Unico cliente Kysely del proceso HTTP y el ciclo de vida de su pool.
 *
 * No lee negocio y no elige otra base. La configuracion ya paso por Zod; esta
 * clase vuelve a exigir el nombre aprobado porque un `ConfigService` de prueba
 * puede existir sin esa validacion. El pool no se abre si el nombre no coincide.
 */

/** Conexiones simultaneas de este proceso. No sale de una variable: subirlo es un cambio de codigo. */
const MYSQL_CONNECTION_LIMIT = 10;

/**
 * Peticiones que pueden esperar una conexion. Al llegar a 200, mysql2 falla la
 * nueva en lugar de crecer sin tope. El default de la libreria, si no se envia,
 * es cola ilimitada.
 */
const MYSQL_QUEUE_LIMIT = 200;

/**
 * Segunda compuerta despues de Zod. El tipo queda reducido a `string` para no
 * castear el nombre en el constructor. El error nombra la base recibida; no
 * incluye usuario ni clave.
 */
function assertAllowedDatabase(database: string | undefined): asserts database is string {
    if (database !== APPROVED_DATABASE_NAME) {
        throw new Error(`El runtime de identidad solo puede conectarse a "${APPROVED_DATABASE_NAME}" (recibido: "${database ?? "undefined"}").`);
    }
}

/**
 * Pasa la configuracion ya validada al pool comun. `getOrThrow` no inventa host,
 * puerto ni clave. La CA solo viaja si existe: sin ella, TLS sigue verificando
 * contra las CA del proceso.
 */
const buildPoolOptions = (config: ConfigService, database: string): PoolOptions => {
    const sslCaPath = config.get<string>("DB_SSL_CA");

    return buildMysqlPoolOptions({
        host: config.getOrThrow<string>("DB_HOST"),
        port: config.getOrThrow<number>("DB_PORT"),
        user: config.getOrThrow<string>("DB_USER"),
        password: config.getOrThrow<string>("DB_PASSWORD"),
        database,
        connectionLimit: MYSQL_CONNECTION_LIMIT,
        queueLimit: MYSQL_QUEUE_LIMIT,
        ssl: config.getOrThrow<boolean>("DB_SSL"),
        ...(sslCaPath ? { sslCaPath } : {}),
    });
};

/**
 * Kysely recibe un pool ya cerrado. No interpreta variables de entorno ni
 * decide TLS.
 */
const createKyselyDatabase = (poolOptions: PoolOptions): Kysely<CrmDatabase> =>
    new Kysely<CrmDatabase>({
        dialect: new MysqlDialect({ pool: createPool(poolOptions) }),
    });

/** Cliente de `CRM_THINK_V2` para los repositorios. Una instancia por proceso. */
@Injectable()
export class DatabaseService implements OnModuleDestroy {
    /** Unico Kysely. Los repositorios lo usan; no crean otro pool. */
    readonly db: Kysely<CrmDatabase>;

    /** No asigna `db` si el nombre de la base no es el aprobado. */
    constructor(@Inject(ConfigService) config: ConfigService) {
        const database = config.get<string>("DB_NAME");
        assertAllowedDatabase(database);
        this.db = createKyselyDatabase(buildPoolOptions(config, database));
    }

    /**
     * Cierra el pool al destruir el modulo. Sin esto, un reinicio deja
     * conexiones abiertas y el proceso puede no terminar.
     */
    async onModuleDestroy(): Promise<void> {
        await this.db.destroy();
    }
}
