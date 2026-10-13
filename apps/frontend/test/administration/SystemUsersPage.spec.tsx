import "@testing-library/jest-dom/vitest";

import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { buildApiUrl } from "../../src/config/frontend-env";
import { SYSTEM_USERS_DATATABLE_STATE_KEY } from "../../src/modules/administration/hooks/useDataTableSearchPanes";
import { SystemUsersPage } from "../../src/modules/administration/pages/SystemUsersPage";
import { createSystemUser, getIdentityProfile, getIdentitySecurityCatalog, getSystemUsers, updateSystemUser, updateSystemUserStatus } from "../../src/services/auth/auth-service";
import type { IdentityProfile } from "../../src/services/auth/identity-contracts";
import { installBrowserApiDoubles } from "../support/browser";

vi.mock("../../src/services/auth/auth-service", () => ({
    createSystemUser: vi.fn(),
    getIdentityProfile: vi.fn(),
    getIdentitySecurityCatalog: vi.fn(),
    getSystemUsers: vi.fn(),
    updateSystemUser: vi.fn(),
    updateSystemUserStatus: vi.fn(),
}));

const mockCreateSystemUser = vi.mocked(createSystemUser);
const mockGetIdentityProfile = vi.mocked(getIdentityProfile);
const userPermissions = ["user.view_list", "user.view_detail", "user.create", "user.update", "user.activate", "user.deactivate", "role.assign"];
const profileWithPermissions = (codes: readonly string[]) => ({ permissions: codes.map((code) => ({ code, effect: "allow" })), roles: [{ code: "owner", name: "Owner", status: "active" }] }) as unknown as IdentityProfile;
const mockGetIdentitySecurityCatalog = vi.mocked(getIdentitySecurityCatalog);
const mockGetSystemUsers = vi.mocked(getSystemUsers);
const mockUpdateSystemUser = vi.mocked(updateSystemUser);
const mockUpdateSystemUserStatus = vi.mocked(updateSystemUserStatus);

const mockUsersResponse = {
    items: [
        {
            email: "avalverde@roccacr.com",
            externalReferences: [
                { externalUserId: "654321", externalUsername: "avalverde@roccacr.com", status: "active", systemCode: "netsuite", systemName: "NetSuite" },
                { externalUserId: "ODOO-77", externalUsername: null, status: "active", systemCode: "odoo", systemName: "Odoo" },
            ],
            invitedBy: "Sistemas",
            isCurrentUser: false,
            lastActivityAt: null,
            mfaStatus: "not_configured",
            name: "Andrea Valverde",
            orgUnit: { code: "finanzas", name: "Finanzas", publicId: "ORG-FIN" },
            profileImageUrl: null,
            provider: "microsoft",
            publicId: "USR-ROCCA-0004",
            roleChangedAt: "2026-09-29T21:10:00.000Z",
            roles: [{ code: "consulta", name: "Consulta" }],
            status: "inactive",
        },
        {
            email: "jcastro@roccacr.com",
            externalReferences: [],
            invitedBy: "Sistemas",
            isCurrentUser: false,
            lastActivityAt: null,
            mfaStatus: "pending",
            name: "Javier Castro",
            orgUnit: { code: "crm_tink", name: "CRM Tink", publicId: "ORG-CRM" },
            profileImageUrl: null,
            provider: "local",
            publicId: "USR-ROCCA-0003",
            roleChangedAt: "2026-09-26T17:30:00.000Z",
            roles: [{ code: "supervisor", name: "Supervisor" }],
            status: "pending",
        },
        {
            email: "mflores@roccacr.com",
            externalReferences: [],
            invitedBy: null,
            isCurrentUser: false,
            lastActivityAt: "2026-09-29T22:42:00.000Z",
            mfaStatus: "enabled",
            name: "Mariana Flores",
            orgUnit: { code: "administracion", name: "Administración", publicId: "ORG-ADM" },
            profileImageUrl: null,
            provider: "microsoft",
            publicId: "USR-ROCCA-0002",
            roleChangedAt: "2026-09-29T21:10:00.000Z",
            roles: [{ code: "jefatura_general", name: "Jefatura general" }],
            status: "active",
        },
        {
            email: "rzuniga@roccacr.com",
            externalReferences: [],
            invitedBy: null,
            isCurrentUser: true,
            lastActivityAt: "2026-09-30T15:18:00.000Z",
            mfaStatus: "enabled",
            name: "Roberto Carlos Zúñiga Altamirano",
            orgUnit: { code: "sistemas", name: "Sistemas", publicId: "ORG-SIS" },
            profileImageUrl: null,
            provider: "mixed",
            publicId: "USR-ROCCA-0001",
            roleChangedAt: "2026-09-30T14:54:00.000Z",
            roles: [
                { code: "owner", name: "Propietario" },
                { code: "soporte_sistemas", name: "Soporte sistemas" },
                { code: "administrador", name: "Administrador" },
            ],
            status: "active",
        },
        {
            email: "soporte.externo@roccacr.com",
            externalReferences: [],
            invitedBy: "Sistemas",
            isCurrentUser: false,
            lastActivityAt: "2026-09-20T20:00:00.000Z",
            mfaStatus: "pending",
            name: "Soporte Externo",
            orgUnit: { code: "integraciones", name: "Integraciones", publicId: "ORG-INT" },
            profileImageUrl: null,
            provider: "local",
            publicId: "USR-ROCCA-0005",
            roleChangedAt: "2026-09-20T19:45:00.000Z",
            roles: [{ code: "soporte_sistemas", name: "Soporte sistemas" }],
            status: "blocked",
        },
    ],
    page: {
        limit: 25,
        nextCursor: null,
        total: 5,
    },
    summary: {
        active: 2,
        all: 5,
        blocked: 1,
        inactive: 1,
        pending: 1,
    },
} as const;

const mockSecurityCatalog = {
    auditEvents: [],
    modules: [
        {
            code: "ventas",
            name: "Ventas",
            views: [
                {
                    code: "leads",
                    name: "Leads",
                    permissions: [
                        { code: "lead.read", description: "Permite leer leads.", name: "Ver lista de leads", sensitive: false },
                        { code: "lead.create", description: "Permite crear leads.", name: "Crear lead", sensitive: false },
                    ],
                },
            ],
        },
        {
            code: "mercadeo",
            name: "Mercadeo",
            views: [
                {
                    code: "campanas",
                    name: "Campañas",
                    permissions: [{ code: "marketing.read", description: "Permite leer campañas.", name: "Ver campañas", sensitive: false }],
                },
            ],
        },
        { code: "user", name: "Usuarios", views: [] },
    ],
    rolePermissions: {},
    roles: [
        { code: "owner", description: null, locked: true, name: "Owner", status: "active", users: 1 },
        { code: "ventas", description: null, locked: false, name: "Ventas", status: "active", users: 31 },
        { code: "mercadeo", description: null, locked: false, name: "Mercadeo", status: "active", users: 0 },
    ],
} as const;

afterEach(() => {
    cleanup();
    vi.clearAllMocks();
    window.localStorage.clear();
    window.history.replaceState(null, "", "/");
});

beforeEach(() => {
    installBrowserApiDoubles();
    mockGetIdentityProfile.mockResolvedValue(profileWithPermissions(userPermissions));
    mockCreateSystemUser.mockResolvedValue(mockUsersResponse.items[0]);
    mockGetIdentitySecurityCatalog.mockResolvedValue(mockSecurityCatalog);
    mockGetSystemUsers.mockResolvedValue(mockUsersResponse);
    mockUpdateSystemUser.mockResolvedValue({ ...mockUsersResponse.items[0], name: "Andrea Valverde Actualizada", roles: [{ code: "ventas", name: "Ventas" }] });
    mockUpdateSystemUserStatus.mockResolvedValue({ ...mockUsersResponse.items[0], status: "active" });
});

const openUserDetail = async (name: string): Promise<void> => {
    fireEvent.click(await screen.findByRole("button", { name: `Abrir detalle de ${name}` }));
    await screen.findByRole("heading", { name });
};

const getUserRow = (name: string): HTMLElement => {
    const row = screen.getByRole("button", { name: `Abrir detalle de ${name}` }).closest("tr");

    if (!row) {
        throw new Error(`No se encontro la fila de ${name}.`);
    }

    return row;
};

const getDetailPanel = (name: string): HTMLElement => {
    const heading = screen.getByRole("heading", { name });
    const panel = heading.closest<HTMLElement>(".user-detail-drawer");

    if (!panel) {
        throw new Error(`No se encontro el panel de detalle para ${name}.`);
    }

    return panel;
};

const getRectValue = (value: number | undefined, fallback = 0): number => value ?? fallback;

const buildDomRect = (rect: Partial<DOMRect>): DOMRect => {
    const left = getRectValue(rect.left);
    const top = getRectValue(rect.top);

    return {
        bottom: getRectValue(rect.bottom),
        height: getRectValue(rect.height),
        left,
        right: getRectValue(rect.right),
        top,
        width: getRectValue(rect.width),
        x: getRectValue(rect.x, left),
        y: getRectValue(rect.y, top),
        toJSON: () => ({}),
    };
};

const openCreateUserDrawer = async (): Promise<void> => {
    await screen.findByRole("button", { name: "Abrir detalle de Andrea Valverde" });
    fireEvent.click(screen.getByRole("button", { name: "Nuevo usuario" }));
    await screen.findByRole("heading", { name: "Identificación" });
};

const selectRole = async (roleName: string): Promise<void> => {
    const roleSelect = document.getElementById("createSystemUser_roleCodes")?.closest(".ant-select");

    if (!roleSelect) {
        throw new Error("No se encontro el selector de roles.");
    }

    fireEvent.mouseDown(roleSelect);
    const dropdown = await waitFor(() => {
        const element = document.querySelector<HTMLElement>(".ant-select-dropdown");

        if (!element) {
            throw new Error("No se abrio la lista de roles.");
        }

        return element;
    });

    fireEvent.click(within(dropdown).getByTitle(roleName));
};

describe("SystemUsersPage", () => {
    it("fails closed without permissions or when the profile cannot be loaded", async () => {
        mockGetIdentityProfile.mockRejectedValue(new Error("Profile unavailable"));
        render(<SystemUsersPage />);
        await waitFor(() => {
            expect(mockGetIdentityProfile).toHaveBeenCalled();
        });
        expect(mockGetSystemUsers).not.toHaveBeenCalled();
        expect(screen.queryByRole("button", { name: "Nuevo usuario" })).not.toBeInTheDocument();
    });
    it("isolates list permission from detail and mutation permissions", async () => {
        mockGetIdentityProfile.mockResolvedValue(profileWithPermissions(["user.view_list"]));
        render(<SystemUsersPage />);
        await screen.findByText("Andrea Valverde");
        expect(screen.queryByRole("button", { name: "Abrir detalle de Andrea Valverde" })).not.toBeInTheDocument();
        expect(screen.queryByRole("button", { name: "Nuevo usuario" })).not.toBeInTheDocument();
        fireEvent.click(screen.getByRole("button", { name: "Más acciones para Andrea Valverde" }));
        expect(screen.queryByRole("menuitem", { name: "Editar usuario" })).not.toBeInTheDocument();
        expect(screen.queryByRole("menuitem", { name: "Reactivar usuario" })).not.toBeInTheDocument();
    });
    it.each(["user.create", "role.assign"])("does not offer creation with %s alone", async (grant) => {
        mockGetIdentityProfile.mockResolvedValue(profileWithPermissions(["user.view_list", grant]));
        render(<SystemUsersPage />);
        await screen.findByText("Andrea Valverde");
        expect(screen.queryByRole("button", { name: "Nuevo usuario" })).not.toBeInTheDocument();
    });
    it("offers no invented creation options when the security catalog fails", async () => {
        mockGetIdentitySecurityCatalog.mockRejectedValue(new Error("Catalog unavailable"));
        render(<SystemUsersPage />);
        await screen.findByRole("button", { name: "Abrir detalle de Andrea Valverde" });
        expect(screen.queryByRole("button", { name: "Nuevo usuario" })).not.toBeInTheDocument();
        expect(mockCreateSystemUser).not.toHaveBeenCalled();
    });
    it("clears cached list and detail when a focus recheck fails", async () => {
        render(<SystemUsersPage />);
        await openUserDetail("Andrea Valverde");
        mockGetIdentityProfile.mockRejectedValue(new Error("Revoked session"));
        fireEvent.focus(window);
        await waitFor(() => {
            expect(screen.queryByRole("heading", { name: "Andrea Valverde" })).not.toBeInTheDocument();
        });
        expect(screen.queryByText("Andrea Valverde")).not.toBeInTheDocument();
        expect(screen.queryByRole("button", { name: "Nuevo usuario" })).not.toBeInTheDocument();
    });
    it("keeps update-only edits isolated from detail and preserves all target modules", async () => {
        mockGetIdentityProfile.mockResolvedValue(profileWithPermissions(["user.view_list", "user.update"]));
        mockGetSystemUsers.mockResolvedValue({
            ...mockUsersResponse,
            items: mockUsersResponse.items.map((user) => ({
                ...user,
                orgUnits: [
                    { code: "ventas", name: "Ventas", publicId: "ventas" },
                    { code: "formalizacion", name: "Formalización", publicId: "formalizacion" },
                ],
            })),
        });
        render(<SystemUsersPage />);
        fireEvent.click(await screen.findByRole("button", { name: "Más acciones para Andrea Valverde" }));
        fireEvent.click(screen.getByRole("menuitem", { name: "Editar usuario" }));
        const name = await screen.findByLabelText("Nombre completo");
        expect(screen.getByRole("combobox", { name: /Roles asignados/u })).toBeDisabled();
        fireEvent.change(name, { target: { value: "Andrea Edited" } });
        fireEvent.change(screen.getByLabelText("Motivo de la edición"), { target: { value: "Profile correction" } });
        fireEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));
        await waitFor(() => {
            expect(mockUpdateSystemUser).toHaveBeenCalledWith("USR-ROCCA-0004", expect.objectContaining({ roleCodes: ["consulta"], orgUnitCodes: ["ventas", "formalizacion"] }));
        });
        expect(screen.queryByRole("heading", { name: "Andrea Valverde Actualizada" })).not.toBeInTheDocument();
    });
    it("does not fetch the list with detail-only permission", async () => {
        mockGetIdentityProfile.mockResolvedValue(profileWithPermissions(["user.view_detail"]));
        render(<SystemUsersPage />);
        await waitFor(() => {
            expect(mockGetIdentityProfile).toHaveBeenCalled();
        });
        expect(mockGetSystemUsers).not.toHaveBeenCalled();
    });
    it.each([
        ["user.update", "Editar usuario"],
        ["user.view_detail", "Ver detalle"],
        ["user.activate", "Reactivar"],
        ["user.deactivate", "Bloquear"],
    ])("offers only the exact %s action in the row menu", async (grant, label) => {
        mockGetIdentityProfile.mockResolvedValue(profileWithPermissions(["user.view_list", grant]));
        render(<SystemUsersPage />);
        fireEvent.click(await screen.findByRole("button", { name: "Más acciones para Andrea Valverde" }));
        expect(screen.getByRole("menuitem", { name: label })).toBeInTheDocument();
        for (const other of ["Editar usuario", "Ver detalle", "Reactivar", "Bloquear"].filter((name) => name !== label)) expect(screen.queryByRole("menuitem", { name: other })).not.toBeInTheDocument();
    });
    it("rechecks confirmation and closes a status action when access was revoked", async () => {
        render(<SystemUsersPage />);
        await openUserDetail("Andrea Valverde");
        fireEvent.click(await screen.findByRole("button", { name: "Reactivar usuario" }));
        fireEvent.change(await screen.findByLabelText(/Motivo de auditoría/u), { target: { value: "Approved change" } });
        mockGetIdentityProfile.mockResolvedValue(profileWithPermissions([]));
        fireEvent.click(screen.getByRole("button", { name: "Confirmar acción" }));
        await waitFor(() => expect(screen.queryByRole("heading", { name: "Reactivar usuario" })).not.toBeInTheDocument());
        expect(mockUpdateSystemUserStatus).not.toHaveBeenCalled();
    });
    it("muestra preload inicial antes de confirmar que no hay resultados", () => {
        mockGetSystemUsers.mockReturnValue(new Promise(() => undefined));

        render(<SystemUsersPage />);

        expect(screen.getByText("Cargando información de usuarios")).toBeInTheDocument();
        expect(screen.queryByText("Sin resultados")).not.toBeInTheDocument();
    });

    it("usa el origen del API para mostrar la foto real del usuario", async () => {
        mockGetSystemUsers.mockResolvedValueOnce({
            ...mockUsersResponse,
            items: mockUsersResponse.items.map((user) => (user.email === "rzuniga@roccacr.com" ? { ...user, profileImageUrl: "/identity/me/photo" } : user)),
        });
        render(<SystemUsersPage />);

        await openUserDetail("Roberto Carlos Zúñiga Altamirano");

        expect(getDetailPanel("Roberto Carlos Zúñiga Altamirano").querySelector(`img[src="${buildApiUrl("/identity/me/photo")}"]`)).toBeInTheDocument();
    });

    it("muestra rol y área en una sola columna sin avatares en la tabla", async () => {
        const { container } = render(<SystemUsersPage />);

        await screen.findByRole("button", { name: "Abrir detalle de Andrea Valverde" });

        expect(screen.getAllByRole("columnheader", { name: "Rol" }).length).toBeGreaterThan(0);
        expect(screen.queryByRole("columnheader", { name: "Área" })).not.toBeInTheDocument();
        expect(within(getUserRow("Andrea Valverde")).getByText("Consulta")).toBeInTheDocument();
        expect(within(getUserRow("Andrea Valverde")).getByText("Finanzas")).toBeInTheDocument();
        expect(within(getUserRow("Roberto Carlos Zúñiga Altamirano")).getByText("+2")).toBeInTheDocument();
        expect(within(getUserRow("Javier Castro")).getByText("CRM Tink")).toBeInTheDocument();
        expect(container.querySelector(".administration-users-table .administration-users-avatar")).not.toBeInTheDocument();
    });

    it("no repite el área cuando el único rol se llama igual", async () => {
        const [andrea, ...otherUsers] = mockUsersResponse.items;
        mockGetSystemUsers.mockResolvedValue({ ...mockUsersResponse, items: [{ ...andrea, roles: [{ code: "finanzas", name: "Finanzas" }] }, ...otherUsers] });
        render(<SystemUsersPage />);

        await screen.findByRole("button", { name: "Abrir detalle de Andrea Valverde" });

        expect(within(getUserRow("Andrea Valverde")).getAllByText("Finanzas")).toHaveLength(1);
    });

    it("carga la siguiente página con el cursor y agrega usuarios sin duplicarlos", async () => {
        const [firstUser, ...restUsers] = mockUsersResponse.items;
        mockGetSystemUsers.mockResolvedValueOnce({ ...mockUsersResponse, items: [firstUser], page: { limit: 25, nextCursor: "cursor-2", total: 5 } }).mockResolvedValueOnce({ ...mockUsersResponse, items: [firstUser, ...restUsers], page: { limit: 25, nextCursor: null, total: 5 } });

        render(<SystemUsersPage />);

        expect(await screen.findByText("Mostrando 1 de 5 usuarios")).toBeInTheDocument();
        fireEvent.click(screen.getByRole("button", { name: "Cargar 4 más" }));

        expect(await screen.findByText("Mostrando 5 de 5 usuarios")).toBeInTheDocument();
        expect(mockGetSystemUsers).toHaveBeenLastCalledWith(expect.objectContaining({ cursor: "cursor-2" }));
        expect(await screen.findAllByRole("button", { name: "Abrir detalle de Andrea Valverde" })).toHaveLength(1);
        expect(screen.queryByRole("button", { name: /Cargar .* más/u })).not.toBeInTheDocument();
    });

    it("usa DataTables como única capa visible de búsqueda y filtros", async () => {
        render(<SystemUsersPage />);

        await screen.findByRole("button", { name: "Abrir detalle de Andrea Valverde" });

        expect(screen.queryByRole("button", { name: /Exportar/u })).not.toBeInTheDocument();
        expect(screen.queryByLabelText("Buscar usuarios")).not.toBeInTheDocument();
        expect(screen.queryByRole("button", { name: /^Filtros/u })).not.toBeInTheDocument();
        expect(screen.getByRole("searchbox", { name: "Buscar:" })).toBeInTheDocument();
    });

    it("restaura la búsqueda local de DataTables al refrescar la vista", async () => {
        window.localStorage.setItem(
            SYSTEM_USERS_DATATABLE_STATE_KEY,
            JSON.stringify({
                columns: [{ search: { search: "" } }, { search: { search: "" } }, { search: { search: "" } }, { search: { search: "" } }, { search: { search: "" } }, { search: { search: "" } }],
                length: 10,
                order: [[0, "asc"]],
                search: { search: "Javier" },
                start: 0,
                time: Date.now(),
            }),
        );

        render(<SystemUsersPage />);

        await waitFor(() => {
            expect(screen.getByRole("searchbox", { name: "Buscar:" })).toHaveValue("Javier");
        });
        expect(screen.getByRole("button", { name: "Abrir detalle de Javier Castro" })).toBeInTheDocument();
        expect(screen.queryByRole("button", { name: "Abrir detalle de Andrea Valverde" })).not.toBeInTheDocument();
    });

    it("restaura estado y búsqueda desde la URL para compartir la vista filtrada", async () => {
        window.history.replaceState(null, "", "/?estado=blocked&q=soporte");

        render(<SystemUsersPage />);

        await waitFor(() => {
            expect(mockGetSystemUsers).toHaveBeenCalledWith(expect.objectContaining({ search: "soporte", status: "blocked" }));
        });
        expect(screen.queryByRole("radio", { name: /Bloqueados/u })).not.toBeInTheDocument();
        expect(screen.queryByLabelText("Buscar usuarios")).not.toBeInTheDocument();
    });

    it("concentra las acciones de la fila en un menú contextual", async () => {
        render(<SystemUsersPage />);

        const actionButton = await screen.findByRole("button", { name: "Más acciones para Andrea Valverde" });
        const tableWrapper = actionButton.closest<HTMLElement>(".administration-users-datatable-wrap");

        if (!tableWrapper) {
            throw new Error("No se encontro el contenedor de la tabla.");
        }

        vi.spyOn(tableWrapper, "getBoundingClientRect").mockReturnValue(buildDomRect({ right: 900, top: 200 }));
        vi.spyOn(actionButton, "getBoundingClientRect").mockReturnValue(buildDomRect({ bottom: 480, right: 850 }));

        fireEvent.click(actionButton);

        const menu = await screen.findByRole("menu", { name: "Acciones para Andrea Valverde" });
        expect(menu).toHaveStyle({ right: "50px", top: "286px" });
        expect(getUserRow("Andrea Valverde")).toHaveClass("administration-users-table__row--menu-open");
        expect(getUserRow("Javier Castro")).not.toHaveClass("administration-users-table__row--menu-open");
        expect(screen.getByRole("menuitem", { name: /Ver detalle/u })).toBeInTheDocument();
        expect(screen.getByRole("menuitem", { name: /Copiar ID de usuario/u })).toBeInTheDocument();
        expect(screen.queryByRole("heading", { name: "Andrea Valverde" })).not.toBeInTheDocument();

        fireEvent.click(screen.getByRole("menuitem", { name: /Ver detalle/u }));

        expect(await screen.findByRole("heading", { name: "Andrea Valverde" })).toBeInTheDocument();
    });

    it("muestra ayuda de estados y datos de detalle coherentes", async () => {
        mockGetSystemUsers.mockResolvedValueOnce({
            ...mockUsersResponse,
            items: mockUsersResponse.items.map((user) => (user.email === "mflores@roccacr.com" ? { ...user, lastActivityAt: null } : user)),
            summary: {
                ...mockUsersResponse.summary,
                blocked: 0,
            },
        });

        render(<SystemUsersPage />);

        await screen.findByRole("button", { name: "Abrir detalle de Andrea Valverde" });
        expect(screen.queryByRole("button", { name: /Exportar/u })).not.toBeInTheDocument();
        expect(screen.queryByLabelText("Filtrar por estado")).not.toBeInTheDocument();
        expect((await screen.findAllByTitle(/Pendiente: invitación enviada/u)).length).toBeGreaterThan(0);
        expect(screen.getAllByRole("columnheader", { name: "Estado" }).length).toBeGreaterThan(0);
        expect(screen.queryByRole("checkbox", { name: "Seleccionar usuarios visibles" })).not.toBeInTheDocument();
        expect(screen.getAllByText("Sin inicio registrado").length).toBeGreaterThan(0);

        await openUserDetail("Andrea Valverde");

        const cardTitles = Array.from(getDetailPanel("Andrea Valverde").querySelectorAll(".ant-card-head-title"), (title) => title.textContent);
        expect(cardTitles).toEqual(["Rol y área", "Seguridad", "Registro"]);
        expect(within(getDetailPanel("Andrea Valverde")).getByText("Rol")).toBeInTheDocument();
        expect(screen.getByText("USR-ROCCA-0004")).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Copiar ID de usuario" })).toBeInTheDocument();
        expect(screen.getByText("Referencias externas")).toBeInTheDocument();
        expect(screen.getByText("NetSuite")).toBeInTheDocument();
        expect(screen.getByText("654321")).toBeInTheDocument();
        expect(screen.getByText("Odoo")).toBeInTheDocument();
        expect(screen.getByText("ODOO-77")).toBeInTheDocument();
        expect(screen.getByText("No configurado")).toBeInTheDocument();
        expect(screen.getByText("Invitado por")).toBeInTheDocument();
        expect(screen.queryByText("Este usuario no admite una acción de bloqueo directa por su estado actual.")).not.toBeInTheDocument();
    });

    it("edita un usuario desde el detalle y guarda roles contra el API", async () => {
        mockGetSystemUsers.mockResolvedValueOnce({
            ...mockUsersResponse,
            items: mockUsersResponse.items.map((user) => (user.publicId === "USR-ROCCA-0004" ? { ...user, orgUnit: { code: "ventas", name: "Ventas", publicId: "ORG-VENTAS" }, roles: [{ code: "ventas", name: "Ventas" }] } : user)),
        });
        mockGetIdentitySecurityCatalog.mockResolvedValue({ ...mockSecurityCatalog, rolePermissions: { ventas: ["lead.read"] } });
        render(<SystemUsersPage />);

        await openUserDetail("Andrea Valverde");
        expect(await screen.findByRole("heading", { name: "Andrea Valverde" })).toBeInTheDocument();
        fireEvent.click(within(getDetailPanel("Andrea Valverde")).getByRole("button", { name: "Editar usuario" }));

        expect(await screen.findByRole("heading", { name: "Identificación" })).toBeInTheDocument();
        expect(screen.getAllByText("Editar usuario").length).toBeGreaterThan(0);
        expect(screen.getByLabelText("Nombre completo")).toHaveValue("Andrea Valverde");
        expect(screen.getByLabelText("Correo")).toHaveValue("avalverde@roccacr.com");
        fireEvent.click(screen.getByRole("button", { name: /Opciones avanzadas/u }));
        expect(screen.getByLabelText("ID NetSuite")).toHaveValue("654321");

        fireEvent.change(screen.getByLabelText("Nombre completo"), { target: { value: "Andrea Ventas" } });
        fireEvent.change(screen.getByLabelText("Motivo de la edición"), { target: { value: "Cambio autorizado por jefatura" } });
        fireEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));

        await waitFor(() => {
            expect(mockUpdateSystemUser).toHaveBeenCalledWith("USR-ROCCA-0004", {
                accessMethods: ["microsoft"],
                displayName: "Andrea Ventas",
                email: "avalverde@roccacr.com",
                externalReferences: [
                    { externalUserId: "654321", systemCode: "netsuite" },
                    { externalUserId: "ODOO-77", systemCode: "odoo" },
                ],
                orgUnitCodes: ["ventas"],
                reason: "Cambio autorizado por jefatura",
                roleCode: "ventas",
                roleCodes: ["ventas"],
            });
        });
    });

    it("abre el detalle al hacer clic en cualquier columna de la fila", async () => {
        render(<SystemUsersPage />);

        await screen.findByRole("button", { name: "Abrir detalle de Andrea Valverde" });
        fireEvent.click(within(getUserRow("Andrea Valverde")).getByText("Consulta"));

        expect(await screen.findByRole("heading", { name: "Andrea Valverde" })).toBeInTheDocument();
        expect(getUserRow("Andrea Valverde")).toHaveClass("administration-users-table__row--selected");
        expect(getUserRow("Javier Castro")).not.toHaveClass("administration-users-table__row--selected");
    });

    it("no abre el detalle al copiar el correo desde la fila", async () => {
        const writeText = vi.fn(() => Promise.resolve());
        Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
        render(<SystemUsersPage />);

        fireEvent.click(await screen.findByRole("button", { name: "Copiar correo de Andrea Valverde" }));

        expect(writeText).toHaveBeenCalledWith("avalverde@roccacr.com");
        expect(screen.queryByRole("heading", { name: "Andrea Valverde" })).not.toBeInTheDocument();
        Reflect.deleteProperty(navigator, "clipboard");
    });

    it("navega el panel de detalle con flechas de teclado segun la lista visible", async () => {
        render(<SystemUsersPage />);

        await openUserDetail("Andrea Valverde");

        expect(screen.getByRole("heading", { name: "Andrea Valverde" })).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Usuario anterior" })).toBeDisabled();

        fireEvent.keyDown(getDetailPanel("Andrea Valverde"), { key: "ArrowDown" });

        expect(await screen.findByRole("heading", { name: "Javier Castro" })).toBeInTheDocument();
    });

    it("adopta la presentación de Proyectos en página, tabla, detalle y diálogo", async () => {
        const { container } = render(<SystemUsersPage />);

        fireEvent.click(await screen.findByRole("button", { name: "Más acciones para Andrea Valverde" }));
        fireEvent.click(await screen.findByRole("menuitem", { name: "Reactivar" }));

        const reason = await screen.findByLabelText(/Motivo de auditoría/u);
        expect(reason.closest(".ant-modal")).toHaveClass("catalog-items-modal--projects", "users-view-modal");
        expect(reason).not.toHaveAttribute("rows", "4");
        fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));

        expect(container.querySelector(".users-view.catalog-items-page--projects")).toBeInTheDocument();
        expect(screen.getByText("5 usuarios")).toHaveClass("projects-view-total");
        expect(screen.getByRole("button", { name: "Actualizar usuarios" })).toHaveClass("projects-view-refresh");
        expect(container.querySelector(".projects-view-toolbar .dt-search")).toBeInTheDocument();
        expect(getUserRow("Andrea Valverde").querySelector("td.administration-users-col-role")).toHaveAttribute("data-project-field", "Rol");
        expect(within(getUserRow("Soporte Externo")).getByText("Bloqueado").closest(".administration-users-dt-status--blocked")).toBeInTheDocument();

        await openUserDetail("Andrea Valverde");

        const panel = getDetailPanel("Andrea Valverde");
        expect(panel).toHaveClass("catalog-item-detail-drawer--projects", "users-view-drawer");
        expect(panel.querySelector(".user-detail-drawer__identity-meta .administration-users-dt-status--inactive")).toHaveTextContent("Inactivo");
    });

    it("recorre el detalle en el orden que muestra la tabla", async () => {
        render(<SystemUsersPage />);

        const header = (await screen.findAllByRole("columnheader", { name: /Usuario/ }))[0];

        if (!header) {
            throw new Error("No se encontro el encabezado Usuario.");
        }

        fireEvent.click(header);
        await waitFor(() => {
            expect(document.querySelector("tbody tr[data-user-email]")).toHaveAttribute("data-user-email", "soporte.externo@roccacr.com");
        });
        await openUserDetail("Soporte Externo");

        expect(screen.getByText("Usuario 1 de 5")).toBeInTheDocument();

        fireEvent.click(screen.getByRole("button", { name: "Usuario siguiente" }));

        expect(await screen.findByRole("heading", { name: "Roberto Carlos Zúñiga Altamirano" })).toBeInTheDocument();
        expect(screen.getByText("Usuario 2 de 5")).toBeInTheDocument();
    });

    it("recorre usuarios desde el pie del panel y cierra al hacer clic en la máscara", async () => {
        render(<SystemUsersPage />);

        await openUserDetail("Andrea Valverde");
        expect(screen.getByText("Usuario 1 de 5")).toBeInTheDocument();

        fireEvent.click(screen.getByRole("button", { name: "Usuario siguiente" }));

        expect(await screen.findByRole("heading", { name: "Javier Castro" })).toBeInTheDocument();
        expect(screen.getByText("Usuario 2 de 5")).toBeInTheDocument();

        const mask = document.querySelector(".user-detail-drawer .ant-drawer-mask");

        if (!mask) {
            throw new Error("No se encontro la mascara del panel de detalle.");
        }

        fireEvent.click(mask);

        await waitFor(() => {
            expect(document.querySelector(".user-detail-drawer.ant-drawer-open")).not.toBeInTheDocument();
        });
    });

    it("muestra la identidad sin duplicados y deja bloquear solo desde el menú del encabezado", async () => {
        render(<SystemUsersPage />);

        await openUserDetail("Mariana Flores");
        const panel = getDetailPanel("Mariana Flores");

        expect(within(panel).queryByText("Invitado por")).not.toBeInTheDocument();
        expect(within(panel).queryByText("No aplica")).not.toBeInTheDocument();
        expect(within(panel).getAllByText("Microsoft")).toHaveLength(1);
        expect(within(panel).queryByRole("button", { name: "Bloquear usuario" })).not.toBeInTheDocument();
        expect(within(panel).queryByRole("tab")).not.toBeInTheDocument();
        expect(within(panel).getByRole("button", { name: "Desactivar usuario" }).closest(".ant-drawer-footer")).toBeInTheDocument();

        fireEvent.click(within(panel).getByRole("button", { name: "Más acciones para Mariana Flores" }));

        expect(await screen.findByRole("menuitem", { name: /Bloquear usuario/u })).toBeInTheDocument();
    });

    it("cambia estado desde el menu de fila con motivo auditable y refresca", async () => {
        mockUpdateSystemUserStatus.mockResolvedValue({ ...mockUsersResponse.items[0], status: "active" });
        render(<SystemUsersPage />);

        fireEvent.click(await screen.findByRole("button", { name: "Más acciones para Andrea Valverde" }));
        fireEvent.click(await screen.findByRole("menuitem", { name: "Reactivar" }));
        fireEvent.change(await screen.findByLabelText(/Motivo de auditoría/u), { target: { value: "Reactivación autorizada por jefatura" } });
        fireEvent.click(screen.getByRole("button", { name: "Confirmar acción" }));

        await waitFor(() => {
            expect(mockUpdateSystemUserStatus).toHaveBeenCalledWith("USR-ROCCA-0004", {
                reason: "Reactivación autorizada por jefatura",
                status: "active",
            });
        });
        await waitFor(() => {
            expect(mockGetSystemUsers).toHaveBeenCalledTimes(2);
        });
    });

    it("bloquea y desbloquea desde el menu de fila usando el API", async () => {
        mockUpdateSystemUserStatus.mockResolvedValue({ ...mockUsersResponse.items[2], status: "blocked" });
        render(<SystemUsersPage />);

        fireEvent.click(await screen.findByRole("button", { name: "Más acciones para Mariana Flores" }));
        fireEvent.click(await screen.findByRole("menuitem", { name: "Bloquear" }));
        fireEvent.change(await screen.findByLabelText(/Motivo de auditoría/u), { target: { value: "Bloqueo temporal solicitado por seguridad" } });
        fireEvent.click(screen.getByRole("button", { name: "Confirmar acción" }));

        await waitFor(() => {
            expect(mockUpdateSystemUserStatus).toHaveBeenCalledWith("USR-ROCCA-0002", {
                reason: "Bloqueo temporal solicitado por seguridad",
                status: "blocked",
            });
        });
    });

    it("ejecuta la accion principal desde el detalle del usuario", async () => {
        mockUpdateSystemUserStatus.mockResolvedValue({ ...mockUsersResponse.items[4], status: "active" });
        render(<SystemUsersPage />);

        await openUserDetail("Soporte Externo");
        fireEvent.click(screen.getByRole("button", { name: "Desbloquear usuario" }));
        const modalWrap = (await screen.findByLabelText(/Motivo de auditoría/u)).closest<HTMLElement>(".ant-modal-wrap");

        if (!modalWrap) {
            throw new Error("No se encontro la capa del modal de accion.");
        }

        expect(modalWrap).toHaveStyle({ zIndex: "1400" });
        expect(screen.getByRole("heading", { name: "Desbloquear usuario" })).toBeInTheDocument();
        expect(screen.getByText("Resumen efectivo")).toBeInTheDocument();
        expect(screen.getByText("Usuario: Soporte Externo")).toBeInTheDocument();
        expect(screen.getByText("Estado: Bloqueado -> Activo")).toBeInTheDocument();

        fireEvent.change(await screen.findByLabelText(/Motivo de auditoría/u), { target: { value: "Acceso restaurado por soporte interno" } });
        fireEvent.click(screen.getByRole("button", { name: "Confirmar acción" }));

        await waitFor(() => {
            expect(mockUpdateSystemUserStatus).toHaveBeenCalledWith("USR-ROCCA-0005", {
                reason: "Acceso restaurado por soporte interno",
                status: "active",
            });
        });
    });

    it("muestra un guion en actividad vacía sin perder el motivo para lectores de pantalla", async () => {
        render(<SystemUsersPage />);

        const row = await screen.findByRole("button", { name: "Abrir detalle de Andrea Valverde" });
        const activityCell = within(row.closest("tr") ?? document.body).getByText("—");

        expect(activityCell.closest(".administration-users-muted")).toHaveTextContent("Sin actividad registrada");
    });

    it("crea un usuario con rol, modulo, ids externos y refresca el directorio", async () => {
        mockGetIdentityProfile.mockResolvedValue(profileWithPermissions([...userPermissions, "user.assign_password"]));
        mockGetIdentitySecurityCatalog.mockResolvedValue({ ...mockSecurityCatalog, rolePermissions: { ventas: ["lead.read"] } });
        render(<SystemUsersPage />);
        await openCreateUserDrawer();
        fireEvent.change(await screen.findByLabelText("Contraseña inicial"), { target: { value: "Initial secret 123" } });

        expect(screen.getByRole("heading", { name: "Identificación" })).toBeInTheDocument();
        expect(screen.getByRole("heading", { name: "Acceso y permisos" })).toBeInTheDocument();
        expect(screen.getByRole("heading", { name: "Auditoría" })).toBeInTheDocument();
        expect(screen.queryByText(/Debe terminar en @roccacr\.com/u)).not.toBeInTheDocument();
        expect(screen.getByRole("checkbox", { name: "Microsoft 365" })).toBeChecked();
        expect(screen.getByRole("checkbox", { name: "Contraseña local" })).toBeChecked();
        expect(screen.getByText("Sin roles asignados")).toBeInTheDocument();

        fireEvent.change(screen.getByLabelText("Nombre completo"), { target: { value: "Laura Ventas" } });
        fireEvent.change(screen.getByLabelText("Correo"), { target: { value: "  lventas@roccacr.com " } });
        await selectRole("Ventas");
        expect(await screen.findByText("1 módulo")).toBeInTheDocument();

        const advancedOptions = screen.getByRole("button", { name: /Opciones avanzadas/u });
        expect(advancedOptions).toHaveAttribute("aria-expanded", "false");
        fireEvent.click(advancedOptions);
        expect(advancedOptions).toHaveAttribute("aria-expanded", "true");
        fireEvent.change(screen.getByLabelText("ID NetSuite"), { target: { value: "654321" } });
        fireEvent.change(screen.getByLabelText("ID Odoo"), { target: { value: "ODOO-77" } });
        fireEvent.change(screen.getByLabelText("Motivo del alta"), { target: { value: "Alta autorizada por TI" } });
        fireEvent.click(screen.getByRole("button", { name: "Crear usuario" }));

        await waitFor(() => {
            expect(mockCreateSystemUser).toHaveBeenCalledWith({
                password: "Initial secret 123",
                accessMethods: ["microsoft", "local"],
                displayName: "Laura Ventas",
                email: "lventas@roccacr.com",
                externalReferences: [
                    { externalUserId: "654321", systemCode: "netsuite" },
                    { externalUserId: "ODOO-77", systemCode: "odoo" },
                ],
                initialStatus: "pending",
                orgUnitCodes: ["ventas"],
                reason: "Alta autorizada por TI",
                roleCode: "ventas",
                roleCodes: ["ventas"],
            });
        });
        await waitFor(() => {
            expect(mockGetSystemUsers).toHaveBeenCalledTimes(2);
        });
        await waitFor(() => {
            expect(getUserRow("Andrea Valverde")).toHaveClass("administration-users-table__row--new");
        });
        expect(getUserRow("Javier Castro")).not.toHaveClass("administration-users-table__row--new");
    });

    it("crea un owner con alcance global y correo de cualquier dominio", async () => {
        render(<SystemUsersPage />);
        await openCreateUserDrawer();

        fireEvent.change(screen.getByLabelText("Nombre completo"), { target: { value: "Owner Global" } });
        fireEvent.change(screen.getByLabelText("Correo"), { target: { value: "owner.global@gmail.com" } });
        await selectRole("Owner");

        expect(await screen.findByText("Alcance global: toda la empresa.")).toBeInTheDocument();
        expect(screen.getByText("Alcance global")).toBeInTheDocument();

        fireEvent.change(screen.getByLabelText("Motivo del alta"), { target: { value: "Alta aprobada por dirección" } });
        fireEvent.click(screen.getByRole("button", { name: "Crear usuario" }));

        await waitFor(() => {
            expect(mockCreateSystemUser).toHaveBeenCalledWith(
                expect.objectContaining({
                    accessMethods: ["microsoft", "local"],
                    email: "owner.global@gmail.com",
                    orgUnitCodes: ["empresa"],
                    roleCode: "owner",
                    roleCodes: ["owner"],
                }),
            );
        });
    });

    it("asigna los modulos a partir de los roles sin pedirlos en el formulario", async () => {
        mockGetIdentitySecurityCatalog.mockResolvedValue({ ...mockSecurityCatalog, rolePermissions: { mercadeo: ["marketing.read"], ventas: ["lead.read"] } });
        render(<SystemUsersPage />);
        await openCreateUserDrawer();

        expect(screen.queryByText("Módulos de acceso")).not.toBeInTheDocument();

        await selectRole("Ventas");
        await selectRole("Mercadeo");

        expect(await screen.findByText("Ventas, Mercadeo")).toBeInTheDocument();
        expect(screen.getByText("2 módulos")).toBeInTheDocument();
        expect(screen.queryByRole("checkbox", { name: "Acceso a Ventas" })).not.toBeInTheDocument();

        fireEvent.change(screen.getByLabelText("Nombre completo"), { target: { value: "Laura Comercial" } });
        fireEvent.change(screen.getByLabelText("Correo"), { target: { value: "lcomercial@roccacr.com" } });
        fireEvent.change(screen.getByLabelText("Motivo del alta"), { target: { value: "Alta autorizada por TI" } });
        fireEvent.click(screen.getByRole("button", { name: "Crear usuario" }));

        await waitFor(() => {
            expect(mockCreateSystemUser).toHaveBeenCalledWith(expect.objectContaining({ orgUnitCodes: ["ventas", "mercadeo"], roleCodes: ["ventas", "mercadeo"] }));
        });
    });

    it("bloquea el alta si los roles no tienen acciones en ningun modulo", async () => {
        render(<SystemUsersPage />);
        await openCreateUserDrawer();

        await selectRole("Ventas");

        expect(await screen.findByText("Los roles elegidos no tienen acciones en ningún módulo. Agrega un rol operativo.")).toBeInTheDocument();
        fireEvent.click(screen.getByRole("button", { name: "Crear usuario" }));
        await waitFor(() => {
            expect(screen.getByText("Ingresa el nombre completo.")).toBeInTheDocument();
        });
        expect(mockCreateSystemUser).not.toHaveBeenCalled();
    });

    it("cierra el alta de usuario al hacer clic fuera del panel", async () => {
        render(<SystemUsersPage />);
        await openCreateUserDrawer();

        const mask = document.querySelector(".create-user-drawer .ant-drawer-mask");

        if (!mask) {
            throw new Error("No se encontro la mascara del panel de alta.");
        }

        fireEvent.click(mask);

        await waitFor(() => {
            expect(document.querySelector(".create-user-drawer.ant-drawer-open")).not.toBeInTheDocument();
        });
    });

    it("valida en linea los campos obligatorios sin llamar al API", async () => {
        render(<SystemUsersPage />);
        await openCreateUserDrawer();

        fireEvent.click(screen.getByRole("button", { name: "Crear usuario" }));

        expect(await screen.findByText("Ingresa el nombre completo.")).toBeInTheDocument();
        expect(screen.getByText("Ingresa el correo.")).toBeInTheDocument();
        expect(screen.getByText("Selecciona al menos un rol.")).toBeInTheDocument();
        expect(mockCreateSystemUser).not.toHaveBeenCalled();

        fireEvent.change(screen.getByLabelText("Correo"), { target: { value: "rocca@" } });
        fireEvent.blur(screen.getByLabelText("Correo"));
        expect(await screen.findByText("Ingresa un correo válido.")).toBeInTheDocument();
    });

    it("protege el formulario con datos contra cierre accidental", async () => {
        const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(false);
        render(<SystemUsersPage />);
        await openCreateUserDrawer();

        fireEvent.change(screen.getByLabelText("Motivo del alta"), { target: { value: "Alta pendiente de validar" } });
        fireEvent.click(screen.getByRole("button", { name: "Cerrar creación de usuario" }));

        expect(confirmSpy).toHaveBeenCalledWith("Hay datos sin guardar. ¿Quieres cerrar el formulario y descartarlos?");
        expect(document.querySelector(".create-user-drawer.ant-drawer-open")).toBeInTheDocument();

        confirmSpy.mockRestore();
    });
});
