import { CorsOptions } from "@nestjs/common/interfaces/external/cors-options.interface";

import { APP_ENV_KEYS } from "./app-config.constants";
import { CORS_ALLOW_CREDENTIALS, CORS_ALLOWED_HEADERS, CORS_ALLOWED_METHODS, DEFAULT_CRM_FRONTEND_ORIGINS } from "./cors-options.constants";

/**
 * Une orígenes default (Vite local) con los de `CRM_FRONTEND_ORIGINS`.
 *
 * El Set elimina duplicados: produccion suele repetir `localhost:5173`.
 * Whitespace-only se trata como ausente, igual que los headers HTTP.
 *
 * @param rawOrigins - Lista separada por comas, o `undefined` si no hay env
 */
export function parseCorsOrigins(rawOrigins?: string): string[] {
    return uniqueOrigins([...DEFAULT_CRM_FRONTEND_ORIGINS, ...splitOriginList(rawOrigins)]);
}

/**
 * CORS del API Kapso para el frontend CRM.
 *
 * Lee `CRM_FRONTEND_ORIGINS` del env (no de `AppConfig`) porque los origenes
 * no son un secreto y `createCorsOptions` corre en `main.ts` con `process.env`.
 */
export function createCorsOptions(env: NodeJS.ProcessEnv = process.env): CorsOptions {
    return {
        allowedHeaders: [...CORS_ALLOWED_HEADERS],
        credentials: CORS_ALLOW_CREDENTIALS,
        methods: [...CORS_ALLOWED_METHODS],
        origin: parseCorsOrigins(env[APP_ENV_KEYS.CRM_FRONTEND_ORIGINS]),
    };
}

function splitOriginList(rawOrigins?: string): string[] {
    if (!rawOrigins) {
        return [];
    }

    return rawOrigins
        .split(",")
        .map((origin) => origin.trim())
        .filter(Boolean);
}

function uniqueOrigins(origins: string[]): string[] {
    return [...new Set(origins)];
}
