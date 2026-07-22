/**
 * Namespace de seguridad: Entra ID y rate limiting interno.
 *
 * Deriva issuer/JWKS desde el tenant y expone audiences, scopes y client ids
 * bajo `security`, para que el guard/servicio de auth no construyan URLs a mano.
 */
import { registerAs } from "@nestjs/config";

/**
 * Parte una lista CSV en valores no vacíos.
 *
 * Se usa para allowlists de client ids / audiences Entra sin depender de librerías extra.
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
 *
 * `ENTRA_API_AUDIENCE` acepta CSV: GUID del app registration y/o Application ID URI
 * (`api://...`), porque el claim `aud` del access token puede ser cualquiera de los dos
 * según `accessTokenAcceptedVersion` del manifiesto Entra.
 */
export default registerAs("security", () => {
  const tenantId = process.env.ENTRA_TENANT_ID ?? "";
  const entraAudiences = splitCsv(process.env.ENTRA_API_AUDIENCE);

  return {
    entraTenantId: tenantId,
    /** Audiences aceptadas (GUID y/o `api://...`). */
    entraAudiences,
    /** Compat: primera audiencia (tests/legacy). Preferir `entraAudiences`. */
    entraAudience: entraAudiences[0] ?? "",
    entraRequiredScope: process.env.ENTRA_REQUIRED_SCOPE ?? "Kapso.Access",
    entraAllowedClientIds: splitCsv(process.env.ENTRA_ALLOWED_CLIENT_IDS),
    entraIssuer: tenantId ? `https://login.microsoftonline.com/${tenantId}/v2.0` : "",
    entraJwksUri: tenantId ? `https://login.microsoftonline.com/${tenantId}/discovery/v2.0/keys` : "",
    crmJwtSecret: process.env.CRM_JWT_SECRET ?? process.env.JWT_SECRET ?? "",
    rateLimitPerMinute: Number(process.env.INTERNAL_RATE_LIMIT_PER_MINUTE ?? 120),
  };
});
