// ============================================================================
// IMPORTS
// ============================================================================

// Primitivas base de Nest para arranque, validacion y lectura de configuracion.
import { Logger, ValidationPipe } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { NestFactory } from "@nestjs/core";
import { NestExpressApplication } from "@nestjs/platform-express";
import helmet from "helmet";

import { AppModule } from "./app.module";

// ============================================================================
// OPCIONES GLOBALES DE ARRANQUE
// ============================================================================

/**
 * `rawBody: true` conserva el cuerpo original del request para validar firmas
 * HMAC de Kapso y Meta sin depender de serializaciones posteriores.
 */
const NEST_FACTORY_OPTIONS = { rawBody: true };

/** Politica global de validacion aplicada a todos los DTOs de entrada. */
const VALIDATION_PIPE_OPTIONS = {
  // Elimina propiedades no declaradas en el DTO.
  whitelist: true,
  // Convierte tipos primitivos cuando el DTO lo permite.
  transform: true,
  // Mantiene compatibilidad con payloads JSON que incluyan estructuras amplias.
  forbidUnknownValues: false,
};

// ============================================================================
// BOOTSTRAP
// ============================================================================

/**
 * Inicializa la aplicacion Nest, aplica middleware de seguridad y levanta HTTP.
 */
async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, NEST_FACTORY_OPTIONS);
  const logger = new Logger("Bootstrap");
  const configService = app.get(ConfigService);

  const apiPrefix = configService.getOrThrow<string>("app.apiPrefix");
  const corsOrigins = configService.get<string[]>("app.corsOrigins", []);
  const port = configService.getOrThrow<number>("app.port");

  // Todas las rutas de la API viven bajo el prefijo configurado.
  app.setGlobalPrefix(apiPrefix);

  // Helmet endurece headers HTTP comunes sin afectar la logica del dominio.
  app.use(helmet());

  // CORS queda gobernado solo por la configuracion cargada desde env.
  app.enableCors({
    origin: corsOrigins,
    credentials: true,
  });

  // La validacion global asegura entradas consistentes en DTOs y query params.
  app.useGlobalPipes(new ValidationPipe(VALIDATION_PIPE_OPTIONS));

  await app.listen(port);
  logger.log(`API escuchando en http://localhost:${port}/${apiPrefix}`);
}

void bootstrap();
