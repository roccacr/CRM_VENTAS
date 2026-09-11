import { InternalTokenGuard } from "../common/auth/internal-token.guard";
import { CRM_INTERNAL_TOKEN_ENV_KEY, CRM_INTERNAL_TOKEN_HEADER, CRM_INTERNAL_TOKEN_SERVICE_LABEL } from "./crm-internal-token.constants";

/**
 * Guard Nest de las rutas CRM → API Kapso.
 *
 * Este archivo no implementa auth: solo cablea la integracion CRM sobre
 * `InternalTokenGuard`. La politica (503 fail-closed, comparacion timing-safe,
 * Bearer o header custom) vive una sola vez en `common/auth`.
 *
 * Uso en controllers, sin cambios:
 *   `@UseGuards(CrmInternalTokenGuard)`
 *
 * Tambien se registra como provider en `KapsoIntegrationsModule` porque el
 * mixin de Nest necesita DI de `ConfigService` para leer la env var.
 */
export const CrmInternalTokenGuard = InternalTokenGuard({
    envKey: CRM_INTERNAL_TOKEN_ENV_KEY,
    headerName: CRM_INTERNAL_TOKEN_HEADER,
    serviceLabel: CRM_INTERNAL_TOKEN_SERVICE_LABEL,
});
