// ============================================================================
// IMPORTS
// ============================================================================

// Carga variables de entorno antes de resolver credenciales de MySQL.
import { config as loadDotenv } from "dotenv";

// Habilita decoradores TypeORM en tiempo de ejecucion para el CLI.
import "reflect-metadata";

import { DataSource } from "typeorm";

import { buildTypeOrmOptions } from "./typeorm.options";

// ============================================================================
// INICIALIZACION DEL CLI DE TYPEORM
// ============================================================================

// El .env local debe prevalecer sobre variables heredadas del sistema.
loadDotenv({ override: true });

/** DataSource usado por scripts de migracion y utilidades del CLI de TypeORM. */
const dataSource = new DataSource(buildTypeOrmOptions());

export default dataSource;
