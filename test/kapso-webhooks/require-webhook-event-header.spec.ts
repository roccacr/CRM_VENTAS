import { BadRequestException } from "@nestjs/common";

import { requireWebhookEventHeader } from "../../src/kapso-webhooks/require-webhook-event-header";

describe("requireWebhookEventHeader", () => {
    it("returns a usable event name", () => {
        expect(requireWebhookEventHeader("whatsapp.phone_number.created")).toBe("whatsapp.phone_number.created");
    });

    it("trims surrounding whitespace", () => {
        expect(requireWebhookEventHeader("  whatsapp.message.received  ")).toBe("whatsapp.message.received");
    });

    it("rejects a missing header", () => {
        expect(() => requireWebhookEventHeader(undefined)).toThrow(BadRequestException);
    });

    it("rejects whitespace-only as missing", () => {
        expect(() => requireWebhookEventHeader("   ")).toThrow(BadRequestException);
    });
});
