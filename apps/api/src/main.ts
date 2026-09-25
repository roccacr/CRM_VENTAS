import "reflect-metadata";

import { ConfigService } from "@nestjs/config";
import { NestFactory } from "@nestjs/core";
import { FastifyAdapter, type NestFastifyApplication } from "@nestjs/platform-fastify";

import { AppModule } from "./app.module.js";
import { configureHttpApp } from "./bootstrap/configure-http-app.js";
import { parseTrustedProxyIps } from "./config/env.validation.js";

/**
 * Lee la lista explicita de proxies confiables antes de crear Fastify.
 *
 * No se usa `trustProxy: true` porque permitiria confiar headers
 * `X-Forwarded-*` enviados por clientes directos. Solo se aceptan IP/CIDR
 * definidos por infraestructura.
 */
const readTrustedProxyConfig = (): string[] | false => {
    return parseTrustedProxyIps(process.env.TRUSTED_PROXY_IPS);
};

/**
 * Inicia el runtime NestJS de identidad aprobado.
 *
 * El bootstrap solo maneja concerns de proceso: crear Nest/Fastify, aplicar
 * hardening HTTP, leer el puerto validado y escuchar. Seguridad, persistencia e
 * identidad permanecen en sus modulos enfocados.
 */
const bootstrap = async (): Promise<void> => {
    const app = await NestFactory.create<NestFastifyApplication>(
        AppModule,
        new FastifyAdapter({
            trustProxy: readTrustedProxyConfig(),
        }),
    );
    app.enableShutdownHooks();
    await configureHttpApp(app);

    const config = app.get(ConfigService);
    const host = config.getOrThrow<string>("API_BIND_HOST");
    const port = config.getOrThrow<number>("PORT");
    await app.listen({ host, port });
};

await bootstrap();
