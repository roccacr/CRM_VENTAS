import { createHash, timingSafeEqual } from "node:crypto";

import { applyDecorators, type CanActivate, type ExecutionContext, ForbiddenException, Inject, Injectable, SetMetadata, UnauthorizedException, UseGuards } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

import type { CookieRequest } from "./cookie-request.type.js";

const LOCAL_SERVICE_TOKEN_METADATA = "crm:local-service-token";
/** Machine proof is independent of browser cookies; bound to the deployment environment. */
export function assertLocalServiceToken(config: ConfigService, request: Pick<CookieRequest, "headers">, environment: "sandbox" | "production" = "sandbox"): void {
    const production = environment === "production";
    const prefix = { production: "NETSUITE_PRODUCTION_EVENTS", sandbox: "NETSUITE_LOCAL_EVENTS" }[environment];
    const secret = config.get<string>(prefix + "_SECRET");
    if (!secret) throw new ForbiddenException("Receptor NetSuite no habilitado.");
    if (![isNetsuiteEventReceiverEnabled(config, environment), /^[a-f0-9]{64}$/.test(secret), !production || secret !== config.get<string>("NETSUITE_LOCAL_EVENTS_SECRET")].every(Boolean)) throw new ForbiddenException("Receptor NetSuite no habilitado.");
    const header = request.headers.authorization;
    const supplied = typeof header === "string" && /^Bearer [a-f0-9]{64}$/.test(header) ? header.slice(7) : "";
    if (!timingSafeEqual(createHash("sha256").update(secret).digest(), createHash("sha256").update(supplied).digest())) throw new UnauthorizedException("Credencial de integracion invalida.");
}
/** Deployment gates are reused by HTTP authentication and direct durable writes. */
export function isNetsuiteEventReceiverEnabled(config: ConfigService, environment: "sandbox" | "production"): boolean {
    const production = environment === "production";
    const prefix = production ? "NETSUITE_PRODUCTION_EVENTS" : "NETSUITE_LOCAL_EVENTS";
    const deployment = !production || [config.get<string>("FRONTEND_ORIGIN") === "https://habita.roccacr.com", config.get<string>("NETSUITE_ENVIRONMENT") === "production"].every(Boolean);
    return [config.get<boolean>(prefix + "_ENABLED") === true, config.get<string>("NODE_ENV") === (production ? "production" : "development"), deployment].every(Boolean);
}
/** Only marked handlers may substitute machine authentication for CSRF proof. */
export function hasLocalServiceToken(handler: object): boolean {
    return getServiceTokenEnvironment(handler) !== undefined;
}
/** Environment is selected by route metadata, never by request headers or body. */
export function getServiceTokenEnvironment(handler: object): "sandbox" | "production" | undefined {
    const value: unknown = Reflect.getMetadata(LOCAL_SERVICE_TOKEN_METADATA, handler);
    return value === "production" ? "production" : value === "sandbox" ? "sandbox" : undefined;
}
/** Independently rechecks machine proof even when global CSRF registration changes. */
@Injectable()
export class LocalServiceTokenGuard implements CanActivate {
    /** Uses validated runtime configuration; no request can choose the secret. */
    constructor(@Inject(ConfigService) private readonly config: ConfigService) {}
    /** Rejects missing credentials and execution in a different deployment environment. */
    canActivate(context: ExecutionContext): boolean {
        assertLocalServiceToken(this.config, context.switchToHttp().getRequest<CookieRequest>(), getServiceTokenEnvironment(context.getHandler()));
        return true;
    }
}
/** Keep metadata and the independent route guard together; public alone never exempts CSRF. */
export function LocalServiceToken(environment: "sandbox" | "production" = "sandbox"): MethodDecorator {
    return applyDecorators(SetMetadata(LOCAL_SERVICE_TOKEN_METADATA, environment), UseGuards(LocalServiceTokenGuard));
}
