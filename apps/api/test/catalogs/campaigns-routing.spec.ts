import { describe, expect, it, vi } from "vitest";

import type { DatabaseService } from "../../src/database/database.service.js";
import type { SecurityAuditService } from "../../src/modules/crm/audit/security-audit.service.js";
import { CampaignsRepository } from "../../src/modules/crm/campaigns/campaigns.repository.js";
import { CampaignsService } from "../../src/modules/crm/campaigns/campaigns.service.js";
import { CatalogsRepository } from "../../src/modules/crm/catalogs/catalogs.repository.js";
import type { IdentityService } from "../../src/modules/crm/identity/identity.service.js";

describe("independent Campaigns persistence", () => {
    it("limits the feature service to Campaigns and authorizes before persistence", async () => {
        const identity = { getCurrentUser: vi.fn().mockRejectedValue(new Error("not authenticated")) };
        const repository = { listCatalogItems: vi.fn(), createCatalogItem: vi.fn(), updateCatalogItem: vi.fn(), updateCatalogItemStatus: vi.fn() };
        const service = new CampaignsService(identity as unknown as IdentityService, repository as unknown as CampaignsRepository);
        await expect(service.listCatalogItems(undefined, "projects", { moduleCode: "administration" })).rejects.toThrow("Unsupported campaign domain");
        expect(identity.getCurrentUser).not.toHaveBeenCalled();
        await expect(service.listCatalogItems(undefined, "campaigns", { moduleCode: "administration" })).rejects.toThrow("not authenticated");
        expect(repository.listCatalogItems).not.toHaveBeenCalled();
    });
    it("routes campaign reads and all mutations away from generic catalog storage", async () => {
        const response = { catalog: { code: "campaigns" as const, label: "Campañas", moduleCode: "catalog_campaign" }, items: [], total: 0 };
        const list = vi.spyOn(CampaignsRepository.prototype, "listCatalogItems").mockResolvedValue(response);
        const create = vi.spyOn(CampaignsRepository.prototype, "createCatalogItem").mockRejectedValue(new Error("dedicated create"));
        const update = vi.spyOn(CampaignsRepository.prototype, "updateCatalogItem").mockResolvedValue(null);
        const status = vi.spyOn(CampaignsRepository.prototype, "updateCatalogItemStatus").mockResolvedValue(null);
        try {
            const repository = new CampaignsRepository({} as DatabaseService, {} as SecurityAuditService);
            const input = { catalogCode: "campaigns" as const, actorPublicId: "actor", name: "Campaign", reason: "test isolation", externalReferences: [] };
            expect(await repository.listCatalogItems({ catalogCode: "campaigns" })).toEqual(response);
            await expect(repository.createCatalogItem(input)).rejects.toThrow("dedicated create");
            expect(await repository.updateCatalogItem("campaign", input)).toBeNull();
            expect(await repository.updateCatalogItemStatus({ ...input, itemPublicId: "campaign", status: "inactive" })).toBeNull();
            expect(list).toHaveBeenCalledOnce();
            expect(create).toHaveBeenCalledOnce();
            expect(update).toHaveBeenCalledOnce();
            expect(status).toHaveBeenCalledOnce();
        } finally {
            vi.restoreAllMocks();
        }
    });

    it("rejects Campaigns on the shared-table persistence boundary", async () => {
        const repository = new CatalogsRepository({} as DatabaseService, {} as SecurityAuditService);
        const input = { catalogCode: "campaigns" as const, actorPublicId: "actor", name: "Campaign", reason: "test isolation", externalReferences: [] };
        await expect(repository.listCatalogItems(input)).rejects.toThrow("Campaigns module");
        await expect(repository.createCatalogItem(input)).rejects.toThrow("Campaigns module");
        await expect(repository.updateCatalogItem("campaign", input)).rejects.toThrow("Campaigns module");
        await expect(repository.updateCatalogItemStatus({ ...input, itemPublicId: "campaign", status: "inactive" })).rejects.toThrow("Campaigns module");
    });
});
