import { Body, Controller, Headers, HttpCode, HttpStatus, Post, UseGuards } from "@nestjs/common";
import { ApiHeader, ApiOkResponse, ApiOperation, ApiTags, ApiUnauthorizedResponse } from "@nestjs/swagger";

import { toNonEmptyHeader } from "../common/http/headers";
import { KAPSO_WEBHOOK_HEADERS } from "./kapso-webhook.constants";
import { KapsoWhatsappWebhookSignatureGuard } from "./kapso-whatsapp-webhook-signature.guard";
import { KapsoWhatsappWebhookResult, KapsoWhatsappWebhookService } from "./kapso-whatsapp-webhook.service";
import { requireWebhookEventHeader } from "./require-webhook-event-header";

/**
 * Receptor de eventos WhatsApp por numero.
 * Procesa solo respuestas del template `saludo`; chats completos quedan fuera.
 */
@ApiTags("Kapso webhooks")
@UseGuards(KapsoWhatsappWebhookSignatureGuard)
@Controller("webhooks/kapso")
export class KapsoWhatsappWebhookController {
    constructor(private readonly service: KapsoWhatsappWebhookService) {}

    @Post("whatsapp")
    @ApiOperation({ summary: "Receive Kapso WhatsApp number webhooks." })
    @ApiHeader({ name: "X-Webhook-Signature", required: true })
    @ApiHeader({ name: "X-Webhook-Event", required: true })
    @ApiHeader({ name: "X-Idempotency-Key", required: false })
    @ApiOkResponse({ description: "Webhook accepted." })
    @ApiUnauthorizedResponse({ description: "Invalid webhook signature." })
    @HttpCode(HttpStatus.OK)
    async receiveWhatsappWebhook(@Body() payload: unknown, @Headers(KAPSO_WEBHOOK_HEADERS.EVENT) event: string | undefined, @Headers(KAPSO_WEBHOOK_HEADERS.IDEMPOTENCY_KEY) idempotencyKey: string | undefined): Promise<{ ok: true } & KapsoWhatsappWebhookResult> {
        const result = await this.service.process({
            event: requireWebhookEventHeader(event),
            idempotencyKey: toNonEmptyHeader(idempotencyKey) ?? undefined,
            payload,
        });

        return { ok: true, ...result };
    }
}
