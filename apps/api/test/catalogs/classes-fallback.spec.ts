import { describe, expect, it, vi } from "vitest";

import { readCatalogWithFallback } from "../../src/modules/crm/catalogs/catalog-fallback.js";

describe("class merge parity with Projects", () => {
    it("appends unmigrated rows even when native classes exist", async () => {
        const native = { publicId: "native", nativeCode: "classes_native", name: "Native", detail: null, status: "active" as const, updatedAt: "", externalReferences: [], id_old_produccion: 42 };
        const catalog = { code: "classes" as const, label: "Clases", moduleCode: "catalog_class" };
        const primary = { listCatalogItems: vi.fn().mockResolvedValue({ catalog, items: [native], total: 1 }), listMigratedClassIds: vi.fn().mockResolvedValue([42]) };
        const remote = { ...native, publicId: "legacy:classes:43", id_old_produccion: 43 };
        const fallback = { enabled: () => true, list: vi.fn().mockResolvedValue({ catalog, items: [remote], total: 1 }) };
        const result = await readCatalogWithFallback(primary, { catalogCode: "classes", limit: 10 }, fallback);
        expect(result.items).toEqual([native, remote]);
        expect(result.total).toBe(2);
        expect(fallback.list).toHaveBeenCalledWith({ catalogCode: "classes", limit: 9, offset: 0, excludedLegacyIds: [42] });
    });
});
