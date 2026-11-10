import { SetMetadata } from "@nestjs/common";

export const ROUTE_SECURITY_METADATA = "crm:route-security";

/**
 * Clasificacion de acceso de la ruta. El guard niega si falta.
 *
 * - `public`: no exige sesion de acceso. CSRF, el reto OIDC, el refresh y el
 *   reset siguen aplicando en su propio guard o prueba.
 * - `authenticated`: exige perfil vigente y nada mas en esta capa.
 * - `permission`: ademas exige el descriptor local de `RequirePermission`.
 *   Sin ese descriptor la ruta falla cerrada. La fila, el recurso y la
 *   condicion de negocio siguen en el servicio: este metadato no los reemplaza.
 */
export const RouteSecurity = (classification: "public" | "authenticated" | "permission"): MethodDecorator => SetMetadata(ROUTE_SECURITY_METADATA, classification);
