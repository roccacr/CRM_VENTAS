import { toDataEnvelope } from "../../src/kapso-integrations/to-data-envelope";

describe("toDataEnvelope", () => {
    it("wraps a list payload", () => {
        expect(toDataEnvelope([{ id: "1" }])).toEqual({ data: [{ id: "1" }] });
    });

    it("wraps null without inventing a fallback", () => {
        expect(toDataEnvelope(null)).toEqual({ data: null });
    });

    it("wraps a primitive", () => {
        expect(toDataEnvelope(true)).toEqual({ data: true });
    });
});
