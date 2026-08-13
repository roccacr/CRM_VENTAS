import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import { PrismaClient } from '@prisma/client';

import { buildMysqlPoolConfig } from './mysql-pool-config';

/** Crea un PrismaClient con adaptador MariaDB/MySQL. */
export function createPrismaClient(env = process.env): PrismaClient {
  const pool = buildMysqlPoolConfig(env);
  return new PrismaClient({
    adapter: new PrismaMariaDb(pool, { database: pool.database }),
  });
}
