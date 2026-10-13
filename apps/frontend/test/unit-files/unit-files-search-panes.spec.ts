import { describe, expect, it, vi } from "vitest";

import { listUnitFacets, type UnitSummary } from "../../src/modules/administration/unit-files/unit-files.api";
import { createUnitPaneAjax, loadUnitFilePaneChoices, localUnitPaneData, type UnitPaneAjaxResponse, unitPaneResponse, unitPaneSelection } from "../../src/modules/administration/unit-files/unit-files-search-panes";
vi.mock("../../src/modules/administration/unit-files/unit-files.api", () => ({ listUnitFacets: vi.fn() }));

describe("Unit Files native server-side SearchPanes", () => {
    it("supersedes an in-flight filter when clearing back to the accepted selection", async () => {
        const choices = { code: [], housingType: [], status: [], projectIds: [] };
        let finish: (result: { items: UnitSummary[]; choices: typeof choices }) => void = () => {};
        const onFilterChange = vi
            .fn()
            .mockImplementationOnce(
                () =>
                    new Promise((resolve) => {
                        finish = resolve;
                    }),
            )
            .mockResolvedValue({ items: [], choices });
        const ajax = createUnitPaneAjax(() => ({ items: [], choices, onFilterChange }), vi.fn());
        const done = vi.fn<(response: UnitPaneAjaxResponse) => void>();
        ajax({ draw: 1, order: [], searchPanes: { code: ["FF001"] } }, done);
        await Promise.resolve();
        await Promise.resolve();
        ajax({ draw: 2, order: [], searchPanes: {} }, done);
        await vi.waitFor(() => {
            expect(onFilterChange).toHaveBeenCalledTimes(2);
        });
        finish({ items: [], choices });
        await vi.waitFor(() => {
            expect(done).toHaveBeenCalledTimes(1);
        });
        expect(done.mock.calls[0]?.[0].draw).toBe(2);
    });
    it("filters a complete cached code locally while keeping full-scope cascading counts", () => {
        const item = { id: "a", code: "FF001", project: { id: "p", name: "P" }, housingType: "A", sourceStatus: "Available" } as UnitSummary;
        const base = {
            code: [
                { label: "FF001", value: "FF001", total: 1, count: 1 },
                { label: "FF002", value: "FF002", total: 1, count: 1 },
            ],
            projectIds: [{ label: "P", value: "p", total: 2, count: 2 }],
            housingType: [{ label: "A", value: "A", total: 2, count: 2 }],
            status: [{ label: "Available", value: "Available", total: 2, count: 2 }],
        };
        const result = localUnitPaneData([item], base, { ...unitPaneSelection(), code: ["FF001"] });
        expect(result?.items).toEqual([item]);
        expect(result?.choices?.projectIds[0]?.count).toBe(1);
        expect(result?.choices?.code[1]?.count).toBe(1);
        expect(localUnitPaneData([item], base, { ...unitPaneSelection(), code: ["FF002"] })).toBeUndefined();
        expect(localUnitPaneData([item], base, { ...unitPaneSelection(), projectIds: ["p"] })).toBeUndefined();
    });
    it("coalesces clear-all redraws, preserves local sorting and never queries on header sorting", async () => {
        const items = [
            { id: "a", code: "FF001", project: { id: "p", name: "P" } },
            { id: "b", code: "FF002", project: { id: "p", name: "P" } },
        ] as UnitSummary[];
        const choices = { code: [], housingType: [], status: [], projectIds: [{ label: "P", value: "p", total: 2, count: 2 }] };
        const onFilterChange = vi.fn().mockResolvedValue({ items, choices });
        const ajax = createUnitPaneAjax(() => ({ items, choices, onFilterChange }), vi.fn());
        const done = vi.fn<(response: UnitPaneAjaxResponse) => void>();
        ajax({ draw: 1, order: [{ column: 1, dir: "desc" }] }, done);
        await vi.waitFor(() => {
            expect(done).toHaveBeenCalledTimes(1);
        });
        expect(done.mock.calls[0]?.[0].data.map((row: UnitSummary) => row.id)).toEqual(["b", "a"]);
        expect(onFilterChange).not.toHaveBeenCalled();
        ajax({ draw: 2, order: [], searchPanes: { code: { 0: "FF001" } } }, done);
        ajax({ draw: 3, order: [], searchPanes: { code: {} } }, done);
        await vi.waitFor(() => {
            expect(done).toHaveBeenCalledTimes(2);
        });
        expect(onFilterChange).not.toHaveBeenCalled();
    });
    it("shares an in-flight filter request with subsequent header draws", async () => {
        const choices = { code: [], housingType: [], status: [], projectIds: [] };
        let finish: (result: { items: UnitSummary[]; choices: typeof choices }) => void = () => {};
        const onFilterChange = vi.fn(
            () =>
                new Promise<{ items: UnitSummary[]; choices: typeof choices }>((resolve) => {
                    finish = resolve;
                }),
        );
        const ajax = createUnitPaneAjax(() => ({ items: [], choices, onFilterChange }), vi.fn());
        const done = vi.fn<(response: UnitPaneAjaxResponse) => void>();
        ajax({ draw: 1, order: [], searchPanes: { code: ["FF001"] } }, done);
        await Promise.resolve();
        ajax({ draw: 2, order: [{ column: 1, dir: "desc" }], searchPanes: { code: ["FF001"] } }, done);
        await Promise.resolve();
        expect(onFilterChange).toHaveBeenCalledTimes(1);
        finish({ items: [], choices });
        await vi.waitFor(() => {
            expect(done).toHaveBeenCalledTimes(1);
        });
        expect(done.mock.calls[0]?.[0].draw).toBe(2);
    });
    it("invalidates rows when a filter request fails instead of claiming old rows match new selections", async () => {
        const choices = { code: [], housingType: [], status: [], projectIds: [] };
        const ajax = createUnitPaneAjax(() => ({ items: [{ id: "old" } as UnitSummary], choices, onFilterChange: vi.fn().mockResolvedValue(undefined) }), vi.fn());
        const done = vi.fn<(response: UnitPaneAjaxResponse) => void>();
        ajax({ draw: 1, order: [], searchPanes: { code: ["FF001"] } }, done);
        await vi.waitFor(() => {
            expect(done).toHaveBeenCalledTimes(1);
        });
        expect(done.mock.calls[0]?.[0].data).toEqual([]);
    });
    it("retains every selected value and uses canonical project IDs, not display names", () => {
        expect(unitPaneSelection({ code: { 0: "FF002", 1: "FF001" }, "project.name": { 0: "canonical" }, sourceStatus: ["Sold", "Available"] })).toEqual({ code: ["FF001", "FF002"], projectIds: ["canonical"], housingType: [], status: ["Available", "Sold"] });
        expect(unitPaneSelection()).toEqual({ code: [], projectIds: [], housingType: [], status: [] });
    });
    it("loads counts across facet pages without fetching full inventory", async () => {
        vi.mocked(listUnitFacets).mockImplementation((_filter, kind, after) => Promise.resolve({ items: kind === "code" ? [{ value: after ? "FF101" : "FF001", count: 1 }] : kind === "projectIds" ? [{ value: "canonical", count: 2 }] : [], nextAfter: kind === "code" && after === undefined ? "FF001" : null }));
        const base = await loadUnitFilePaneChoices({ projectIds: ["canonical"], limit: 50 }, "administration", [{ id: "canonical", name: "Project" }]);
        expect(base.code.map((row) => row.value)).toEqual(["FF001", "FF101"]);
        expect(unitPaneResponse(base).options["project.name"]).toEqual([{ label: "Project", value: "canonical", count: 2, total: 2 }]);
        vi.mocked(listUnitFacets).mockResolvedValue({ items: [{ value: "FF101", count: 1 }], nextAfter: null });
        const filtered = await loadUnitFilePaneChoices({ projectIds: ["canonical"], limit: 50 }, "administration", [], base);
        expect(filtered.code).toEqual([
            { label: "FF001", value: "FF001", total: 1, count: 0 },
            { label: "FF101", value: "FF101", total: 1, count: 1 },
        ]);
    });
    it("rejects repeated facet cursors", async () => {
        vi.mocked(listUnitFacets).mockResolvedValue({ items: [], nextAfter: "repeated" });
        await expect(loadUnitFilePaneChoices({ projectIds: ["canonical"], limit: 50 }, "administration")).rejects.toThrow("Repeated unit option cursor");
    });
});
