import { CanActivate, ExecutionContext, Type } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

/**
 * ConfigService mock: mapa key→value o valor fijo para cualquier key.
 * Fail-closed de tests: no inventar defaults silenciosos.
 */
export function createConfigServiceMock(values: Record<string, string | undefined> | string | undefined): ConfigService {
    const get = typeof values === "object" && values !== null ? (key: string): string | undefined => values[key] : (): string | undefined => values;

    return { get } as unknown as ConfigService;
}

/** ExecutionContext HTTP mínimo (headers + body/rawBody opcionales). */
export function createHttpExecutionContext(options: { readonly headers?: Record<string, string | string[] | undefined>; readonly body?: unknown; readonly rawBody?: Buffer }): ExecutionContext {
    return {
        switchToHttp: () => ({
            getRequest: () => ({
                headers: options.headers ?? {},
                body: options.body,
                rawBody: options.rawBody,
            }),
        }),
    } as ExecutionContext;
}

/**
 * Instancia un guard creado con mixin() de Nest.
 * Los mixins no exponen constructor tipado; este cast es el único lugar que lo hace.
 */
export function instantiateMixinGuard(Guard: Type<CanActivate>, configService: ConfigService): { canActivate: (context: ExecutionContext) => boolean } {
    return new (
        Guard as new (config: ConfigService) => {
            canActivate: (context: ExecutionContext) => boolean;
        }
    )(configService);
}
