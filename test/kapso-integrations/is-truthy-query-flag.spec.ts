import { isTruthyQueryFlag } from "../../src/kapso-integrations/is-truthy-query-flag";

describe("isTruthyQueryFlag", () => {
    it.each(["1", "true"])("accepts CRM flag %s", (value) => {
        expect(isTruthyQueryFlag(value)).toBe(true);
    });

    it.each(["TRUE", "yes", "0", "false", "on", "", undefined])("rejects non-canonical flag %s", (value) => {
        expect(isTruthyQueryFlag(value)).toBe(false);
    });
});
