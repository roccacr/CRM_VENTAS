import { formatMysqlUrl, MysqlEnv, readMysqlCredentials } from './mysql-env';

/**
 * Construye (o reutiliza) una DATABASE_URL a partir del entorno.
 *
 * Comportamiento real (el doc debe coincidir con el código):
 *   1. Si existe DATABASE_URL → se devuelve tal cual (passthrough, sin revalidar).
 *   2. Si no, y MYSQL_* está completo y con puerto válido → formatMysqlUrl(...).
 *   3. En cualquier otro caso → undefined (no lanza).
 *
 * No usa resolveMysqlCredentials() a propósito: los scripts/CI que consumen
 * esta función esperan `string | undefined`, no una excepción. La validación
 * estricta (protocolo, URL parseable) vive en parseMysqlUrl / resolveMysqlCredentials.
 */
export function buildDatabaseUrlFromMysqlEnv(env: MysqlEnv): string | undefined {
  if (env.DATABASE_URL) {
    return env.DATABASE_URL;
  }

  const credentials = readMysqlCredentials(env);
  return credentials ? formatMysqlUrl(credentials) : undefined;
}
