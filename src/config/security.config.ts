/**
 * Namespace de seguridad: Entra ID y rate limiting interno.
 *
 * Deriva issuer/JWKS desde el tenant y expone audience, scopes y client ids
 * bajo `security`, para que el guard/servicio de auth no construyan URLs a mano.
 */
import { registerAs } from "@nestjs/config";

/**
 * Parte una lista CSV en valores no vacíos.
 *
 * Se usa para allowlists de client ids Entra sin depender de librerías extra.
 */
const splitCsv = (value: string | undefined): string[] =>
  (value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

/**
 * Registra el bloque `security` en ConfigModule.
 *
 * Construye `entraIssuer` y `entraJwksUri` desde el tenant para mantener
 * coherencia con el discovery de Microsoft y evitar desalineaciones manuales.
 */
export default registerAs("security", () => {
  const tenantId = process.env.ENTRA_TENANT_ID ?? "";

  return {
    entraTenantId: tenantId,
    entraAudience: process.env.ENTRA_API_AUDIENCE ?? "",
    entraRequiredScope: process.env.ENTRA_REQUIRED_SCOPE ?? "Kapso.Access",
    entraAllowedClientIds: splitCsv(process.env.ENTRA_ALLOWED_CLIENT_IDS),
    entraIssuer: tenantId ? `https://login.microsoftonline.com/${tenantId}/v2.0` : "",
    entraJwksUri: tenantId ? `https://login.microsoftonline.com/${tenantId}/discovery/v2.0/keys` : "",
    rateLimitPerMinute: Number(process.env.INTERNAL_RATE_LIMIT_PER_MINUTE ?? 120),
  };
});
