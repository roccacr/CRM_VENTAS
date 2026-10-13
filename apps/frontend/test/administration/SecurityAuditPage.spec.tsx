import "@testing-library/jest-dom/vitest";

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { getAuditDetail, getAuditOptions, getAuditPage } from "../../src/modules/administration/pages/security-audit.api";
import { SecurityAuditDetailDrawer } from "../../src/modules/administration/pages/SecurityAuditDetailDrawer";
import { SecurityAuditPage } from "../../src/modules/administration/pages/SecurityAuditPage";
import type { IdentityUser } from "../../src/services/auth/identity-contracts";
import { installBrowserApiDoubles } from "../support/browser";
vi.mock("../../src/modules/administration/pages/security-audit.api", () => ({ getAuditDetail: vi.fn(), getAuditOptions: vi.fn(), getAuditPage: vi.fn() }));
const item = {
    publicId: "event1",
    eventType: "catalog_item_updated",
    summary: "Proyecto editado",
    reason: "Cambio autorizado",
    actorName: "Roberto",
    targetName: null,
    recordedModule: null,
    catalogCode: "projects",
    contextKnown: false,
    createdAt: "2026-10-13T12:00:00Z",
    actorPublicId: null,
    actorRoles: null,
    recordedSection: null,
    moduleName: null,
    sectionName: null,
    catalogName: "Proyectos",
    record: { id: null, entity: null, name: null },
    action: "catalog_item_updated",
    actionLabel: "Edición de registro",
};
beforeEach(() => {
    installBrowserApiDoubles();
    vi.resetAllMocks();
    vi.mocked(getAuditOptions).mockResolvedValue({
        modules: [
            {
                code: "administration",
                name: "Administración",
                sections: [
                    { code: "users", name: "Usuarios" },
                    { code: "catalogs", name: "Catálogos" },
                ],
            },
        ],
        catalogs: [{ code: "projects", name: "Proyectos" }],
    });
    vi.mocked(getAuditPage).mockResolvedValue({ items: [item], pagination: { limit: 100, returned: 1, hasNext: false, nextCursor: null } });
});
afterEach(cleanup);
it("hides technical summaries in the table and detail while preserving the reason", async () => {
    const technical = { ...item, summary: "Campaign catalog_item_updated. catalog_item_updated", catalogCode: "campaigns", catalogName: "Campañas" };
    vi.mocked(getAuditPage).mockResolvedValue({ items: [technical], pagination: { limit: 100, returned: 1, hasNext: false, nextCursor: null } });
    vi.mocked(getAuditDetail).mockResolvedValue({ ...technical, changeSet: null });
    render(<SecurityAuditPage currentUser={{ publicId: "owner" } as IdentityUser} />);
    await selectScope();
    fireEvent.click(screen.getByRole("button", { name: "Buscar eventos" }));
    expect(await screen.findByText("Se actualizó la campaña")).toBeInTheDocument();
    expect(screen.queryByText(/catalog_item_updated/)).not.toBeInTheDocument();
    expect(screen.getByText("Cambio autorizado")).toBeInTheDocument();
    fireEvent.click(await screen.findByRole("button", { name: "Ver detalle" }));
    expect(await screen.findByRole("heading", { name: "Se actualizó la campaña" })).toBeInTheDocument();
    expect(screen.queryByText(/catalog_item_updated/)).not.toBeInTheDocument();
});
it.each([
    ["administration", "users", null, "/home/administration/users"],
    ["administration", "roles", null, "/home/administration/roles-security"],
    ["administration", "catalogs", "projects", "/home/administration/catalogs/projects"],
    ["ventas", "catalogs", "files", "/home/sales/catalogs/files"],
    ["mercadeo", "catalogs", "campaigns", "/home/marketing/catalogs/campaigns"],
    ["formalizacion", "catalogs", "classes", "/home/formalization/catalogs/classes"],
    ["contabilidad", "catalogs", "locations", "/home/accounting/catalogs/locations"],
])("links only to the verified recorded section %s/%s", async (recordedModule, recordedSection, catalogCode, path) => {
    vi.mocked(getAuditDetail).mockResolvedValue({ ...item, recordedModule, recordedSection, catalogCode, contextKnown: true, changeSet: null });
    render(<SecurityAuditDetailDrawer publicId="event" onClose={vi.fn()} />);
    expect(await screen.findByRole("link", { name: "Abrir sección" })).toHaveAttribute("href", path);
});
it("distinguishes missing roles from an explicitly empty historical set and omits unknown section links", async () => {
    vi.mocked(getAuditDetail).mockResolvedValue({ ...item, actorRoles: [], changeSet: null });
    render(<SecurityAuditDetailDrawer publicId="event" onClose={vi.fn()} />);
    expect(await screen.findByText("Sin roles al momento del evento")).toBeInTheDocument();
    expect(screen.queryByText("Roles históricos no registrados")).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Abrir sección" })).not.toBeInTheDocument();
});
it("shows historical actor roles/location/record/action and opens the audit reference for deleted records", async () => {
    const contextual = { ...item, actorRoles: [{ code: "manager", name: "Gerencia histórica" }], moduleName: "Administración", sectionName: "Catálogos", catalogName: "Proyectos", record: { id: "deleted-record", entity: "catalog", name: "Proyecto eliminado" }, action: "delete", actionLabel: "Eliminación" };
    vi.mocked(getAuditPage).mockResolvedValue({ items: [contextual], pagination: { limit: 100, returned: 1, hasNext: false, nextCursor: null } });
    vi.mocked(getAuditDetail).mockResolvedValue({ ...contextual, changeSet: null });
    render(<SecurityAuditPage currentUser={{ publicId: "owner" } as IdentityUser} />);
    await selectScope();
    fireEvent.click(screen.getByRole("button", { name: "Buscar eventos" }));
    expect(await screen.findByText("Gerencia histórica")).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Ubicación" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Acción y motivo" })).toBeInTheDocument();
    expect(await screen.findByText("deleted-record")).toBeInTheDocument();
    fireEvent.click(await screen.findByRole("button", { name: "Proyecto eliminado" }));
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    expect(await screen.findByText("Referencia del registro")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Proyecto eliminado" })).not.toBeInTheDocument();
    expect(getAuditDetail).toHaveBeenCalledWith(item.publicId);
});
it("shows creation snapshots including false and null values", async () => {
    vi.mocked(getAuditDetail).mockResolvedValue({ ...item, changeSet: { version: 1, entity: "user", recordId: "record", action: "create", before: null, after: { name: "Creado", deleted: false, detail: null }, changes: [] } });
    render(<SecurityAuditDetailDrawer publicId="record" onClose={vi.fn()} />);
    expect(await screen.findByText("Datos registrados al crear")).toBeInTheDocument();
    expect(screen.getByText("Creado")).toBeInTheDocument();
    expect(screen.getByText("No")).toBeInTheDocument();
    expect(screen.getAllByText("Sin valor").length).toBeGreaterThan(0);
});
it("retries failed detail reads and labels historical absence", async () => {
    vi.mocked(getAuditDetail)
        .mockRejectedValueOnce(new Error("failed"))
        .mockResolvedValueOnce({ ...item, changeSet: null });
    render(<SecurityAuditDetailDrawer publicId="record" onClose={vi.fn()} />);
    expect(await screen.findByRole("alert")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Reintentar" }));
    expect(await screen.findByText("Este evento histórico no tiene comparación registrada.")).toBeInTheDocument();
    expect(screen.queryByRole("table", { name: "Comparación de campos" })).not.toBeInTheDocument();
});
it("loads detail only on demand and renders previous/current values in Spanish", async () => {
    vi.mocked(getAuditDetail).mockResolvedValue({ ...item, changeSet: { version: 1, entity: "catalog", recordId: "project", action: "update", before: { name: "Nombre anterior" }, after: { name: "Nombre nuevo" }, changes: [{ field: "name", before: "Nombre anterior", after: "Nombre nuevo" }] } });
    render(<SecurityAuditPage currentUser={{ publicId: "owner" } as IdentityUser} />);
    await selectScope();
    fireEvent.click(screen.getByRole("button", { name: "Buscar eventos" }));
    await screen.findByText("Se actualizó el proyecto");
    expect(getAuditDetail).not.toHaveBeenCalled();
    fireEvent.click(await screen.findByRole("button", { name: "Ver detalle" }));
    expect(await screen.findByText("Nombre anterior")).toBeInTheDocument();
    expect(screen.getByText("Nombre nuevo")).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Anterior" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Actual" })).toBeInTheDocument();
    expect(getAuditDetail).toHaveBeenCalledWith(item.publicId);
});
async function selectScope() {
    fireEvent.mouseDown(screen.getByRole("combobox", { name: "Módulo de auditoría" }));
    fireEvent.click(await screen.findByText("Administración", { selector: ".ant-select-item-option-content" }));
    fireEvent.mouseDown(screen.getByRole("combobox", { name: "Sección de auditoría" }));
    fireEvent.click(await screen.findByText("Catálogos", { selector: ".ant-select-item-option-content" }));
}
it("requires module and section, downloads no events on mount and labels unknown historic context", async () => {
    render(<SecurityAuditPage currentUser={{ publicId: "owner" } as IdentityUser} />);
    expect(screen.getByRole("button", { name: "Buscar eventos" })).toBeDisabled();
    await waitFor(() => {
        expect(getAuditOptions).toHaveBeenCalledTimes(1);
    });
    expect(getAuditPage).not.toHaveBeenCalled();
    await selectScope();
    expect(getAuditPage).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Buscar eventos" }));
    expect(await screen.findByText("Se actualizó el proyecto")).toBeInTheDocument();
    expect(await screen.findByText("Contexto histórico no registrado")).toBeInTheDocument();
    expect(getAuditPage).toHaveBeenCalledWith({ moduleCode: "administration", sectionCode: "catalogs", limit: 100 });
    expect(screen.getByRole("columnheader", { name: "Acción y motivo" })).toBeInTheDocument();
});
it("fetches the next bounded page and uses memory when returning to the previous page", async () => {
    vi.mocked(getAuditPage)
        .mockResolvedValueOnce({ items: [item], pagination: { limit: 100, returned: 1, hasNext: true, nextCursor: "next" } })
        .mockResolvedValueOnce({ items: [{ ...item, publicId: "event2", catalogCode: "campaigns", summary: "Campaña editada" }], pagination: { limit: 100, returned: 1, hasNext: false, nextCursor: null } });
    render(<SecurityAuditPage currentUser={{ publicId: "owner" } as IdentityUser} />);
    await selectScope();
    fireEvent.click(screen.getByRole("button", { name: "Buscar eventos" }));
    await screen.findByText("Se actualizó el proyecto");
    fireEvent.click(screen.getByRole("button", { name: "Página siguiente" }));
    await screen.findByText("Se actualizó la campaña");
    fireEvent.click(screen.getByRole("button", { name: "Página anterior" }));
    await screen.findByText("Se actualizó el proyecto");
    expect(getAuditPage).toHaveBeenCalledTimes(2);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
});
it("ignores a pending response after the section changes", async () => {
    let finish: (page: Awaited<ReturnType<typeof getAuditPage>>) => void = () => {};
    vi.mocked(getAuditPage).mockImplementationOnce(
        () =>
            new Promise((resolve) => {
                finish = resolve;
            }),
    );
    render(<SecurityAuditPage currentUser={{ publicId: "owner" } as IdentityUser} />);
    await selectScope();
    fireEvent.click(screen.getByRole("button", { name: "Buscar eventos" }));
    await screen.findByRole("status");
    fireEvent.mouseDown(screen.getByRole("combobox", { name: "Sección de auditoría" }));
    fireEvent.click(await screen.findByText("Usuarios", { selector: ".ant-select-item-option-content" }));
    finish({ items: [item], pagination: { limit: 100, returned: 1, hasNext: false, nextCursor: null } });
    await waitFor(() => {
        expect(screen.queryByRole("status")).not.toBeInTheDocument();
    });
    expect(screen.queryByText("Proyecto editado")).not.toBeInTheDocument();
    expect(screen.getByText("Selecciona un módulo y una sección.")).toBeInTheDocument();
});
