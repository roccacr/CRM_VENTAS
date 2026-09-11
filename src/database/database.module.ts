import { Global, Module } from "@nestjs/common";

import { PrismaService } from "./prisma.service";

/**
 * Acceso global a MySQL via Prisma.
 *
 * `@Global` evita reimportar `DatabaseModule` en cada feature (webhooks,
 * integraciones, cronjobs). El client es singleton: un pool por proceso.
 */
@Global()
@Module({
    exports: [PrismaService],
    providers: [PrismaService],
})
export class DatabaseModule {}
