import "./config/load-env";

import { ConfigService } from "@nestjs/config";
import { NestFactory } from "@nestjs/core";
import { Logger } from "nestjs-pino";

import { AppModule } from "./app.module";
import { APP_ENV_KEYS, DEFAULT_APP_PORT } from "./config/app-config.constants";
import { createCorsOptions } from "./config/cors-options";
import { GLOBAL_API_PREFIX } from "./config/http.constants";
import { setupSwagger } from "./config/setup-swagger";
import { GLOBAL_VALIDATION_PIPE } from "./config/validation-pipe";

/**
 * `rawBody: true` es obligatorio para webhooks Kapso: la firma HMAC se calcula
 * sobre los bytes exactos del wire, no sobre `JSON.stringify(body)`.
 * `bufferLogs` espera a que Pino tome el logger para no perder el boot.
 */
const NEST_HTTP_ADAPTER_OPTIONS = {
    bufferLogs: true,
    rawBody: true,
} as const;

/**
 * Bootstrap de la API Nest.
 *
 * `load-env` va en la primera linea: dotenv tiene que existir ANTES de que
 * `AppModule` lea `process.env` para Pino. `validateEnvironment` (ConfigModule)
 * ya corrio al crear el modulo; el PORT de aqui es el valor ya validado.
 */
async function bootstrap(): Promise<void> {
    const app = await NestFactory.create(AppModule, NEST_HTTP_ADAPTER_OPTIONS);

    app.useLogger(app.get(Logger));
    app.enableCors(createCorsOptions());
    app.setGlobalPrefix(GLOBAL_API_PREFIX);
    app.useGlobalPipes(GLOBAL_VALIDATION_PIPE);
    setupSwagger(app);

    const port = Number(app.get(ConfigService).get(APP_ENV_KEYS.PORT, DEFAULT_APP_PORT));
    await app.listen(port);
}

void bootstrap();
