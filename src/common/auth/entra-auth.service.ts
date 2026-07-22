/**
 * Servicio de verificación de access tokens de Microsoft Entra ID.
 *
 * Valida firma JWKS, audience, issuer, tenant, cliente y scope; luego mapea
 * el correo del token a un admin activo del CRM. Así la API no confía solo
 * en un JWT válido, sino también en la membresía de negocio.
 */
import { Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { decode, verify } from "jsonwebtoken";
import { JwksClient } from "jwks-rsa";
import { DataSource } from "typeorm";

import { AuthenticatedCrmUser, CrmSessionTokenPayload, EntraAccessTokenPayload } from "./auth.types";

/**
 * Normaliza `ENTRA_API_AUDIENCE` / config legacy a lista de audiences.
 */
const splitAudience = (value: string | undefined): string[] =>
  (value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

/**
 * Fila mínima de `admins` necesaria para construir `AuthenticatedCrmUser`.
 */
type CrmAdminRow = {
  emailAdmin: string;
  idAdmin: number;
  idNetSuiteAdmin: number | null;
  nameAdmin: string;
  roleId: number;
};

/**
 * Autentica tokens Entra y resuelve el usuario CRM correspondiente.
 *
 * Cachea claves JWKS con rate limit para no saturar el discovery de Microsoft
 * bajo carga, manteniendo rotación de claves sin reiniciar el proceso.
 */
@Injectable()
export class EntraAuthService {
  private readonly allowedClientIds: string[];
  private readonly audiences: string[];
  private readonly issuer: string;
  private readonly jwks: JwksClient;
  private readonly requiredScope: string;
  private readonly tenantId: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly dataSource: DataSource,
  ) {
    this.tenantId = this.configService.getOrThrow<string>("security.entraTenantId");
    const configuredAudiences = this.configService.get<string[]>("security.entraAudiences", []);
    const legacyAudience = this.configService.get<string>("security.entraAudience", "");
    this.audiences = configuredAudiences.length > 0 ? configuredAudiences : splitAudience(legacyAudience);
    this.issuer = this.configService.getOrThrow<string>("security.entraIssuer");
    this.requiredScope = this.configService.getOrThrow<string>("security.entraRequiredScope");
    this.allowedClientIds = this.configService.get<string[]>("security.entraAllowedClientIds", []);

    if (this.audiences.length === 0) {
      throw new Error("security.entraAudiences / security.entraAudience debe definir al menos una audiencia.");
    }

    this.jwks = new JwksClient({
      cache: true,
      cacheMaxAge: 60 * 60 * 1000,
      cacheMaxEntries: 5,
      jwksRequestsPerMinute: 10,
      jwksUri: this.configService.getOrThrow<string>("security.entraJwksUri"),
      rateLimit: true,
    });
  }

  /**
   * Autentica un access token y devuelve el usuario CRM activo asociado.
   *
   * Combina verificación criptográfica del JWT con lookup en `admins` para
   * asegurar que solo cuentas CRM vigentes operen la API Kapso.
   *
   * @param token - Access token Bearer (sin el prefijo "Bearer")
   * @returns Usuario CRM autenticado listo para adjuntar al request
   * @throws {UnauthorizedException} Si el token es inválido o el admin no está activo
   */
  async authenticate(token: string): Promise<AuthenticatedCrmUser> {
    if (this.isCrmSessionToken(token)) {
      return this.authenticateCrmSessionToken(token);
    }

    const payload = await this.verifyAccessToken(token);
    const email = this.resolveEmail(payload);
    const crmUser = await this.findActiveCrmUser(email);

    if (!crmUser) {
      throw new UnauthorizedException("La cuenta autenticada no tiene acceso activo al CRM.");
    }

    return {
      idAdmin: crmUser.idAdmin,
      idNetSuiteAdmin: crmUser.idNetSuiteAdmin,
      roleId: crmUser.roleId,
      email: crmUser.emailAdmin,
      name: crmUser.nameAdmin,
      entraObjectId: payload.oid ?? null,
      authSource: "entra",
    };
  }

  /**
   * Detecta tokens de sesión legacy del CRM antes de llamar JWKS.
   *
   * Un token CRM usa `data.email` y no trae issuer/audience Entra; esto evita
   * disparar validaciones Microsoft para una sesión que ya existe en el CRM.
   */
  private isCrmSessionToken(token: string): boolean {
    const payload = decode(token) as CrmSessionTokenPayload | null;

    return Boolean(payload?.data?.email && !payload.iss && !payload.aud);
  }

  /**
   * Valida `token_admin` igual que el backend CRM: firma JWT + sesión activa.
   */
  private async authenticateCrmSessionToken(token: string): Promise<AuthenticatedCrmUser> {
    const secret = this.configService.get<string>("security.crmJwtSecret", "");

    if (!secret) {
      throw new UnauthorizedException("La autenticación por sesión CRM no está configurada.");
    }

    let payload: CrmSessionTokenPayload;

    try {
      payload = verify(token, secret) as CrmSessionTokenPayload;
    } catch {
      throw new UnauthorizedException("Token de sesión CRM inválido o vencido.");
    }

    const email = payload.data?.email?.trim().toLowerCase();

    if (!email) {
      throw new UnauthorizedException("El token CRM no identifica una cuenta de correo.");
    }

    const crmUser = await this.findActiveCrmSessionUser(email, token);

    if (!crmUser) {
      throw new UnauthorizedException("La sesión CRM ya no está activa.");
    }

    return {
      idAdmin: crmUser.idAdmin,
      idNetSuiteAdmin: crmUser.idNetSuiteAdmin,
      roleId: crmUser.roleId,
      email: crmUser.emailAdmin,
      name: crmUser.nameAdmin,
      entraObjectId: null,
      authSource: "crm",
    };
  }

  /**
   * Verifica firma y claims de seguridad del access token.
   *
   * @param token - JWT compacto
   * @returns Payload tipado tras pasar tenant, cliente y scope
   */
  private async verifyAccessToken(token: string): Promise<EntraAccessTokenPayload> {
    const decoded = decode(token, { complete: true });
    const keyId = decoded && typeof decoded !== "string" ? decoded.header.kid : undefined;

    if (!keyId) {
      throw new UnauthorizedException("Token de acceso inválido.");
    }

    try {
      const signingKey = await this.jwks.getSigningKey(keyId);
      const payload = await this.verifySignature(token, signingKey.getPublicKey());

      this.assertTenant(payload);
      this.assertClient(payload);
      this.assertScope(payload);

      return payload;
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }

      throw new UnauthorizedException("Token de acceso inválido o vencido.");
    }
  }

  /**
   * Verifica la firma RS256 y los claims estándar (aud / iss / exp).
   *
   * @param token - JWT compacto
   * @param publicKey - Clave pública JWKS correspondiente al `kid`
   */
  private verifySignature(token: string, publicKey: string): Promise<EntraAccessTokenPayload> {
    const audienceOption =
      this.audiences.length === 1 ? this.audiences[0] : ([this.audiences[0], ...this.audiences.slice(1)] as [string, ...string[]]);

    return new Promise((resolve, reject) => {
      verify(
        token,
        publicKey,
        {
          algorithms: ["RS256"],
          audience: audienceOption,
          // Tolerancia corta para desfase de reloj entre API e IdP.
          clockTolerance: 5,
          issuer: this.issuer,
        },
        (error: Error | null, payload) => {
          if (error || !payload || typeof payload === "string") {
            reject(error ?? new Error("Invalid access token payload"));
            return;
          }

          resolve(payload as EntraAccessTokenPayload);
        },
      );
    });
  }

  /** Rechaza tokens emitidos por un tenant distinto al configurado. */
  private assertTenant(payload: EntraAccessTokenPayload): void {
    if (payload.tid !== this.tenantId) {
      throw new UnauthorizedException("El token pertenece a un tenant no autorizado.");
    }
  }

  /**
   * Restringe el acceso a aplicaciones cliente allowlisted.
   *
   * Si la lista está vacía, no aplica filtro (útil en entornos de prueba
   * controlados); en producción se espera al menos un client id.
   */
  private assertClient(payload: EntraAccessTokenPayload): void {
    if (this.allowedClientIds.length === 0) {
      return;
    }

    const clientId = payload.azp ?? payload.appid;

    if (!clientId || !this.allowedClientIds.includes(clientId)) {
      throw new UnauthorizedException("La aplicación cliente no está autorizada.");
    }
  }

  /** Exige el scope OAuth configurado para operar esta API. */
  private assertScope(payload: EntraAccessTokenPayload): void {
    const scopes = new Set((payload.scp ?? "").split(/\s+/).filter(Boolean));

    if (!scopes.has(this.requiredScope)) {
      throw new UnauthorizedException("El token no contiene el permiso requerido.");
    }
  }

  /**
   * Obtiene el correo del token en orden de claims más confiables.
   *
   * Normaliza a minúsculas para alinear con la comparación case-insensitive
   * contra `email_admin` en MySQL.
   */
  private resolveEmail(payload: EntraAccessTokenPayload): string {
    const email = payload.preferred_username ?? payload.email ?? payload.upn;

    if (!email?.trim()) {
      throw new UnauthorizedException("El token no identifica una cuenta de correo.");
    }

    return email.trim().toLowerCase();
  }

  /**
   * Busca un administrador CRM activo por correo.
   *
   * Solo `status_admin = 1` puede operar; cuentas deshabilitadas se tratan
   * como no autenticadas aunque el JWT Entra siga siendo válido.
   */
  private async findActiveCrmUser(email: string): Promise<CrmAdminRow | null> {
    const rows = (await this.dataSource.query(
      `
        SELECT
          admin.id_admin AS idAdmin,
          admin.idnetsuite_admin AS idNetSuiteAdmin,
          admin.id_rol_admin AS roleId,
          admin.email_admin AS emailAdmin,
          admin.name_admin AS nameAdmin
        FROM admins admin
        WHERE LOWER(admin.email_admin) = ?
          AND admin.status_admin = 1
        LIMIT 1
      `,
      [email],
    )) as CrmAdminRow[];

    return rows[0] ?? null;
  }

  /**
   * Busca una sesión CRM vigente por correo y `token_admin` exacto.
   *
   * La comparación con el token persistido permite revocar sesiones desde el
   * CRM legacy sin depender solo de la expiración del JWT.
   */
  private async findActiveCrmSessionUser(email: string, token: string): Promise<CrmAdminRow | null> {
    const rows = (await this.dataSource.query(
      `
        SELECT
          admin.id_admin AS idAdmin,
          admin.idnetsuite_admin AS idNetSuiteAdmin,
          admin.id_rol_admin AS roleId,
          admin.email_admin AS emailAdmin,
          admin.name_admin AS nameAdmin
        FROM admins admin
        WHERE LOWER(admin.email_admin) = ?
          AND admin.token_admin = ?
          AND admin.status_admin = 1
        LIMIT 1
      `,
      [email, token],
    )) as CrmAdminRow[];

    return rows[0] ?? null;
  }
}
