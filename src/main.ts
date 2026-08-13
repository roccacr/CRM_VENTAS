import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { Logger } from 'nestjs-pino';

import { AppModule } from './app.module';

/** Arranca Nest: logger, prefijo, validación, Swagger y listen. */
async function bootstrap(): Promise<void> {
  // rawBody: necesario para verificar firmas HMAC de webhooks
  const app = await NestFactory.create(AppModule, { bufferLogs: true, rawBody: true });

  app.useLogger(app.get(Logger));
  app.setGlobalPrefix('api/v1');
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
  SwaggerModule.setup('api/docs', app, SwaggerModule.createDocument(app, swagger));

  const port = Number(app.get(ConfigService).get('PORT', 8002));
  await app.listen(port);
}

void bootstrap();
