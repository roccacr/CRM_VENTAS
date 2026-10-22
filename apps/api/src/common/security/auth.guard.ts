import { type CanActivate, type ExecutionContext, ForbiddenException, Inject, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { FastifyReply } from "fastify";

import { IdentityService } from "../../modules/crm/identity/identity.service.js";
import { AuthenticatedReadRateLimit } from "./authenticated-read-rate-limit.js";
import type { CookieRequest } from "./cookie-request.type.js";
import { SESSION_COOKIE_NAME } from "./http-security.constants.js";
import { type PermissionRequirement, REQUIRE_PERMISSION_METADATA } from "./require-permission.decorator.js";
import { hasRoutePermission } from "./route-permission.js";
import { ROUTE_SECURITY_METADATA } from "./route-security.decorator.js";

/** Default-deny authentication/permission boundary; domain and row checks remain in services. */
@Injectable()
export class AuthGuard implements CanActivate {
    /** Reuses the exported identity service and the process-local read limiter. */
    constructor(
        @Inject(Reflector) private readonly reflector: Reflector,
        @Inject(IdentityService) private readonly identity: IdentityService,
        @Inject(AuthenticatedReadRateLimit) private readonly readLimit: AuthenticatedReadRateLimit,
    ) {}

    /** Public handlers skip access authentication; other handlers must explicitly opt in. */
    async canActivate(context: ExecutionContext): Promise<boolean> {
        const classification = this.reflector.get<unknown>(ROUTE_SECURITY_METADATA, context.getHandler());
        if (classification === "public") return true;
        if (classification !== "authenticated" && classification !== "permission") {
            throw new ForbiddenException("Permiso insuficiente.");
        }
        const request = context.switchToHttp().getRequest<CookieRequest>();
        const profile = await this.identity.getCurrentUser(request.cookies[SESSION_COOKIE_NAME]);
        if (classification === "permission" && !hasRoutePermission(profile, this.reflector.get<PermissionRequirement>(REQUIRE_PERMISSION_METADATA, context.getHandler()), request)) {
            throw new ForbiddenException("Permiso insuficiente.");
        }
        if (request.method === "GET" || request.method === "HEAD") {
            return this.readLimit.enforceAuthenticatedReadLimit(request, context.switchToHttp().getResponse<FastifyReply>(), profile.user.publicId);
        }
        return true;
    }
}
