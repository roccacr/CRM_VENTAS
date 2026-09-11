import { extractBearerOrHeaderToken } from "../../../src/common/auth/internal-token.util";

/**
 * Specs de la política de parsing (common), no del guard CRM.
 * Si cambia extractBearerOrHeaderToken, falla acá — no en cada integración.
 */
describe("extractBearerOrHeaderToken", () => {
    it("prefers Authorization Bearer over the fallback header", () => {
        expect(
            extractBearerOrHeaderToken(
                {
                    authorization: "Bearer from-bearer",
                    "x-crm-api-token": "from-header",
                },
                "x-crm-api-token",
            ),
        ).toBe("from-bearer");
    });

    it("uses the fallback header when Bearer is absent", () => {
        expect(extractBearerOrHeaderToken({ "x-crm-api-token": " from-header " }, "x-crm-api-token")).toBe("from-header");
    });

    it("treats blank Bearer and blank fallback as absent", () => {
        expect(extractBearerOrHeaderToken({ authorization: "Bearer   ", "x-crm-api-token": "   " }, "x-crm-api-token")).toBeUndefined();
    });

    it("reads the first value when a header arrives as string[]", () => {
        expect(extractBearerOrHeaderToken({ "x-crm-api-token": ["first", "second"] }, "x-crm-api-token")).toBe("first");
    });

    it("ignores Basic and Digest Authorization schemes and uses the fallback header", () => {
        expect(
            extractBearerOrHeaderToken(
                {
                    authorization: "Basic dXNlcjpwYXNz",
                    "x-crm-api-token": "from-header",
                },
                "x-crm-api-token",
            ),
        ).toBe("from-header");
        expect(extractBearerOrHeaderToken({ authorization: "Digest abc" }, "x-crm-api-token")).toBeUndefined();
    });

    it("does not treat bearer as a scheme because the prefix is case-sensitive", () => {
        expect(extractBearerOrHeaderToken({ authorization: "bearer leaked-token", "x-crm-api-token": "from-header" }, "x-crm-api-token")).toBe("from-header");
    });
});
