import { Injectable, Optional, ServiceUnavailableException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { z } from "zod";

import { KAPSO_API_ENV_KEYS, KAPSO_WHATSAPP_WEBHOOKS_URL } from "./kapso-api.constants";
import { createKapsoApiKeyHeaders, createKapsoJsonHeaders } from "./read-kapso-api-key";

export const KAPSO_WHATSAPP_WEBHOOK_EVENTS = ["whatsapp.message.received", "whatsapp.message.sent", "whatsapp.conversation.created", "whatsapp.conversation.inactive", "whatsapp.conversation.ended", "whatsapp.contact.identity_changed", "whatsapp.contact.marketing_preference_changed", "whatsapp.message.delivered", "whatsapp.message.read", "whatsapp.message.failed"] as const;

const webhookSchema = z
    .object({
        active: z.boolean().optional(),
        events: z.array(z.string()).optional(),
        id: z.string().optional(),
        phone_number_id: z.string().nullish(),
        url: z.string().optional(),
    })
    .passthrough();

const webhooksResponseSchema = z.object({
    data: z.array(z.unknown()).default([]),
});

const createWebhookResponseSchema = z.object({
    data: z.object({ id: z.string().optional() }).passthrough(),
});

export type KapsoPhoneWebhookEnsureResult = {
    readonly action: "created" | "exists" | "updated";
    readonly webhookId: string | null;
};

type Fetcher = (input: string, init: RequestInit) => Promise<Response>;

type KapsoWebhookConfig = {
    readonly apiKey: string;
    readonly destinationUrl: string;
    readonly secret: string;
};

type ExistingWebhook = {
    readonly hasRequiredEvents: boolean;
    readonly id: string | null;
};

/**
 * Asegura el webhook WhatsApp por numero sin crear duplicados.
 *
 * Orden: lista → si existe con todos los eventos, no-op; si existe incompleto,
 * PATCH; si no existe, POST. El secret WhatsApp gana sobre el de Platform.
 */
@Injectable()
export class KapsoPhoneWebhookClient {
    constructor(
        private readonly configService: ConfigService,
        @Optional() private readonly fetcher: Fetcher = fetch,
    ) {}

    async ensureWhatsappWebhook(phoneNumberId: string): Promise<KapsoPhoneWebhookEnsureResult> {
        const config = this.readConfig();
        const existingWebhook = await this.findExistingWebhook(phoneNumberId, config);

        if (existingWebhook?.hasRequiredEvents) {
            return { action: "exists", webhookId: existingWebhook.id };
        }

        if (existingWebhook?.id) {
            await this.updateWebhook(existingWebhook.id, config);
            return { action: "updated", webhookId: existingWebhook.id };
        }

        return this.createWebhook(config, phoneNumberId);
    }

    private async findExistingWebhook(phoneNumberId: string, config: KapsoWebhookConfig): Promise<ExistingWebhook | null> {
        const response = await this.fetcher(`${KAPSO_WHATSAPP_WEBHOOKS_URL}?per_page=100&page=1`, {
            headers: createKapsoApiKeyHeaders(config.apiKey),
            method: "GET",
        });

        if (!response.ok) {
            throw new ServiceUnavailableException(`Kapso webhook list failed with ${response.status}`);
        }

        const body = webhooksResponseSchema.parse(await response.json());
        const existing = body.data.map((item) => webhookSchema.safeParse(item)).find((result) => result.success && isMatchingWebhook(result.data, phoneNumberId, config.destinationUrl));

        if (!existing?.success) {
            return null;
        }

        return {
            hasRequiredEvents: hasRequiredEvents(existing.data.events),
            id: existing.data.id ?? null,
        };
    }

    private async updateWebhook(webhookId: string, config: KapsoWebhookConfig): Promise<void> {
        const response = await this.fetcher(`${KAPSO_WHATSAPP_WEBHOOKS_URL}/${encodeURIComponent(webhookId)}`, {
            body: JSON.stringify(createWebhookPayload(config)),
            headers: createKapsoJsonHeaders(config.apiKey),
            method: "PATCH",
        });

        if (!response.ok) {
            throw new ServiceUnavailableException(`Kapso webhook update failed with ${response.status}`);
        }
    }

    private async createWebhook(config: KapsoWebhookConfig, phoneNumberId: string): Promise<KapsoPhoneWebhookEnsureResult> {
        const response = await this.fetcher(KAPSO_WHATSAPP_WEBHOOKS_URL, {
            body: JSON.stringify(createWebhookPayload(config, phoneNumberId)),
            headers: createKapsoJsonHeaders(config.apiKey),
            method: "POST",
        });

        if (!response.ok) {
            throw new ServiceUnavailableException(`Kapso webhook creation failed with ${response.status}`);
        }

        const body = createWebhookResponseSchema.parse(await response.json());
        return { action: "created", webhookId: body.data.id ?? null };
    }

    private readConfig(): KapsoWebhookConfig {
        const apiKey = this.configService.get<string>(KAPSO_API_ENV_KEYS.API_KEY);
        const destinationUrl = this.configService.get<string>(KAPSO_API_ENV_KEYS.WHATSAPP_WEBHOOK_URL);
        const secret = this.configService.get<string>(KAPSO_API_ENV_KEYS.WHATSAPP_WEBHOOK_SECRET) ?? this.configService.get<string>(KAPSO_API_ENV_KEYS.PLATFORM_WEBHOOK_SECRET);

        // Los tres son un paquete: sin URL o secret no tiene sentido llamar a Kapso.
        if (!apiKey || !destinationUrl || !secret) {
            throw new ServiceUnavailableException("Kapso WhatsApp webhook config is not configured");
        }

        return { apiKey, destinationUrl, secret };
    }
}

function isMatchingWebhook(webhook: { readonly active?: boolean | undefined; readonly phone_number_id?: string | null | undefined; readonly url?: string | undefined }, phoneNumberId: string, destinationUrl: string): boolean {
    return webhook.active === true && webhook.phone_number_id === phoneNumberId && webhook.url === destinationUrl;
}

function hasRequiredEvents(events: string[] | undefined): boolean {
    return Boolean(events && KAPSO_WHATSAPP_WEBHOOK_EVENTS.every((event) => events.includes(event)));
}

function createWebhookPayload(
    config: KapsoWebhookConfig,
    phoneNumberId?: string,
): {
    readonly whatsapp_webhook: {
        readonly active: true;
        readonly events: typeof KAPSO_WHATSAPP_WEBHOOK_EVENTS;
        readonly phone_number_id?: string;
        readonly secret_key: string;
        readonly url: string;
    };
} {
    return {
        whatsapp_webhook: {
            active: true,
            events: KAPSO_WHATSAPP_WEBHOOK_EVENTS,
            ...(phoneNumberId ? { phone_number_id: phoneNumberId } : {}),
            secret_key: config.secret,
            url: config.destinationUrl,
        },
    };
}
