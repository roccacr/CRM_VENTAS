/** Archivo principal de eventos HTTP del API Kapso (Pino + scripts de soporte). */
export const API_LOG_FILE_NAME = "api-kapso.log";

/** Env var opcional para reubicar `logs/` (tests, contenedores). */
export const KAPSO_LOG_DIR_ENV_KEY = "KAPSO_LOG_DIR";

/**
 * Directorio default relativo al cwd si `KAPSO_LOG_DIR` no esta seteada.
 * Se resuelve contra `process.cwd()`, no contra `__dirname`, para que en
 * produccion (dist/) y en tests apunte al mismo lugar configurable.
 */
export const DEFAULT_LOG_DIR = "logs";
