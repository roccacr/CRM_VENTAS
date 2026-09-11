/**
 * Cableado de una integracion sobre `WebhookSignatureGuard`.
 *
 * Cada proveedor (Kapso Platform, Kapso WhatsApp) aporta solo estos tres
 * datos; la politica HMAC (503/401/timing-safe) no se reimplementa.
 */
export type WebhookSignatureGuardOptions = {
    /** Env var del secreto HMAC (ej. `KAPSO_PLATFORM_WEBHOOK_SECRET`). */
    readonly envKey: string;

    /** Header de firma (ej. `x-webhook-signature`). */
    readonly headerName: string;

    /** Nombre legible del proveedor, solo para mensajes 401/503 (ej. `Kapso`). */
    readonly serviceLabel: string;
};
