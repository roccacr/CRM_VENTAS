import { describe, expect, it, vi } from "vitest";

import type { DatabaseService } from "../../src/database/database.service.js";
import type { SecurityAuditService } from "../../src/modules/crm/audit/security-audit.service.js";
import { CatalogsRepository } from "../../src/modules/crm/catalogs/catalogs.repository.js";
import { ClassesRepository } from "../../src/modules/crm/classes/classes.repository.js";
import { ClassesService } from "../../src/modules/crm/classes/classes.service.js";
import type { IdentityService } from "../../src/modules/crm/identity/identity.service.js";

describe("independent Classes persistence", () => {
    it("limits the feature service to Classes and authorizes before persistence", async () => {
        const identity = { getCurrentUser: vi.fn().mockRejectedValue(new Error("not authenticated")) };
        const repository = { listCatalogItems: vi.fn(), createCatalogItem: vi.fn(), updateCatalogItem: vi.fn(), updateCatalogItemStatus: vi.fn() };
        const service = new ClassesService(identity as unknown as IdentityService, repository as unknown as ClassesRepository);
        await expect(service.listCatalogItems(undefined, "projects", { moduleCode: "administration" })).rejects.toThrow("Unsupported class domain");
        expect(identity.getCurrentUser).not.toHaveBeenCalled();
        await expect(service.listCatalogItems(undefined, "classes", { moduleCode: "administration" })).rejects.toThrow("not authenticated");
        expect(repository.listCatalogItems).not.toHaveBeenCalled();
    });
    it("routes class reads and all mutations away from generic catalog storage", async () => {
        const response = { catalog: { code: "classes" as const, label: "Clases", moduleCode: "catalog_class" }, items: [], total: 0 };
        const list = vi.spyOn(ClassesRepository.prototype, "listCatalogItems").mockResolvedValue(response);
        const create = vi.spyOn(ClassesRepository.prototype, "createCatalogItem").mockRejectedValue(new Error("dedicated create"));
        const update = vi.spyOn(ClassesRepository.prototype, "updateCatalogItem").mockResolvedValue(null);
        const status = vi.spyOn(ClassesRepository.prototype, "updateCatalogItemStatus").mockResolvedValue(null);
        try {
            const repository = new ClassesRepository({} as DatabaseService, {} as SecurityAuditService);
            const input = { catalogCode: "classes" as const, actorPublicId: "actor", name: "Class", reason: "test isolation", externalReferences: [] };
            expect(await repository.listCatalogItems({ catalogCode: "classes" })).toEqual(response);
            await expect(repository.createCatalogItem(input)).rejects.toThrow("dedicated create");
            expect(await repository.updateCatalogItem("class", input)).toBeNull();
            expect(await repository.updateCatalogItemStatus({ ...input, itemPublicId: "class", status: "inactive" })).toBeNull();
            expect(list).toHaveBeenCalledOnce();
            expect(create).toHaveBeenCalledOnce();
            expect(update).toHaveBeenCalledOnce();
            expect(status).toHaveBeenCalledOnce();
        } finally {
            vi.restoreAllMocks();
        }
    });

    it("rejects Classes on the shared-table persistence boundary", async () => {
        const repository = new CatalogsRepository({} as DatabaseService, {} as SecurityAuditService);
        const input = { catalogCode: "classes" as const, actorPublicId: "actor", name: "Class", reason: "test isolation", externalReferences: [] };
        await expect(repository.listCatalogItems(input)).rejects.toThrow("Classes module");
        await expect(repository.createCatalogItem(input)).rejects.toThrow("Classes module");
        await expect(repository.updateCatalogItem("class", input)).rejects.toThrow("Classes module");
        await expect(repository.updateCatalogItemStatus({ ...input, itemPublicId: "class", status: "inactive" })).rejects.toThrow("Classes module");
    });
});
