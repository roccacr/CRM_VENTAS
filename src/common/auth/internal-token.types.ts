/**
 * Cableado de una integracion sobre `InternalTokenGuard`.
 *
 * Cada consumidor (CRM, y a futuro NetSuite/Postventa) aporta solo estos tres
 * datos; la politica HTTP (503/401/timing-safe) no se reimplementa.
 */
export type InternalTokenGuardOptions = {
    /** Env var con el token esperado (ej. `CRM_API_INTERNAL_TOKEN`). */
    readonly envKey: string;

    /** Header fallback si no viene `Authorization: Bearer` (ej. `x-crm-api-token`). */
    readonly headerName: string;

    /** Nombre legible del servicio, solo para mensajes 401/503 (ej. `CRM`). */
    readonly serviceLabel: string;
};
