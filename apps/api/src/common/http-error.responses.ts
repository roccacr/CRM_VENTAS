/** Shared safe 503 body for Nest exceptions and early Fastify unavailable responses. */
export const SERVICE_UNAVAILABLE_RESPONSE = Object.freeze({ statusCode: 503, error: "Service Unavailable", message: "Servicio no disponible." });

/** Fixed safe recovery signal: external approval may be committed while local persistence is unconfirmed. */
export const FORMALIZATION_APPROVAL_RECONCILIATION_RESPONSE = Object.freeze({
    statusCode: 503,
    error: "Service Unavailable",
    code: "FORMALIZATION_APPROVAL_RECONCILIATION_REQUIRED",
    message: "NetSuite confirmó la aprobación, pero falta sincronizar el CRM. Reintenta la misma operación.",
});
