import { Injectable, Optional, ServiceUnavailableException, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Prisma } from "@prisma/client";
import { z } from "zod";

import { KAPSO_PHONE_NUMBERS_COLLECTION_URL, KAPSO_PHONE_NUMBER_URL, KAPSO_SYNC_STATUS_DEFAULT } from "./kapso-api.constants";
import { createKapsoApiKeyHeaders, readKapsoApiKey } from "./read-kapso-api-key";

const phoneNumberSchema = z
    .object({
        business_account_id: z.string().nullish(),
        customer_id: z.string().nullish(),
        display_name: z.string().nullish(),
        display_phone_number: z.string().nullish(),
        display_phone_number_normalized: z.string().nullish(),
        id: z.string().nullish(),
        name: z.string().nullish(),
        phone_number_id: z.string().nullish(),
        status: z.string().nullish(),
        verified_name: z.string().nullish(),
    })
    .passthrough();

const phoneNumbersResponseSchema = z.object({
    data: z.array(z.unknown()).default([]),
});

const phoneNumberResponseSchema = z.object({
    data: z.unknown(),
});

export type KapsoPlatformPhoneNumber = {
    readonly businessAccountId: string | null;
    readonly businessName: string | null;
    readonly displayPhoneNumber: string | null;
    readonly kapsoCustomerId: string | null;
    readonly kapsoPhoneNumberId: string;
    readonly phoneNumber: string | null;
    readonly rawPayload: Prisma.InputJsonValue;
    readonly status: string;
};

type Fetcher = (input: string, init: RequestInit) => Promise<Response>;

/**
 * Cliente de solo lectura para completar datos que el webhook Platform no envia.
 * Falla cerrado si Kapso no responde con el contrato esperado.
 */
@Injectable()
export class KapsoPlatformClient {
    constructor(
        private readonly configService: ConfigService,
        @Optional() private readonly fetcher: Fetcher = fetch,
    ) {}

    async listPhoneNumbers(): Promise<KapsoPlatformPhoneNumber[]> {
        const parsed = phoneNumbersResponseSchema.parse(await this.fetchJson(KAPSO_PHONE_NUMBERS_COLLECTION_URL));
        return parsed.data.flatMap(toPhoneNumber);
    }

    async getPhoneNumber(phoneNumberId: string): Promise<KapsoPlatformPhoneNumber> {
        const parsed = phoneNumberResponseSchema.parse(await this.fetchJson(createPhoneNumberUrl(phoneNumberId)));
        const item = toPhoneNumber(parsed.data).at(0);

        if (!item) {
            throw new ServiceUnavailableException("Kapso phone number response is not usable");
        }

        return item;
    }

    private async fetchJson(url: string): Promise<unknown> {
        const apiKey = readKapsoApiKey(this.configService);
        const response = await this.fetcher(url, {
            headers: createKapsoApiKeyHeaders(apiKey),
            method: "GET",
        });

        if (response.status === 401) {
            throw new UnauthorizedException("Kapso API key was rejected");
        }

        if (!response.ok) {
            throw new ServiceUnavailableException(`Kapso phone number sync failed with ${response.status}`);
        }

        return response.json();
    }
}

function createPhoneNumberUrl(phoneNumberId: string): string {
    return `${KAPSO_PHONE_NUMBER_URL}/${encodeURIComponent(phoneNumberId)}`;
}

/**
 * Kapso puede usar `phone_number_id` o `id` segun endpoint/version.
 * Sin id usable se descarta el item (no tumba el listado entero).
 */
function toPhoneNumber(item: unknown): KapsoPlatformPhoneNumber[] {
    const parsed = phoneNumberSchema.safeParse(item);

    if (!parsed.success) {
        return [];
    }

    const phoneNumberId = parsed.data.phone_number_id ?? parsed.data.id;

    if (!phoneNumberId) {
        return [];
    }

    return [
        {
            businessAccountId: parsed.data.business_account_id ?? null,
            businessName: parsed.data.verified_name ?? parsed.data.display_name ?? parsed.data.name ?? null,
            displayPhoneNumber: parsed.data.display_phone_number ?? null,
            kapsoCustomerId: parsed.data.customer_id ?? null,
            kapsoPhoneNumberId: phoneNumberId,
            phoneNumber: parsed.data.display_phone_number_normalized ?? null,
            rawPayload: parsed.data as Prisma.InputJsonObject,
            status: parsed.data.status ?? KAPSO_SYNC_STATUS_DEFAULT,
        },
    ];
}
