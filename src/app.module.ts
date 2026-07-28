/**
 * Módulo raíz de la API Kapso CRM.
 *
 * Compone ConfigModule, TypeORM, jobs Kapso, Throttler y KapsoModule, e instala
 * guards globales de rate limit y autenticación Entra para proteger toda la API.
 */
import "dotenv/config";

import { Module } from "@nestjs/common";
import { BullModule } from "@nestjs/bullmq";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { APP_GUARD } from "@nestjs/core";
import { ThrottlerGuard, ThrottlerModule, seconds } from "@nestjs/throttler";
import { TypeOrmModule } from "@nestjs/typeorm";

import { EntraAuthGuard } from "./common/auth/entra-auth.guard";
import { EntraAuthService } from "./common/auth/entra-auth.service";
import appConfig from "./config/app.config";
import kapsoConfig from "./config/kapso.config";
import mysqlConfig from "./config/mysql.config";
import redisConfig from "./config/redis.config";
import securityConfig from "./config/security.config";
import { validateEnv } from "./config/validate-env";

import { AppController } from "./app.controller";
import { buildTypeOrmOptions } from "./database/typeorm.options";
import { KapsoModule } from "./modules/kapso/kapso.module";

/** Loaders de namespaces tipados registrados en ConfigModule. */
const CONFIG_LOADERS = [appConfig, kapsoConfig, mysqlConfig, redisConfig, securityConfig];
const KAPSO_JOBS_DRIVER = (process.env.KAPSO_JOBS_DRIVER ?? "local").trim().toLowerCase();
const BULLMQ_IMPORTS =
  KAPSO_JOBS_DRIVER === "bullmq"
    ? [
        BullModule.forRootAsync({
          inject: [ConfigService],
          useFactory: (configService: ConfigService) => ({
            connection: {
              db: configService.get<number>("redis.db", 0),
              host: configService.getOrThrow<string>("redis.host"),
              password: configService.get<string>("redis.password"),
              port: configService.get<number>("redis.port", 6379),
              tls: configService.get<boolean>("redis.tls", false) ? {} : undefined,
              username: configService.get<string>("redis.username"),
            },
            defaultJobOptions: {
              attempts: 3,
              backoff: {
                delay: 5_000,
                type: "exponential",
              },
              removeOnComplete: 100,
              removeOnFail: 500,
            },
          }),
        }),
      ]
    : [];

/**
 * Ensambla la infraestructura transversal y el dominio Kapso.
 *
 * Los providers `APP_GUARD` aplican Throttler y Entra a todos los endpoints
 * (salvo excepciones explícitas como `@Public` / `@SkipThrottle`).
 */
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      // Reutiliza valores resueltos para evitar releer process.env en cada acceso.
      cache: true,
      load: CONFIG_LOADERS,
      validate: validateEnv,
    }),

    TypeOrmModule.forRootAsync({
      // Mantiene una sola fuente de verdad para las opciones de TypeORM.
      useFactory: () => buildTypeOrmOptions(),
    }),

    ...BULLMQ_IMPORTS,

    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => [
        {
          limit: configService.get<number>("security.rateLimitPerMinute", 120),
          ttl: seconds(60),
        },
      ],
    }),

    KapsoModule,
  ],
  controllers: [AppController],
  providers: [
    EntraAuthService,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    {
      provide: APP_GUARD,
      useClass: EntraAuthGuard,
    },
  ],
})
export class AppModule {}
