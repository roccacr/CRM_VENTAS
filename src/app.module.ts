import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { LoggerModule } from 'nestjs-pino';
import { Options as PinoHttpOptions } from 'pino-http';

import { parseAppConfig, validateEnvironment } from './config/app-config';
import { DatabaseModule } from './database/database.module';
import { HealthModule } from './health/health.module';
import { KapsoIntegrationsModule } from './kapso-integrations/kapso-integrations.module';
import { KapsoWebhooksModule } from './kapso-webhooks/kapso-webhooks.module';

const appConfig = parseAppConfig(process.env);

/** Pino HTTP: nivel, pretty fuera de prod, redacción de headers sensibles. */
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
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      'req.headers.x-api-key',
      'req.headers.x-webhook-signature',
    ],
    censor: '[redacted]',
  },
};

/** Módulo raíz: config, logs, DB, health, integraciones y webhooks. */
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
