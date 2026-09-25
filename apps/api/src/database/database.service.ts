import { Inject, Injectable, type OnModuleDestroy } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Kysely, MysqlDialect } from "kysely";
import { createPool, type PoolOptions } from "mysql2";

import { APPROVED_DATABASE_NAME } from "../config/product.constants.js";
import type { CrmDatabase } from "./database.types.js";
import { buildMysqlPoolOptions } from "./mysql-pool-options.js";

// ============================================================================
// Servicio de acceso a datos: expone una unica instancia de Kysely tipada sobre
// un pool de mysql2 y gestiona su ciclo de vida junto con Nest.
//
// Regla SRP: esta clase no debe mezclar lectura de config, validacion de base,
// armado del pool e inicializacion de Kysely en un bloque anonimo. Cada concern
// queda nombrado en una funcion privada de modulo; el provider queda como wiring
// y ciclo de vida, que es exactamente lo que Nest espera aqui.
// ============================================================================

/** Limite de conexiones simultaneas del pool hacia MySQL. */
const MYSQL_CONNECTION_LIMIT = 10;

/**
 * Valida que el runtime apunte a la base CRM nueva.
 *
 * Se declara como assertion function para que TypeScript reduzca el tipo de
 * `database` a `string` despues de llamarla, sin casts manuales en el
 * constructor.
 */
function assertAllowedDatabase(database: string | undefined): asserts database is string {
    if (database !== APPROVED_DATABASE_NAME) {
        throw new Error(`El runtime de identidad solo puede conectarse a "${APPROVED_DATABASE_NAME}" (recibido: "${database ?? "undefined"}").`);
    }
}

/**
 * Traduce `ConfigService` al contrato de `mysql2.createPool`.
 *
 * Las variables pasan por `getOrThrow` porque Zod ya aplico defaults seguros y
 * la conexion no debe inventar fallback propio. `DB_PASSWORD` puede ser string
 * vacio si Zod lo definio asi, pero nunca se loguea ni se documenta su valor.
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
        ssl: config.getOrThrow<boolean>("DB_SSL"),
        ...(sslCaPath ? { sslCaPath } : {}),
    });
};

/**
 * Crea la instancia tipada de Kysely a partir del pool aprobado.
 *
 * Mantener esto como funcion separada hace explicito que Kysely no decide
 * configuracion ni seguridad; solo recibe un pool ya validado.
 */
const createKyselyDatabase = (poolOptions: PoolOptions): Kysely<CrmDatabase> =>
    new Kysely<CrmDatabase>({
        dialect: new MysqlDialect({ pool: createPool(poolOptions) }),
    });

/**
 * Provider global de acceso a datos para el runtime de identidad.
 *
 * Expone una unica instancia Kysely tipada contra `CrmDatabase`. No contiene
 * queries de negocio: esas viven en repositories por modulo.
 */
@Injectable()
export class DatabaseService implements OnModuleDestroy {
    /** Instancia unica de Kysely usada por repositories del API. */
    readonly db: Kysely<CrmDatabase>;

    /**
     * Inicializa Kysely despues de validar que el runtime apunta a CRM_THINK_V2.
     */
    constructor(@Inject(ConfigService) config: ConfigService) {
        const database = config.get<string>("DB_NAME");
        assertAllowedDatabase(database);
        this.db = createKyselyDatabase(buildPoolOptions(config, database));
    }

    /**
     * Cierra el pool cuando Nest destruye el modulo.
     *
     * Esto evita conexiones huerfanas que mantengan vivo el proceso o agoten
     * conexiones MySQL en reinicios sucesivos.
     */
    async onModuleDestroy(): Promise<void> {
        await this.db.destroy();
    }
}
