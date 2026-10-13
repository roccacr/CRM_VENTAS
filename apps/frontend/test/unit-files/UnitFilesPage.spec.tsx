import "@testing-library/jest-dom/vitest";

import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getUnitFile, listUnitFacets, listUnitFiles, listUnitProjects } from "../../src/modules/administration/unit-files/unit-files.api";
import { UnitFilesPage } from "../../src/modules/administration/unit-files/UnitFilesPage";

vi.mock("../../src/modules/administration/unit-files/unit-files.api", () => ({ listUnitFacets: vi.fn(), listUnitProjects: vi.fn(), listUnitFiles: vi.fn(), getUnitFile: vi.fn() }));
const id = "01M4RCK911NS2ZNCRYPBD40B9W";
const item = { id: "legacy:unit-files:1", nativeCode: null, legacyId: 1, project: { id, name: "Amara" }, code: "AM-101", housingType: "Modelo A", status: "available", sourceStatus: "1. Disponible para Venta", advertisedSalePrice: "100", habitableArea: "50", estimatedDelivery: "2027", totalArea: "80", lotArea: "60", approximateParkingArea: "20", updatedAt: null };
describe("Unit Files view", () => {
    afterEach(cleanup);
    beforeEach(() => {
        vi.stubGlobal(
            "ResizeObserver",
            class {
                observe() {}
                unobserve() {}
                disconnect() {}
            },
        );
        vi.resetAllMocks();
        vi.mocked(listUnitProjects).mockResolvedValue([{ id, name: "Amara" }]);
        vi.mocked(listUnitFacets).mockImplementation((_filter, kind) => Promise.resolve({ items: [{ value: kind === "housingType" ? "Modelo A" : kind === "projectIds" ? id : kind === "status" ? item.sourceStatus : "AM-101", count: 1 }], nextAfter: null }));
        vi.mocked(listUnitFiles).mockResolvedValue({ items: [item], pagination: { limit: 50, returned: 1, hasNext: false, nextCursor: null } });
    });
    it("does not load inventory until a project and Search are selected", async () => {
        render(<UnitFilesPage />);
        await waitFor(() => {
            expect(listUnitProjects).toHaveBeenCalledTimes(1);
        });
        expect(listUnitFiles).not.toHaveBeenCalled();
        expect(screen.getByRole("button", { name: "Buscar expedientes" })).toBeDisabled();
        fireEvent.mouseDown(screen.getByRole("combobox", { name: "Proyectos" }));
        fireEvent.click(await screen.findByText("Amara"));
        fireEvent.click(screen.getByRole("button", { name: "Buscar expedientes" }));
        expect(await screen.findByText("AM-101")).toBeInTheDocument();
        for (const name of ["Código", "Proyecto", "Tipo de vivienda", "Precio de venta", "Estado", "Entrega estimada", "Área total (m²)", "Lote (m²)", "Área de parqueo (m²)"]) expect(screen.getByRole("columnheader", { name })).toBeInTheDocument();
        expect(screen.queryByRole("combobox", { name: "Tipo de vivienda" })).not.toBeInTheDocument();
        expect(screen.queryByRole("combobox", { name: "Unidad" })).not.toBeInTheDocument();
        expect(screen.queryByRole("searchbox", { name: "Buscar" })).not.toBeInTheDocument();
        expect(document.querySelector('[data-filter-engine="searchpanes"]')).toBeInTheDocument();
        expect(listUnitFiles).toHaveBeenCalledWith(expect.objectContaining({ projectIds: [id], limit: 50 }), "administration");
    });
    it("keeps rows visible while fetching next, and serves Back from its bounded cache", async () => {
        vi.mocked(listUnitFiles).mockResolvedValueOnce({ items: [item], pagination: { limit: 50, returned: 1, hasNext: true, nextCursor: "cursor-2" } });
        let finish: (value: Awaited<ReturnType<typeof listUnitFiles>>) => void = () => {};
        vi.mocked(listUnitFiles).mockImplementationOnce(
            () =>
                new Promise((resolve) => {
                    finish = resolve;
                }),
        );
        render(<UnitFilesPage />);
        await waitFor(() => {
            expect(listUnitProjects).toHaveBeenCalledTimes(1);
        });
        fireEvent.mouseDown(screen.getByRole("combobox", { name: "Proyectos" }));
        fireEvent.click(await screen.findByText("Amara"));
        fireEvent.click(screen.getByRole("button", { name: "Buscar expedientes" }));
        await screen.findByText("AM-101");
        fireEvent.click(screen.getByRole("checkbox", { name: "Comparar AM-101" }));
        const selectionBar = screen.getByText("1 / 8 seleccionados").closest(".unit-files-selection");
        expect(screen.getByRole("button", { name: "table Comparar" })).toBeDisabled();
        fireEvent.click(screen.getByRole("button", { name: "Página siguiente" }));
        expect(screen.getByText("AM-101")).toBeInTheDocument();
        expect(screen.getByRole("status")).toHaveTextContent("Cargando expedientes");
        finish({ items: [{ ...item, id: "legacy:unit-files:2", code: "AM-102" }], pagination: { limit: 50, returned: 1, hasNext: false, nextCursor: null } });
        await screen.findByText("AM-102");
        fireEvent.click(screen.getByRole("checkbox", { name: "Comparar AM-102" }));
        expect(screen.getByText("2 / 8 seleccionados").closest(".unit-files-selection")).toBe(selectionBar);
        expect(screen.getByRole("button", { name: "table Comparar" })).toBeEnabled();
        fireEvent.click(screen.getByRole("button", { name: "Página anterior" }));
        expect(screen.getByText("AM-101")).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "table Comparar" })).toBeEnabled();
        expect(listUnitFiles).toHaveBeenCalledTimes(2);
        expect(screen.queryByRole("status")).not.toBeInTheDocument();
    });
    it("allows selecting and submitting more than three projects", async () => {
        const projects = ["Amara", "Andira", "AVIVA", "BC Lofts"].map((name, index) => ({ id: id.slice(0, -1) + String(index), name }));
        vi.mocked(listUnitProjects).mockResolvedValue(projects);
        render(<UnitFilesPage />);
        fireEvent.mouseDown(screen.getByRole("combobox", { name: "Proyectos" }));
        for (const project of projects) fireEvent.click(await screen.findByText(project.name, { selector: ".ant-select-item-option-content" }));
        fireEvent.click(screen.getByRole("button", { name: "Buscar expedientes" }));
        await waitFor(() => {
            expect(listUnitFiles).toHaveBeenCalledWith(expect.objectContaining({ projectIds: projects.map((project) => project.id) }), "administration");
        });
    });
    it("searches code fragments across all projects without requiring a project selection", async () => {
        render(<UnitFilesPage />);
        await waitFor(() => {
            expect(listUnitProjects).toHaveBeenCalledTimes(1);
        });
        fireEvent.change(screen.getByRole("textbox", { name: "Código de expediente" }), { target: { value: "ff03" } });
        fireEvent.click(screen.getByRole("button", { name: "Buscar expedientes" }));
        await waitFor(() => {
            expect(listUnitFiles).toHaveBeenCalledWith(expect.objectContaining({ projectIds: [id], codeMatch: "ff03" }), "administration");
        });
    });
    it("filters the complete scope through the API, including options outside the loaded page", async () => {
        vi.mocked(listUnitFacets).mockResolvedValue({ items: [{ value: "Modelo fuera de página", count: 1 }], nextAfter: null });
        vi.mocked(listUnitFiles).mockResolvedValue({ items: [item, { ...item, id: "legacy:unit-files:2", code: "AM-102", housingType: "Modelo B" }], pagination: { limit: 50, returned: 2, hasNext: false, nextCursor: null } });
        render(<UnitFilesPage />);
        expect(screen.queryByRole("combobox", { name: "Unidad" })).not.toBeInTheDocument();
        expect(screen.queryByRole("combobox", { name: "Tipo de vivienda" })).not.toBeInTheDocument();
        fireEvent.mouseDown(screen.getByRole("combobox", { name: "Proyectos" }));
        fireEvent.click(await screen.findByText("Amara"));
        fireEvent.click(screen.getByRole("button", { name: "Buscar expedientes" }));
        await screen.findByRole("button", { name: "AM-101" });
        expect(document.querySelector("table.dataTable")).toBeInTheDocument();
        expect(screen.queryByRole("combobox", { name: "Unidad" })).not.toBeInTheDocument();
        for (const name of ["Código", "Proyecto", "Tipo de vivienda", "Filtrar estado"]) expect(screen.queryByRole("combobox", { name })).not.toBeInTheDocument();
        expect(document.querySelector('[data-filter-engine="searchpanes"]')).toBeInTheDocument();
        expect(listUnitFacets).toHaveBeenCalledWith(expect.objectContaining({ projectIds: [id] }), "housingType", undefined, "administration");
    });
    it("updates comparison selection without replacing table cells or querying again", async () => {
        render(<UnitFilesPage />);
        fireEvent.mouseDown(screen.getByRole("combobox", { name: "Proyectos" }));
        fireEvent.click(await screen.findByText("Amara"));
        fireEvent.click(screen.getByRole("button", { name: "Buscar expedientes" }));
        const codeButton = await screen.findByRole("button", { name: "AM-101" });
        for (let count = 0; count < 3; count++) {
            fireEvent.click(screen.getByRole("checkbox", { name: "Comparar AM-101" }));
            expect(await screen.findByText("1 / 8 seleccionados")).toBeInTheDocument();
            const selectionBar = screen.getByText("1 / 8 seleccionados").closest(".unit-files-selection");
            expect(selectionBar?.closest(".projects-view-toolbar")).not.toBeNull();
            if (!selectionBar) throw new Error("Missing selection bar");
            fireEvent.click(screen.getByRole("button", { name: "Limpiar selección" }));
            await waitFor(() => {
                expect(screen.getByRole("checkbox", { name: "Comparar AM-101" })).not.toBeChecked();
            });
            expect(screen.getByRole("button", { name: "AM-101" })).toBe(codeButton);
        }
        expect(listUnitFiles).toHaveBeenCalledTimes(1);
    });
    it.each(["https://rocca.box.com/s/2zlwbc4sh6lw4jfwtm62oklh31oi6bkx", "javascript:alert(1)", "not a URL"])("renders plans safely: %s", async (unitPlans) => {
        vi.mocked(getUnitFile).mockResolvedValue({ ...item, values: { unitPlans }, sourceMetadata: { projectReference: "43" }, externalReferences: [] });
        render(<UnitFilesPage />);
        fireEvent.mouseDown(screen.getByRole("combobox", { name: "Proyectos" }));
        fireEvent.click(await screen.findByText("Amara"));
        fireEvent.click(screen.getByRole("button", { name: "Buscar expedientes" }));
        fireEvent.click(await screen.findByRole("button", { name: "AM-101" }));
        const drawer = await screen.findByRole("dialog");
        const text = await within(drawer).findByText(unitPlans);
        if (unitPlans.startsWith("https://")) {
            expect(text).toHaveAttribute("href", unitPlans);
            expect(text).toHaveAttribute("target", "_blank");
            expect(text).toHaveAttribute("rel", "noopener noreferrer");
        } else expect(text.closest("a")).toBeNull();
    });
    it("shows all 27 business fields, canonical project identity, source metadata and provider status in grouped detail", async () => {
        const keys = [
            "code",
            "projectNameSnapshot",
            "housingType",
            "lotArea",
            "sourceStatus",
            "advertisedSalePrice",
            "habitableArea",
            "totalArea",
            "approximateMaintenanceFee",
            "unitPlans",
            "estimatedDelivery",
            "storageArea",
            "mezzanineArea",
            "balconyArea",
            "groundFloorArea",
            "upperFloorArea",
            "extensionArea",
            "terraceArea",
            "pricePerSquareMeter",
            "thirdLevelBasementArea",
            "approximateParkingArea",
            "externalGardenArea",
            "slopedGardenArea",
            "openCommonArea",
            "minimumSalePrice",
            "modifiedAt",
            "cronValue",
        ];
        vi.mocked(getUnitFile).mockResolvedValue({ ...item, values: Object.fromEntries(keys.map((key) => [key, `value:${key}`])), sourceMetadata: { projectReference: "43" }, externalReferences: [{ systemCode: "provider", externalId: "123", status: "active" }] });
        render(<UnitFilesPage />);
        fireEvent.mouseDown(screen.getByRole("combobox", { name: "Proyectos" }));
        fireEvent.click(await screen.findByText("Amara"));
        fireEvent.click(screen.getByRole("button", { name: "Buscar expedientes" }));
        fireEvent.click(await screen.findByRole("button", { name: "AM-101" }));
        const drawer = await screen.findByRole("dialog");
        for (const key of keys) expect(await within(drawer).findByText(`value:${key}`)).toBeInTheDocument();
        expect(within(drawer).getByText(id)).toBeInTheDocument();
        expect(within(drawer).getByText("43")).toBeInTheDocument();
        expect(within(drawer).getByText("Activo")).toBeInTheDocument();
        expect(within(drawer).queryByText("legacy:unit-files:1")).not.toBeInTheDocument();
    });
});
