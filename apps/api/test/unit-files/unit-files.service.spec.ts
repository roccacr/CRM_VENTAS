import { describe, expect, it, vi } from "vitest";

import type { IdentityService } from "../../src/modules/crm/identity/identity.service.js";
import { decodeUnitCursor, type UnitFilter, unitFilterKey, type UnitSummary } from "../../src/modules/crm/unit-files/unit-files.contract.js";
import type { UnitFilesRepository } from "../../src/modules/crm/unit-files/unit-files.repository.js";
import { UnitFilesService } from "../../src/modules/crm/unit-files/unit-files.service.js";

const project = { id: "01M4RCK911NS2ZNCRYPBD40B9W", name: "Project", externalReferences: [] };
const filter: UnitFilter = { projectIds: [project.id], moduleCode: "administration", limit: 2 };
const row = (position: number) => ({ position, item: { id: String(position) } as UnitSummary });
function setup(enabled = true) {
    const identity = { getCurrentUser: vi.fn().mockResolvedValue({ roles: [{ code: "owner", status: "active" }], orgUnits: [], permissions: [] }) };
    const repository = { projects: vi.fn().mockResolvedValue([project]), facets: vi.fn().mockResolvedValue([]), options: vi.fn().mockResolvedValue([]), list: vi.fn().mockResolvedValue([]), findPromotedId: vi.fn().mockResolvedValue(null), detail: vi.fn().mockResolvedValue(null) };
    const legacy = { enabled: vi.fn(() => enabled), facets: vi.fn().mockResolvedValue([]), options: vi.fn().mockResolvedValue([]), list: vi.fn().mockResolvedValue([]), detail: vi.fn().mockResolvedValue(null) };
    return { identity, repository, legacy, service: new UnitFilesService(identity as unknown as IdentityService, repository as unknown as UnitFilesRepository, legacy) };
}
describe("Unit Files native-first service", () => {
    it("merges full-scope facet counts and does not query disabled legacy", async () => {
        const { service, repository, legacy } = setup();
        repository.facets.mockResolvedValue([
            { value: "A", count: 2 },
            { value: "B", count: 1 },
        ]);
        legacy.facets.mockResolvedValue([
            { value: "A", count: 3 },
            { value: "C", count: 4 },
            { value: "D", count: 1 },
        ]);
        const query = { ...filter, kind: "housingType" as const, codes: ["FF001", "FF002"] };
        expect(await service.facets("session", query)).toEqual({
            items: [
                { value: "A", count: 5 },
                { value: "B", count: 1 },
            ],
            nextAfter: "B",
        });
        expect(repository.facets).toHaveBeenCalledWith(query, 3);
        legacy.enabled.mockReturnValue(false);
        legacy.facets.mockClear();
        expect((await service.facets("session", query)).items).toEqual([
            { value: "A", count: 2 },
            { value: "B", count: 1 },
        ]);
        expect(legacy.facets).not.toHaveBeenCalled();
    });
    it("authorizes facets and rejects unknown project scopes before aggregate reads", async () => {
        const { service, repository, identity, legacy } = setup();
        await expect(service.facets("session", { ...filter, projectIds: ["unknown"], kind: "code" })).rejects.toThrow("Proyecto CRM");
        expect(repository.facets).not.toHaveBeenCalled();
        identity.getCurrentUser.mockRejectedValue(new Error("Unauthorized"));
        await expect(service.facets("session", { ...filter, kind: "code" })).rejects.toThrow("Unauthorized");
        expect(legacy.facets).not.toHaveBeenCalled();
    });
    it("merges distinct scoped choices and disables legacy options through the global gate", async () => {
        const { service, repository, legacy } = setup();
        repository.options.mockResolvedValue(["A", "B"]);
        legacy.options.mockResolvedValue(["B", "C", "D"]);
        const query = { ...filter, kind: "code" as const };
        expect(await service.options("session", query)).toEqual({ items: ["A", "B"], hasNext: true, nextAfter: "B" });
        expect(repository.options).toHaveBeenCalledWith(query, 3);
        legacy.enabled.mockReturnValue(false);
        legacy.options.mockClear();
        expect((await service.options("session", query)).items).toEqual(["A", "B"]);
        expect(legacy.options).not.toHaveBeenCalled();
    });
    it("crosses the native/legacy boundary without skipping the look-ahead row", async () => {
        const { service, repository, legacy } = setup();
        repository.list.mockResolvedValue([row(10)]);
        legacy.list.mockResolvedValue([row(100), row(101)]);
        const result = await service.list("session", filter);
        expect(result.items.map((item) => item.id)).toEqual(["10", "100"]);
        const cursor = result.pagination.nextCursor;
        expect(cursor).not.toBeNull();
        expect(decodeUnitCursor(cursor ?? undefined, unitFilterKey(filter))).toMatchObject({ phase: "legacy", after: 100 });
        repository.list.mockClear();
        legacy.list.mockResolvedValue([row(101)]);
        const next = await service.list("session", { ...filter, cursor: cursor ?? "" });
        expect(repository.list).not.toHaveBeenCalled();
        expect(next.items.map((item) => item.id)).toEqual(["101"]);
        expect(next.pagination.hasNext).toBe(false);
    });
    it("does not call the legacy pool when disabled, and works without any adapter", async () => {
        const { identity, repository, legacy, service } = setup(false);
        repository.list.mockResolvedValue([row(1)]);
        expect((await service.list("session", filter)).items).toHaveLength(1);
        await expect(service.detail("session", "legacy:unit-files:1", "administration")).rejects.toThrow();
        expect(legacy.list).not.toHaveBeenCalled();
        expect(legacy.detail).not.toHaveBeenCalled();
        const nativeOnly = new UnitFilesService(identity as unknown as IdentityService, repository as unknown as UnitFilesRepository);
        expect((await nativeOnly.list("session", filter)).items).toHaveLength(1);
    });
    it("authorizes before querying either database and deny overrides scoped allow", async () => {
        const { identity, service, repository, legacy } = setup();
        identity.getCurrentUser.mockResolvedValue({
            roles: [],
            orgUnits: [{ code: "administration", status: "active" }],
            permissions: [
                { code: "administration.catalog_file.read", effect: "allow" },
                { code: "administration.catalog_file.read", effect: "deny" },
            ],
        });
        await expect(service.list("session", filter)).rejects.toThrow("Permiso");
        expect(repository.projects).not.toHaveBeenCalled();
        expect(legacy.list).not.toHaveBeenCalled();
    });
    it("returns a migrated native detail for an old legacy link", async () => {
        const { service, repository, legacy } = setup();
        repository.findPromotedId.mockResolvedValue(project.id);
        repository.detail.mockResolvedValue({ id: project.id });
        expect(await service.detail("session", "legacy:unit-files:1", "administration")).toEqual({ id: project.id });
        expect(legacy.detail).not.toHaveBeenCalled();
    });
    it("does not query inventory when loading project options", async () => {
        const { service, repository, legacy } = setup();
        expect(await service.projects("session", "administration")).toEqual({ items: [{ id: project.id, name: project.name }] });
        expect(repository.list).not.toHaveBeenCalled();
        expect(legacy.list).not.toHaveBeenCalled();
    });
});
