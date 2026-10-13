import { describe, expect, it, vi } from "vitest";

import type { DatabaseService } from "../../src/database/database.service.js";
import type { SecurityAuditService } from "../../src/modules/crm/audit/security-audit.service.js";
import { BrokersRepository } from "../../src/modules/crm/brokers/brokers.repository.js";
import { BrokersService } from "../../src/modules/crm/brokers/brokers.service.js";
import { CatalogsRepository } from "../../src/modules/crm/catalogs/catalogs.repository.js";
import type { IdentityService } from "../../src/modules/crm/identity/identity.service.js";

describe("independent Brokers persistence", () => {
    it("limits the feature service to Brokers and authorizes before persistence", async () => {
        const identity = { getCurrentUser: vi.fn().mockRejectedValue(new Error("not authenticated")) };
        const repository = { listCatalogItems: vi.fn(), createCatalogItem: vi.fn(), updateCatalogItem: vi.fn(), updateCatalogItemStatus: vi.fn() };
        const service = new BrokersService(identity as unknown as IdentityService, repository as unknown as BrokersRepository);
        await expect(service.listCatalogItems(undefined, "projects", { moduleCode: "administration" })).rejects.toThrow("Unsupported broker domain");
        expect(identity.getCurrentUser).not.toHaveBeenCalled();
        await expect(service.listCatalogItems(undefined, "brokers", { moduleCode: "administration" })).rejects.toThrow("not authenticated");
        expect(repository.listCatalogItems).not.toHaveBeenCalled();
    });
    it("routes broker reads and all mutations away from generic catalog storage", async () => {
        const response = { catalog: { code: "brokers" as const, label: "Corredores", moduleCode: "catalog_broker" }, items: [], total: 0 };
        const list = vi.spyOn(BrokersRepository.prototype, "listCatalogItems").mockResolvedValue(response);
        const create = vi.spyOn(BrokersRepository.prototype, "createCatalogItem").mockRejectedValue(new Error("dedicated create"));
        const update = vi.spyOn(BrokersRepository.prototype, "updateCatalogItem").mockResolvedValue(null);
        const status = vi.spyOn(BrokersRepository.prototype, "updateCatalogItemStatus").mockResolvedValue(null);
        try {
            const repository = new BrokersRepository({} as DatabaseService, {} as SecurityAuditService);
            const input = { catalogCode: "brokers" as const, actorPublicId: "actor", name: "Broker", reason: "test isolation", externalReferences: [] };
            expect(await repository.listCatalogItems({ catalogCode: "brokers" })).toEqual(response);
            await expect(repository.createCatalogItem(input)).rejects.toThrow("dedicated create");
            expect(await repository.updateCatalogItem("broker", input)).toBeNull();
            expect(await repository.updateCatalogItemStatus({ ...input, itemPublicId: "broker", status: "inactive" })).toBeNull();
            expect(list).toHaveBeenCalledOnce();
            expect(create).toHaveBeenCalledOnce();
            expect(update).toHaveBeenCalledOnce();
            expect(status).toHaveBeenCalledOnce();
        } finally {
            vi.restoreAllMocks();
        }
    });

    it("rejects Brokers on the shared-table persistence boundary", async () => {
        const repository = new CatalogsRepository({} as DatabaseService, {} as SecurityAuditService);
        const input = { catalogCode: "brokers" as const, actorPublicId: "actor", name: "Broker", reason: "test isolation", externalReferences: [] };
        await expect(repository.listCatalogItems(input)).rejects.toThrow("Brokers module");
        await expect(repository.createCatalogItem(input)).rejects.toThrow("Brokers module");
        await expect(repository.updateCatalogItem("broker", input)).rejects.toThrow("Brokers module");
        await expect(repository.updateCatalogItemStatus({ ...input, itemPublicId: "broker", status: "inactive" })).rejects.toThrow("Brokers module");
    });
});
