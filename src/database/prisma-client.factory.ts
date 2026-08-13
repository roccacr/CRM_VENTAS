import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import { PrismaClient } from '@prisma/client';

import { buildMysqlPoolConfig } from './mysql-pool-config';
import { MysqlEnv } from './mysql-env';

/**
 * Factory del PrismaClient con adaptador MariaDB/MySQL.
 *
 * Se mantiene separado de PrismaService para que scripts y Playwright puedan
 * crear un cliente sin arrancar Nest. Usa buildMysqlPoolConfig (precedencia
 * MYSQL_* > DATABASE_URL) porque es el camino de conexión runtime.
 *
 * @throws {MysqlConfigError} si el entorno no tiene credenciales usables
 */
export function createPrismaClient(env: MysqlEnv = process.env): PrismaClient {
  const pool = buildMysqlPoolConfig(env);

  return new PrismaClient({
    adapter: new PrismaMariaDb(pool, { database: pool.database }),
  });
}
