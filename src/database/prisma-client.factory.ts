import { Prisma, PrismaClient } from "@prisma/client";

import { buildRuntimeDatabaseUrl } from "./database-url";
import { MysqlEnv } from "./mysql-env";

/**
 * Factory del PrismaClient MySQL.
 *
 * Se mantiene separado de `PrismaService` para que scripts y Playwright
 * creen un cliente sin arrancar Nest. Usa `buildRuntimeDatabaseUrl` (MYSQL_*
 * primero) para no heredar un `DATABASE_URL` mal encodeado.
 *
 * Si no existe `DATABASE_URL` ni `MYSQL_*` completo, se instancia Prisma
 * sin override: el error de configuracion lo lanza Prisma, no este factory.
 */
export function createPrismaClient(env: MysqlEnv = process.env): PrismaClient {
    return new PrismaClient(toPrismaClientOptions(buildRuntimeDatabaseUrl(env)));
}

/**
 * Solo inyecta `datasources.db.url` cuando hay una URL usable.
 * Pasar `{ datasources: { db: { url: undefined } } }` haria que Prisma
 * ignore el env del schema y falle con un mensaje peor.
 */
function toPrismaClientOptions(databaseUrl: string | undefined): Prisma.PrismaClientOptions | undefined {
    if (!databaseUrl) {
        return undefined;
    }

    return { datasources: { db: { url: databaseUrl } } };
}
