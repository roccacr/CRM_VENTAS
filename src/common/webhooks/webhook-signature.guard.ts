import { CanActivate, ExecutionContext, Injectable, RawBodyRequest, Type, mixin } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { Request } from "express";

import { firstHeaderValue } from "../http/headers";
import { assertWebhookSignature } from "./assert-webhook-signature";
import { readWebhookRawBody } from "./read-webhook-raw-body";
import type { WebhookSignatureGuardOptions } from "./webhook-signature.types";

export type { WebhookSignatureGuardOptions } from "./webhook-signature.types";

/**
 * Factory de guards de firma HMAC de webhooks.
 *
 * Misma idea que `InternalTokenGuard`: la politica vive una sola vez.
 * Este mixin solo adapta HTTP (`ConfigService` + header + rawBody) a
 * `assertWebhookSignature`.
 *
 * Uso:
 *   export const KapsoWebhookSignatureGuard = WebhookSignatureGuard({
 *     envKey: 'KAPSO_PLATFORM_WEBHOOK_SECRET',
 *     headerName: 'x-webhook-signature',
 *     serviceLabel: 'Kapso',
 *   });
 *
 *   @UseGuards(KapsoWebhookSignatureGuard)
 */
export function WebhookSignatureGuard(options: WebhookSignatureGuardOptions): Type<CanActivate> {
    @Injectable()
    class MixinWebhookSignatureGuard implements CanActivate {
        constructor(private readonly configService: ConfigService) {}

        canActivate(context: ExecutionContext): boolean {
            const request = context.switchToHttp().getRequest<RawBodyRequest<Request>>();

            assertWebhookSignature({
                rawBody: readWebhookRawBody(request),
                secret: this.configService.get<string>(options.envKey),
                serviceLabel: options.serviceLabel,
                signatureHeader: firstHeaderValue(request.headers[options.headerName]),
            });

            return true;
        }
    }

    return mixin(MixinWebhookSignatureGuard);
}
