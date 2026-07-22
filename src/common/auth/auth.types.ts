/**
 * Tipos compartidos del flujo de autenticación Entra ID ↔ CRM.
 *
 * Desacoplan el payload JWT de Microsoft del modelo de usuario interno del CRM,
 * de modo que guards y servicios trabajen con contratos estables y tipados.
 */
import { JwtPayload } from "jsonwebtoken";

/**
 * Claims relevantes de un access token de Microsoft Entra ID.
 *
 * Extiende `JwtPayload` con campos usados para validar tenant, cliente,
 * alcance (scope) e identidad de correo al mapear contra `admins` del CRM.
 */
export type EntraAccessTokenPayload = JwtPayload & {
  /** Application ID del cliente que obtuvo el token (azp / appid). */
  azp?: string;
  /** Alias legacy del client id en tokens v1. */
  appid?: string;
  /** Correo del usuario si el IdP lo emite en el claim `email`. */
  email?: string;
  /** Object ID único del usuario en el tenant de Entra. */
  oid?: string;
  /** Nombre de usuario preferido (suele ser el UPN / correo). */
  preferred_username?: string;
  /** Scopes OAuth2 separados por espacio. */
  scp?: string;
  /** Tenant ID emisor del token. */
  tid?: string;
  /** User Principal Name; fallback de identidad cuando no hay email. */
  upn?: string;
};

/**
 * Usuario CRM autenticado adjunto al request HTTP.
 *
 * Representa la identidad de negocio ya validada (Entra + admin activo),
 * para que controladores lean datos del CRM sin reconsultar JWT ni BD.
 */
export type AuthenticatedCrmUser = {
  /** PK del administrador en la tabla `admins`. */
  idAdmin: number;
  /** ID de empleado NetSuite vinculado, si existe. */
  idNetSuiteAdmin: number | null;
  /** Rol CRM usado para autorización por endpoint. */
  roleId: number;
  /** Correo canónico del admin en el CRM. */
  email: string;
  /** Nombre visible del administrador. */
  name: string;
  /** Object ID de Entra; null si el token no lo trae. */
  entraObjectId: string | null;
};
