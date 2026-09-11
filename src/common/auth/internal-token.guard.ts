import { CanActivate, ExecutionContext, Injectable, Type, mixin } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

import type { RequestWithHeaders } from "../http/headers";
import { assertInternalToken } from "./assert-internal-token";
import { extractBearerOrHeaderToken } from "./internal-token.util";
import type { InternalTokenGuardOptions } from "./internal-token.types";

export type { InternalTokenGuardOptions } from "./internal-token.types";

/**
 * Factory de guards de auth servicio-a-servicio.
 *
 * Cada integracion interna (CRM, y a futuro NetSuite/WhatsApp/Postventa) necesita
 * la misma politica exacta; este factory evita copiar el mixin. El guard en si
 * no decide 401 vs 503: solo adapta HTTP a `assertInternalToken`.
 *
 * Uso:
 *   export const CrmInternalTokenGuard = InternalTokenGuard({
 *     envKey: 'CRM_API_INTERNAL_TOKEN',
 *     headerName: 'x-crm-api-token',
 *     serviceLabel: 'CRM',
 *   });
 *
 *   @UseGuards(CrmInternalTokenGuard)
 */
export function InternalTokenGuard(options: InternalTokenGuardOptions): Type<CanActivate> {
    @Injectable()
    class MixinInternalTokenGuard implements CanActivate {
        constructor(private readonly configService: ConfigService) {}

        canActivate(context: ExecutionContext): boolean {
            const { headers } = context.switchToHttp().getRequest<RequestWithHeaders>();

            assertInternalToken({
                expectedToken: this.configService.get<string>(options.envKey),
                receivedToken: extractBearerOrHeaderToken(headers, options.headerName),
                serviceLabel: options.serviceLabel,
            });

            return true;
        }
    }

    return mixin(MixinInternalTokenGuard);
}
