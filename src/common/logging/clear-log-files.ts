import { existsSync, mkdirSync, readdirSync, rmSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

import { resolveLogDir } from "./log-files";

export type ClearLogFilesResult = {
    readonly removed: number;
};

/**
 * Limpia solo archivos `.log` dentro del directorio de monitoreo Kapso.
 *
 * No borra subcarpetas ni otros tipos de archivo para evitar perdida
 * accidental de evidencia (archivos `.txt`, dumps, archives).
 *
 * @param logDir - Directorio a limpiar; default `resolveLogDir()`
 */
export function clearLogFiles(logDir = resolveLogDir()): ClearLogFilesResult {
    const resolvedLogDir = ensureLogDirectory(logDir);
    return { removed: removeLogFilesIn(resolvedLogDir) };
}

/**
 * Garantiza que el directorio exista. Si no estaba, no hay nada que borrar.
 */
function ensureLogDirectory(logDir: string): string {
    const resolvedLogDir = resolve(logDir);

    if (!existsSync(resolvedLogDir)) {
        mkdirSync(resolvedLogDir, { recursive: true });
    }

    return resolvedLogDir;
}

function removeLogFilesIn(resolvedLogDir: string): number {
    let removed = 0;

    for (const entry of readdirSync(resolvedLogDir)) {
        const filePath = join(resolvedLogDir, entry);

        if (!isLogFile(filePath, entry)) {
            continue;
        }

        rmSync(filePath, { force: true });
        removed += 1;
    }

    return removed;
}

function isLogFile(filePath: string, fileName: string): boolean {
    return statSync(filePath).isFile() && fileName.endsWith(".log");
}
