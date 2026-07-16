// ============================================================================
// IMPORTS
// ============================================================================

import { registerAs } from "@nestjs/config";

// ============================================================================
// CONFIGURACION MYSQL
// ============================================================================

/**
 * Namespace `mysql`.
 *
 * Expone una vista tipada de las variables necesarias para TypeORM y scripts
 * de base de datos. La validacion fuerte vive en `validate-env.ts`.
 */
export default registerAs("mysql", () => ({
  // Host del servidor MySQL.
  host: process.env.MYSQL_HOST ?? "localhost",

  // Puerto TCP de la conexion.
  port: Number(process.env.MYSQL_PORT ?? 3306),

  // Usuario usado por Nest y por el CLI de migraciones.
  username: process.env.MYSQL_USER ?? "root",

  // Contrasena del usuario; puede venir vacia en entornos locales.
  password: process.env.MYSQL_PASSWORD ?? "",

  // Schema/base de datos objetivo.
  database: process.env.MYSQL_DATABASE ?? "",
}));
