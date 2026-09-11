import { resolve } from "node:path";

import { API_LOG_FILE_NAME, DEFAULT_LOG_DIR, KAPSO_LOG_DIR_ENV_KEY } from "./log-files.constants";

/**
 * Resuelve el directorio de monitoreo operativo.
 *
 * Default relativo al repo (`logs/`). `KAPSO_LOG_DIR` gana si viene no vacia;
 * whitespace-only se trata como ausente, igual que los headers HTTP.
 *
 * @param logDir - Override explicito o env `KAPSO_LOG_DIR`
 */
export function resolveLogDir(logDir = process.env[KAPSO_LOG_DIR_ENV_KEY]): string {
    return resolve(process.cwd(), toUsableLogDir(logDir));
}

/**
 * Archivo principal de eventos del API Kapso para pruebas y soporte.
 *
 * @param logDir - Override de directorio; si se omite, usa `resolveLogDir()`
 */
export function resolveApiLogFile(logDir?: string): string {
    return resolve(resolveLogDir(logDir), API_LOG_FILE_NAME);
}

function toUsableLogDir(logDir: string | undefined): string {
    const trimmed = logDir?.trim();
    return trimmed || DEFAULT_LOG_DIR;
}
