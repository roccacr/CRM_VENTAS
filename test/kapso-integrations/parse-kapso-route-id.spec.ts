import { NotFoundException } from "@nestjs/common";

import { parseKapsoRouteId } from "../../src/kapso-integrations/parse-kapso-route-id";

const NOT_FOUND = "Kapso WhatsApp number integration not found";

describe("parseKapsoRouteId", () => {
    it("returns a bigint for a strictly numeric id", () => {
        expect(parseKapsoRouteId("30", NOT_FOUND)).toBe(30n);
    });

    it("keeps large ids as bigint", () => {
        expect(parseKapsoRouteId("90071992547409931234", NOT_FOUND)).toBe(90071992547409931234n);
    });

    it.each(["abc", "12-3", "", "   ", "-1", "+1", "12.3", "1e3"])("answers 404 with the same message for invalid id %s", (id) => {
        expect(() => parseKapsoRouteId(id, NOT_FOUND)).toThrow(new NotFoundException(NOT_FOUND));
    });

    it("accepts numeric zero because the helper must not treat 0n as missing", () => {
        expect(parseKapsoRouteId("0", NOT_FOUND)).toBe(0n);
    });
});
