import { CRM_INTERNAL_TOKEN_HEADER } from "../auth/crm-internal-token.constants";

/**
 * Vite del CRM en local. Siempre se permiten, aunque `CRM_FRONTEND_ORIGINS`
 * traiga produccion: si no, el front de desarrollo queda bloqueado al mezclar envs.
 */
export const DEFAULT_CRM_FRONTEND_ORIGINS = ["http://localhost:5173", "http://127.0.0.1:5173"] as const;

/**
 * Headers que el browser del CRM manda en preflight.
 * `x-crm-api-token` sale de `auth/` para no divergir del guard.
 */
export const CORS_ALLOWED_HEADERS = ["Authorization", "Content-Type", CRM_INTERNAL_TOKEN_HEADER] as const;

export const CORS_ALLOWED_METHODS = ["GET", "POST", "PATCH", "DELETE", "OPTIONS"] as const;

/**
 * API de tokens, no de cookies de sesion. `credentials: false` evita que el
 * browser adjunte cookies de otro origen; el CRM autentica con header.
 */
export const CORS_ALLOW_CREDENTIALS = false;
