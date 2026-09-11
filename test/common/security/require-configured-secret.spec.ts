import { ServiceUnavailableException } from "@nestjs/common";

import { requireConfiguredSecret } from "../../../src/common/security/require-configured-secret";

describe("requireConfiguredSecret", () => {
    it("returns the secret when configured", () => {
        expect(requireConfiguredSecret("secret", "CRM internal token")).toBe("secret");
    });

    it("fails closed with 503 when missing or blank", () => {
        expect(() => requireConfiguredSecret(undefined, "CRM internal token")).toThrow(ServiceUnavailableException);
        expect(() => requireConfiguredSecret("", "Kapso webhook secret")).toThrow(ServiceUnavailableException);
    });

    it("keeps a whitespace-only value because the helper only treats empty string as missing", () => {
        expect(requireConfiguredSecret("   ", "CRM internal token")).toBe("   ");
    });
});
