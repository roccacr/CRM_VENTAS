import {
  MysqlCredentials,
  MysqlEnv,
  MysqlConfigError,
  parseMysqlUrl,
  readMysqlCredentials,
} from './mysql-env';

/**
 * Configuración del pool MariaDB/MySQL para el adaptador Prisma.
 *
 * Precedencia (intencional e invertida respecto a resolveMysqlCredentials):
 *   1. MYSQL_*        → password en crudo, sin pasar por encode/decode de URL
 *   2. DATABASE_URL   → fallback cuando el set MYSQL_* está incompleto o inválido
 *
 * ¿Por qué MYSQL_* gana aquí? En el pool runtime necesitamos el password exacto
 * del proceso (caracteres como `%`, `#`, `@`). Si priorizáramos DATABASE_URL,
 * un password mal escapado en la URL corrompería la autenticación aunque
 * MYSQL_PASSWORD estuviera bien. resolveMysqlCredentials() sigue siendo la
 * API general (DATABASE_URL primero) para scripts/CLI; este builder es el
 * camino del runtime Nest/Prisma.
 */

const DEFAULT_CONNECTION_LIMIT = 5;

/** Credenciales + tamaño del pool para PrismaMariaDb. */
export type MysqlPoolConfig = MysqlCredentials & {
  readonly connectionLimit: number;
};

function toPoolConfig(credentials: MysqlCredentials): MysqlPoolConfig {
  return { ...credentials, connectionLimit: DEFAULT_CONNECTION_LIMIT };
}

/**
 * Resuelve la config del pool con precedencia MYSQL_* > DATABASE_URL.
 *
 * @throws {MysqlConfigError} si no hay configuración usable
 */
export function buildMysqlPoolConfig(env: MysqlEnv): MysqlPoolConfig {
  const fromMysql = readMysqlCredentials(env);
  if (fromMysql) {
    return toPoolConfig(fromMysql);
  }

  if (!env.DATABASE_URL) {
    throw new MysqlConfigError(
      'DATABASE_URL or MYSQL_* values are required to connect to MySQL',
    );
  }

  // parseMysqlUrl ya valida protocolo y formato; propaga MysqlConfigError
  return toPoolConfig(parseMysqlUrl(env.DATABASE_URL));
}
