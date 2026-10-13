import { describe, expect, it, vi } from "vitest";

import type { DatabaseService } from "../../src/database/database.service.js";
import type { SecurityAuditService } from "../../src/modules/crm/audit/security-audit.service.js";
import { CatalogsRepository } from "../../src/modules/crm/catalogs/catalogs.repository.js";
import type { IdentityService } from "../../src/modules/crm/identity/identity.service.js";
import { SubsidiariesRepository } from "../../src/modules/crm/subsidiaries/subsidiaries.repository.js";
import { SubsidiariesService } from "../../src/modules/crm/subsidiaries/subsidiaries.service.js";

describe("independent Subsidiaries persistence", () => {
    it("limits the feature service to Subsidiaries and authorizes before persistence", async () => {
        const identity = { getCurrentUser: vi.fn().mockRejectedValue(new Error("not authenticated")) };
        const repository = { listCatalogItems: vi.fn(), createCatalogItem: vi.fn(), updateCatalogItem: vi.fn(), updateCatalogItemStatus: vi.fn() };
        const service = new SubsidiariesService(identity as unknown as IdentityService, repository as unknown as SubsidiariesRepository);
        await expect(service.listCatalogItems(undefined, "projects", { moduleCode: "administration" })).rejects.toThrow("Unsupported subsidiary domain");
        expect(identity.getCurrentUser).not.toHaveBeenCalled();
        await expect(service.listCatalogItems(undefined, "subsidiaries", { moduleCode: "administration" })).rejects.toThrow("not authenticated");
        expect(repository.listCatalogItems).not.toHaveBeenCalled();
    });
    it("routes subsidiary reads and all mutations away from generic catalog storage", async () => {
        const response = { catalog: { code: "subsidiaries" as const, label: "Subsidiarias", moduleCode: "catalog_subsidiary" }, items: [], total: 0 };
        const list = vi.spyOn(SubsidiariesRepository.prototype, "listCatalogItems").mockResolvedValue(response);
        const create = vi.spyOn(SubsidiariesRepository.prototype, "createCatalogItem").mockRejectedValue(new Error("dedicated create"));
        const update = vi.spyOn(SubsidiariesRepository.prototype, "updateCatalogItem").mockResolvedValue(null);
        const status = vi.spyOn(SubsidiariesRepository.prototype, "updateCatalogItemStatus").mockResolvedValue(null);
        try {
            const repository = new SubsidiariesRepository({} as DatabaseService, {} as SecurityAuditService);
            const input = { catalogCode: "subsidiaries" as const, actorPublicId: "actor", name: "Subsidiary", reason: "test isolation", externalReferences: [] };
            expect(await repository.listCatalogItems({ catalogCode: "subsidiaries" })).toEqual(response);
            await expect(repository.createCatalogItem(input)).rejects.toThrow("dedicated create");
            expect(await repository.updateCatalogItem("subsidiary", input)).toBeNull();
            expect(await repository.updateCatalogItemStatus({ ...input, itemPublicId: "subsidiary", status: "inactive" })).toBeNull();
            expect(list).toHaveBeenCalledOnce();
            expect(create).toHaveBeenCalledOnce();
            expect(update).toHaveBeenCalledOnce();
            expect(status).toHaveBeenCalledOnce();
        } finally {
            vi.restoreAllMocks();
        }
    });

    it("rejects Subsidiaries on the shared-table persistence boundary", async () => {
        const repository = new CatalogsRepository({} as DatabaseService, {} as SecurityAuditService);
        const input = { catalogCode: "subsidiaries" as const, actorPublicId: "actor", name: "Subsidiary", reason: "test isolation", externalReferences: [] };
        await expect(repository.listCatalogItems(input)).rejects.toThrow("Subsidiaries module");
        await expect(repository.createCatalogItem(input)).rejects.toThrow("Subsidiaries module");
        await expect(repository.updateCatalogItem("subsidiary", input)).rejects.toThrow("Subsidiaries module");
        await expect(repository.updateCatalogItemStatus({ ...input, itemPublicId: "subsidiary", status: "inactive" })).rejects.toThrow("Subsidiaries module");
    });
});
