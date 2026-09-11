import type { RawBodyRequest } from "@nestjs/common";
import type { Request } from "express";

import { readWebhookRawBody } from "../../../src/common/webhooks/read-webhook-raw-body";

describe("readWebhookRawBody", () => {
    it("prefers rawBody bytes over a re-serialized JSON body", () => {
        const request = {
            body: { phone_number_id: "parsed" },
            rawBody: Buffer.from('{"phone_number_id":"wire"}'),
        } as RawBodyRequest<Request>;

        expect(readWebhookRawBody(request)).toBe('{"phone_number_id":"wire"}');
    });

    it("falls back to JSON.stringify when rawBody is absent", () => {
        const request = {
            body: { phone_number_id: "parsed" },
        } as RawBodyRequest<Request>;

        expect(readWebhookRawBody(request)).toBe('{"phone_number_id":"parsed"}');
    });

    it("does not treat an empty Buffer as absent", () => {
        const request = {
            body: { fallback: true },
            rawBody: Buffer.alloc(0),
        } as RawBodyRequest<Request>;

        expect(readWebhookRawBody(request)).toBe("");
    });
});
