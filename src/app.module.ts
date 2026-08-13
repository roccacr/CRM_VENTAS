import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { LoggerModule } from 'nestjs-pino';
import { Options as PinoHttpOptions } from 'pino-http';

import { parseAppConfig, validateEnvironment } from './config/app-config';
import { DatabaseModule } from './database/database.module';
import { HealthModule } from './health/health.module';
import { KapsoIntegrationsModule } from './kapso-integrations/kapso-integrations.module';
import { KapsoWebhooksModule } from './kapso-webhooks/kapso-webhooks.module';

/**
 * Módulo raíz.
 *
 * parseAppConfig(process.env) corre al cargar el módulo (configura Pino).
 * ConfigModule.validate vuelve a validar al boot de Nest — doble check
 * deliberado: el primero alimenta LoggerModule.forRoot (que no espera async),
 * el segundo es el contrato oficial de @nestjs/config.
 */
const appConfig = parseAppConfig(process.env);

const SENSITIVE_HEADER_PATHS = [
  'req.headers.authorization',
  'req.headers.cookie',
  'req.headers.x-api-key',
  'req.headers.x-webhook-signature',
] as const;

/** Pino HTTP: JSON en production; pretty + redact de headers sensibles fuera. */
const pinoHttpOptions: PinoHttpOptions = {
  level: appConfig.logLevel,
  ...(appConfig.nodeEnv === 'production'
    ? {}
    : {
        transport: {
          target: 'pino-pretty',
          options: {
            colorize: false,
            ignore: 'pid,hostname',
            singleLine: true,
            translateTime: 'SYS:standard',
          },
        },
      }),
  redact: {
    paths: [...SENSITIVE_HEADER_PATHS],
    censor: '[redacted]',
  },
};

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnvironment }),
    LoggerModule.forRoot({ pinoHttp: pinoHttpOptions }),
    DatabaseModule,
    HealthModule,
    KapsoIntegrationsModule,
    KapsoWebhooksModule,
  ],
})
export class AppModule {}
