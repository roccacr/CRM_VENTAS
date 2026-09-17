import { extractCustomerPhoneNumber, extractFailureReason, extractLeadIdFromPayload, extractPhoneNumberId, extractReplyContextMessageId, extractResponseText, extractWhatsappMessageId, normalizeResponseText, readStringPath } from "../../src/kapso-webhooks/kapso-whatsapp-webhook.payload";

describe("normalizeResponseText", () => {
    it("collapses punctuation, case and accents", () => {
        expect(normalizeResponseText("¡Sí!! enviar información.")).toBe("si enviar informacion");
    });

    it("treats null as empty", () => {
        expect(normalizeResponseText(null)).toBe("");
    });
});

describe("extractResponseText", () => {
    it("prefers interactive button title over other paths", () => {
        expect(
            extractResponseText({
                message: {
                    interactive: { button_reply: { id: "btn-1", title: "Sí, enviar información" } },
                    text: { body: "ignored body" },
                    kapso: { content: "ignored content" },
                },
            }),
        ).toBe("Sí, enviar información");
    });

    it("reads button payload when interactive title is absent", () => {
        expect(
            extractResponseText({
                message: {
                    button: { payload: "No, gracias", text: "No, gracias" },
                    type: "button",
                },
            }),
        ).toBe("No, gracias");
    });

    it("reads message.text.body for free-text replies", () => {
        expect(extractResponseText({ message: { text: { body: "Mejor mañana" } } })).toBe("Mejor mañana");
    });
});

describe("extractWhatsappMessageId", () => {
    it("reads the simplified Kapso message id", () => {
        expect(extractWhatsappMessageId({ message: { id: "wamid.123" } })).toBe("wamid.123");
    });

    it("finds a nested wamid when Kapso sends a raw Meta payload", () => {
        expect(
            extractWhatsappMessageId({
                raw_payload: {
                    entry: [{ changes: [{ value: { statuses: [{ id: "wamid.nested" }] } }] }],
                },
            }),
        ).toBe("wamid.nested");
    });

    it("ignores non-WhatsApp ids", () => {
        expect(extractWhatsappMessageId({ message: { id: "local-id" } })).toBeNull();
    });
});

describe("extractReplyContextMessageId", () => {
    it("reads the outbound message id from an inbound reply context", () => {
        expect(extractReplyContextMessageId({ message: { context: { id: "wamid.outbound-template-1" } } })).toBe("wamid.outbound-template-1");
    });

    it("ignores local context ids that are not WhatsApp message ids", () => {
        expect(extractReplyContextMessageId({ message: { context: { id: "local-message-id" } } })).toBeNull();
    });
});

describe("extractPhoneNumberId", () => {
    it("reads the Kapso phone number id from the simplified payload", () => {
        expect(extractPhoneNumberId({ phone_number_id: "1197677976762773" })).toBe("1197677976762773");
    });

    it("reads the Kapso phone number id from conversation metadata", () => {
        expect(extractPhoneNumberId({ conversation: { phone_number_id: "1197677976762773" } })).toBe("1197677976762773");
    });
});

describe("extractCustomerPhoneNumber", () => {
    it("reads the customer phone from the conversation payload", () => {
        expect(extractCustomerPhoneNumber({ conversation: { phone_number: "+506 8832 5933" } })).toBe("+506 8832 5933");
    });

    it("reads the customer phone from Meta contacts", () => {
        expect(extractCustomerPhoneNumber({ contacts: [{ wa_id: "50688325933" }] })).toBe("50688325933");
    });
});

describe("extractFailureReason", () => {
    it("reads a direct failure reason", () => {
        expect(extractFailureReason({ message: { failure_reason: "User's number is part of an experiment" } })).toBe("User's number is part of an experiment");
    });

    it("reads Meta nested error details", () => {
        expect(
            extractFailureReason({
                raw_payload: {
                    entry: [
                        {
                            changes: [
                                {
                                    value: {
                                        statuses: [
                                            {
                                                errors: [{ error_data: { details: "Failed to send message" } }],
                                            },
                                        ],
                                    },
                                },
                            ],
                        },
                    ],
                },
            }),
        ).toBe("Failed to send message");
    });
});

describe("extractLeadIdFromPayload", () => {
    it("finds crm_lead in biz_opaque_callback_data", () => {
        expect(
            extractLeadIdFromPayload({
                tracking: { biz_opaque_callback_data: "crm_lead:36640;template:saludo" },
            }),
        ).toBe(36640);
    });

    it("finds crm_lead buried inside nested objects within depth 8", () => {
        const nested = { a: { b: { c: { d: { e: { f: { g: "crm_lead:99;template:saludo" } } } } } } };

        expect(extractLeadIdFromPayload(nested)).toBe(99);
    });

    it("ignores crm_lead markers deeper than MAX_PAYLOAD_WALK_DEPTH", () => {
        const tooDeep = { a: { b: { c: { d: { e: { f: { g: { h: { i: "crm_lead:99;template:saludo" } } } } } } } } };

        expect(extractLeadIdFromPayload(tooDeep)).toBeNull();
    });

    it("does not treat a substring like xcrm_lead:1 as a marker", () => {
        expect(extractLeadIdFromPayload({ note: "xcrm_lead:1;template:saludo" })).toBeNull();
    });
});

describe("readStringPath", () => {
    it("returns null when a path segment is missing or not an object", () => {
        expect(readStringPath({ conversation: { id: 123 } }, ["conversation", "id"])).toBeNull();
        expect(readStringPath({ conversation: null }, ["conversation", "id"])).toBeNull();
        expect(readStringPath(["conv"], ["conversation", "id"])).toBeNull();
    });
});
