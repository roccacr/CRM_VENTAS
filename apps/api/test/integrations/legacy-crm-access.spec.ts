import { ConfigService } from "@nestjs/config";
import { describe, expect, it } from "vitest";

import { isLegacyCrmEnabled, isLegacyCrmWriteEnabled } from "../../src/integrations/legacy-crm/legacy-crm-access.js";

describe("one global legacy access gate", () => {
    it("uses a strict boolean and observes changes on the next operation", () => {
        const config = new ConfigService({ ENABLE_LEGACY_FALLBACK: true });
        expect(isLegacyCrmEnabled(config)).toBe(true);
        config.set("ENABLE_LEGACY_FALLBACK", false);
        expect(isLegacyCrmEnabled(config)).toBe(false);
        expect(isLegacyCrmEnabled(new ConfigService({ ENABLE_LEGACY_FALLBACK: "false" }))).toBe(false);
    });
});

describe("legacy writes require a separate production-only opt-in", () => {
    it.each([undefined, "development", "test"])("blocks writes in %s even with both flags enabled", (environment) => {
        const config = new ConfigService({ NODE_ENV: environment, LEGACY_CRM_DB_NAME: "crmdatabase-api", ENABLE_LEGACY_FALLBACK: true, ENABLE_LEGACY_WRITES: true });
        expect(isLegacyCrmWriteEnabled(config)).toBe(false);
    });

    it.each([undefined, false, "true"])("rejects a missing or non-boolean write opt-in: %s", (writeFlag) => {
        const config = new ConfigService({ NODE_ENV: "production", LEGACY_CRM_DB_NAME: "crmdatabase-api", ENABLE_LEGACY_FALLBACK: true, ENABLE_LEGACY_WRITES: writeFlag });
        expect(isLegacyCrmWriteEnabled(config)).toBe(false);
    });

    it("allows explicitly enabled production writes and still observes the master switch", () => {
        const config = new ConfigService({ NODE_ENV: "production", LEGACY_CRM_DB_NAME: "crmdatabase-api", ENABLE_LEGACY_FALLBACK: true, ENABLE_LEGACY_WRITES: true });
        expect(isLegacyCrmWriteEnabled(config)).toBe(true);
        config.set("ENABLE_LEGACY_FALLBACK", false);
        expect(isLegacyCrmWriteEnabled(config)).toBe(false);
    });
    it.each([undefined, "", "other"])("requires the configured legacy destination: %s", (database) => {
        expect(isLegacyCrmWriteEnabled(new ConfigService({ NODE_ENV: "production", LEGACY_CRM_DB_NAME: database, ENABLE_LEGACY_FALLBACK: true, ENABLE_LEGACY_WRITES: true }))).toBe(false);
    });
});
