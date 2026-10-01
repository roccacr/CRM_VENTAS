import "@testing-library/jest-dom/vitest";

import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { buildApiUrl } from "../../src/config/frontend-env";
import { SystemUsersPage } from "../../src/modules/administration/pages/SystemUsersPage";
import { createSystemUser, getIdentitySecurityCatalog, getSystemUsers } from "../../src/services/auth/auth-service";
import { installBrowserApiDoubles } from "../support/browser";

vi.mock("../../src/services/auth/auth-service", () => ({
    createSystemUser: vi.fn(),
    getIdentitySecurityCatalog: vi.fn(),
    getSystemUsers: vi.fn(),
}));

const mockCreateSystemUser = vi.mocked(createSystemUser);
const mockGetIdentitySecurityCatalog = vi.mocked(getIdentitySecurityCatalog);
const mockGetSystemUsers = vi.mocked(getSystemUsers);

const mockUsersResponse = {
    items: [
        {
            email: "avalverde@roccacr.com",
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
    window.history.replaceState(null, "", "/");
});

beforeEach(() => {
    installBrowserApiDoubles();
    mockCreateSystemUser.mockResolvedValue(mockUsersResponse.items[0]);
    mockGetIdentitySecurityCatalog.mockResolvedValue(mockSecurityCatalog);
    mockGetSystemUsers.mockResolvedValue(mockUsersResponse);
});

const openUserDetail = async (name: string): Promise<void> => {
    fireEvent.click(await screen.findByRole("button", { name: `Abrir detalle de ${name}` }));
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

const openCreateUserDrawer = async (): Promise<void> => {
    await screen.findByRole("button", { name: "Exportar 5 usuarios visibles" });
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

        expect(screen.getAllByRole("columnheader", { name: "Rol y área" }).length).toBeGreaterThan(0);
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
        expect(screen.getAllByRole("button", { name: "Abrir detalle de Andrea Valverde" })).toHaveLength(1);
        expect(screen.queryByRole("button", { name: /Cargar .* más/u })).not.toBeInTheDocument();
    });

    it("pide una pagina nueva y muestra actualizacion al cambiar filtro de estado", async () => {
        mockGetSystemUsers.mockResolvedValueOnce(mockUsersResponse).mockReturnValueOnce(new Promise(() => undefined));

        render(<SystemUsersPage />);

        await screen.findByRole("button", { name: "Abrir detalle de Andrea Valverde" });
        fireEvent.click(screen.getByRole("radio", { name: /Activos/u }));

        await waitFor(() => {
            expect(mockGetSystemUsers).toHaveBeenLastCalledWith(expect.objectContaining({ status: "active" }));
        });
        expect(screen.getByText("Actualizando usuarios...")).toBeInTheDocument();
        await waitFor(() => {
            expect(document.querySelector(".administration-users-panel .ant-spin-spinning")).toBeInTheDocument();
        });
        expect(window.location.search).toBe("?estado=active");
    });

    it("restaura estado y búsqueda desde la URL para compartir la vista filtrada", async () => {
        window.history.replaceState(null, "", "/?estado=blocked&q=soporte");

        render(<SystemUsersPage />);

        await waitFor(() => {
            expect(mockGetSystemUsers).toHaveBeenCalledWith(expect.objectContaining({ search: "soporte", status: "blocked" }));
        });
        expect(screen.getByRole("radio", { name: /Bloqueados/u })).toBeChecked();
        expect(screen.getByLabelText("Buscar usuarios")).toHaveValue("soporte");
    });

    it("concentra las acciones de la fila en un menú contextual", async () => {
        render(<SystemUsersPage />);

        fireEvent.click(await screen.findByRole("button", { name: "Más acciones para Andrea Valverde" }));

        expect(await screen.findByRole("menuitem", { name: /Ver detalle/u })).toBeInTheDocument();
        expect(screen.getByRole("menuitem", { name: /Copiar ID de usuario/u })).toBeInTheDocument();
        expect(screen.queryByRole("heading", { name: "Andrea Valverde" })).not.toBeInTheDocument();

        fireEvent.click(screen.getByRole("menuitem", { name: /Ver detalle/u }));

        expect(await screen.findByRole("heading", { name: "Andrea Valverde" })).toBeInTheDocument();
    });

    it("muestra ayuda de estados, alcance de exportacion y datos de detalle coherentes", async () => {
        mockGetSystemUsers.mockResolvedValueOnce({
            ...mockUsersResponse,
            items: mockUsersResponse.items.map((user) => (user.email === "mflores@roccacr.com" ? { ...user, lastActivityAt: null } : user)),
            summary: {
                ...mockUsersResponse.summary,
                blocked: 0,
            },
        });

        render(<SystemUsersPage />);

        expect(await screen.findByRole("button", { name: "Exportar 5 usuarios visibles" })).toBeInTheDocument();
        expect(screen.getByLabelText("Filtrar por estado")).toBeInTheDocument();
        expect((await screen.findAllByTitle(/Pendiente: invitación enviada/u)).length).toBeGreaterThan(0);
        expect(screen.getAllByRole("columnheader", { name: "Estado" }).length).toBeGreaterThan(0);
        expect(screen.getAllByRole("checkbox", { name: "Seleccionar usuarios visibles" }).length).toBeGreaterThan(0);
        expect(screen.getByText("Bloqueados").closest(".administration-users-status-filter__option")).toHaveClass("administration-users-status-filter__option--empty");
        expect(screen.getAllByText("Sin inicio registrado").length).toBeGreaterThan(0);

        await openUserDetail("Andrea Valverde");

        const cardTitles = Array.from(getDetailPanel("Andrea Valverde").querySelectorAll(".ant-card-head-title"), (title) => title.textContent);
        expect(cardTitles).toEqual(["Rol y área", "Seguridad", "Registro"]);
        expect(within(getDetailPanel("Andrea Valverde")).getByText("Rol")).toBeInTheDocument();
        expect(screen.getByText("USR-ROCCA-0004")).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Copiar ID de usuario" })).toBeInTheDocument();
        expect(screen.getByText("No configurado")).toBeInTheDocument();
        expect(screen.getByText("Invitado por")).toBeInTheDocument();
        expect(screen.queryByText("Este usuario no admite una acción de bloqueo directa por su estado actual.")).not.toBeInTheDocument();
    });

    it("navega el panel de detalle con flechas de teclado segun la lista visible", async () => {
        render(<SystemUsersPage />);

        await openUserDetail("Andrea Valverde");

        expect(screen.getByRole("heading", { name: "Andrea Valverde" })).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Usuario anterior" })).toBeDisabled();

        fireEvent.keyDown(getDetailPanel("Andrea Valverde"), { key: "ArrowDown" });

        expect(screen.getByRole("heading", { name: "Javier Castro" })).toBeInTheDocument();
    });

    it("recorre usuarios desde el pie del panel y cierra al hacer clic en la máscara", async () => {
        render(<SystemUsersPage />);

        await openUserDetail("Andrea Valverde");
        expect(screen.getByText("Usuario 1 de 5")).toBeInTheDocument();

        fireEvent.click(screen.getByRole("button", { name: "Usuario siguiente" }));

        expect(screen.getByRole("heading", { name: "Javier Castro" })).toBeInTheDocument();
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
        expect(within(panel).getByRole("button", { name: "Editar usuario" }).closest(".ant-drawer-footer")).toBeInTheDocument();

        fireEvent.click(within(panel).getByRole("button", { name: "Más acciones para Mariana Flores" }));

        expect(await screen.findByRole("menuitem", { name: /Bloquear usuario/u })).toBeInTheDocument();
    });

    it("muestra un guion en actividad vacía sin perder el motivo para lectores de pantalla", async () => {
        render(<SystemUsersPage />);

        const row = await screen.findByRole("button", { name: "Abrir detalle de Andrea Valverde" });
        const activityCell = within(row.closest("tr") ?? document.body).getByText("—");

        expect(activityCell.closest(".administration-users-muted")).toHaveTextContent("Sin actividad registrada");
    });

    it("crea un usuario con rol, modulo, ids externos y refresca el directorio", async () => {
        mockGetIdentitySecurityCatalog.mockResolvedValue({ ...mockSecurityCatalog, rolePermissions: { ventas: ["lead.read"] } });
        render(<SystemUsersPage />);
        await openCreateUserDrawer();

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
        expect(screen.getByText("Indica el motivo del alta.")).toBeInTheDocument();
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
