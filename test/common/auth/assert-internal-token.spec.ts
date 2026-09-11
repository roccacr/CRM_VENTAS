import { ServiceUnavailableException, UnauthorizedException } from "@nestjs/common";

import { assertInternalToken } from "../../../src/common/auth/assert-internal-token";

describe("assertInternalToken", () => {
    it("accepts a matching token", () => {
        expect(() =>
            assertInternalToken({
                expectedToken: "crm-token",
                receivedToken: "crm-token",
                serviceLabel: "CRM",
            }),
        ).not.toThrow();
    });

    it("fails closed with 503 when the server token is missing", () => {
        expect(() =>
            assertInternalToken({
                expectedToken: undefined,
                receivedToken: "crm-token",
                serviceLabel: "CRM",
            }),
        ).toThrow(ServiceUnavailableException);
    });

    it("fails closed with 503 when the server token is empty", () => {
        expect(() =>
            assertInternalToken({
                expectedToken: "",
                receivedToken: "crm-token",
                serviceLabel: "CRM",
            }),
        ).toThrow(ServiceUnavailableException);
    });

    it("rejects a missing client token with 401", () => {
        expect(() =>
            assertInternalToken({
                expectedToken: "crm-token",
                receivedToken: undefined,
                serviceLabel: "CRM",
            }),
        ).toThrow(UnauthorizedException);
    });

    it("rejects a different-length token without throwing a crypto TypeError", () => {
        expect(() =>
            assertInternalToken({
                expectedToken: "crm-token",
                receivedToken: "short",
                serviceLabel: "CRM",
            }),
        ).toThrow(UnauthorizedException);
    });
});
