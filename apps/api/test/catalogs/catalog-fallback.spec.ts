import { describe, expect, it, vi } from "vitest";

import { readCatalogWithFallback } from "../../src/modules/crm/catalogs/catalog-fallback.js";

const response = { catalog: { code: "projects" as const, label: "Proyectos", moduleCode: "catalog_project" }, items: [], total: 0 };
const input = { catalogCode: "campaigns" as const };

describe("optional catalog fallback", () => {
    it("works without the legacy provider", async () => {
        const primary = { listCatalogItems: vi.fn().mockResolvedValue(response) };
        expect(await readCatalogWithFallback(primary, input)).toEqual(response);
        expect(primary.listCatalogItems).toHaveBeenCalledTimes(1);
    });
    it("never calls legacy while disabled", async () => {
        const primary = { listCatalogItems: vi.fn().mockResolvedValue(response) };
        const legacy = { enabled: () => false, list: vi.fn() };
        expect(await readCatalogWithFallback(primary, input, legacy)).toEqual(response);
        expect(legacy.list).not.toHaveBeenCalled();
    });
    it("reads legacy even when the filtered native page is empty", async () => {
        const primary = { listCatalogItems: vi.fn().mockResolvedValue(response), listMigratedCampaignIds: vi.fn().mockResolvedValue([42]) };
        const legacy = { enabled: () => true, list: vi.fn().mockResolvedValue({ ...response, total: 2 }) };
        expect((await readCatalogWithFallback(primary, { ...input, search: "missing", offset: 100 }, legacy)).total).toBe(2);
        expect(legacy.list).toHaveBeenCalledWith({ ...input, search: "missing", offset: 100, limit: 100, excludedLegacyIds: [42] });
    });
    it("does not hide legacy connection failures as empty results", async () => {
        const primary = { listCatalogItems: vi.fn().mockResolvedValue(response), listMigratedCampaignIds: vi.fn().mockResolvedValue([]) };
        const legacy = { enabled: () => true, list: vi.fn().mockRejectedValue(new Error("unavailable")) };
        await expect(readCatalogWithFallback(primary, input, legacy)).rejects.toThrow("unavailable");
    });
});

describe("project read-through merge", () => {
    const nativeItem = { publicId: "native", nativeCode: "projects_native", name: "Native", detail: null, status: "active" as const, updatedAt: "", externalReferences: [], id_old_produccion: 42 };
    const legacyItem = { ...nativeItem, publicId: "legacy:projects:43", id_old_produccion: 43 };
    it("appends only unmigrated legacy rows and includes both totals", async () => {
        const primary = { listCatalogItems: vi.fn().mockResolvedValue({ ...response, items: [nativeItem], total: 1 }), listMigratedProjectIds: vi.fn().mockResolvedValue([42]) };
        const legacy = { enabled: () => true, list: vi.fn().mockResolvedValue({ ...response, items: [legacyItem], total: 2 }) };
        const result = await readCatalogWithFallback(primary, { catalogCode: "projects", limit: 10 }, legacy);
        expect(result.items).toEqual([nativeItem, legacyItem]);
        expect(result.total).toBe(3);
        expect(legacy.list).toHaveBeenCalledWith({ catalogCode: "projects", limit: 9, offset: 0, excludedLegacyIds: [42] });
    });
    it("paginates legacy after native rows, excluding migrated IDs even when filters hide them", async () => {
        const primary = { listCatalogItems: vi.fn().mockResolvedValue({ ...response, total: 2 }), listMigratedProjectIds: vi.fn().mockResolvedValue([42, 44]) };
        const legacy = { enabled: () => true, list: vi.fn().mockResolvedValue({ ...response, items: [legacyItem], total: 10 }) };
        const result = await readCatalogWithFallback(primary, { catalogCode: "projects", limit: 2, offset: 4, search: "Native" }, legacy);
        expect(result.total).toBe(12);
        expect(legacy.list).toHaveBeenCalledWith({ catalogCode: "projects", limit: 2, offset: 2, search: "Native", excludedLegacyIds: [42, 44] });
    });
    it("keeps a full native page while counting remaining legacy records", async () => {
        const primary = { listCatalogItems: vi.fn().mockResolvedValue({ ...response, items: [nativeItem], total: 1 }), listMigratedProjectIds: vi.fn().mockResolvedValue([42]) };
        const legacy = { enabled: () => true, list: vi.fn().mockResolvedValue({ ...response, items: [legacyItem], total: 1 }) };
        const result = await readCatalogWithFallback(primary, { catalogCode: "projects", limit: 1 }, legacy);
        expect(result.items).toEqual([nativeItem]);
        expect(result.total).toBe(2);
    });
    it("disabled fallback never reads migration identities or legacy", async () => {
        const primary = { listCatalogItems: vi.fn().mockResolvedValue(response), listMigratedProjectIds: vi.fn() };
        const legacy = { enabled: () => false, list: vi.fn() };
        expect(await readCatalogWithFallback(primary, { catalogCode: "projects" }, legacy)).toEqual(response);
        expect(primary.listMigratedProjectIds).not.toHaveBeenCalled();
        expect(legacy.list).not.toHaveBeenCalled();
    });
});
