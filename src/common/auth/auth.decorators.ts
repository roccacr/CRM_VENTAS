/**
 * Decoradores y claves de metadata de autenticación CRM.
 *
 * Centralizan el marcado de rutas públicas y roles requeridos para que el
 * guard de Entra lea una sola fuente de verdad vía Reflector, sin acoplar
 * controladores a la lógica de verificación JWT.
 */
import { SetMetadata } from "@nestjs/common";

/** Clave de metadata que indica que la ruta no exige autenticación Bearer. */
export const IS_PUBLIC_ROUTE = "isPublicRoute";

/** Clave de metadata con los IDs de rol CRM permitidos en la ruta. */
export const REQUIRED_CRM_ROLES = "requiredCrmRoles";

/**
 * Marca un controlador o handler como público.
 *
 * Se usa para health checks y endpoints de webhook donde el cliente no envía
 * token de Entra; el guard omite la validación cuando encuentra esta metadata.
 *
 * @returns Decorador que fija `IS_PUBLIC_ROUTE` en `true`
 */
export const Public = () => SetMetadata(IS_PUBLIC_ROUTE, true);

/**
 * Exige que el usuario autenticado tenga uno de los roles CRM indicados.
 *
 * Complementa la autenticación Entra con autorización de negocio del CRM,
 * evitando exponer operaciones administrativas a roles no privilegiados.
 *
 * @param roles - IDs de rol CRM (`id_rol_admin`) autorizados
 * @returns Decorador que fija `REQUIRED_CRM_ROLES` con la lista de roles
 */
export const RequireCrmRoles = (...roles: number[]) => SetMetadata(REQUIRED_CRM_ROLES, roles);
