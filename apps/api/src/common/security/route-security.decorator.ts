import { SetMetadata } from "@nestjs/common";

export const ROUTE_SECURITY_METADATA = "crm:route-security";

/** AuthGuard requires a current profile for authenticated/permission classifications.
 * Permission is an inventory category: exact permissions/row scopes remain enforced by services.
 * Public means no access-session prerequisite; CSRF, OIDC, refresh and reset proofs still apply.
 */
export const RouteSecurity = (classification: "public" | "authenticated" | "permission"): MethodDecorator => SetMetadata(ROUTE_SECURITY_METADATA, classification);
