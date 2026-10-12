import { ConfigService } from "@nestjs/config";
import { describe, expect, it, vi } from "vitest";

import { mapLegacyCampaign } from "../../src/integrations/legacy-crm/campaigns/legacy-campaigns.mapper.js";
import { LegacyCatalogReader } from "../../src/integrations/legacy-crm/legacy-catalog.reader.js";
import { LegacyCrmDatabaseService } from "../../src/integrations/legacy-crm/legacy-crm-database.service.js";
import { mapLegacyProject } from "../../src/integrations/legacy-crm/projects/legacy-projects.mapper.js";

describe("isolated legacy catalog adapter", () => {
    const mapLegacyCatalogItem = (code: "projects" | "campaigns", input: unknown) => (code === "projects" ? mapLegacyProject(input) : mapLegacyCampaign(input));
    it.each(["projects", "campaigns"] as const)("maps %s without inventing CRM or Odoo identities", (code) => {
        const item = mapLegacyCatalogItem(code, { legacyId: 42, externalId: -5, name: " Default ", status: 1 });
        expect(item).toMatchObject({ publicId: `legacy:${code}:42`, id_old_produccion: 42, name: "Default", status: "active" });
        expect(item.externalReferences).toEqual([{ systemCode: "netsuite", systemName: "NetSuite", externalId: "-5", status: "active" }]);
        expect(mapLegacyCatalogItem(code, { legacyId: 42, externalId: null, name: null, status: null }).externalReferences).toEqual([]);
        expect(mapLegacyCatalogItem(code, { legacyId: 42, externalId: -5, name: " Default ", status: 1 }).publicId).toBe(item.publicId);
    });
    it("rejects invalid source identifiers and unknown status values", () => {
        expect(() => mapLegacyCatalogItem("projects", { legacyId: 42, externalId: 1.5, name: "A", status: 1 })).toThrow();
        expect(() => mapLegacyCatalogItem("projects", { legacyId: 42, externalId: 1, name: "A", status: 99 })).toThrow();
    });
    it("never accesses the legacy database when disabled", async () => {
        const access = vi.spyOn(LegacyCrmDatabaseService.prototype, "db", "get");
        try {
            const reader = new LegacyCatalogReader(new ConfigService({ ENABLE_LEGACY_FALLBACK: false }), new LegacyCrmDatabaseService(null));
            expect(reader.enabled()).toBe(false);
            await expect(reader.list({ catalogCode: "campaigns" })).rejects.toThrow("disabled");
            expect(access).not.toHaveBeenCalled();
        } finally {
            access.mockRestore();
        }
    });
    it("returns a controlled error for unavailable legacy configuration", async () => {
        const reader = new LegacyCatalogReader(new ConfigService({ ENABLE_LEGACY_FALLBACK: true }), new LegacyCrmDatabaseService(null));
        await expect(reader.list({ catalogCode: "projects" })).rejects.toThrow("temporarily unavailable");
    });
});
