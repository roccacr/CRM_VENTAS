// ============================================================================
// IMPORTS
// ============================================================================

// Bloques base de Nest para configurar la app, la base de datos y el dominio.
import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { TypeOrmModule } from "@nestjs/typeorm";
import { config as loadDotenv } from "dotenv";

// Namespaces de configuracion propios del proyecto.
import appConfig from "./config/app.config";
import kapsoConfig from "./config/kapso.config";
import mysqlConfig from "./config/mysql.config";
import { validateEnv } from "./config/validate-env";

// Superficie HTTP raiz y wiring del dominio Kapso.
import { AppController } from "./app.controller";
import { buildTypeOrmOptions } from "./database/typeorm.options";
import { KapsoModule } from "./modules/kapso/kapso.module";

// ============================================================================
// CONFIGURACION GLOBAL
// ============================================================================

/** Loaders registrados en `ConfigModule` para exponer namespaces tipados. */
const CONFIG_LOADERS = [appConfig, kapsoConfig, mysqlConfig];

// El .env del proyecto debe prevalecer sobre variables heredadas del sistema.
loadDotenv({ override: true });

// ============================================================================
// MODULO RAIZ
// ============================================================================

/**
 * Modulo raiz de la aplicacion NestJS.
 *
 * Centraliza:
 * - carga y validacion de variables de entorno;
 * - conexion TypeORM compartida con migraciones;
 * - registro del modulo funcional Kapso.
 */
@Module({
  imports: [
    ConfigModule.forRoot({
      // Disponible en toda la app sin reimportar ConfigModule.
      isGlobal: true,
      // Reutiliza valores resueltos para evitar releer process.env en cada acceso.
      cache: true,
      load: CONFIG_LOADERS,
      // Corta el arranque si falta una variable critica o su formato es invalido.
      validate: validateEnv,
    }),

    TypeOrmModule.forRootAsync({
      // Mantiene una sola fuente de verdad para las opciones de TypeORM.
      useFactory: () => buildTypeOrmOptions(),
    }),

    // Modulo principal de integracion Kapso / WhatsApp / CRM.
    KapsoModule,
  ],
  controllers: [AppController],
})
export class AppModule {}
