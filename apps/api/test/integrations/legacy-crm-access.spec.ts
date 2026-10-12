import { ConfigService } from "@nestjs/config";
import { describe, expect, it } from "vitest";

import { isLegacyCrmEnabled } from "../../src/integrations/legacy-crm/legacy-crm-access.js";

describe("one global legacy access gate", () => {
    it("uses a strict boolean and observes changes on the next operation", () => {
        const config = new ConfigService({ ENABLE_LEGACY_FALLBACK: true });
        expect(isLegacyCrmEnabled(config)).toBe(true);
        config.set("ENABLE_LEGACY_FALLBACK", false);
        expect(isLegacyCrmEnabled(config)).toBe(false);
        expect(isLegacyCrmEnabled(new ConfigService({ ENABLE_LEGACY_FALLBACK: "false" }))).toBe(false);
    });
});
