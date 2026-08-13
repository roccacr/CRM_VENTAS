/**
 * Configuración de conexión a MySQL.
 *
 * Se admiten dos estrategias, evaluadas en este orden de precedencia:
 *   1. DATABASE_URL          → formato mysql://user:pass@host:port/db
 *   2. Variables MYSQL_*     → MYSQL_HOST, MYSQL_PORT, MYSQL_USER, MYSQL_PASSWORD, MYSQL_DATABASE
 *
 * La precedencia existe porque en entornos gestionados (RDS Proxy, Railway, Heroku, etc.)
 * suele inyectarse un único DATABASE_URL, mientras que en local/CI es más práctico
 * declarar variables sueltas. resolveMysqlCredentials() es el punto de entrada que
 * implementa esta regla; readMysqlCredentials() y parseMysqlUrl() son las estrategias
 * individuales y siguen siendo exportadas para quien necesite forzar una de las dos.
 */

const DEFAULT_MYSQL_PORT = 3306;
const MYSQL_URL_PROTOCOL = 'mysql:';

/** Variables de entorno aceptadas para conectar a MySQL. */
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
 * Error de configuración MySQL.
 * Se separa de Error genérico para poder distinguir en logs/monitoring "falta
 * configuración" de un fallo de runtime, y para que el bootstrap de la app
 * pueda hacer catch selectivo (ej. mostrar mensaje claro en vez de stack trace).
 */
export class MysqlConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MysqlConfigError';
  }
}

/**
 * Punto de entrada único: resuelve credenciales aplicando la precedencia
 * DATABASE_URL > MYSQL_*.
 *
 * @throws {MysqlConfigError} si no hay configuración suficiente o es inválida.
 */
export function resolveMysqlCredentials(env: MysqlEnv): MysqlCredentials {
  if (env.DATABASE_URL) {
    return parseMysqlUrl(env.DATABASE_URL);
  }

  const credentials = readMysqlCredentials(env);
  if (!credentials) {
    throw new MysqlConfigError(
      'Faltan credenciales de MySQL: defina DATABASE_URL o el set completo ' +
        'MYSQL_HOST, MYSQL_PORT, MYSQL_USER, MYSQL_PASSWORD, MYSQL_DATABASE.',
    );
  }

  return credentials;
}

/**
 * Lee MYSQL_* como credenciales tipadas.
 * @returns undefined si falta algún campo obligatorio o MYSQL_PORT no es un puerto válido.
 */
export function readMysqlCredentials(env: MysqlEnv): MysqlCredentials | undefined {
  const { MYSQL_HOST, MYSQL_PORT, MYSQL_USER, MYSQL_PASSWORD, MYSQL_DATABASE } = env;

  if (!MYSQL_HOST || !MYSQL_PORT || !MYSQL_USER || !MYSQL_PASSWORD || !MYSQL_DATABASE) {
    return undefined;
  }

  // Antes: Number(MYSQL_PORT) podía dar NaN (ej. MYSQL_PORT="abc") y ese NaN
  // se colaba igual porque el string original era truthy. toValidPort() cierra ese hueco.
  const port = toValidPort(MYSQL_PORT);
  if (port === undefined) {
    return undefined;
  }

  return {
    database: MYSQL_DATABASE,
    host: MYSQL_HOST,
    password: MYSQL_PASSWORD,
    port,
    user: MYSQL_USER,
  };
}

/**
 * Parsea mysql://user:pass@host:port/db a credenciales.
 * @throws {MysqlConfigError} si la URL es inválida o no usa el protocolo mysql:
 */
export function parseMysqlUrl(databaseUrl: string): MysqlCredentials {
  let url: URL;
  try {
    url = new URL(databaseUrl);
  } catch {
    throw new MysqlConfigError(`DATABASE_URL inválida: "${databaseUrl}"`);
  }

  if (url.protocol !== MYSQL_URL_PROTOCOL) {
    throw new MysqlConfigError(
      `DATABASE_URL debe usar el protocolo "${MYSQL_URL_PROTOCOL}//" (recibido: "${url.protocol}//")`,
    );
  }

  return {
    database: decodeURIComponent(url.pathname.replace(/^\//, '')),
    host: url.hostname,
    password: decodeURIComponent(url.password),
    port: url.port ? Number(url.port) : DEFAULT_MYSQL_PORT,
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

/** Valida que el string sea un puerto TCP válido (entero, 1–65535). */
function toValidPort(port: string): number | undefined {
  const parsed = Number(port);
  return Number.isInteger(parsed) && parsed > 0 && parsed <= 65535 ? parsed : undefined;
}
