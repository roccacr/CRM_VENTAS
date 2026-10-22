/** Shared safe 503 body for Nest exceptions and early Fastify unavailable responses. */
export const SERVICE_UNAVAILABLE_RESPONSE = Object.freeze({ statusCode: 503, error: "Service Unavailable", message: "Servicio no disponible." });
