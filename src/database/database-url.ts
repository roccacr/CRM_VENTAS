import { formatMysqlUrl, MysqlEnv, readMysqlCredentials } from './mysql-env';

/**
 * Construye DATABASE_URL: reusa la existente o la arma desde MYSQL_*.
 */
export function buildDatabaseUrlFromMysqlEnv(env: MysqlEnv): string | undefined {
  if (env.DATABASE_URL) {
    return env.DATABASE_URL;
  }

  const credentials = readMysqlCredentials(env);
  return credentials ? formatMysqlUrl(credentials) : undefined;
}
