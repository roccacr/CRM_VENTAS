import { describe, expect, it, vi } from "vitest";

import type { DatabaseService } from "../../src/database/database.service.js";
import type { SecurityAuditService } from "../../src/modules/crm/audit/security-audit.service.js";
import { CatalogsRepository } from "../../src/modules/crm/catalogs/catalogs.repository.js";
import type { IdentityService } from "../../src/modules/crm/identity/identity.service.js";
import { ProjectsRepository } from "../../src/modules/crm/projects/projects.repository.js";
import { ProjectsService } from "../../src/modules/crm/projects/projects.service.js";

describe("independent Projects persistence", () => {
    it("limits the feature service to Projects and authorizes before persistence", async () => {
        const identity = { getCurrentUser: vi.fn().mockRejectedValue(new Error("not authenticated")) };
        const repository = { listCatalogItems: vi.fn(), createCatalogItem: vi.fn(), updateCatalogItem: vi.fn(), updateCatalogItemStatus: vi.fn() };
        const service = new ProjectsService(identity as unknown as IdentityService, repository as unknown as ProjectsRepository);
        await expect(service.listCatalogItems(undefined, "campaigns", { moduleCode: "administration" })).rejects.toThrow("Unsupported project domain");
        expect(identity.getCurrentUser).not.toHaveBeenCalled();
        await expect(service.listCatalogItems(undefined, "projects", { moduleCode: "administration" })).rejects.toThrow("not authenticated");
        expect(repository.listCatalogItems).not.toHaveBeenCalled();
    });
    it("routes project reads and all mutations away from generic catalog storage", async () => {
        const response = { catalog: { code: "projects" as const, label: "Proyectos", moduleCode: "catalog_project" }, items: [], total: 0 };
        const list = vi.spyOn(ProjectsRepository.prototype, "listCatalogItems").mockResolvedValue(response);
        const create = vi.spyOn(ProjectsRepository.prototype, "createCatalogItem").mockRejectedValue(new Error("dedicated create"));
        const update = vi.spyOn(ProjectsRepository.prototype, "updateCatalogItem").mockResolvedValue(null);
        const status = vi.spyOn(ProjectsRepository.prototype, "updateCatalogItemStatus").mockResolvedValue(null);
        try {
            const repository = new ProjectsRepository({} as DatabaseService, {} as SecurityAuditService);
            const input = { catalogCode: "projects" as const, actorPublicId: "actor", name: "Project", reason: "test isolation", externalReferences: [] };
            expect(await repository.listCatalogItems({ catalogCode: "projects" })).toEqual(response);
            await expect(repository.createCatalogItem(input)).rejects.toThrow("dedicated create");
            expect(await repository.updateCatalogItem("project", input)).toBeNull();
            expect(await repository.updateCatalogItemStatus({ ...input, itemPublicId: "project", status: "inactive" })).toBeNull();
            expect(list).toHaveBeenCalledOnce();
            expect(create).toHaveBeenCalledOnce();
            expect(update).toHaveBeenCalledOnce();
            expect(status).toHaveBeenCalledOnce();
        } finally {
            vi.restoreAllMocks();
        }
    });

    it("rejects Projects on the shared-table persistence boundary", async () => {
        const repository = new CatalogsRepository({} as DatabaseService, {} as SecurityAuditService);
        const input = { catalogCode: "projects" as const, actorPublicId: "actor", name: "Project", reason: "test isolation", externalReferences: [] };
        await expect(repository.listCatalogItems(input)).rejects.toThrow("Projects module");
        await expect(repository.createCatalogItem(input)).rejects.toThrow("Projects module");
        await expect(repository.updateCatalogItem("project", input)).rejects.toThrow("Projects module");
        await expect(repository.updateCatalogItemStatus({ ...input, itemPublicId: "project", status: "inactive" })).rejects.toThrow("Projects module");
    });
});
