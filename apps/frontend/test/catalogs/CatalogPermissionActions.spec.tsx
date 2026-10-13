import "@testing-library/jest-dom/vitest";

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CatalogItemDetailDrawer } from "../../src/modules/administration/catalogs/CatalogItemDetailDrawer";
import { CatalogItemsDataTable } from "../../src/modules/administration/catalogs/CatalogItemsDataTable";
import type { CatalogItem } from "../../src/services/catalogs/catalog-service";
import { installBrowserApiDoubles } from "../support/browser";

const item: CatalogItem = { publicId: "project", nativeCode: "project", name: "Proyecto visible", detail: "Detalle visible", status: "active", updatedAt: "2026-10-13T12:00:00Z", externalReferences: [] };
const drawerProps = () => ({ catalogLabel: "Proyectos", error: null, isLoading: false, item, open: true, position: 1, total: 1, onClose: vi.fn(), onEdit: vi.fn(), onRefresh: vi.fn(), onStatusAction: vi.fn(), onSelectPrevious: vi.fn(), onSelectNext: vi.fn() });
const tableProps = () => ({ entityLabel: "Proyecto", items: [item], label: "Proyectos", isLoading: false, storageKey: "catalog-permission-test", selectedPublicId: null, onSelect: vi.fn(), onEdit: vi.fn(), onStatusAction: vi.fn() });

beforeEach(() => {
    installBrowserApiDoubles();
    window.localStorage.clear();
});
afterEach(async () => {
    cleanup();
    // DataTables disposes independent React slot roots 250 ms after table teardown.
    await waitFor(() => {
        expect(screen.queryAllByRole("menuitem", { hidden: true })).toHaveLength(0);
    });
});

describe("catalog drawer exact action grants", () => {
    it("defaults to read only while retaining details and navigation", () => {
        const props = drawerProps();
        render(<CatalogItemDetailDrawer {...props} />);
        expect(screen.getByText("Detalle visible")).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Actualizar detalle" })).toBeEnabled();
        expect(screen.queryByRole("button", { name: "Editar" })).not.toBeInTheDocument();
        expect(screen.queryByRole("button", { name: "Inactivar" })).not.toBeInTheDocument();
        expect(props.onEdit).not.toHaveBeenCalled();
        expect(props.onStatusAction).not.toHaveBeenCalled();
    });
    it.each([
        ["active", true, false, "Editar", "Inactivar"],
        ["active", false, true, "Inactivar", "Editar"],
        ["inactive", true, false, "Reactivar", "Inactivar"],
        ["inactive", false, true, null, "Reactivar"],
    ] as const)("uses update/inactivate independently for %s (%s/%s)", (...[status, canEdit, canInactivate, visible, hidden]) => {
        const props = drawerProps();
        render(<CatalogItemDetailDrawer {...props} item={{ ...item, status }} canEdit={canEdit} canInactivate={canInactivate} />);
        expect(screen.queryByRole("button", { name: hidden })).not.toBeInTheDocument();
        if (!visible) {
            expect(screen.queryByRole("button", { name: "Editar" })).not.toBeInTheDocument();
            return;
        }
        fireEvent.click(screen.getByRole("button", { name: visible }));
        if (visible === "Editar") expect(props.onEdit).toHaveBeenCalledWith(expect.objectContaining({ publicId: item.publicId }));
        else expect(props.onStatusAction).toHaveBeenCalledWith(expect.objectContaining({ publicId: item.publicId }), status === "active" ? "inactive" : "active");
    });
    it("retains the immutable legacy constraint for authorized actions", () => {
        render(<CatalogItemDetailDrawer {...drawerProps()} item={{ ...item, publicId: "legacy:files:42" }} canEdit canInactivate />);
        expect(screen.getByRole("button", { name: "Editar" })).toBeDisabled();
        expect(screen.getByRole("button", { name: "Inactivar" })).toBeDisabled();
    });
    it("removes actions when grants are revoked", () => {
        const props = drawerProps();
        const view = render(<CatalogItemDetailDrawer {...props} canEdit canInactivate />);
        view.rerender(<CatalogItemDetailDrawer {...props} canEdit={false} canInactivate={false} />);
        expect(screen.queryByRole("button", { name: "Editar" })).not.toBeInTheDocument();
        expect(screen.queryByRole("button", { name: "Inactivar" })).not.toBeInTheDocument();
        expect(props.onEdit).not.toHaveBeenCalled();
        expect(props.onStatusAction).not.toHaveBeenCalled();
    });
});

describe("catalog table exact action grants", () => {
    it("defaults to no mutation menu and still opens the detail row", async () => {
        const props = tableProps();
        render(<CatalogItemsDataTable {...props} />);
        const name = await screen.findByText(item.name);
        expect(screen.queryByRole("button", { name: `Acciones de ${item.name}` })).not.toBeInTheDocument();
        fireEvent.click(name);
        expect(props.onSelect).toHaveBeenCalledWith(item);
    });
    it.each([
        ["active", true, false, "Editar", "Inactivar"],
        ["active", false, true, "Inactivar", "Editar"],
        ["inactive", true, false, "Reactivar", "Inactivar"],
    ] as const)("filters menu actions for %s (%s/%s)", async (...[status, canEdit, canInactivate, visible, hidden]) => {
        const props = tableProps();
        render(<CatalogItemsDataTable {...props} items={[{ ...item, status }]} canEdit={canEdit} canInactivate={canInactivate} />);
        fireEvent.click(await screen.findByRole("button", { name: `Acciones de ${item.name}` }));
        const action = await screen.findByRole("menuitem", { name: new RegExp(visible) });
        expect(screen.queryByRole("menuitem", { name: new RegExp(hidden) })).not.toBeInTheDocument();
        fireEvent.click(action);
        expect(visible === "Editar" ? props.onEdit : props.onStatusAction).toHaveBeenCalledTimes(1);
        expect(props.onSelect).not.toHaveBeenCalled();
    });
    it("removes an open mutation menu after revocation with the same row batch", async () => {
        const props = tableProps();
        const view = render(<CatalogItemsDataTable {...props} canEdit canInactivate />);
        fireEvent.click(await screen.findByRole("button", { name: `Acciones de ${item.name}` }));
        const edit = await screen.findByRole("menuitem", { name: /Editar/ });
        view.rerender(<CatalogItemsDataTable {...props} canEdit={false} canInactivate={false} />);
        await waitFor(() => {
            expect(screen.queryByRole("button", { name: `Acciones de ${item.name}` })).not.toBeInTheDocument();
        });
        fireEvent.click(edit);
        expect(props.onEdit).not.toHaveBeenCalled();
        expect(props.onStatusAction).not.toHaveBeenCalled();
    });
});
