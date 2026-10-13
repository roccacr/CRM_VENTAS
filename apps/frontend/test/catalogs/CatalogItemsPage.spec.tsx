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

/** Projects moves each provider status into its card header and shows the system code as a chip. */
const expectDrawerReferenceLayout = (drawer: HTMLElement, projects: boolean) => {
    const projectCount = projects ? 2 : 0;
    expect(drawer.querySelectorAll(".projects-view-reference-status")).toHaveLength(projectCount);
    expect(drawer.querySelectorAll(".ant-card-extra .projects-view-reference-status")).toHaveLength(projectCount);
    expect(drawer.querySelectorAll(".projects-view-system-code")).toHaveLength(projectCount);
    expect(within(drawer).queryAllByText("Estado de referencia")).toHaveLength(2 - projectCount);
};

describe("CatalogItemsPage", () => {
    it("allows legacy Campaigns editing and status changes with the Projects presentation", () => {
        render(<CatalogItemDetailDrawer catalogLabel="Campañas" error={null} isLoading={false} item={{ ...item, publicId: "legacy:campaigns:42" }} open position={1} total={1} onClose={vi.fn()} onEdit={vi.fn()} onRefresh={vi.fn()} onStatusAction={vi.fn()} onSelectPrevious={vi.fn()} onSelectNext={vi.fn()} projectView />);
        expect(screen.getByRole("button", { name: "Editar" })).toBeEnabled();
        expect(screen.getByRole("button", { name: "Inactivar" })).toBeEnabled();
    });

    it("allows editing and changing status of legacy Projects without a delete action", () => {
        const onEdit = vi.fn();
        const onStatusAction = vi.fn();
        render(<CatalogItemDetailDrawer catalogLabel="Proyectos" error={null} isLoading={false} item={{ ...item, publicId: "legacy:projects:42", nativeCode: "legacy_projects_42", updatedAt: "" }} open position={1} total={1} onClose={vi.fn()} onEdit={onEdit} onRefresh={vi.fn()} onStatusAction={onStatusAction} onSelectPrevious={vi.fn()} onSelectNext={vi.fn()} projectView />);
        const edit = screen.getByRole("button", { name: "Editar" });
        const deactivate = screen.getByRole("button", { name: "Inactivar" });
        expect(edit).toBeEnabled();
        expect(deactivate).toBeEnabled();
        fireEvent.click(edit);
        fireEvent.click(deactivate);
        expect(onEdit).toHaveBeenCalledOnce();
        expect(onStatusAction).toHaveBeenCalledOnce();
        expect(screen.queryByRole("button", { name: /eliminar/i })).not.toBeInTheDocument();
        expect(screen.queryByText("legacy:projects:42")).not.toBeInTheDocument();
        expect(screen.queryByText("legacy_projects_42")).not.toBeInTheDocument();
        expect(screen.getAllByText("Pendiente de migración")).toHaveLength(2);
        expect(screen.getAllByRole("button", { name: "Copy" })).toHaveLength(1);
        expect(onEdit).toHaveBeenCalledWith(expect.objectContaining({ publicId: "legacy:projects:42", nativeCode: "legacy_projects_42" }));
        expect(edit.closest(".catalog-item-detail-drawer__actions")).toContainElement(deactivate);
    });

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

    it.each(ADMINISTRATION_CATALOGS)("limits enterprise presentation to approved catalogs: $code", async (catalog) => {
        mockListCatalogItems.mockResolvedValue({ catalog: { code: catalog.code, label: catalog.label, moduleCode: catalog.moduleCode }, items: [item], total: 1 });
        render(<CatalogItemsPage catalog={catalog} />);
        const row = (await screen.findByText(item.name)).closest("tr");
        if (!row) throw new Error("Row missing");
        const projects = ["projects", "campaigns", "classes", "locations", "subsidiaries", "brokers"].includes(catalog.code);
        const createLabels: Partial<Record<typeof catalog.code, RegExp>> = { brokers: /Nuevo corredor/, subsidiaries: /Nueva subsidiaria/, locations: /Nueva ubicación/, classes: /Nueva clase/, campaigns: /Nueva campaña/, projects: /Nuevo proyecto/ };
        expect(screen.getByRole("button", { name: createLabels[catalog.code] ?? /Nuevo valor/ })).toBeInTheDocument();
        expect(Boolean(screen.queryByRole("button", { name: `Actualizar ${catalog.label.toLocaleLowerCase("es-CR")}` }))).toBe(projects);
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
        expectDrawerReferenceLayout(drawer, projects);
        expect(Boolean(drawer.querySelector(".user-detail-drawer__identity-meta .catalog-items-status--active"))).toBe(projects);
        expect(Boolean(drawer.querySelector(".user-detail-drawer__identity-meta .administration-users-status"))).toBe(!projects);
    });

    it("groups project search and create/edit fields without changing optional references", async () => {
        const catalog = ADMINISTRATION_CATALOGS[0];
        if (!catalog) throw new Error("Catalog missing");
        mockListCatalogItems.mockResolvedValue({ catalog: { code: catalog.code, label: catalog.label, moduleCode: catalog.moduleCode }, items: [item], total: 1 });
        render(<CatalogItemsPage catalog={catalog} />);
        await screen.findByText(item.name);
        expect(screen.getByRole("searchbox").closest(".projects-view-toolbar")).not.toBeNull();
        await waitFor(() => {
            expect(document.querySelector('[aria-label="Descripción: activar para ordenar"]')).not.toBeNull();
        });
        fireEvent.click(screen.getByRole("button", { name: /Nuevo proyecto/ }));
        const create = await screen.findByRole("dialog");
        expect(create.closest(".catalog-items-modal--projects")).not.toBeNull();
        expect(within(create).getByRole("heading", { name: "Nuevo proyecto" })).toBeInTheDocument();
        expect(within(create).getByRole("button", { name: /Crear proyecto/ })).toBeInTheDocument();
        expect(within(create).getByPlaceholderText("Ej. Proyecto principal")).toBeInTheDocument();
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

    it("shows the API total beside the title and a quiet placeholder for missing grid values", async () => {
        const catalog = ADMINISTRATION_CATALOGS[0];
        if (!catalog) throw new Error("Catalog missing");
        mockListCatalogItems.mockResolvedValue({ catalog: { code: catalog.code, label: catalog.label, moduleCode: catalog.moduleCode }, items: [{ ...item, detail: null }], total: 37 });
        render(<CatalogItemsPage catalog={catalog} />);
        const row = (await screen.findByText(item.name)).closest("tr");
        if (!row) throw new Error("Row missing");
        expect(screen.getByText("37 proyectos")).toHaveClass("projects-view-total");
        await waitFor(() => {
            expect(row.querySelectorAll(".projects-view-empty")).toHaveLength(2);
        });
        expect(within(row).getAllByText("Sin asignar")).toHaveLength(2);
        expect(within(row).getByText("1")).toHaveClass("projects-view-integration__id");
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
        const catalog = ADMINISTRATION_CATALOGS.find((entry) => !["projects", "campaigns", "classes", "locations", "subsidiaries", "brokers"].includes(entry.code));
        if (!catalog) throw new Error("Catalog missing");
        mockListCatalogItems.mockReturnValue(new Promise(() => {}));
        render(<CatalogItemsPage catalog={catalog} />);
        expect(screen.queryByRole("status", { name: "Cargando proyectos" })).not.toBeInTheDocument();
    });

    it("uses campaign-specific loading and create form with the shared enterprise layout", async () => {
        const catalog = ADMINISTRATION_CATALOGS.find((entry) => entry.code === "campaigns");
        if (!catalog) throw new Error("Campaigns catalog missing");
        mockListCatalogItems.mockReturnValue(new Promise(() => {}));
        render(<CatalogItemsPage catalog={catalog} />);
        expect(screen.getByRole("status", { name: "Cargando campañas" })).toHaveTextContent("Cargando campañas...");
        fireEvent.click(screen.getByRole("button", { name: /Nueva campaña/ }));
        const dialog = await screen.findByRole("dialog");
        expect(dialog.closest(".catalog-items-modal--projects")).not.toBeNull();
        expect(within(dialog).getByRole("group", { name: "NetSuite" })).toBeInTheDocument();
        expect(within(dialog).getByRole("group", { name: "Odoo" })).toBeInTheDocument();
    });

    it.each([
        { code: "classes", loading: "Cargando clases", create: /Nueva clase/, submit: /Crear clase/, maxLength: "100" },
        { code: "locations", loading: "Cargando ubicaciones", create: /Nueva ubicación/, submit: /Crear ubicación/, maxLength: "100" },
        { code: "brokers", loading: "Cargando corredores", create: /Nuevo corredor/, submit: /Crear corredor/, maxLength: "250" },
        { code: "subsidiaries", loading: "Cargando subsidiarias", create: /Nueva subsidiaria/, submit: /Crear subsidiaria/, maxLength: "250" },
    ])("uses $code loading, form copy and verified name length with enterprise presentation", async ({ code, loading, create, submit, maxLength }) => {
        const catalog = ADMINISTRATION_CATALOGS.find((entry) => entry.code === code);
        if (!catalog) throw new Error("Catalog missing");
        mockListCatalogItems.mockReturnValue(new Promise(() => {}));
        render(<CatalogItemsPage catalog={catalog} />);
        expect(screen.getByRole("status", { name: loading })).toHaveTextContent(`${loading}...`);
        fireEvent.click(screen.getByRole("button", { name: create }));
        const dialog = await screen.findByRole("dialog");
        expect(dialog.closest(".catalog-items-modal--projects")).not.toBeNull();
        expect(within(dialog).getByRole("textbox", { name: "Nombre" })).toHaveAttribute("maxlength", maxLength);
        expect(within(dialog).getByRole("group", { name: "NetSuite" })).toBeInTheDocument();
        expect(within(dialog).getByRole("group", { name: "Odoo" })).toBeInTheDocument();
        expect(within(dialog).getByRole("button", { name: submit })).toBeInTheDocument();
    });

    it("renders campaign data and signed NetSuite identifiers in the table and drawer", async () => {
        const catalog = ADMINISTRATION_CATALOGS.find((entry) => entry.code === "campaigns");
        if (!catalog) throw new Error("Campaigns catalog missing");
        const campaign = { ...item, publicId: "campaign_001", nativeCode: "campaigns_default", name: "Campaña predeterminada", externalReferences: [{ externalId: "-5", systemCode: "netsuite", systemName: "NetSuite", status: "active" }] };
        mockListCatalogItems.mockResolvedValue({ catalog: { code: catalog.code, label: catalog.label, moduleCode: catalog.moduleCode }, items: [campaign], total: 1 });
        render(<CatalogItemsPage catalog={catalog} />);
        const row = await screen.findByRole("row", { name: `Ver detalle de ${campaign.name}` });
        expect(screen.getByRole("columnheader", { name: /^Campaña/ })).toBeInTheDocument();
        expect(screen.getByPlaceholderText("Buscar en Campañas")).toBeInTheDocument();
        expect(await within(row).findByText("-5")).toBeInTheDocument();
        expect(within(row).getByText("Odoo")).toBeInTheDocument();
        fireEvent.click(row);
        const drawer = await screen.findByRole("dialog");
        expect(within(drawer).getByText("-5")).toBeInTheDocument();
        expect(drawer.closest(".catalog-item-detail-drawer--projects")).not.toBeNull();
        fireEvent.click(within(drawer).getByRole("button", { name: "Editar" }));
        const edit = (await screen.findByRole("button", { name: /Guardar cambios/ })).closest('[role="dialog"]');
        if (!(edit instanceof HTMLElement)) throw new Error("Edit dialog missing");
        expect(within(edit).getByRole("heading", { name: "Editar campaña" })).toBeInTheDocument();
        expect(within(edit).getByRole("textbox", { name: /ID NetSuite/ })).toHaveValue("-5");
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

    it("shows loading feedback while retaining rows during the next page request", async () => {
        const catalog = ADMINISTRATION_CATALOGS[0];
        if (!catalog) throw new Error("Catalog missing");
        mockListCatalogItems.mockResolvedValueOnce({ catalog: { code: catalog.code, label: catalog.label, moduleCode: catalog.moduleCode }, items: [item], total: 291 });
        render(<CatalogItemsPage catalog={catalog} />);
        await screen.findByText(item.name);
        await waitFor(() => expect(screen.queryByRole("status", { name: "Cargando proyectos" })).not.toBeInTheDocument());
        mockListCatalogItems.mockReturnValueOnce(new Promise(() => {}));
        fireEvent.click(screen.getByRole("button", { name: "Página siguiente" }));
        expect(screen.getByRole("status", { name: "Cargando proyectos" })).toBeInTheDocument();
        expect(screen.getByText(item.name)).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Página siguiente" })).toBeDisabled();
        expect(screen.getByRole("combobox", { name: "Filas por página" })).toHaveValue("100");
    });

    it("reuses fetched pages without requests or a loader and keeps the grid mounted", async () => {
        const catalog = ADMINISTRATION_CATALOGS[0];
        if (!catalog) throw new Error("Catalog missing");
        const response = { catalog: { code: catalog.code, label: catalog.label, moduleCode: catalog.moduleCode }, items: [item], total: 291 };
        mockListCatalogItems.mockResolvedValueOnce(response).mockResolvedValueOnce({ ...response, items: [{ ...item, publicId: "second", name: "Second project" }] });
        render(<CatalogItemsPage catalog={catalog} />);
        await screen.findByText(item.name);
        const grid = screen.getByRole("table", { name: "Proyectos" });
        fireEvent.click(screen.getByRole("button", { name: "Página siguiente" }));
        await screen.findByText("Second project");
        await waitFor(() => expect(screen.queryByRole("status", { name: "Cargando proyectos" })).not.toBeInTheDocument());
        expect(screen.getByRole("table", { name: "Proyectos" })).toBe(grid);
        fireEvent.click(screen.getByRole("button", { name: "Página anterior" }));
        expect(await screen.findByText(item.name)).toBeInTheDocument();
        expect(screen.queryByRole("status", { name: "Cargando proyectos" })).not.toBeInTheDocument();
        expect(mockListCatalogItems).toHaveBeenCalledTimes(2);
        fireEvent.click(screen.getByRole("button", { name: "Página siguiente" }));
        expect(await screen.findByText("Second project")).toBeInTheDocument();
        expect(mockListCatalogItems).toHaveBeenCalledTimes(2);
    });

    it("invalidates cached pages on explicit refresh", async () => {
        const catalog = ADMINISTRATION_CATALOGS[0];
        if (!catalog) throw new Error("Catalog missing");
        mockListCatalogItems.mockResolvedValue({ catalog: { code: catalog.code, label: catalog.label, moduleCode: catalog.moduleCode }, items: [item], total: 291 });
        render(<CatalogItemsPage catalog={catalog} />);
        await screen.findByText(item.name);
        fireEvent.click(screen.getByRole("button", { name: "Página siguiente" }));
        await waitFor(() => expect(screen.getByRole("button", { name: "Página anterior" })).toBeEnabled());
        fireEvent.click(screen.getByRole("button", { name: "Página anterior" }));
        fireEvent.click(screen.getByRole("button", { name: "Actualizar proyectos" }));
        await waitFor(() => {
            expect(mockListCatalogItems).toHaveBeenCalledTimes(3);
        });
        await waitFor(() => expect(screen.getByRole("button", { name: "Página siguiente" })).toBeEnabled());
        fireEvent.click(screen.getByRole("button", { name: "Página siguiente" }));
        await waitFor(() => {
            expect(mockListCatalogItems).toHaveBeenCalledTimes(4);
        });
    });

    it("fetches the next API page instead of accumulating rows", async () => {
        const catalog = ADMINISTRATION_CATALOGS[0];
        if (!catalog) throw new Error("Catalog missing");
        mockListCatalogItems.mockResolvedValueOnce({ catalog: { code: catalog.code, label: catalog.label, moduleCode: catalog.moduleCode }, items: [item], total: 291 });
        mockListCatalogItems.mockResolvedValueOnce({ catalog: { code: catalog.code, label: catalog.label, moduleCode: catalog.moduleCode }, items: [{ ...item, publicId: "second", name: "Second project" }], total: 291 });
        render(<CatalogItemsPage catalog={catalog} />);
        expect(await screen.findByRole("searchbox", { name: "Buscar:" })).toBeInTheDocument();
        expect(screen.queryByRole("radio", { name: /Todos/ })).not.toBeInTheDocument();
        fireEvent.click(screen.getByRole("button", { name: "Página siguiente" }));
        await waitFor(() => {
            expect(mockListCatalogItems).toHaveBeenLastCalledWith(catalog.code, expect.objectContaining({ offset: 100, limit: 100, moduleCode: "administration" }));
        });
        expect(await screen.findByText("Second project")).toBeInTheDocument();
        expect(screen.queryByText(item.name)).not.toBeInTheDocument();
        expect(screen.queryByRole("button", { name: "Cargar más" })).not.toBeInTheDocument();
    });

    it.each([10, 50, 100, 200])("fetches exactly the selected %i row limit and resets to page one", async (size) => {
        const catalog = ADMINISTRATION_CATALOGS[0];
        if (!catalog) throw new Error("Catalog missing");
        mockListCatalogItems.mockResolvedValue({ catalog: { code: catalog.code, label: catalog.label, moduleCode: catalog.moduleCode }, items: [item], total: 291 });
        render(<CatalogItemsPage catalog={catalog} />);
        await screen.findByText(item.name);
        fireEvent.click(screen.getByRole("button", { name: "Página siguiente" }));
        await waitFor(() => {
            expect(mockListCatalogItems).toHaveBeenLastCalledWith(catalog.code, expect.objectContaining({ offset: 100 }));
        });
        await waitFor(() => expect(screen.getByRole("combobox", { name: "Filas por página" })).toBeEnabled());
        fireEvent.change(screen.getByRole("combobox", { name: "Filas por página" }), { target: { value: String(size) } });
        await waitFor(() => {
            if (size === 100) expect(mockListCatalogItems).toHaveBeenCalledTimes(2);
            else expect(mockListCatalogItems).toHaveBeenLastCalledWith(catalog.code, expect.objectContaining({ offset: 0, limit: size }));
        });
        expect(screen.getByRole("button", { name: "Página anterior" })).toBeDisabled();
        await waitFor(() => expect(screen.getByRole("button", { name: "Página siguiente" })).toBeEnabled());
        fireEvent.click(screen.getByRole("button", { name: "Página siguiente" }));
        await waitFor(() => {
            expect(mockListCatalogItems).toHaveBeenLastCalledWith(catalog.code, expect.objectContaining({ offset: size, limit: size }));
        });
    });

    it("fetches last and previous API pages and disables Next at the boundary", async () => {
        const catalog = ADMINISTRATION_CATALOGS[0];
        if (!catalog) throw new Error("Catalog missing");
        mockListCatalogItems.mockResolvedValue({ catalog: { code: catalog.code, label: catalog.label, moduleCode: catalog.moduleCode }, items: [item], total: 291 });
        render(<CatalogItemsPage catalog={catalog} />);
        await screen.findByText(item.name);
        fireEvent.click(screen.getByRole("button", { name: "Última página" }));
        await waitFor(() => {
            expect(mockListCatalogItems).toHaveBeenLastCalledWith(catalog.code, expect.objectContaining({ limit: 100, offset: 200 }));
        });
        await waitFor(() => expect(screen.getByRole("button", { name: "Página siguiente" })).toBeDisabled());
        await waitFor(() => expect(screen.getByRole("button", { name: "Página anterior" })).toBeEnabled());
        fireEvent.click(screen.getByRole("button", { name: "Página anterior" }));
        await waitFor(() => {
            expect(mockListCatalogItems).toHaveBeenLastCalledWith(catalog.code, expect.objectContaining({ offset: 100 }));
        });
    });

    it("returns to the last available page when the API total shrinks", async () => {
        const catalog = ADMINISTRATION_CATALOGS[0];
        if (!catalog) throw new Error("Catalog missing");
        const response = { catalog: { code: catalog.code, label: catalog.label, moduleCode: catalog.moduleCode }, items: [item], total: 291 };
        mockListCatalogItems
            .mockResolvedValueOnce(response)
            .mockResolvedValueOnce({ ...response, items: [], total: 1 })
            .mockResolvedValueOnce({ ...response, total: 1 });
        render(<CatalogItemsPage catalog={catalog} />);
        await screen.findByText(item.name);
        fireEvent.click(screen.getByRole("button", { name: "Última página" }));
        await waitFor(() => {
            expect(mockListCatalogItems).toHaveBeenCalledTimes(3);
        });
        expect(mockListCatalogItems).toHaveBeenLastCalledWith(catalog.code, expect.objectContaining({ limit: 100, offset: 0 }));
        await waitFor(() => expect(screen.getByRole("button", { name: "Página siguiente" })).toBeDisabled());
        expect(screen.getByText(item.name)).toBeInTheDocument();
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

    it("retains the current page and permits retry after a page request fails", async () => {
        const catalog = ADMINISTRATION_CATALOGS[0];
        if (!catalog) throw new Error("Catalog missing");
        mockListCatalogItems.mockResolvedValueOnce({ catalog: { code: catalog.code, label: catalog.label, moduleCode: catalog.moduleCode }, items: [item], total: 291 });
        mockListCatalogItems.mockRejectedValueOnce(new Error("Network failure"));
        mockListCatalogItems.mockResolvedValueOnce({ catalog: { code: catalog.code, label: catalog.label, moduleCode: catalog.moduleCode }, items: [{ ...item, publicId: "second", name: "Second project" }], total: 291 });
        render(<CatalogItemsPage catalog={catalog} />);
        fireEvent.click(await screen.findByRole("button", { name: "Página siguiente" }));
        expect(await screen.findByRole("alert")).toHaveTextContent("No pudimos cargar el catálogo");
        expect(screen.getByText(item.name)).toBeInTheDocument();
        await waitFor(() => expect(screen.getByRole("button", { name: "Página siguiente" })).toBeEnabled());
        fireEvent.click(screen.getByRole("button", { name: "Página siguiente" }));
        expect(await screen.findByText("Second project")).toBeInTheDocument();
    });

    it("loads each catalog with its module and an initial API page of 100", async () => {
        for (const catalog of ADMINISTRATION_CATALOGS) {
            const { unmount } = render(<CatalogItemsPage catalog={catalog} />);

            expect(await screen.findByRole("heading", { name: catalog.label })).toBeInTheDocument();
            await waitFor(() => {
                expect(mockListCatalogItems).toHaveBeenLastCalledWith(catalog.code, { limit: 100, offset: 0, moduleCode: "administration", status: "all" });
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
        expect(await screen.findByRole("heading", { name: "Editar proyecto" })).toBeInTheDocument();
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
        expect(await screen.findByRole("heading", { name: "Editar proyecto" })).toBeInTheDocument();
        fireEvent.keyDown(screen.getByRole("button", { name: "Cancelar" }), { key: "ArrowDown" });
        expect(within(drawer).getByRole("heading", { name: item.name })).toBeInTheDocument();
    });

    it("navigates project details in the table's visible order", async () => {
        const catalog = ADMINISTRATION_CATALOGS[0];
        if (!catalog) throw new Error("Catalog missing");
        const zeta = { ...item, publicId: "project_zeta", name: "Zeta" };
        const alfa = { ...item, publicId: "project_alfa", name: "Alfa" };
        mockListCatalogItems.mockResolvedValue({ catalog: { code: catalog.code, label: catalog.label, moduleCode: catalog.moduleCode }, items: [zeta, alfa], total: 2 });
        render(<CatalogItemsPage catalog={catalog} />);
        const row = (await screen.findByText(alfa.name)).closest("tr");
        if (!row) throw new Error("Row missing");
        await waitFor(() => {
            expect(row).toHaveAttribute("tabindex", "0");
        });
        fireEvent.click(row);
        const drawer = await screen.findByRole("dialog");
        expect(within(drawer).getByText("Registro 1 de 2")).toBeInTheDocument();
        expect(within(drawer).getByRole("button", { name: "Registro anterior" })).toBeDisabled();
        fireEvent.click(within(drawer).getByRole("button", { name: "Registro siguiente" }));
        expect(within(drawer).getByRole("heading", { name: zeta.name })).toBeInTheDocument();
    });

    it.each(["projects", "campaigns", "classes", "locations", "subsidiaries", "brokers"])("submits legacy %s edits without blank Odoo references and follows the promoted identity", async (code) => {
        const warning = vi.spyOn(console, "error");
        const catalog = ADMINISTRATION_CATALOGS.find((entry) => entry.code === code);
        if (!catalog) throw new Error("Catalog missing");
        const legacyItem = { ...item, publicId: `legacy:${code}:42` };
        const responseCatalog = { code: catalog.code, label: catalog.label, moduleCode: catalog.moduleCode };
        mockListCatalogItems.mockResolvedValueOnce({ catalog: responseCatalog, items: [legacyItem], total: 1 }).mockResolvedValue({ catalog: responseCatalog, items: [item], total: 1 });
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
            expect(updateCatalogItem).toHaveBeenCalledWith(catalog.code, legacyItem.publicId, expect.objectContaining({ externalReferences: [{ systemCode: "netsuite", externalId: "1" }], reason: "Project correction authorized" }));
        });
        await waitFor(() => {
            expect(screen.queryByRole("button", { name: /Guardar cambios/ })).not.toBeInTheDocument();
            expect(screen.getByText(item.publicId)).toBeInTheDocument();
        });
        expect(warning.mock.calls.flat().join(" ")).not.toContain("is not connected to any Form element");
        warning.mockRestore();
    });
});
