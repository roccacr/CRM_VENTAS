import "@testing-library/jest-dom/vitest";

import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ADMINISTRATION_CATALOGS } from "../../src/modules/administration/catalogs/catalog-definitions";
import { CatalogItemsPage } from "../../src/modules/administration/catalogs/CatalogItemsPage";
import type * as CatalogServiceModule from "../../src/services/catalogs/catalog-service";
import { listCatalogItems, updateCatalogItem } from "../../src/services/catalogs/catalog-service";
import { installBrowserApiDoubles } from "../support/browser";

vi.mock("../../src/services/catalogs/catalog-service", async (importOriginal) => {
    const actual = await importOriginal<typeof CatalogServiceModule>();

    return {
        ...actual,
        createCatalogItem: vi.fn(),
        listCatalogItems: vi.fn(),
        updateCatalogItem: vi.fn(),
        updateCatalogItemStatus: vi.fn(),
    };
});

const mockListCatalogItems = vi.mocked(listCatalogItems);
const item = { publicId: "project_001", nativeCode: "projects_native", name: "Lomas del Valle", detail: "Project details", status: "active" as const, updatedAt: "2026-10-08T12:00:00.000Z", externalReferences: [{ externalId: "1", systemCode: "netsuite", systemName: "NetSuite", status: "active" }] };

describe("CatalogItemsPage", () => {
    beforeEach(() => {
        installBrowserApiDoubles();
        window.localStorage.clear();
        mockListCatalogItems.mockResolvedValue({
            catalog: { code: "projects", label: "Proyectos", moduleCode: "catalog_project" },
            items: [],
            total: 0,
        });
    });

    afterEach(() => {
        cleanup();
        vi.clearAllMocks();
    });

    it("uses the users DataTables search pattern and loads the next catalog batch", async () => {
        const catalog = ADMINISTRATION_CATALOGS[0];
        if (!catalog) throw new Error("Catalog missing");
        mockListCatalogItems.mockResolvedValueOnce({ catalog: { code: catalog.code, label: catalog.label, moduleCode: catalog.moduleCode }, items: [item], total: 2 });
        mockListCatalogItems.mockResolvedValueOnce({ catalog: { code: catalog.code, label: catalog.label, moduleCode: catalog.moduleCode }, items: [{ ...item, publicId: "second", name: "Second project" }], total: 2 });
        render(<CatalogItemsPage catalog={catalog} />);
        expect(await screen.findByRole("searchbox", { name: "Buscar:" })).toBeInTheDocument();
        expect(screen.queryByRole("radio", { name: /Todos/ })).not.toBeInTheDocument();
        fireEvent.click(screen.getByRole("button", { name: "Cargar más" }));
        await waitFor(() => {
            expect(mockListCatalogItems).toHaveBeenLastCalledWith(catalog.code, expect.objectContaining({ offset: 1, limit: 100, moduleCode: "administration" }));
        });
        expect(await screen.findByText("Second project")).toBeInTheDocument();
        expect(screen.queryByRole("button", { name: "Cargar más" })).not.toBeInTheDocument();
    });

    it("restores local search without leaking filters into another catalog or module", async () => {
        const catalog = ADMINISTRATION_CATALOGS[0];
        const other = ADMINISTRATION_CATALOGS[1];
        if (!catalog || !other) throw new Error("Catalog missing");
        const key = `rocca.administration.catalogs.${catalog.code}.datatable.v1`;
        window.localStorage.setItem(key, JSON.stringify({ time: Date.now(), start: 0, length: 10, order: [[0, "asc"]], search: { search: "Second" }, columns: Array.from({ length: 5 }, () => ({ search: { search: "" }, visible: true })) }));
        mockListCatalogItems.mockResolvedValue({ catalog: { code: catalog.code, label: catalog.label, moduleCode: catalog.moduleCode }, items: [item, { ...item, name: "Second project", publicId: "second" }], total: 2 });
        const { rerender } = render(<CatalogItemsPage catalog={catalog} />);
        await waitFor(() => expect(screen.getByRole("searchbox", { name: "Buscar:" })).toHaveValue("Second"));
        expect(await screen.findByText("Second project")).toBeInTheDocument();
        expect(screen.queryByText(item.name)).not.toBeInTheDocument();
        rerender(<CatalogItemsPage catalog={other} />);
        await waitFor(() => expect(screen.getByRole("searchbox", { name: "Buscar:" })).toHaveValue(""));
        expect(await screen.findByText(item.name)).toBeInTheDocument();
        rerender(<CatalogItemsPage catalog={catalog} contextModuleCode="ventas" />);
        await waitFor(() => expect(screen.getByRole("searchbox", { name: "Buscar:" })).toHaveValue(""));
    });

    it("retains loaded rows and permits retry after a batch load failure", async () => {
        const catalog = ADMINISTRATION_CATALOGS[0];
        if (!catalog) throw new Error("Catalog missing");
        mockListCatalogItems.mockResolvedValueOnce({ catalog: { code: catalog.code, label: catalog.label, moduleCode: catalog.moduleCode }, items: [item], total: 2 });
        mockListCatalogItems.mockRejectedValueOnce(new Error("Network failure"));
        mockListCatalogItems.mockResolvedValueOnce({ catalog: { code: catalog.code, label: catalog.label, moduleCode: catalog.moduleCode }, items: [{ ...item, publicId: "second", name: "Second project" }], total: 2 });
        render(<CatalogItemsPage catalog={catalog} />);
        fireEvent.click(await screen.findByRole("button", { name: "Cargar más" }));
        expect(await screen.findByRole("alert")).toHaveTextContent("No pudimos cargar más valores");
        expect(screen.getByText(item.name)).toBeInTheDocument();
        await waitFor(() => expect(screen.getByRole("button", { name: "Cargar más" })).toBeEnabled());
        fireEvent.click(screen.getByRole("button", { name: "Cargar más" }));
        expect(await screen.findByText("Second project")).toBeInTheDocument();
    });

    it("carga cada catalogo administrativo con modulo administration y limite 100", async () => {
        for (const catalog of ADMINISTRATION_CATALOGS) {
            const { unmount } = render(<CatalogItemsPage catalog={catalog} />);

            expect(await screen.findByRole("heading", { name: catalog.label })).toBeInTheDocument();
            await waitFor(() => {
                expect(mockListCatalogItems).toHaveBeenLastCalledWith(catalog.code, { limit: 100, moduleCode: "administration", status: "all" });
            });

            unmount();
        }

        expect(mockListCatalogItems).toHaveBeenCalledTimes(ADMINISTRATION_CATALOGS.length);
    });

    it.each(ADMINISTRATION_CATALOGS)("opens complete details on row click for $code", async (catalog) => {
        mockListCatalogItems.mockResolvedValue({ catalog: { code: catalog.code, label: catalog.label, moduleCode: catalog.moduleCode }, items: [item], total: 1 });
        render(<CatalogItemsPage catalog={catalog} />);
        const name = await screen.findByText(item.name);
        const row = name.closest("tr");
        expect(row).not.toBeNull();
        if (!row) throw new Error("Row missing");
        await waitFor(() => {
            expect(row).toHaveAttribute("tabindex", "0");
        });
        fireEvent.click(row);
        const drawer = await screen.findByRole("dialog");
        expect(drawer.closest(".user-detail-drawer")).not.toBeNull();
        expect(drawer.querySelector(".ant-drawer-header .user-detail-drawer__identity-copy h4")).toHaveTextContent(item.name);
        expect(drawer.querySelectorAll(".user-detail-drawer__sections > .ant-card")).toHaveLength(4);
        expect(within(drawer).getByText("Registro 1 de 1")).toBeInTheDocument();
        expect(within(drawer).getByRole("button", { name: "Registro anterior" })).toBeDisabled();
        expect(within(drawer).getByRole("button", { name: "Registro siguiente" })).toBeDisabled();
        expect(within(drawer).getByText(item.publicId)).toBeInTheDocument();
        expect(within(drawer).getByText(item.detail)).toBeInTheDocument();
        expect(within(drawer).getByText("NetSuite")).toBeInTheDocument();
        expect(within(drawer).getByText("Odoo")).toBeInTheDocument();
        const netsuiteCard = within(drawer).getByText("NetSuite").closest(".ant-card");
        const odooCard = within(drawer).getByText("Odoo").closest(".ant-card");
        if (!netsuiteCard || !odooCard) throw new Error("Provider cards missing");
        expect(netsuiteCard).not.toBe(odooCard);
        expect(within(netsuiteCard as HTMLElement).getByText("1")).toBeInTheDocument();
        expect(within(netsuiteCard as HTMLElement).queryByText("Odoo")).not.toBeInTheDocument();
        expect(within(odooCard as HTMLElement).getAllByText("Sin asignar")).toHaveLength(2);
        expect(within(drawer).getAllByText("Sin asignar")).toHaveLength(2);
        expect(within(drawer).getByText("1")).toBeInTheDocument();
        expect(within(drawer).getByRole("button", { name: /Editar/ })).toBeEnabled();
    });

    it("supports keyboard selection without opening details from row actions", async () => {
        const catalog = ADMINISTRATION_CATALOGS[0];
        if (!catalog) throw new Error("Catalog missing");
        mockListCatalogItems.mockResolvedValue({ catalog: { code: catalog.code, label: catalog.label, moduleCode: catalog.moduleCode }, items: [item], total: 1 });
        render(<CatalogItemsPage catalog={catalog} />);
        const row = (await screen.findByText(item.name)).closest("tr");
        if (!row) throw new Error("Row missing");
        await waitFor(() => {
            expect(row).toHaveAttribute("tabindex", "0");
        });
        fireEvent.click(await within(row).findByRole("button"));
        expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
        fireEvent.keyDown(row, { key: "Enter" });
        expect(await screen.findByRole("dialog")).toBeInTheDocument();
    });

    it("shows refresh errors with retry, updates details, and closes cleanly", async () => {
        const catalog = ADMINISTRATION_CATALOGS[0];
        if (!catalog) throw new Error("Catalog missing");
        const response = { catalog: { code: catalog.code, label: catalog.label, moduleCode: catalog.moduleCode }, items: [item], total: 1 };
        mockListCatalogItems.mockResolvedValue(response);
        render(<CatalogItemsPage catalog={catalog} />);
        const row = (await screen.findByText(item.name)).closest("tr");
        if (!row) throw new Error("Row missing");
        await waitFor(() => {
            expect(row).toHaveAttribute("tabindex", "0");
        });
        fireEvent.keyDown(row, { key: " " });
        const drawer = await screen.findByRole("dialog");
        mockListCatalogItems.mockRejectedValueOnce(new Error("private error"));
        fireEvent.click(within(drawer).getByRole("button", { name: "Actualizar detalle" }));
        expect(within(drawer).getByRole("status", { name: "Cargando detalle" })).toBeInTheDocument();
        expect(await within(drawer).findByText("No pudimos cargar el catálogo.")).toBeInTheDocument();
        expect(within(drawer).queryByText(item.publicId)).not.toBeInTheDocument();
        mockListCatalogItems.mockResolvedValueOnce({ ...response, items: [{ ...item, detail: "Updated detail", externalReferences: [] }] });
        fireEvent.click(within(drawer).getByRole("button", { name: "Reintentar" }));
        expect(await within(drawer).findByText("Updated detail")).toBeInTheDocument();
        expect(within(drawer).getByText("NetSuite")).toBeInTheDocument();
        expect(within(drawer).getByText("Odoo")).toBeInTheDocument();
        expect(within(drawer).getAllByText("Sin asignar")).toHaveLength(4);
        fireEvent.click(within(drawer).getByRole("button", { name: "Editar" }));
        expect(await screen.findByRole("heading", { name: "Editar Proyectos" })).toBeInTheDocument();
        expect(screen.getByRole("textbox", { name: "Nombre" })).toHaveValue(item.name);
        fireEvent.keyDown(screen.getByRole("textbox", { name: "Nombre" }), { key: "ArrowDown" });
        expect(within(drawer).getByRole("heading", { name: item.name })).toBeInTheDocument();
        fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
        mockListCatalogItems.mockResolvedValueOnce({ ...response, items: [], total: 0 });
        fireEvent.click(within(drawer).getByRole("button", { name: "Actualizar detalle" }));
        expect(await within(drawer).findByText("Este registro ya no está disponible en el listado actual.")).toBeInTheDocument();
        fireEvent.click(within(drawer).getByRole("button", { name: "Cerrar detalle" }));
        await waitFor(() => {
            expect(drawer).not.toBeInTheDocument();
        });
    });

    it.each([
        { detail: null, references: [], missing: 5 },
        { detail: "   ", references: [{ externalId: " ", systemCode: "odoo", systemName: "Odoo", status: "" }], missing: 5 },
        {
            detail: "Details",
            references: [
                { externalId: "0", systemCode: "odoo", systemName: "Odoo", status: "pending" },
                { externalId: "85", systemCode: "legacy", systemName: "CRM Legacy", status: "inactive" },
            ],
            missing: 2,
        },
        {
            detail: "Details",
            references: [
                { externalId: "11", systemCode: "netsuite", systemName: "NetSuite", status: "active" },
                { externalId: "12", systemCode: "netsuite", systemName: "NetSuite", status: "pending" },
            ],
            missing: 2,
        },
    ])("shows explicit missing values without dropping provider data: $missing fallbacks", async ({ detail, references, missing }) => {
        const catalog = ADMINISTRATION_CATALOGS[0];
        if (!catalog) throw new Error("Catalog missing");
        mockListCatalogItems.mockResolvedValue({ catalog: { code: catalog.code, label: catalog.label, moduleCode: catalog.moduleCode }, items: [{ ...item, detail, externalReferences: references }], total: 1 });
        render(<CatalogItemsPage catalog={catalog} />);
        const row = (await screen.findByText(item.name)).closest("tr");
        if (!row) throw new Error("Row missing");
        await waitFor(() => {
            expect(row).toHaveAttribute("tabindex", "0");
        });
        fireEvent.click(row);
        const drawer = await screen.findByRole("dialog");
        expect(within(drawer).getByText("NetSuite")).toBeInTheDocument();
        expect(within(drawer).getByText("Odoo")).toBeInTheDocument();
        expect(within(drawer).getAllByText("Sin asignar")).toHaveLength(missing);
        expect(drawer.querySelectorAll(".ant-typography-copy")).toHaveLength(2 + references.filter((reference) => reference.externalId.trim()).length);
        for (const reference of references.filter((reference) => reference.externalId.trim())) {
            const providerCard = within(drawer).getByText(reference.systemName).closest<HTMLElement>(".ant-card");
            if (!providerCard) throw new Error("Provider card missing");
            expect(within(providerCard).getByText(reference.externalId)).toBeInTheDocument();
        }
        if (references.some((reference) => reference.systemCode === "legacy")) {
            expect(within(drawer).getByText("CRM Legacy")).toBeInTheDocument();
            expect(within(drawer).getByText("Pendiente")).toBeInTheDocument();
        }
    });

    it("navigates between catalog records using the same footer pattern as users", async () => {
        const catalog = ADMINISTRATION_CATALOGS[0];
        if (!catalog) throw new Error("Catalog missing");
        const nextItem = { ...item, publicId: "project_002", name: "Second project" };
        mockListCatalogItems.mockResolvedValue({ catalog: { code: catalog.code, label: catalog.label, moduleCode: catalog.moduleCode }, items: [item, nextItem], total: 2 });
        render(<CatalogItemsPage catalog={catalog} />);
        const row = (await screen.findByText(item.name)).closest("tr");
        if (!row) throw new Error("Row missing");
        await waitFor(() => {
            expect(row).toHaveAttribute("tabindex", "0");
        });
        fireEvent.click(row);
        const drawer = await screen.findByRole("dialog");
        fireEvent.click(within(drawer).getByRole("button", { name: "Registro siguiente" }));
        expect(within(drawer).getByRole("heading", { name: nextItem.name })).toBeInTheDocument();
        expect(within(drawer).getByText("Registro 2 de 2")).toBeInTheDocument();
        expect(within(drawer).getByRole("button", { name: "Registro siguiente" })).toBeDisabled();
        fireEvent.keyDown(drawer, { key: "ArrowUp" });
        expect(within(drawer).getByRole("heading", { name: item.name })).toBeInTheDocument();
        fireEvent.click(within(drawer).getByRole("button", { name: "Editar" }));
        expect(await screen.findByRole("heading", { name: "Editar Proyectos" })).toBeInTheDocument();
        fireEvent.keyDown(screen.getByRole("button", { name: "Cancelar" }), { key: "ArrowDown" });
        expect(within(drawer).getByRole("heading", { name: item.name })).toBeInTheDocument();
    });

    it("submits project edits without blank Odoo references and keeps the form connected", async () => {
        const warning = vi.spyOn(console, "error");
        const catalog = ADMINISTRATION_CATALOGS[0];
        if (!catalog) throw new Error("Catalog missing");
        mockListCatalogItems.mockResolvedValue({ catalog: { code: catalog.code, label: catalog.label, moduleCode: catalog.moduleCode }, items: [item], total: 1 });
        vi.mocked(updateCatalogItem).mockResolvedValue(item);
        render(<CatalogItemsPage catalog={catalog} />);
        const row = (await screen.findByText(item.name)).closest("tr");
        if (!row) throw new Error("Row missing");
        await waitFor(() => {
            expect(row).toHaveAttribute("tabindex", "0");
        });
        fireEvent.click(row);
        fireEvent.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Editar" }));
        const form = screen.getByRole("textbox", { name: "Nombre" }).closest("form");
        if (!form) throw new Error("Form missing");
        fireEvent.change(within(form).getByRole("textbox", { name: /ID Odoo/ }), { target: { value: "   " } });
        fireEvent.change(within(form).getByRole("textbox", { name: "Motivo de auditoría" }), { target: { value: "Project correction authorized" } });
        fireEvent.click(screen.getByRole("button", { name: /Guardar cambios/ }));
        await waitFor(() => {
            expect(updateCatalogItem).toHaveBeenCalledWith(catalog.code, item.publicId, expect.objectContaining({ externalReferences: [{ systemCode: "netsuite", externalId: "1" }], reason: "Project correction authorized" }));
        });
        expect(warning.mock.calls.flat().join(" ")).not.toContain("is not connected to any Form element");
        warning.mockRestore();
    });
});
