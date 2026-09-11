import { extractLeadIdFromPayload, extractResponseText, normalizeResponseText, readStringPath } from "../../src/kapso-webhooks/kapso-whatsapp-webhook.payload";

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
