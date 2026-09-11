import { Body, Controller, Headers, HttpCode, HttpStatus, Post, UseGuards } from "@nestjs/common";
import { ApiHeader, ApiOkResponse, ApiOperation, ApiTags, ApiUnauthorizedResponse } from "@nestjs/swagger";

import { toNonEmptyHeader } from "../common/http/headers";
import { KapsoPlatformWebhookService } from "./kapso-platform-webhook.service";
import { KAPSO_WEBHOOK_HEADERS } from "./kapso-webhook.constants";
import { KapsoWebhookSignatureGuard } from "./kapso-webhook-signature.guard";
import { requireWebhookEventHeader } from "./require-webhook-event-header";

/**
 * `POST /api/v1/webhooks/kapso/platform`
 *
 * Orden real:
 *   1. Guard HMAC → 503 si falta secreto, 401 si firma mala.
 *   2. Exigir `X-Webhook-Event` (400 si falta / blank).
 *   3. Delegar al service de dominio.
 *
 * `X-Idempotency-Key` se acepta y se reenvia; el service Platform aun no deduplica.
 */
@ApiTags("Kapso webhooks")
@UseGuards(KapsoWebhookSignatureGuard)
@Controller("webhooks/kapso")
export class KapsoPlatformWebhookController {
    constructor(private readonly platformWebhookService: KapsoPlatformWebhookService) {}

    @Post("platform")
    @ApiOperation({ summary: "Receive Kapso Platform project webhooks." })
    @ApiHeader({ name: "X-Webhook-Signature", required: true })
    @ApiHeader({ name: "X-Webhook-Event", required: true })
    @ApiHeader({ name: "X-Idempotency-Key", required: false })
    @ApiOkResponse({ description: "Webhook accepted." })
    @ApiUnauthorizedResponse({ description: "Invalid webhook signature." })
    @HttpCode(HttpStatus.OK)
    async receivePlatformWebhook(@Body() payload: unknown, @Headers(KAPSO_WEBHOOK_HEADERS.EVENT) event: string | undefined, @Headers(KAPSO_WEBHOOK_HEADERS.IDEMPOTENCY_KEY) idempotencyKey: string | undefined): Promise<{ ok: true; processed: boolean; action: "created" | "deleted" | "ignored" }> {
        const result = await this.platformWebhookService.process({
            event: requireWebhookEventHeader(event),
            idempotencyKey: toNonEmptyHeader(idempotencyKey),
            payload,
        });

        return { ok: true, ...result };
    }
}
