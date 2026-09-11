import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { LoggerModule } from "nestjs-pino";

import { createPinoHttpOptions } from "./common/logging/pino-http-options";
import { parseAppConfig, validateEnvironment } from "./config/app-config";
import { DatabaseModule } from "./database/database.module";
import { HealthModule } from "./health/health.module";
import { KapsoCronjobsModule } from "./kapso-cronjobs/kapso-cronjobs.module";
import { KapsoIntegrationsModule } from "./kapso-integrations/kapso-integrations.module";
import { KapsoWebhooksModule } from "./kapso-webhooks/kapso-webhooks.module";

/**
 * Modulo raiz.
 *
 * `parseAppConfig(process.env)` corre al cargar el archivo (configura Pino).
 * `ConfigModule.validate` vuelve a validar al boot de Nest — doble check
 * deliberado: el primero alimenta `LoggerModule.forRoot` (no espera async),
 * el segundo es el contrato oficial de `@nestjs/config`.
 *
 * Orden de imports: config/logger → DB → health → features Kapso.
 * Cronjobs al final: el runner no debe arrancar sin ConfigModule global.
 */
const appConfig = parseAppConfig(process.env);

const pinoHttpOptions = createPinoHttpOptions({
    logLevel: appConfig.logLevel,
    nodeEnv: appConfig.nodeEnv,
});

const infrastructureModules = [ConfigModule.forRoot({ isGlobal: true, validate: validateEnvironment }), LoggerModule.forRoot({ pinoHttp: pinoHttpOptions }), DatabaseModule, HealthModule] as const;

const kapsoFeatureModules = [KapsoIntegrationsModule, KapsoWebhooksModule, KapsoCronjobsModule] as const;

@Module({
    imports: [...infrastructureModules, ...kapsoFeatureModules],
})
export class AppModule {}
