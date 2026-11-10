import { createHash, timingSafeEqual } from "node:crypto";

import { applyDecorators, type CanActivate, type ExecutionContext, ForbiddenException, Inject, Injectable, SetMetadata, UnauthorizedException, UseGuards } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

import type { CookieRequest } from "./cookie-request.type.js";

const LOCAL_SERVICE_TOKEN_METADATA = "crm:local-service-token";

/**
 * Prueba de maquina para el receptor NetSuite. No usa cookies del navegador.
 *
 * El entorno lo elige la metadata de la ruta. Un header o un cuerpo no pueden
 * pedir el secreto de produccion. Receptor apagado, secreto ausente, secreto
 * que no es 64 hex o secreto de produccion igual al de sandbox responden el
 * mismo 403: no se informa cual de las compuertas fallo.
 *
 * La credencial se compara por el hash de ambos lados. Los digest miden siempre
 * 32 bytes, asi `timingSafeEqual` no revela longitud ni un prefijo del secreto.
 * Un header que no es `Bearer` y 64 hex se trata como vacio y falla en 401,
 * distinto del receptor apagado.
 */
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

/**
 * Compuertas del despliegue, compartidas por el HTTP y por la escritura durable.
 * Sandbox exige la bandera y `NODE_ENV=development`. Produccion exige ademas
 * `NODE_ENV=production`, el origen publico de Habita y `NETSUITE_ENVIRONMENT`.
 */
export function isNetsuiteEventReceiverEnabled(config: ConfigService, environment: "sandbox" | "production"): boolean {
    const production = environment === "production";
    const prefix = production ? "NETSUITE_PRODUCTION_EVENTS" : "NETSUITE_LOCAL_EVENTS";
    const deployment = !production || [config.get<string>("FRONTEND_ORIGIN") === "https://habita.roccacr.com", config.get<string>("NETSUITE_ENVIRONMENT") === "production"].every(Boolean);
    return [config.get<boolean>(prefix + "_ENABLED") === true, config.get<string>("NODE_ENV") === (production ? "production" : "development"), deployment].every(Boolean);
}

/**
 * Solo metadata exacta sustituye el CSRF. Un valor desconocido o ausente no es
 * sandbox: el parametro por defecto de `assertLocalServiceToken` no se usa para
 * decidir esta exencion.
 */
export function hasLocalServiceToken(handler: object): boolean {
    return getServiceTokenEnvironment(handler) !== undefined;
}

/** Lee el entorno escrito por el decorador. No consulta el request. */
export function getServiceTokenEnvironment(handler: object): "sandbox" | "production" | undefined {
    const value: unknown = Reflect.getMetadata(LOCAL_SERVICE_TOKEN_METADATA, handler);
    return value === "production" ? "production" : value === "sandbox" ? "sandbox" : undefined;
}

/**
 * Segunda comprobacion, independiente del guard global de CSRF. Si alguien
 * quita el registro global, la ruta marcada sigue exigiendo la credencial.
 */
@Injectable()
export class LocalServiceTokenGuard implements CanActivate {
    /** Configuracion de arranque. Ningun campo del request selecciona el secreto. */
    constructor(@Inject(ConfigService) private readonly config: ConfigService) {}

    /** Niega credencial ausente y tambien un proceso que no esta en el entorno de la ruta. */
    canActivate(context: ExecutionContext): boolean {
        assertLocalServiceToken(this.config, context.switchToHttp().getRequest<CookieRequest>(), getServiceTokenEnvironment(context.getHandler()));
        return true;
    }
}

/**
 * Metadata y guard van juntos. El default es sandbox. `public` en la ruta no
 * reemplaza este decorador y no apaga el CSRF.
 */
export function LocalServiceToken(environment: "sandbox" | "production" = "sandbox"): MethodDecorator {
    return applyDecorators(SetMetadata(LOCAL_SERVICE_TOKEN_METADATA, environment), UseGuards(LocalServiceTokenGuard));
}
