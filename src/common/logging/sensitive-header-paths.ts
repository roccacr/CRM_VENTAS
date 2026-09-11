/**
 * Paths de Pino redactados en logs HTTP.
 *
 * Politica de seguridad: al agregar un header de auth/firma nuevo al proyecto,
 * sumarlo aqui. Es la lista que audita "¿que secretos no deben aparecer en logs?".
 *
 * Los nombres coinciden con los headers reales (`x-crm-api-token`,
 * `x-webhook-signature`); no importar constants de `src/auth` para no invertir
 * la dependencia common → feature.
 */
export const SENSITIVE_HEADER_PATHS = ["req.headers.authorization", "req.headers.cookie", "req.headers.x-api-key", "req.headers.x-webhook-signature", "req.headers.x-crm-api-token"] as const;
