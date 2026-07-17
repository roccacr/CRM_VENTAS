// ============================================================================
// IMPORTS
// ============================================================================

import { TypeOrmModuleOptions } from "@nestjs/typeorm";
import { DataSourceOptions } from "typeorm";

import { AdminKapsoIntegrationEntity } from "../modules/kapso/entities/admin-kapso-integration.entity";
import { KapsoPhoneNumberEntity } from "../modules/kapso/entities/kapso-phone-number.entity";

// ============================================================================
// CONSTANTES
// ============================================================================

/** Patron de migraciones compatible con desarrollo TS y build JS. */
const MIGRATIONS_GLOB = `${__dirname}/migrations/*{.ts,.js}`;

// ============================================================================
// HELPERS DE CONEXION
// ============================================================================

/**
 * Lee credenciales MySQL desde variables de entorno.
 * Mantiene la misma semantica usada en `mysql.config.ts`.
 */
function readMysqlConnectionFromEnv() {
  return {
    host: process.env.MYSQL_HOST ?? "localhost",
    port: Number(process.env.MYSQL_PORT ?? 3306),
    username: process.env.MYSQL_USER ?? "root",
    password: process.env.MYSQL_PASSWORD ?? "",
    database: process.env.MYSQL_DATABASE ?? "",
  };
}

// ============================================================================
// FACTORY DE OPCIONES TYPEORM
// ============================================================================

/**
 * Construye las opciones TypeORM compartidas por Nest y por el CLI.
 * Asi evitamos divergencias entre la app en runtime y las migraciones.
 */
export function buildTypeOrmOptions(): DataSourceOptions & Pick<TypeOrmModuleOptions, "retryAttempts" | "retryDelay" | "verboseRetryLog"> {
  const connection = readMysqlConnectionFromEnv();

  return {
    type: "mysql",
    ...connection,

    // Evita que una falla temporal de DNS o red derribe el proceso durante el arranque.
    retryAttempts: Number(process.env.MYSQL_RETRY_ATTEMPTS ?? 20),
    retryDelay: Number(process.env.MYSQL_RETRY_DELAY_MS ?? 5000),
    verboseRetryLog: true,

    // Entidades registradas en el contexto de persistencia.
    entities: [AdminKapsoIntegrationEntity, KapsoPhoneNumberEntity],

    // Migraciones versionadas del proyecto.
    migrations: [MIGRATIONS_GLOB],

    // El schema se modifica solo por migraciones, nunca por synchronize.
    synchronize: false,

    // Aplica migraciones pendientes al iniciar la app.
    migrationsRun: true,

    // Tabla interna donde TypeORM registra migraciones aplicadas.
    migrationsTableName: "typeorm_migrations",

    // Guarda y compara fechas en UTC.
    timezone: "Z",
  };
}
