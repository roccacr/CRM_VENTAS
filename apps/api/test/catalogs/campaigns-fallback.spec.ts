import { describe, expect, it, vi } from "vitest";

import { readCatalogWithFallback } from "../../src/modules/crm/catalogs/catalog-fallback.js";

describe("campaign merge parity with Projects", () => {
    it("appends unmigrated rows even when native campaigns exist", async () => {
        const native = { publicId: "native", nativeCode: "campaigns_native", name: "Native", detail: null, status: "active" as const, updatedAt: "", externalReferences: [], id_old_produccion: 42 };
        const catalog = { code: "campaigns" as const, label: "Campañas", moduleCode: "catalog_campaign" };
        const primary = { listCatalogItems: vi.fn().mockResolvedValue({ catalog, items: [native], total: 1 }), listMigratedCampaignIds: vi.fn().mockResolvedValue([42]) };
        const remote = { ...native, publicId: "legacy:campaigns:43", id_old_produccion: 43 };
        const fallback = { enabled: () => true, list: vi.fn().mockResolvedValue({ catalog, items: [remote], total: 1 }) };
        const result = await readCatalogWithFallback(primary, { catalogCode: "campaigns", limit: 10 }, fallback);
        expect(result.items).toEqual([native, remote]);
        expect(result.total).toBe(2);
        expect(fallback.list).toHaveBeenCalledWith({ catalogCode: "campaigns", limit: 9, offset: 0, excludedLegacyIds: [42] });
    });
});
