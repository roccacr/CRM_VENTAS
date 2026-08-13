import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { Logger } from 'nestjs-pino';

import { AppModule } from './app.module';
import { DEFAULT_APP_PORT } from './config/app-config';

const GLOBAL_API_PREFIX = 'api/v1';
const SWAGGER_PATH = 'api/docs';

/**
 * Bootstrap de la API Nest.
 *
 * rawBody: true es obligatorio para webhooks Kapso: la firma HMAC se calcula
 * sobre los bytes exactos del body, no sobre el objeto JSON re-serializado.
 * validateEnvironment (en AppModule) ya corrió antes del listen; el PORT
 * leído aquí viene del ConfigService con default tipado.
 */
async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: true, rawBody: true });

  app.useLogger(app.get(Logger));
  app.setGlobalPrefix(GLOBAL_API_PREFIX);
  app.useGlobalPipes(
    new ValidationPipe({
      forbidNonWhitelisted: true,
      transform: true,
      whitelist: true,
    }),
  );

  const swagger = new DocumentBuilder()
    .setTitle('API Kapso GIT')
    .setDescription('API NestJS para integrar Kapso con CRM Ventas.')
    .setVersion('0.1.0')
    .build();
  SwaggerModule.setup(SWAGGER_PATH, app, SwaggerModule.createDocument(app, swagger));

  const port = Number(app.get(ConfigService).get('PORT', DEFAULT_APP_PORT));
  await app.listen(port);
}

void bootstrap();
