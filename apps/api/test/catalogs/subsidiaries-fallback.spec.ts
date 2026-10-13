import { describe, expect, it, vi } from "vitest";

import { readCatalogWithFallback } from "../../src/modules/crm/catalogs/catalog-fallback.js";

describe("subsidiary merge parity with Projects", () => {
    it("appends unmigrated rows even when native subsidiaries exist", async () => {
        const native = { publicId: "native", nativeCode: "subsidiaries_native", name: "Native", detail: null, status: "active" as const, updatedAt: "", externalReferences: [], id_old_produccion: 42 };
        const catalog = { code: "subsidiaries" as const, label: "Subsidiarias", moduleCode: "catalog_subsidiary" };
        const primary = { listCatalogItems: vi.fn().mockResolvedValue({ catalog, items: [native], total: 1 }), listMigratedSubsidiaryIds: vi.fn().mockResolvedValue([42]) };
        const remote = { ...native, publicId: "legacy:subsidiaries:43", id_old_produccion: 43 };
        const fallback = { enabled: () => true, list: vi.fn().mockResolvedValue({ catalog, items: [remote], total: 1 }) };
        const result = await readCatalogWithFallback(primary, { catalogCode: "subsidiaries", limit: 10 }, fallback);
        expect(result.items).toEqual([native, remote]);
        expect(result.total).toBe(2);
        expect(fallback.list).toHaveBeenCalledWith({ catalogCode: "subsidiaries", limit: 9, offset: 0, excludedLegacyIds: [42] });
    });
});
