import { Injectable, Logger, Optional, ServiceUnavailableException, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Prisma } from "@prisma/client";
import { z } from "zod";

import { requireConfiguredSecret } from "../../common/security/require-configured-secret";
import { ENVIO_TEMPLATE_INICIAL_ENV_KEYS, ENVIO_TEMPLATE_INICIAL_TEMPLATE_NAME } from "./envio-template-inicial.constants";
import { createSaludoTemplatePayload } from "./kapso-template-message.payload";
import { SendSaludoTemplateInput, SendSaludoTemplateResult } from "./kapso-template-message.types";

export type { SendSaludoTemplateInput, SendSaludoTemplateResult } from "./kapso-template-message.types";

const KAPSO_META_WHATSAPP_URL = "https://api.kapso.ai/meta/whatsapp/v24.0";
const MARKETING_MESSAGES_PATH = "marketing_messages";
/** Mismo header que Platform (`kapso-api.constants`); no importar integrations para no acoplar features. */
const KAPSO_API_KEY_HEADER = "X-API-Key";

const KAPSO_TEMPLATE_SEND_EVENTS = {
    FAILED: "kapso.template.send.failed",
    REQUEST: "kapso.template.send.request",
    SUCCESS: "kapso.template.send.success",
    UNUSABLE_RESPONSE: "kapso.template.send.unusable_response",
} as const;

const sendMessageResponseSchema = z
    .object({
        messages: z.array(z.object({ id: z.string().min(1) })).min(1),
    })
    .passthrough();

const kapsoErrorSchema = z
    .object({
        code: z.string().optional(),
        error: z.union([z.string(), z.object({ message: z.string().optional() }).passthrough()]),
    })
    .passthrough();

type Fetcher = (input: string, init: RequestInit) => Promise<Response>;

/**
 * Cliente minimo para enviar el template aprobado `saludo`.
 *
 * No conoce reglas CRM: solo arma payload Kapso, ejecuta HTTP y valida la
 * respuesta. El service decide a quien enviar y que escribir en bitacora.
 */
@Injectable()
export class KapsoTemplateMessageClient {
    private readonly logger = new Logger(KapsoTemplateMessageClient.name);

    constructor(
        private readonly configService: ConfigService,
        @Optional() private readonly fetcher: Fetcher = fetch,
    ) {}

    async sendSaludoTemplate(input: SendSaludoTemplateInput): Promise<SendSaludoTemplateResult> {
        const apiKey = requireConfiguredSecret(this.configService.get<string>(ENVIO_TEMPLATE_INICIAL_ENV_KEYS.API_KEY), ENVIO_TEMPLATE_INICIAL_ENV_KEYS.API_KEY);

        this.logRequest(input);

        const response = await this.fetcher(createMarketingMessagesUrl(input.phoneNumberId), {
            body: JSON.stringify(createSaludoTemplatePayload(input)),
            headers: createKapsoJsonHeaders(apiKey),
            method: "POST",
        });

        if (response.status === 401) {
            throw new UnauthorizedException("Kapso API key was rejected");
        }

        const body = await readJsonBody(response);

        if (!response.ok) {
            this.logRejectedResponse(input, response.status, body);
            throw new ServiceUnavailableException(formatKapsoError(response.status, body));
        }

        const parsed = sendMessageResponseSchema.safeParse(body);

        if (!parsed.success) {
            this.logUnusableResponse(input, response.status, body);
            throw new ServiceUnavailableException("Kapso template response is not usable");
        }

        const messageIds = parsed.data.messages.map((message) => message.id);

        this.logSuccess(input, response.status, messageIds, parsed.data);

        return {
            messageIds,
            rawResponse: parsed.data as Prisma.InputJsonObject,
        };
    }

    private logRequest(input: SendSaludoTemplateInput): void {
        this.logger.log({
            event: KAPSO_TEMPLATE_SEND_EVENTS.REQUEST,
            leadId: input.leadId,
            phoneNumberId: input.phoneNumberId,
            template: ENVIO_TEMPLATE_INICIAL_TEMPLATE_NAME,
            to: maskPhoneNumber(input.to),
        });
    }

    private logRejectedResponse(input: SendSaludoTemplateInput, status: number, body: unknown): void {
        this.logger.warn({
            body,
            event: KAPSO_TEMPLATE_SEND_EVENTS.FAILED,
            leadId: input.leadId,
            phoneNumberId: input.phoneNumberId,
            status,
        });
    }

    private logUnusableResponse(input: SendSaludoTemplateInput, status: number, body: unknown): void {
        this.logger.warn({
            body,
            event: KAPSO_TEMPLATE_SEND_EVENTS.UNUSABLE_RESPONSE,
            leadId: input.leadId,
            phoneNumberId: input.phoneNumberId,
            status,
        });
    }

    private logSuccess(input: SendSaludoTemplateInput, status: number, messageIds: string[], response: z.infer<typeof sendMessageResponseSchema>): void {
        this.logger.log({
            event: KAPSO_TEMPLATE_SEND_EVENTS.SUCCESS,
            leadId: input.leadId,
            messageIds,
            phoneNumberId: input.phoneNumberId,
            response,
            status,
        });
    }
}

function createMarketingMessagesUrl(phoneNumberId: string): string {
    return `${KAPSO_META_WHATSAPP_URL}/${encodeURIComponent(phoneNumberId)}/${MARKETING_MESSAGES_PATH}`;
}

function createKapsoJsonHeaders(apiKey: string): HeadersInit {
    return {
        "Content-Type": "application/json",
        [KAPSO_API_KEY_HEADER]: apiKey,
    };
}

async function readJsonBody(response: Response): Promise<unknown> {
    return (await response.json().catch(() => ({}))) as unknown;
}

function formatKapsoError(status: number, body: unknown): string {
    const parsed = kapsoErrorSchema.safeParse(body);

    if (!parsed.success) {
        return `Kapso template send failed with ${status}`;
    }

    const error = typeof parsed.data.error === "string" ? parsed.data.error : parsed.data.error.message;
    const code = parsed.data.code ? ` (${parsed.data.code})` : "";

    return `Kapso template send failed with ${status}${code}: ${error || "unknown error"}`;
}

function maskPhoneNumber(value: string): string {
    return value.length > 4 ? `${"*".repeat(value.length - 4)}${value.slice(-4)}` : "****";
}
