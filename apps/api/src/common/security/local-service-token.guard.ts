import { createHash, timingSafeEqual } from "node:crypto";

import { applyDecorators, type CanActivate, type ExecutionContext, ForbiddenException, Inject, Injectable, SetMetadata, UnauthorizedException, UseGuards } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

import type { CookieRequest } from "./cookie-request.type.js";

const LOCAL_SERVICE_TOKEN_METADATA = "crm:local-service-token";
/** Machine proof is independent of browser cookies; enabled exclusively in development. */
export function assertLocalServiceToken(config: ConfigService, request: Pick<CookieRequest, "headers">): void {
    const secret = config.get<string>("NETSUITE_LOCAL_EVENTS_SECRET");
    if (config.get<string>("NODE_ENV") !== "development" || config.get<boolean>("NETSUITE_LOCAL_EVENTS_ENABLED") !== true || !secret || !/^[a-f0-9]{64}$/.test(secret)) throw new ForbiddenException("Receptor local no habilitado.");
    const header = request.headers.authorization;
    const supplied = typeof header === "string" && /^Bearer [a-f0-9]{64}$/.test(header) ? header.slice(7) : "";
    if (!timingSafeEqual(createHash("sha256").update(secret).digest(), createHash("sha256").update(supplied).digest())) throw new UnauthorizedException("Credencial de integracion invalida.");
}
/** Only marked handlers may substitute machine authentication for CSRF proof. */
export function hasLocalServiceToken(handler: object): boolean {
    return Reflect.getMetadata(LOCAL_SERVICE_TOKEN_METADATA, handler) === true;
}
/** Independently rechecks machine proof even when global CSRF registration changes. */
@Injectable()
export class LocalServiceTokenGuard implements CanActivate {
    /** Uses validated runtime configuration; no request can choose the secret. */
    constructor(@Inject(ConfigService) private readonly config: ConfigService) {}
    /** Rejects missing credentials and any non-development execution. */
    canActivate(context: ExecutionContext): boolean {
        assertLocalServiceToken(this.config, context.switchToHttp().getRequest<CookieRequest>());
        return true;
    }
}
/** Keep metadata and the independent route guard together; public alone never exempts CSRF. */
export function LocalServiceToken(): MethodDecorator {
    return applyDecorators(SetMetadata(LOCAL_SERVICE_TOKEN_METADATA, true), UseGuards(LocalServiceTokenGuard));
}
