/**
 * Variables de entorno para conectar a MySQL.
 * Se acepta DATABASE_URL o el set completo MYSQL_*.
 */
export type MysqlEnv = {
  readonly DATABASE_URL?: string;
  readonly MYSQL_HOST?: string;
  readonly MYSQL_PORT?: string;
  readonly MYSQL_USER?: string;
  readonly MYSQL_PASSWORD?: string;
  readonly MYSQL_DATABASE?: string;
};

/** Credenciales MySQL ya normalizadas (sin URL). */
export type MysqlCredentials = {
  readonly database: string;
  readonly host: string;
  readonly password: string;
  readonly port: number;
  readonly user: string;
};

/**
 * Lee MYSQL_* como credenciales tipadas.
 * @returns undefined si falta algún campo obligatorio
 */
export function readMysqlCredentials(env: MysqlEnv): MysqlCredentials | undefined {
  const { MYSQL_HOST, MYSQL_PORT, MYSQL_USER, MYSQL_PASSWORD, MYSQL_DATABASE } = env;

  if (!MYSQL_HOST || !MYSQL_PORT || !MYSQL_USER || !MYSQL_PASSWORD || !MYSQL_DATABASE) {
    return undefined;
  }

  return {
    database: MYSQL_DATABASE,
    host: MYSQL_HOST,
    password: MYSQL_PASSWORD,
    port: Number(MYSQL_PORT),
    user: MYSQL_USER,
  };
}

/** Parsea mysql://user:pass@host:port/db a credenciales. */
export function parseMysqlUrl(databaseUrl: string): MysqlCredentials {
  const url = new URL(databaseUrl);

  return {
    database: decodeURIComponent(url.pathname.replace(/^\//, '')),
    host: url.hostname,
    password: decodeURIComponent(url.password),
    port: Number(url.port || 3306),
    user: decodeURIComponent(url.username),
  };
}

/** Arma mysql://... desde credenciales (encode de user/pass/db). */
export function formatMysqlUrl(credentials: MysqlCredentials): string {
  const user = encodeURIComponent(credentials.user);
  const password = encodeURIComponent(credentials.password);
  const database = encodeURIComponent(credentials.database);

  return `mysql://${user}:${password}@${credentials.host}:${credentials.port}/${database}`;
}
