import { MysqlCredentials, MysqlEnv, parseMysqlUrl, readMysqlCredentials } from './mysql-env';

/** Config del pool MariaDB/MySQL para el adaptador Prisma. */
export type MysqlPoolConfig = MysqlCredentials & {
  readonly connectionLimit: number;
};

const DEFAULT_CONNECTION_LIMIT = 5;

function toPoolConfig(credentials: MysqlCredentials): MysqlPoolConfig {
  return { ...credentials, connectionLimit: DEFAULT_CONNECTION_LIMIT };
}

/**
 * Resuelve el pool: prioriza MYSQL_* (password en crudo);
 * si faltan, usa DATABASE_URL.
 */
export function buildMysqlPoolConfig(env: MysqlEnv): MysqlPoolConfig {
  const fromMysql = readMysqlCredentials(env);
  if (fromMysql) {
    return toPoolConfig(fromMysql);
  }

  if (!env.DATABASE_URL) {
    throw new Error('DATABASE_URL or MYSQL_* values are required to connect to MySQL');
  }

  return toPoolConfig(parseMysqlUrl(env.DATABASE_URL));
}
