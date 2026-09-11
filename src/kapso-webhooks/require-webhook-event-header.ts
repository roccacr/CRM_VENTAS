import { BadRequestException } from "@nestjs/common";

import { toNonEmptyHeader } from "../common/http/headers";

/**
 * Exige `X-Webhook-Event` no vacio.
 * El guard de firma ya corrio: aca solo validamos el header de routing.
 *
 * @throws {BadRequestException} Si el header falta o es whitespace
 */
export function requireWebhookEventHeader(event: string | undefined): string {
    const eventName = toNonEmptyHeader(event);

    if (!eventName) {
        throw new BadRequestException("Missing X-Webhook-Event header");
    }

    return eventName;
}
