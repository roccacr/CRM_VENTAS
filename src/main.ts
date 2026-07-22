/**
 * Punto de entrada HTTP de la API Kapso CRM.
 *
 * Arranca Nest con Express, aplica seguridad (helmet, CORS, trust proxy) y
 * ValidationPipe global. Conserva `rawBody` para verificar firmas HMAC de
 * webhooks Kapso/Meta sin alterar el payload original.
 */
import { Logger, ValidationPipe } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { NestFactory } from "@nestjs/core";
import { NestExpressApplication } from "@nestjs/platform-express";
import helmet from "helmet";

import { AppModule } from "./app.module";

/**
 * `rawBody: true` conserva el cuerpo original del request para validar firmas
 * HMAC de Kapso y Meta sin depender de serializaciones posteriores.
 */
const NEST_FACTORY_OPTIONS = { rawBody: true };

/**
 * Opciones del ValidationPipe global de DTO.
 *
 * `whitelist` elimina propiedades no declaradas; `transform` habilita class-transformer.
 */
const VALIDATION_PIPE_OPTIONS = {
  whitelist: true,
  transform: true,
  // Mantiene compatibilidad con payloads JSON que incluyan estructuras amplias.
  forbidUnknownValues: false,
};

/**
 * Inicializa la aplicación Nest y abre el listener HTTP.
 *
 * Configura prefijo global, proxies confiables, CORS restringido a orígenes
 * permitidos y shutdown hooks para drenar conexiones al apagar el proceso.
 */
async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, NEST_FACTORY_OPTIONS);
  const logger = new Logger("Bootstrap");
  const configService = app.get(ConfigService);

  const apiPrefix = configService.getOrThrow<string>("app.apiPrefix");
  const corsOrigins = configService.get<string[]>("app.corsOrigins", []);
  const port = configService.getOrThrow<number>("app.port");
  const trustProxyHops = configService.get<number>("app.trustProxyHops", 0);

  app.setGlobalPrefix(apiPrefix);
  app.set("trust proxy", trustProxyHops);
  app.enableShutdownHooks();

  app.use(helmet());

  app.enableCors({
    origin: corsOrigins,
    credentials: true,
  });

  app.useGlobalPipes(new ValidationPipe(VALIDATION_PIPE_OPTIONS));

  await app.listen(port);
  logger.log(`API escuchando en http://localhost:${port}/${apiPrefix}`);
}

void bootstrap();
