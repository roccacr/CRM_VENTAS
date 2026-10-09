import "@testing-library/jest-dom/vitest";

import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ADMINISTRATION_CATALOGS } from "../../src/modules/administration/catalogs/catalog-definitions";
import { CatalogItemDetailDrawer } from "../../src/modules/administration/catalogs/CatalogItemDetailDrawer";
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

    it("aligns project filter tracks with measured table headers", async () => {
        const geometry = vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
            const index = this instanceof HTMLTableCellElement ? this.cellIndex : 0;
            return this.tagName === "TH" ? new DOMRect(100 + index * 200, 0, 200, 40) : new DOMRect(100, 0, 1000, 40);
        });
        try {
            const catalog = ADMINISTRATION_CATALOGS.find((catalog) => catalog.code === "projects");
            if (!catalog) throw new Error("Projects catalog missing");
            mockListCatalogItems.mockResolvedValue({ catalog: { code: catalog.code, label: catalog.label, moduleCode: catalog.moduleCode }, items: [item], total: 1 });
            render(<CatalogItemsPage catalog={catalog} />);
            const row = (await screen.findByText(item.name)).closest(".administration-users-datatable-wrap");
            if (!(row instanceof HTMLElement)) throw new Error("Table wrapper missing");
            await waitFor(() => {
                expect(row.style.getPropertyValue("--projects-filter-tracks")).toBe("200px 200px 200px 200px 200px");
                expect(row.style.getPropertyValue("--projects-filter-offset")).toBe("0px");
            });
        } finally {
            geometry.mockRestore();
        }
    });

    it.each(ADMINISTRATION_CATALOGS)("isolates the projects presentation from $code", async (catalog) => {
        mockListCatalogItems.mockResolvedValue({ catalog: { code: catalog.code, label: catalog.label, moduleCode: catalog.moduleCode }, items: [item], total: 1 });
        render(<CatalogItemsPage catalog={catalog} />);
        const row = (await screen.findByText(item.name)).closest("tr");
        if (!row) throw new Error("Row missing");
        const projects = catalog.code === "projects";
        expect(screen.getByRole("button", { name: projects ? /Nuevo proyecto/ : /Nuevo valor/ })).toBeInTheDocument();
        expect(Boolean(screen.queryByRole("button", { name: "Actualizar proyectos" }))).toBe(projects);
        expect(Boolean(row.closest(".catalog-items-page--projects"))).toBe(projects);
        await waitFor(() => {
            expect(Boolean(within(row).queryByText("Odoo"))).toBe(projects);
            expect(Boolean(within(row).queryByText(item.nativeCode))).toBe(!projects);
            expect(row.querySelector("time")?.getAttribute("datetime") ?? null).toBe(projects ? item.updatedAt : null);
            expect(row.querySelectorAll("[data-project-field]")).toHaveLength(projects ? 5 : 0);
            expect(row).toHaveAttribute("tabindex", "0");
        });
        fireEvent.click(row);
        const drawer = await screen.findByRole("dialog");
        expect(Boolean(drawer.closest(".catalog-item-detail-drawer--projects"))).toBe(projects);
        expect(drawer.querySelectorAll(".projects-view-reference-status")).toHaveLength(projects ? 2 : 0);
    });

    it("groups project search and create/edit fields without changing optional references", async () => {
        const catalog = ADMINISTRATION_CATALOGS[0];
        if (!catalog) throw new Error("Catalog missing");
        mockListCatalogItems.mockResolvedValue({ catalog: { code: catalog.code, label: catalog.label, moduleCode: catalog.moduleCode }, items: [item], total: 1 });
        render(<CatalogItemsPage catalog={catalog} />);
        await screen.findByText(item.name);
        expect(screen.getByRole("searchbox").closest(".projects-view-search-section")).not.toBeNull();
        fireEvent.click(screen.getByRole("button", { name: /Nuevo proyecto/ }));
        const create = await screen.findByRole("dialog");
        expect(create.closest(".catalog-items-modal--projects")).not.toBeNull();
        expect(within(create).getByRole("group", { name: "Información del registro" })).toContainElement(within(create).getByLabelText("Nombre"));
        expect(within(create).getByRole("group", { name: "NetSuite" })).toContainElement(within(create).getByRole("textbox", { name: /ID NetSuite/ }));
        expect(within(create).getByRole("group", { name: "Odoo" })).toContainElement(within(create).getByRole("textbox", { name: /ID Odoo/ }));
        expect(within(create).getByRole("group", { name: "Auditoría" })).toContainElement(within(create).getByLabelText("Motivo de auditoría"));
        expect(within(create).getByRole("textbox", { name: /ID Odoo/ })).not.toHaveAttribute("aria-required", "true");
        cleanup();
        render(<CatalogItemsPage catalog={catalog} />);
        await screen.findByText(item.name);
        fireEvent.click(screen.getByRole("row", { name: `Ver detalle de ${item.name}` }));
        const drawer = await screen.findByRole("dialog");
        fireEvent.click(within(drawer).getByRole("button", { name: "Editar" }));
        const edit = (await screen.findByRole("button", { name: /Guardar cambios/ })).closest('[role="dialog"]');
        if (!(edit instanceof HTMLElement)) throw new Error("Edit dialog missing");
        expect(within(edit).getByRole("group", { name: "NetSuite" })).toContainElement(within(edit).getByRole("textbox", { name: /ID NetSuite/ }));
        expect(within(edit).getByRole("textbox", { name: /ID NetSuite/ })).toHaveValue("1");
    });

    it("centers the enterprise projects loader while the initial request is pending", () => {
        const catalog = ADMINISTRATION_CATALOGS[0];
        if (!catalog) throw new Error("Catalog missing");
        mockListCatalogItems.mockReturnValue(new Promise(() => {}));
        render(<CatalogItemsPage catalog={catalog} />);
        const loading = screen.getByRole("status", { name: "Cargando proyectos" });
        expect(within(loading).getByText("Cargando proyectos...")).toBeInTheDocument();
        expect(within(loading).getByText("Sincronizando registros y catálogo CRM")).toBeInTheDocument();
        expect(loading.querySelector(".projects-view-loader__ring")).toBeInTheDocument();
        expect(loading.querySelector(".ant-skeleton")).not.toBeInTheDocument();
        expect(screen.getByRole("region", { name: "Listado de Proyectos" })).toHaveAttribute("aria-busy", "true");
        expect(screen.getByRole("button", { name: "Actualizar proyectos" })).toBeDisabled();
    });

    it("uses airy label/value placeholders in the project drawer only", () => {
        const props = { catalogLabel: "Proyectos", error: null, isLoading: true, item: null, open: true, position: 0, total: 0, onClose: vi.fn(), onEdit: vi.fn(), onRefresh: vi.fn(), onStatusAction: vi.fn(), onSelectPrevious: vi.fn(), onSelectNext: vi.fn() };
        const view = render(<CatalogItemDetailDrawer {...props} projectView />);
        const loading = screen.getByRole("status", { name: "Cargando detalle" });
        expect(loading.querySelectorAll(".projects-view-detail-loading__pair")).toHaveLength(5);
        expect(loading.querySelectorAll(".ant-skeleton")).toHaveLength(10);
        view.rerender(<CatalogItemDetailDrawer {...props} projectView={false} />);
        expect(screen.getByRole("status", { name: "Cargando detalle" }).querySelector(".ant-skeleton-paragraph")).toBeInTheDocument();
    });

    it("crossfades the project loader into resolved data", async () => {
        const catalog = ADMINISTRATION_CATALOGS[0];
        if (!catalog) throw new Error("Catalog missing");
        let resolveRequest: ((value: Awaited<ReturnType<typeof listCatalogItems>>) => void) | undefined;
        mockListCatalogItems.mockReturnValue(
            new Promise((resolve) => {
                resolveRequest = resolve;
            }),
        );
        render(<CatalogItemsPage catalog={catalog} />);
        expect(screen.getByRole("status", { name: "Cargando proyectos" })).toBeInTheDocument();
        resolveRequest?.({ catalog: { code: catalog.code, label: catalog.label, moduleCode: catalog.moduleCode }, items: [item], total: 1 });
        await screen.findByRole("row", { name: `Ver detalle de ${item.name}` });
        await waitFor(() => {
            expect(screen.queryByRole("status", { name: "Cargando proyectos" })).not.toBeInTheDocument();
        });
        expect(screen.getByRole("region", { name: "Listado de Proyectos" })).toHaveAttribute("aria-busy", "false");
    });

    it("does not apply the project skeleton to other catalogs", () => {
        const catalog = ADMINISTRATION_CATALOGS.find((entry) => entry.code !== "projects");
        if (!catalog) throw new Error("Catalog missing");
        mockListCatalogItems.mockReturnValue(new Promise(() => {}));
        render(<CatalogItemsPage catalog={catalog} />);
        expect(screen.queryByRole("status", { name: "Cargando proyectos" })).not.toBeInTheDocument();
    });

    it("recovers an initial projects failure from the list refresh control", async () => {
        const catalog = ADMINISTRATION_CATALOGS[0];
        if (!catalog) throw new Error("Catalog missing");
        mockListCatalogItems.mockRejectedValueOnce(new Error("Network failure"));
        mockListCatalogItems.mockResolvedValueOnce({ catalog: { code: catalog.code, label: catalog.label, moduleCode: catalog.moduleCode }, items: [item], total: 1 });
        render(<CatalogItemsPage catalog={catalog} />);
        expect(await screen.findByRole("alert")).toHaveTextContent("No pudimos cargar el catálogo");
        const refresh = screen.getByRole("button", { name: "Actualizar proyectos" });
        await waitFor(() => expect(refresh).toBeEnabled());
        fireEvent.click(refresh);
        expect(await screen.findByText(item.name)).toBeInTheDocument();
        expect(screen.queryByRole("alert")).not.toBeInTheDocument();
        expect(screen.getByRole("region", { name: "Listado de Proyectos" })).toHaveAttribute("aria-busy", "false");
        expect(mockListCatalogItems).toHaveBeenCalledTimes(2);
    });

    it("keeps mobile sorting bound to the same table order", async () => {
        const catalog = ADMINISTRATION_CATALOGS[0];
        if (!catalog) throw new Error("Catalog missing");
        mockListCatalogItems.mockResolvedValue({ catalog: { code: catalog.code, label: catalog.label, moduleCode: catalog.moduleCode }, items: [item, { ...item, name: "Zulu", publicId: "second" }], total: 2 });
        render(<CatalogItemsPage catalog={catalog} />);
        await screen.findByText(item.name);
        const sort = screen.getByLabelText("Ordenar proyectos");
        fireEvent.change(sort, { target: { value: "0,desc" } });
        await waitFor(() => expect(screen.getAllByRole("row", { name: /Ver detalle de/ })[0]).toHaveTextContent("Zulu"));
        expect(sort).toHaveValue("0,desc");
    });

    it.each(["Odoo", item.nativeCode, "NetSuite: 1"])("keeps displayed provider fallbacks and native identifiers searchable: %s", async (search) => {
        const catalog = ADMINISTRATION_CATALOGS[0];
        if (!catalog) throw new Error("Catalog missing");
        const key = `rocca.administration.catalogs.${catalog.code}.datatable.v1`;
        window.localStorage.setItem(key, JSON.stringify({ time: Date.now(), start: 0, length: 10, order: [[0, "asc"]], search: { search }, columns: Array.from({ length: 5 }, () => ({ search: { search: "" }, visible: true })) }));
        mockListCatalogItems.mockResolvedValue({ catalog: { code: catalog.code, label: catalog.label, moduleCode: catalog.moduleCode }, items: [item], total: 1 });
        render(<CatalogItemsPage catalog={catalog} />);
        expect(await screen.findByText(item.name)).toBeInTheDocument();
        expect(screen.getByRole("table", { name: "Proyectos" })).toBeInTheDocument();
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
