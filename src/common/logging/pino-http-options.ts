import type { Options as PinoHttpOptions } from "pino-http";

import { resolveApiLogFile } from "./log-files";
import { PINO_REDACT_CENSOR, PINO_STDOUT_FD } from "./pino-http.constants";
import { SENSITIVE_HEADER_PATHS } from "./sensitive-header-paths";

type CreatePinoHttpOptionsInput = {
    readonly logDir?: string;
    readonly logLevel: string;
    readonly nodeEnv: string;
};

type PinoTransportTarget = {
    readonly level: string;
    readonly options: Record<string, unknown>;
    readonly target: string;
};

/**
 * Configura logs HTTP con dos salidas: consola (lectura humana) y archivo
 * persistente para monitoreo Kapso.
 *
 * Produccion escribe JSON a stdout (destination 1) para que el orquestador
 * recoja el stream. Fuera de produccion usa `pino-pretty` sin color para que
 * los tests y `check-logs` puedan parsear lineas estables.
 */
export function createPinoHttpOptions(input: CreatePinoHttpOptionsInput): PinoHttpOptions {
    return {
        level: input.logLevel,
        redact: createRedactOptions(),
        transport: {
            targets: [createConsoleTarget(input.logLevel, input.nodeEnv), createFileTarget(input)],
        },
    };
}

function createRedactOptions(): { readonly censor: string; readonly paths: string[] } {
    return {
        censor: PINO_REDACT_CENSOR,
        paths: [...SENSITIVE_HEADER_PATHS],
    };
}

function createFileTarget(input: CreatePinoHttpOptionsInput): PinoTransportTarget {
    return {
        level: input.logLevel,
        options: {
            destination: resolveApiLogFile(input.logDir),
            mkdir: true,
        },
        target: "pino/file",
    };
}

function createConsoleTarget(logLevel: string, nodeEnv: string): PinoTransportTarget {
    if (nodeEnv === "production") {
        return {
            level: logLevel,
            options: { destination: PINO_STDOUT_FD },
            target: "pino/file",
        };
    }

    return {
        level: logLevel,
        options: {
            colorize: false,
            ignore: "pid,hostname",
            singleLine: true,
            translateTime: "SYS:standard",
        },
        target: "pino-pretty",
    };
}
