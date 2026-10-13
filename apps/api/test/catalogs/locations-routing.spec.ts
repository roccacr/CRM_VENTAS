import { describe, expect, it, vi } from "vitest";

import type { DatabaseService } from "../../src/database/database.service.js";
import type { SecurityAuditService } from "../../src/modules/crm/audit/security-audit.service.js";
import { CatalogsRepository } from "../../src/modules/crm/catalogs/catalogs.repository.js";
import type { IdentityService } from "../../src/modules/crm/identity/identity.service.js";
import { LocationsRepository } from "../../src/modules/crm/locations/locations.repository.js";
import { LocationsService } from "../../src/modules/crm/locations/locations.service.js";

describe("independent Locations persistence", () => {
    it("limits the feature service to Locations and authorizes before persistence", async () => {
        const identity = { getCurrentUser: vi.fn().mockRejectedValue(new Error("not authenticated")) };
        const repository = { listCatalogItems: vi.fn(), createCatalogItem: vi.fn(), updateCatalogItem: vi.fn(), updateCatalogItemStatus: vi.fn() };
        const service = new LocationsService(identity as unknown as IdentityService, repository as unknown as LocationsRepository);
        await expect(service.listCatalogItems(undefined, "projects", { moduleCode: "administration" })).rejects.toThrow("Unsupported location domain");
        expect(identity.getCurrentUser).not.toHaveBeenCalled();
        await expect(service.listCatalogItems(undefined, "locations", { moduleCode: "administration" })).rejects.toThrow("not authenticated");
        expect(repository.listCatalogItems).not.toHaveBeenCalled();
    });
    it("routes location reads and all mutations away from generic catalog storage", async () => {
        const response = { catalog: { code: "locations" as const, label: "Ubicaciones", moduleCode: "catalog_location" }, items: [], total: 0 };
        const list = vi.spyOn(LocationsRepository.prototype, "listCatalogItems").mockResolvedValue(response);
        const create = vi.spyOn(LocationsRepository.prototype, "createCatalogItem").mockRejectedValue(new Error("dedicated create"));
        const update = vi.spyOn(LocationsRepository.prototype, "updateCatalogItem").mockResolvedValue(null);
        const status = vi.spyOn(LocationsRepository.prototype, "updateCatalogItemStatus").mockResolvedValue(null);
        try {
            const repository = new LocationsRepository({} as DatabaseService, {} as SecurityAuditService);
            const input = { catalogCode: "locations" as const, actorPublicId: "actor", name: "Location", reason: "test isolation", externalReferences: [] };
            expect(await repository.listCatalogItems({ catalogCode: "locations" })).toEqual(response);
            await expect(repository.createCatalogItem(input)).rejects.toThrow("dedicated create");
            expect(await repository.updateCatalogItem("location", input)).toBeNull();
            expect(await repository.updateCatalogItemStatus({ ...input, itemPublicId: "location", status: "inactive" })).toBeNull();
            expect(list).toHaveBeenCalledOnce();
            expect(create).toHaveBeenCalledOnce();
            expect(update).toHaveBeenCalledOnce();
            expect(status).toHaveBeenCalledOnce();
        } finally {
            vi.restoreAllMocks();
        }
    });

    it("rejects Locations on the shared-table persistence boundary", async () => {
        const repository = new CatalogsRepository({} as DatabaseService, {} as SecurityAuditService);
        const input = { catalogCode: "locations" as const, actorPublicId: "actor", name: "Location", reason: "test isolation", externalReferences: [] };
        await expect(repository.listCatalogItems(input)).rejects.toThrow("Locations module");
        await expect(repository.createCatalogItem(input)).rejects.toThrow("Locations module");
        await expect(repository.updateCatalogItem("location", input)).rejects.toThrow("Locations module");
        await expect(repository.updateCatalogItemStatus({ ...input, itemPublicId: "location", status: "inactive" })).rejects.toThrow("Locations module");
    });
});
