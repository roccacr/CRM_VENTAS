import "@testing-library/jest-dom/vitest";

import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { App } from "../../src/App";
import { buildApiUrl } from "../../src/config/frontend-env";
import { DEMO_EFFECTIVE_NAVIGATION_PERMISSIONS } from "../../src/modules/home/GlobalHomeShell";
import type { IdentityProfile, SessionResponse } from "../../src/services/auth/identity-contracts";
import { installBrowserApiDoubles } from "../support/browser";

beforeAll(() => {
    installBrowserApiDoubles();
});
afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.unstubAllGlobals();
    Object.defineProperty(window, "opener", {
        configurable: true,
        value: null,
    });
    window.name = "";
    window.sessionStorage.clear();
    window.history.replaceState(null, "", "/auth/login");
});

const sessionUser = {
    displayName: "Roberto Carlos",
    email: "roberto@roccacr.com",
    permissionVersion: 1,
    profileImageUrl: null,
    publicId: "usr_001",
    status: "active",
} as const;

const authenticatedSession: SessionResponse = {
    authenticated: true,
    csrfToken: "csrf-authenticated",
    session: {
        expiresAt: "2026-09-29T22:00:00.000Z",
        expiresInSeconds: 28_800,
        permissionVersion: 1,
        publicId: "ses_001",
        status: "active",
    },
    user: sessionUser,
};

const anonymousSession: SessionResponse = {
    authenticated: false,
    csrfToken: "csrf-anonymous",
    session: null,
    user: null,
};

const authenticatedProfile: IdentityProfile = {
    auth: {
        availableProviders: ["microsoft", "local"],
        currentProvider: "local",
        localStatus: "active",
        microsoft: null,
        primaryProvider: "microsoft",
    },
    orgUnits: [],
    permissions: DEMO_EFFECTIVE_NAVIGATION_PERMISSIONS.map((permission) => ({
        ...permission,
        scope: "all_areas",
        source: "role",
    })),
    roles: [{ code: "owner", name: "Owner", status: "active" }],
    session: {
        expiresAt: "2026-09-29T22:00:00.000Z",
        expiresInSeconds: 28_800,
        permissionVersion: 1,
        publicId: "ses_001",
        status: "active",
    },
    user: sessionUser,
};

const systemUsersResponse = {
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
    ],
    page: {
        limit: 25,
        nextCursor: null,
        total: 1,
    },
    summary: {
        active: 0,
        all: 1,
        blocked: 0,
        inactive: 1,
        pending: 0,
    },
} as const;

const securityCatalogResponse = {
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
                        { code: "lead.read", description: "Permite leer la tabla de prospectos.", name: "Ver lista de leads", sensitive: false },
                        { code: "lead.create", description: "Habilita el botón Nuevo lead.", name: "Crear lead", sensitive: false },
                        { code: "lead.update", description: "Permite modificar datos del expediente.", name: "Editar lead", sensitive: false },
                        { code: "lead.status", description: "Permite mover etapa en el pipeline.", name: "Cambiar estado", sensitive: false },
                        { code: "lead.assign", description: "Permite reasignar responsable.", name: "Asignar responsable", sensitive: false },
                    ],
                },
                {
                    code: "opportunities",
                    name: "Oportunidades",
                    permissions: [
                        { code: "opportunity.read", description: "Permite consultar oportunidades abiertas.", name: "Ver oportunidades", sensitive: false },
                        { code: "opportunity.create", description: "Habilita creación de oportunidades.", name: "Crear oportunidad", sensitive: false },
                        { code: "opportunity.close", description: "Permite cerrar oportunidad ganada o perdida.", name: "Cerrar oportunidad", sensitive: false },
                    ],
                },
                {
                    code: "estimates",
                    name: "Estimaciones",
                    permissions: [
                        { code: "estimate.read", description: "Permite ver estimaciones asociadas.", name: "Ver estimaciones", sensitive: false },
                        { code: "estimate.create", description: "Habilita cálculo y guardado de estimaciones.", name: "Crear estimación", sensitive: false },
                        { code: "estimate.approve", description: "Permiso sensible para aprobar estimaciones.", name: "Aprobar estimación", sensitive: true },
                    ],
                },
            ],
        },
        {
            code: "mercadeo",
            name: "Mercadeo",
            views: [
                {
                    code: "campaigns",
                    name: "Campañas",
                    permissions: [
                        { code: "campaign.read", description: "Permite ver campañas activas.", name: "Ver campañas", sensitive: false },
                        { code: "campaign.create", description: "Permite crear campañas.", name: "Crear campaña", sensitive: false },
                        { code: "source.update", description: "Permite modificar fuentes de tráfico.", name: "Editar fuentes", sensitive: false },
                    ],
                },
            ],
        },
        {
            code: "formalizacion",
            name: "Formalización",
            views: [
                {
                    code: "files",
                    name: "Expedientes",
                    permissions: [
                        { code: "file.read", description: "Permite ver expedientes.", name: "Ver expedientes", sensitive: false },
                        { code: "contract.review", description: "Permite revisar contratos.", name: "Revisar contrato", sensitive: false },
                        { code: "signature.manage", description: "Permite gestionar firmas.", name: "Gestionar firmas", sensitive: false },
                    ],
                },
            ],
        },
        {
            code: "contabilidad",
            name: "Contabilidad",
            views: [
                {
                    code: "billing",
                    name: "Cobros",
                    permissions: [
                        { code: "wallet.read", description: "Permite ver cartera.", name: "Ver cartera", sensitive: false },
                        { code: "invoice.read", description: "Permite consultar facturas.", name: "Ver facturas", sensitive: false },
                        { code: "payment.reconcile", description: "Permiso sensible para conciliación.", name: "Conciliar pago", sensitive: true },
                    ],
                },
            ],
        },
    ],
    rolePermissions: {
        ventas: ["lead.read", "lead.create", "lead.update"],
    },
    roles: [
        { code: "owner", description: null, locked: true, name: "Owner", status: "active", users: 1 },
        { code: "jefe_general", description: null, locked: false, name: "Jefe general", status: "active", users: 5 },
        { code: "subjefe_area", description: null, locked: false, name: "Subjefe", status: "active", users: 8 },
        {
            code: "ventas",
            description: null,
            locked: false,
            name: "Ventas",
            status: "active",
            users: 31,
        },
        { code: "mercadeo", description: null, locked: false, name: "Mercadeo", status: "active", users: 0 },
        { code: "formalizacion", description: null, locked: false, name: "Formalización", status: "active", users: 0 },
        { code: "contabilidad", description: null, locked: false, name: "Contabilidad", status: "active", users: 0 },
    ],
} as const;

const createJsonResponse = (body: unknown, status = 200): Response =>
    new Response(JSON.stringify(body), {
        headers: {
            "content-type": "application/json",
        },
        status,
    });

const getRequestPath = (input: RequestInfo | URL): string => {
    if (typeof input === "string") {
        return new URL(input).pathname;
    }

    if (input instanceof URL) {
        return input.pathname;
    }

    return new URL(input.url).pathname;
};

const getMockIdentityResponse = (path: string, options: { readonly profile?: IdentityProfile; readonly session: SessionResponse }): Response | null => {
    if (path === "/identity/session") {
        return createJsonResponse(options.session);
    }

    if (path === "/identity/me") {
        return options.profile ? createJsonResponse(options.profile) : createJsonResponse({ message: "No autenticado" }, 401);
    }

    if (path === "/identity/users") {
        return createJsonResponse(systemUsersResponse);
    }

    if (path === "/identity/roles/security-catalog") {
        return createJsonResponse(securityCatalogResponse);
    }

    return null;
};

const mockIdentityFetch = (options: { readonly profile?: IdentityProfile; readonly session: SessionResponse }) => {
    let currentSession = options.session;
    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
        const path = getRequestPath(input);
        const identityResponse = getMockIdentityResponse(path, { ...options, session: currentSession });

        if (identityResponse) {
            return identityResponse;
        }

        if (path === "/identity/local/login" && init?.method === "POST") {
            currentSession = authenticatedSession;
            return createJsonResponse(authenticatedSession);
        }

        if (path === "/identity/logout") {
            currentSession = anonymousSession;
            return createJsonResponse({ success: true });
        }

        return createJsonResponse({ message: `Ruta no mockeada: ${path}` }, 404);
    });

    vi.stubGlobal("fetch", fetchMock);

    return fetchMock;
};

const mockAuthenticatedSessionWithPendingProfile = (session: SessionResponse) => {
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
        const path = getRequestPath(input);

        if (path === "/identity/session") {
            return createJsonResponse(session);
        }

        if (path === "/identity/me") {
            return new Promise<Response>(() => undefined);
        }

        return createJsonResponse({ message: `Ruta no mockeada: ${path}` }, 404);
    });

    vi.stubGlobal("fetch", fetchMock);

    return fetchMock;
};

const expectAdministrationHomeHeading = () =>
    waitFor(
        () => {
            expect(screen.getByRole("heading", { name: "Hola Roberto Carlos al módulo Administración" })).toBeInTheDocument();
        },
        { timeout: 4_000 },
    );

const installDesktopPointerDouble = (): void => {
    Object.defineProperty(window, "matchMedia", {
        writable: true,
        value: (query: string) => ({
            matches: query === "(pointer: fine)",
            media: query,
            onchange: null,
            addEventListener: () => undefined,
            removeEventListener: () => undefined,
            addListener: () => undefined,
            removeListener: () => undefined,
            dispatchEvent: () => false,
        }),
    });
};

describe("App", () => {
    it("muestra un loader de marca mientras verifica la sesion", () => {
        vi.stubGlobal(
            "fetch",
            vi.fn(() => new Promise<Response>(() => undefined)),
        );
        window.history.replaceState(null, "", "/home/administration");

        render(<App />);

        expect(screen.getByRole("status", { name: "Verificando sesión" })).toBeInTheDocument();
        expect(screen.getByRole("heading", { name: "Verificando sesión" })).toBeInTheDocument();
        expect(screen.getByText("Preparando tu entorno de trabajo…")).toBeInTheDocument();
        expect(screen.getByRole("img", { name: "ROCCA Development Group" })).toBeInTheDocument();
        expect(screen.queryByText(/API/iu)).not.toBeInTheDocument();
    });

    it("muestra la foto y el nombre del usuario mientras carga el perfil autenticado", async () => {
        const sessionWithPhoto: SessionResponse = {
            ...authenticatedSession,
            user: {
                ...sessionUser,
                profileImageUrl: "/identity/me/photo",
            },
        };
        mockAuthenticatedSessionWithPendingProfile(sessionWithPhoto);
        window.history.replaceState(null, "", "/home/administration");

        render(<App />);

        expect(await screen.findByRole("status", { name: "Verificando sesión" })).toBeInTheDocument();
        expect(screen.getByText("Roberto Carlos")).toBeInTheDocument();
        expect(screen.getByRole("img", { name: "Foto de Roberto Carlos" })).toHaveAttribute("src", buildApiUrl("/identity/me/photo"));
    });

    it("muestra iniciales y nombre del usuario durante la verificacion si no hay foto", async () => {
        mockAuthenticatedSessionWithPendingProfile(authenticatedSession);
        window.history.replaceState(null, "", "/home/administration");

        render(<App />);

        expect(await screen.findByRole("status", { name: "Verificando sesión" })).toBeInTheDocument();
        expect(screen.getByText("Roberto Carlos")).toBeInTheDocument();
        expect(screen.getByText("RC")).toBeInTheDocument();
        expect(screen.queryByRole("img", { name: "Foto de Roberto Carlos" })).not.toBeInTheDocument();
    });

    it("mantiene /auth/login como ruta publica cuando no existe sesion", async () => {
        mockIdentityFetch({ session: anonymousSession });
        window.history.replaceState(null, "", "/auth/login");

        render(<App />);

        expect(await screen.findByRole("heading", { name: "Bienvenido" })).toBeInTheDocument();
        expect(window.location.pathname).toBe("/auth/login");
    });

    it("mantiene /auth/login visible si falla la verificacion inicial de sesion", async () => {
        vi.stubGlobal(
            "fetch",
            vi.fn(() => Promise.reject(new TypeError("network unavailable"))),
        );
        window.history.replaceState(null, "", "/auth/login");

        render(<App />);

        expect(await screen.findByRole("heading", { name: "Bienvenido" })).toBeInTheDocument();
        expect(window.location.pathname).toBe("/auth/login");
        expect(screen.queryByRole("heading", { name: "Acceso requerido" })).not.toBeInTheDocument();
        expect(screen.queryByRole("heading", { name: "Sin conexión" })).not.toBeInTheDocument();
    });

    it("muestra el fallo Microsoft al volver al login en flujo de pagina completa", async () => {
        mockIdentityFetch({ session: anonymousSession });
        window.history.replaceState(null, "", "/auth/login?microsoftStatus=failed");

        render(<App />);

        expect(await screen.findByText("No pudimos completar el inicio con Microsoft. Inténtalo de nuevo o selecciona otra cuenta.")).toBeInTheDocument();
        expect(window.location.pathname).toBe("/auth/login");
        expect(window.location.search).toBe("");
    });

    it("muestra mensaje de cuenta no asignada cuando Microsoft autentica pero CRM rechaza la identidad", async () => {
        mockIdentityFetch({ session: anonymousSession });
        Object.defineProperty(window, "opener", {
            configurable: true,
            value: null,
        });
        window.name = "";
        window.sessionStorage.clear();
        window.history.replaceState(null, "", "/auth/login?microsoftStatus=unassigned");

        render(<App />);

        expect(await screen.findByText("Tu cuenta Microsoft se validó, pero todavía no está asignada al CRM. Solicita que la vinculen a tu usuario interno.")).toBeInTheDocument();
        expect(screen.queryByText("No pudimos completar el inicio con Microsoft. Inténtalo de nuevo o selecciona otra cuenta.")).not.toBeInTheDocument();
        expect(window.location.pathname).toBe("/auth/login");
        expect(window.location.search).toBe("");
    });

    it("muestra mensaje de usuario no autorizado cuando el usuario CRM esta inactivo o bloqueado", async () => {
        mockIdentityFetch({ session: anonymousSession });
        window.history.replaceState(null, "", "/auth/login?microsoftStatus=unauthorized");

        render(<App />);

        expect(await screen.findByText("Tu cuenta Microsoft se validó, pero tu usuario CRM no está autorizado para iniciar sesión. Contacta a soporte o a tu administrador.")).toBeInTheDocument();
        expect(screen.queryByText("Tu cuenta Microsoft se validó, pero todavía no está asignada al CRM. Solicita que la vinculen a tu usuario interno.")).not.toBeInTheDocument();
        expect(window.location.pathname).toBe("/auth/login");
        expect(window.location.search).toBe("");
    });

    it("no renderiza otro login completo dentro del popup Microsoft fallido", async () => {
        mockIdentityFetch({ session: anonymousSession });
        const closeSpy = vi.spyOn(window, "close").mockImplementation(() => undefined);
        window.name = "rocca-microsoft-login";
        window.history.replaceState(null, "", "/auth/login?microsoftStatus=failed");

        render(<App />);

        await waitFor(
            () => {
                expect(closeSpy).toHaveBeenCalledTimes(1);
            },
            { timeout: 2_000 },
        );
        expect(screen.queryByRole("heading", { name: "Bienvenido" })).not.toBeInTheDocument();
    });

    it("no trata una ventana con opener generico como popup Microsoft", async () => {
        mockIdentityFetch({ session: anonymousSession });
        const closeSpy = vi.spyOn(window, "close").mockImplementation(() => undefined);
        Object.defineProperty(window, "opener", {
            configurable: true,
            value: {},
        });
        window.history.replaceState(null, "", "/auth/login?microsoftStatus=failed");

        render(<App />);

        expect(await screen.findByRole("heading", { name: "Bienvenido" })).toBeInTheDocument();
        expect(await screen.findByText("No pudimos completar el inicio con Microsoft. Inténtalo de nuevo o selecciona otra cuenta.")).toBeInTheDocument();
        expect(closeSpy).not.toHaveBeenCalled();
    });

    it("reconoce el retorno Microsoft como popup desde sessionStorage si Chrome aisla la ventana", async () => {
        mockIdentityFetch({ session: anonymousSession });
        const closeSpy = vi.spyOn(window, "close").mockImplementation(() => undefined);
        Object.defineProperty(window, "opener", {
            configurable: true,
            value: null,
        });
        window.name = "";
        window.sessionStorage.setItem("rocca.microsoftPopup", "1");
        window.history.replaceState(null, "", "/auth/login?microsoftStatus=failed");

        render(<App />);

        expect(closeSpy).not.toHaveBeenCalled();
        await waitFor(
            () => {
                expect(closeSpy).toHaveBeenCalledTimes(1);
            },
            { timeout: 2_000 },
        );
        expect(screen.queryByRole("heading", { name: "Bienvenido" })).not.toBeInTheDocument();
    });

    it("no renderiza el CRM completo dentro del popup Microsoft exitoso", async () => {
        mockIdentityFetch({ profile: authenticatedProfile, session: authenticatedSession });
        const closeSpy = vi.spyOn(window, "close").mockImplementation(() => undefined);
        Object.defineProperty(window, "opener", {
            configurable: true,
            value: null,
        });
        window.name = "";
        window.sessionStorage.setItem("rocca.microsoftPopup", "1");
        window.history.replaceState(null, "", "/home/administration");

        render(<App />);

        expect(await screen.findByRole("heading", { name: "Verificando sesión" })).toBeInTheDocument();
        expect(screen.queryByRole("heading", { name: "Hola Roberto Carlos al módulo Administración" })).not.toBeInTheDocument();
        await waitFor(
            () => {
                expect(closeSpy).toHaveBeenCalledTimes(1);
            },
            { timeout: 2_000 },
        );
    });

    it("bloquea el acceso directo a /home/administration si no hay sesion backend", async () => {
        mockIdentityFetch({ session: anonymousSession });
        window.history.replaceState(null, "", "/home/administration");

        render(<App />);

        expect(await screen.findByRole("heading", { name: "Bienvenido" })).toBeInTheDocument();
        expect(window.location.pathname).toBe("/auth/login");
        expect(screen.queryByRole("banner", { name: "Barra superior global CRM TINK" })).not.toBeInTheDocument();
    });

    it("renderiza /home/administration como home del modulo de administracion", async () => {
        mockIdentityFetch({ profile: authenticatedProfile, session: authenticatedSession });
        window.history.replaceState(null, "", "/home/administration");

        render(<App />);

        expect(await screen.findByRole("heading", { name: "Sesión validada" })).toBeInTheDocument();
        expect(await screen.findByRole("banner", { name: "Barra superior global CRM TINK" })).toBeInTheDocument();
        expect(screen.getByRole("heading", { name: "Hola Roberto Carlos al módulo Administración" })).toBeInTheDocument();
        expect(screen.queryByRole("heading", { name: "Usuarios del sistema" })).not.toBeInTheDocument();
        expect(screen.queryByLabelText("Datos de sesion recibidos desde el API")).not.toBeInTheDocument();
    });

    it("muestra la foto Microsoft en el avatar y reconsulta si la imagen falla", async () => {
        const profileWithPhoto: IdentityProfile = {
            ...authenticatedProfile,
            user: {
                ...authenticatedProfile.user,
                profileImageUrl: "/identity/me/photo",
            },
        };
        mockIdentityFetch({ profile: profileWithPhoto, session: authenticatedSession });
        window.history.replaceState(null, "", "/home/administration");

        render(<App />);

        const avatarButton = await screen.findByRole("button", { name: "Perfil actual: Roberto Carlos" });
        const firstImage = avatarButton.querySelector("img");

        expect(firstImage).toHaveAttribute("src", buildApiUrl("/identity/me/photo"));
        expect(avatarButton.querySelector(".global-home-user-avatar__presence")).not.toBeInTheDocument();

        fireEvent.error(firstImage as HTMLImageElement);

        await waitFor(() => {
            expect(avatarButton.querySelector("img")?.getAttribute("src")).toContain("refresh=1");
        });

        fireEvent.error(avatarButton.querySelector("img") as HTMLImageElement);

        await waitFor(() => {
            expect(avatarButton.querySelector("img")).not.toBeInTheDocument();
        });
        expect(avatarButton).toHaveTextContent("RC");
    });

    it("no renderiza el shell cuando la sesion existe pero no hay modulos permitidos", async () => {
        const profileWithoutVisibleModules: IdentityProfile = {
            ...authenticatedProfile,
            permissions: [],
        };

        mockIdentityFetch({ profile: profileWithoutVisibleModules, session: authenticatedSession });
        window.history.replaceState(null, "", "/home/administration");

        render(<App />);

        expect(await screen.findByRole("heading", { name: "Acceso no autorizado" })).toBeInTheDocument();
        expect(screen.queryByRole("banner", { name: "Barra superior global CRM TINK" })).not.toBeInTheDocument();
    });

    it("permite la ruta de administracion cuando existe permiso de usuarios", async () => {
        const userAdministrationProfile: IdentityProfile = {
            ...authenticatedProfile,
            permissions: [
                {
                    code: "user.view_list",
                    effect: "allow",
                    scope: "all_areas",
                    source: "role",
                },
            ],
        };

        mockIdentityFetch({ profile: userAdministrationProfile, session: authenticatedSession });
        window.history.replaceState(null, "", "/home/administration");

        render(<App />);

        expect(await screen.findByRole("heading", { name: "Hola Roberto Carlos al módulo Administración" })).toBeInTheDocument();
        expect(window.location.pathname).toBe("/home/administration");
        expect(screen.getByRole("button", { name: "Usuarios" })).toBeInTheDocument();
        expect(screen.queryByRole("button", { name: "Roles y seguridad" })).not.toBeInTheDocument();
        expect(screen.queryByRole("button", { name: "Catálogos" })).not.toBeInTheDocument();
        expect(screen.queryByRole("button", { name: "Integraciones" })).not.toBeInTheDocument();
        expect(screen.queryByRole("button", { name: "Auditoría" })).not.toBeInTheDocument();
    });

    it("navega a la vista de usuarios desde el menu del modulo administracion", async () => {
        const user = userEvent.setup();
        const fetchMock = mockIdentityFetch({ profile: authenticatedProfile, session: authenticatedSession });

        window.history.replaceState(null, "", "/home/administration");

        render(<App />);

        expect(await screen.findByRole("heading", { name: "Hola Roberto Carlos al módulo Administración" })).toBeInTheDocument();
        const sessionCallsBeforeNavigation = fetchMock.mock.calls.filter(([input]) => getRequestPath(input) === "/identity/session").length;
        const profileCallsBeforeNavigation = fetchMock.mock.calls.filter(([input]) => getRequestPath(input) === "/identity/me").length;

        await user.click(screen.getByRole("button", { name: "Usuarios" }));

        expect(window.location.pathname).toBe("/home/administration/users");
        expect(await screen.findByRole("heading", { name: "Usuarios" })).toBeInTheDocument();
        expect(screen.queryByRole("heading", { name: "Verificando sesión" })).not.toBeInTheDocument();
        expect(screen.queryByRole("heading", { name: "Sesión validada" })).not.toBeInTheDocument();
        expect(fetchMock.mock.calls.filter(([input]) => getRequestPath(input) === "/identity/session")).toHaveLength(sessionCallsBeforeNavigation);
        expect(fetchMock.mock.calls.filter(([input]) => getRequestPath(input) === "/identity/me")).toHaveLength(profileCallsBeforeNavigation);
    });

    it("cambia a todos los modulos sin salir de la pagina y muestra menus sin textos de ayuda", async () => {
        const user = userEvent.setup();
        mockIdentityFetch({ profile: authenticatedProfile, session: authenticatedSession });
        window.history.replaceState(null, "", "/home/administration/users");

        render(<App />);

        expect(await screen.findByRole("heading", { name: "Usuarios" })).toBeInTheDocument();
        for (const notificationsButton of screen.getAllByRole("button", { name: "Notificaciones" })) {
            expect(notificationsButton).not.toHaveTextContent(/\d/u);
        }

        await user.click(screen.getByRole("button", { name: "Administración" }));
        await user.click(screen.getByRole("button", { name: "Todos" }));

        expect(window.location.pathname).toBe("/home/administration/users");
        expect(screen.getByRole("heading", { name: "Usuarios" })).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Todos" })).toBeInTheDocument();
        expect(screen.queryByText(/El módulo elegido/u)).not.toBeInTheDocument();

        const administrationMenuButton = screen.getByRole("button", { name: "Administración" });
        expect(administrationMenuButton).toHaveClass("global-home-menu__item--active");
        await user.click(administrationMenuButton);

        const administrationMenu = screen.getByRole("menu", { name: "Opciones de Administración" });
        expect(within(administrationMenu).getByRole("button", { name: "Usuarios" })).toHaveAttribute("aria-current", "page");
        expect(
            within(administrationMenu)
                .getAllByRole("button")
                .map((option) => option.textContent),
        ).toEqual(["Usuarios", "Roles y seguridad", "Auditoría"]);
    });

    it("mantiene abierto el modulo actual aunque venza el cierre diferido de otro modulo", async () => {
        const user = userEvent.setup();
        mockIdentityFetch({ profile: authenticatedProfile, session: authenticatedSession });
        window.history.replaceState(null, "", "/home/administration/users");

        render(<App />);

        expect(await screen.findByRole("heading", { name: "Usuarios" })).toBeInTheDocument();
        await user.click(screen.getByRole("button", { name: "Administración" }));
        await user.click(screen.getByRole("button", { name: "Todos" }));

        const administrationButton = screen.getByRole("button", { name: "Administración" });
        const salesButton = screen.getByRole("button", { name: "Ventas" });
        const administrationGroup = administrationButton.closest(".global-home-menu__group");
        const salesGroup = salesButton.closest(".global-home-menu__group");

        if (!administrationGroup || !salesGroup) {
            throw new Error("No se encontraron grupos del menú principal.");
        }

        vi.useFakeTimers();
        fireEvent.pointerEnter(administrationGroup);
        expect(screen.getByRole("menu", { name: "Opciones de Administración" })).toBeInTheDocument();
        fireEvent.pointerLeave(administrationGroup);
        fireEvent.pointerEnter(salesGroup);
        expect(screen.getByRole("menu", { name: "Opciones de Ventas" })).toBeInTheDocument();

        act(() => {
            vi.advanceTimersByTime(450);
        });

        expect(screen.getByRole("menu", { name: "Opciones de Ventas" })).toBeInTheDocument();
        expect(screen.queryByRole("menu", { name: "Opciones de Administración" })).not.toBeInTheDocument();
    });

    it("abre roles y seguridad desde el menu administracion sin revalidar la sesion", async () => {
        const user = userEvent.setup();
        const fetchMock = mockIdentityFetch({ profile: authenticatedProfile, session: authenticatedSession });

        window.history.replaceState(null, "", "/home/administration");

        render(<App />);

        expect(await screen.findByRole("heading", { name: "Hola Roberto Carlos al módulo Administración" })).toBeInTheDocument();
        const sessionCallsBeforeNavigation = fetchMock.mock.calls.filter(([input]) => getRequestPath(input) === "/identity/session").length;
        const profileCallsBeforeNavigation = fetchMock.mock.calls.filter(([input]) => getRequestPath(input) === "/identity/me").length;

        await user.click(screen.getByRole("button", { name: "Roles y seguridad" }));

        expect(window.location.pathname).toBe("/home/administration/roles-security");
        expect(screen.getByRole("heading", { name: "Roles" })).toBeInTheDocument();
        expect(screen.getAllByRole("heading", { name: "Ventas" })).toHaveLength(2);
        expect(screen.queryByRole("button", { name: "Nuevo módulo" })).not.toBeInTheDocument();
        expect(screen.queryByRole("button", { name: "Nuevo rol" })).not.toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Guardar cambios 0" })).toBeInTheDocument();
        expect(screen.queryByRole("button", { name: "Nueva acción" })).not.toBeInTheDocument();
        expect(screen.getByRole("button", { name: /Ventas.*3\/11/ })).toBeInTheDocument();
        expect(screen.getByRole("button", { name: /Mercadeo.*0\/3/ })).toBeInTheDocument();
        expect(screen.getByRole("region", { name: "Leads" })).toBeInTheDocument();
        expect(screen.getByRole("region", { name: "Oportunidades" })).toBeInTheDocument();
        expect(screen.getByRole("region", { name: "Estimaciones" })).toBeInTheDocument();
        expect(screen.getAllByText("Mercadeo").length).toBeGreaterThan(0);
        expect(screen.getAllByText("Formalización").length).toBeGreaterThan(0);
        expect(screen.getAllByText("Contabilidad").length).toBeGreaterThan(0);
        expect(screen.queryByRole("checkbox", { name: /Crear lead/i })).not.toBeInTheDocument();
        await user.click(screen.getByRole("button", { name: /Leads.*5 acciones/i }));
        expect(screen.getByRole("checkbox", { name: /Crear lead/i })).toBeChecked();

        await user.click(screen.getByRole("button", { name: /Mercadeo.*0\/3/ }));

        expect(screen.getByRole("heading", { name: "Mercadeo" })).toBeInTheDocument();
        expect(screen.getByRole("region", { name: "Campañas" })).toBeInTheDocument();
        expect(screen.queryByRole("checkbox", { name: /Ver campañas/i })).not.toBeInTheDocument();
        await user.click(screen.getByRole("button", { name: /Campañas.*3 acciones/i }));
        expect(screen.getByRole("checkbox", { name: /Ver campañas/i })).not.toBeChecked();
        expect(screen.queryByText("Sistemas")).not.toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Auditoría" })).toBeInTheDocument();

        expect(fetchMock.mock.calls.filter(([input]) => getRequestPath(input) === "/identity/session")).toHaveLength(sessionCallsBeforeNavigation);
        expect(fetchMock.mock.calls.filter(([input]) => getRequestPath(input) === "/identity/me")).toHaveLength(profileCallsBeforeNavigation);
    });

    it("abre el panel de detalle de usuario con accion coherente al estado", async () => {
        const user = userEvent.setup();

        mockIdentityFetch({ profile: authenticatedProfile, session: authenticatedSession });
        window.history.replaceState(null, "", "/home/administration/users");

        render(<App />);

        expect(await screen.findByRole("heading", { name: "Usuarios" })).toBeInTheDocument();

        await user.click(await screen.findByRole("button", { name: "Abrir detalle de Andrea Valverde" }));

        expect(screen.getByRole("heading", { name: "Andrea Valverde" })).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Reactivar usuario" })).toBeInTheDocument();
        expect(screen.queryByText("Control de riesgo")).not.toBeInTheDocument();
        expect(screen.queryByRole("button", { name: "Acción no disponible" })).not.toBeInTheDocument();
        expect(screen.queryByText("Este usuario no admite una acción de bloqueo directa por su estado actual.")).not.toBeInTheDocument();
    });

    it("bloquea /home/administration cuando el usuario no tiene permisos visibles", async () => {
        const profileWithoutVisibleModules: IdentityProfile = {
            ...authenticatedProfile,
            permissions: [],
        };

        mockIdentityFetch({ profile: profileWithoutVisibleModules, session: authenticatedSession });
        window.history.replaceState(null, "", "/home/administration");

        render(<App />);

        expect(await screen.findByRole("heading", { name: "Acceso no autorizado" })).toBeInTheDocument();
        expect(screen.queryByRole("heading", { name: "Usuarios del sistema" })).not.toBeInTheDocument();
    });

    it("renueva la sesion cuando la ruta privada recibe sesion anonima pero conserva refresh vigente", async () => {
        let currentSession = anonymousSession;
        const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
            const path = getRequestPath(input);

            if (path === "/identity/session") {
                return createJsonResponse(currentSession);
            }

            if (path === "/identity/refresh" && init?.method === "POST") {
                currentSession = authenticatedSession;
                return createJsonResponse(authenticatedSession);
            }

            if (path === "/identity/me") {
                return createJsonResponse(authenticatedProfile);
            }

            if (path === "/identity/users") {
                return createJsonResponse(systemUsersResponse);
            }

            if (path === "/identity/roles/security-catalog") {
                return createJsonResponse(securityCatalogResponse);
            }

            return createJsonResponse({ message: `Ruta no mockeada: ${path}` }, 404);
        });

        vi.stubGlobal("fetch", fetchMock);
        window.history.replaceState(null, "", "/home/administration");

        render(<App />);

        expect(await screen.findByRole("heading", { name: "Hola Roberto Carlos al módulo Administración" })).toBeInTheDocument();
        expect(fetchMock).toHaveBeenCalledWith(
            buildApiUrl("/identity/refresh"),
            expect.objectContaining({
                credentials: "include",
                method: "POST",
            }),
        );
        expect(window.location.pathname).toBe("/home/administration");
    });

    it("conecta el login local con el BFF y navega al sistema autenticado", async () => {
        const user = userEvent.setup();
        const fetchMock = mockIdentityFetch({ profile: authenticatedProfile, session: anonymousSession });
        window.history.replaceState(null, "", "/auth/login");

        render(<App />);

        await user.type(await screen.findByLabelText("Correo administrativo", { selector: "input" }), "roberto@roccacr.com");
        await user.type(screen.getByLabelText("Contraseña", { selector: "input" }), "PasswordSeguro123!");
        await user.click(screen.getByRole("button", { name: "Ingresar" }));

        await waitFor(
            () => {
                expect(window.location.pathname).toBe("/home/administration");
            },
            { timeout: 2_500 },
        );
        expect(await screen.findByRole("heading", { name: "Hola Roberto Carlos al módulo Administración" })).toBeInTheDocument();
        expect(fetchMock).toHaveBeenCalledWith(
            buildApiUrl("/identity/local/login"),
            expect.objectContaining({
                body: JSON.stringify({
                    email: "roberto@roccacr.com",
                    password: "PasswordSeguro123!",
                }),
                credentials: "include",
                method: "POST",
            }),
        );
    });

    it("cierra sesion desde el menu movil y vuelve al login", async () => {
        const user = userEvent.setup();
        const fetchMock = mockIdentityFetch({ profile: authenticatedProfile, session: authenticatedSession });
        window.history.replaceState(null, "", "/home/administration");

        render(<App />);

        await expectAdministrationHomeHeading();
        await user.click(screen.getByRole("button", { name: "Abrir menú de navegación" }));
        await user.click(within(await screen.findByRole("dialog", { name: "Menú móvil de navegación" })).getByRole("button", { name: "Cerrar sesión" }));

        await waitFor(() => {
            expect(window.location.pathname).toBe("/auth/login");
        });
        expect(await screen.findByRole("heading", { name: "Bienvenido" }, { timeout: 5_000 })).toBeInTheDocument();
        expect(fetchMock).toHaveBeenCalledWith(
            buildApiUrl("/identity/logout"),
            expect.objectContaining({
                credentials: "include",
                method: "POST",
            }),
        );
    }, 10_000);

    it("cierra sesion desde el boton de salida de escritorio", async () => {
        const user = userEvent.setup();
        const fetchMock = mockIdentityFetch({ profile: authenticatedProfile, session: authenticatedSession });
        window.history.replaceState(null, "", "/home/administration");

        render(<App />);

        await expectAdministrationHomeHeading();
        await user.click(screen.getByRole("button", { name: "Cerrar sesión" }));

        await waitFor(() => {
            expect(window.location.pathname).toBe("/auth/login");
        });
        expect(await screen.findByRole("heading", { name: "Bienvenido" }, { timeout: 5_000 })).toBeInTheDocument();
        expect(fetchMock).toHaveBeenCalledWith(
            buildApiUrl("/identity/logout"),
            expect.objectContaining({
                credentials: "include",
                method: "POST",
            }),
        );
    }, 10_000);

    it("abre Microsoft en una ventana emergente de escritorio y la cierra al confirmar sesion", async () => {
        const user = userEvent.setup();
        const authorizationUrl = "https://login.microsoftonline.com/test/oauth2/v2.0/authorize";
        const popupWindow = {
            closed: false,
            close: vi.fn(() => {
                popupWindow.closed = true;
            }),
            location: {
                href: "about:blank",
            },
        };
        let currentSession = anonymousSession;
        const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
            const path = getRequestPath(input);

            if (path === "/identity/session") {
                return createJsonResponse(currentSession);
            }

            if (path === "/identity/microsoft/start" && init?.method === "POST") {
                currentSession = authenticatedSession;
                return createJsonResponse({ authorizationUrl });
            }

            if (path === "/identity/me") {
                return createJsonResponse(authenticatedProfile);
            }

            return createJsonResponse({ message: `Ruta no mockeada: ${path}` }, 404);
        });

        installDesktopPointerDouble();
        vi.stubGlobal("fetch", fetchMock);
        const openSpy = vi.spyOn(window, "open").mockReturnValue(popupWindow as unknown as Window);
        window.history.replaceState(null, "", "/auth/login");

        render(<App />);

        await user.click(await screen.findByRole("button", { name: "Continuar con Microsoft" }));

        expect(openSpy).toHaveBeenCalledWith("about:blank", "rocca-microsoft-login", expect.stringContaining("width=520"));
        await waitFor(() => {
            expect(popupWindow.location.href).toBe(authorizationUrl);
        });
        await waitFor(
            () => {
                expect(window.location.pathname).toBe("/home/administration");
            },
            { timeout: 2_500 },
        );
        expect(await screen.findByRole("heading", { name: "Hola Roberto Carlos al módulo Administración" })).toBeInTheDocument();
        expect(popupWindow.close).toHaveBeenCalledTimes(1);
    });

    it("muestra una transicion de preparacion mientras Microsoft confirma el acceso", async () => {
        const user = userEvent.setup();
        const authorizationUrl = "https://login.microsoftonline.com/test/oauth2/v2.0/authorize";
        const popupWindow = {
            closed: false,
            close: vi.fn(() => {
                popupWindow.closed = true;
            }),
            location: {
                href: "about:blank",
            },
        };
        const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
            const path = getRequestPath(input);

            if (path === "/identity/session") {
                return createJsonResponse(anonymousSession);
            }

            if (path === "/identity/microsoft/start" && init?.method === "POST") {
                return createJsonResponse({ authorizationUrl });
            }

            return createJsonResponse({ message: `Ruta no mockeada: ${path}` }, 404);
        });

        installDesktopPointerDouble();
        vi.stubGlobal("fetch", fetchMock);
        vi.spyOn(window, "open").mockReturnValue(popupWindow as unknown as Window);
        window.history.replaceState(null, "", "/auth/login?microsoftStatus=failed");

        render(<App />);

        await user.click(await screen.findByRole("button", { name: "Continuar con Microsoft" }));

        expect(await screen.findByRole("heading", { name: "Verificando sesión" })).toBeInTheDocument();
        expect(screen.queryByText("No pudimos completar el inicio con Microsoft. Inténtalo de nuevo o selecciona otra cuenta.")).not.toBeInTheDocument();
        expect(screen.queryByRole("heading", { name: "Bienvenido" })).not.toBeInTheDocument();

        popupWindow.location.href = `${window.location.origin}/auth/login?microsoftStatus=failed`;

        expect(await screen.findByText("No pudimos completar el inicio con Microsoft. Inténtalo de nuevo o selecciona otra cuenta.")).toBeInTheDocument();
    });

    it("confirma sesion si el popup Microsoft se cerro despues del callback exitoso", async () => {
        const user = userEvent.setup();
        const authorizationUrl = "https://login.microsoftonline.com/test/oauth2/v2.0/authorize";
        const popupWindow = {
            closed: false,
            close: vi.fn(() => {
                popupWindow.closed = true;
            }),
            location: {
                href: "about:blank",
            },
        };
        let currentSession = anonymousSession;
        const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
            const path = getRequestPath(input);

            if (path === "/identity/session") {
                return createJsonResponse(currentSession);
            }

            if (path === "/identity/microsoft/start" && init?.method === "POST") {
                return createJsonResponse({ authorizationUrl });
            }

            if (path === "/identity/me") {
                return createJsonResponse(authenticatedProfile);
            }

            return createJsonResponse({ message: `Ruta no mockeada: ${path}` }, 404);
        });

        installDesktopPointerDouble();
        vi.stubGlobal("fetch", fetchMock);
        vi.spyOn(window, "open").mockReturnValue(popupWindow as unknown as Window);
        window.history.replaceState(null, "", "/auth/login");

        render(<App />);

        await user.click(await screen.findByRole("button", { name: "Continuar con Microsoft" }));

        await waitFor(() => {
            expect(popupWindow.location.href).toBe(authorizationUrl);
        });

        currentSession = authenticatedSession;
        popupWindow.location.href = `${window.location.origin}/home/administration`;
        popupWindow.closed = true;

        await waitFor(
            () => {
                expect(window.location.pathname).toBe("/home/administration");
            },
            { timeout: 2_500 },
        );
        expect(await screen.findByRole("heading", { name: "Hola Roberto Carlos al módulo Administración" })).toBeInTheDocument();
        expect(screen.queryByText("No pudimos completar el inicio con Microsoft. Inténtalo de nuevo o selecciona otra cuenta.")).not.toBeInTheDocument();
    });

    it("sigue esperando sesion cuando el popup Microsoft se cierra antes de que la cookie sea visible", async () => {
        const user = userEvent.setup();
        const authorizationUrl = "https://login.microsoftonline.com/test/oauth2/v2.0/authorize";
        const popupWindow = {
            closed: false,
            close: vi.fn(() => {
                popupWindow.closed = true;
            }),
            location: {
                href: "about:blank",
            },
        };
        let sessionChecksAfterClose = 0;
        const getSessionAfterPopupClose = (): SessionResponse => {
            if (popupWindow.closed) {
                sessionChecksAfterClose += 1;
            }

            return popupWindow.closed && sessionChecksAfterClose >= 2 ? authenticatedSession : anonymousSession;
        };
        const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
            const path = getRequestPath(input);

            if (path === "/identity/session") {
                return createJsonResponse(getSessionAfterPopupClose());
            }

            if (path === "/identity/microsoft/start" && init?.method === "POST") {
                return createJsonResponse({ authorizationUrl });
            }

            if (path === "/identity/me") {
                return createJsonResponse(authenticatedProfile);
            }

            return createJsonResponse({ message: `Ruta no mockeada: ${path}` }, 404);
        });

        installDesktopPointerDouble();
        vi.stubGlobal("fetch", fetchMock);
        vi.spyOn(window, "open").mockReturnValue(popupWindow as unknown as Window);
        window.history.replaceState(null, "", "/auth/login");

        render(<App />);

        await user.click(await screen.findByRole("button", { name: "Continuar con Microsoft" }));

        await waitFor(() => {
            expect(popupWindow.location.href).toBe(authorizationUrl);
        });

        popupWindow.location.href = `${window.location.origin}/auth/login`;
        popupWindow.closed = true;

        await waitFor(
            () => {
                expect(window.location.pathname).toBe("/home/administration");
            },
            { timeout: 3_000 },
        );
        expect(await screen.findByRole("heading", { name: "Hola Roberto Carlos al módulo Administración" })).toBeInTheDocument();
        expect(screen.queryByText("No pudimos completar el inicio con Microsoft. Inténtalo de nuevo o selecciona otra cuenta.")).not.toBeInTheDocument();
    });

    it("muestra error de Microsoft sin dejar una promesa sin capturar", async () => {
        const user = userEvent.setup();
        const popupWindow = {
            closed: false,
            close: vi.fn(() => {
                popupWindow.closed = true;
            }),
            location: {
                href: "about:blank",
            },
        };
        const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
            const path = getRequestPath(input);

            if (path === "/identity/session") {
                return createJsonResponse(anonymousSession);
            }

            if (path === "/identity/microsoft/start" && init?.method === "POST") {
                return createJsonResponse({ message: "No se pudo completar la accion con los permisos actuales." }, 403);
            }

            return createJsonResponse({ message: `Ruta no mockeada: ${path}` }, 404);
        });

        installDesktopPointerDouble();
        vi.stubGlobal("fetch", fetchMock);
        vi.spyOn(window, "open").mockReturnValue(popupWindow as unknown as Window);
        window.history.replaceState(null, "", "/auth/login");

        render(<App />);

        await user.click(await screen.findByRole("button", { name: "Continuar con Microsoft" }));

        expect(await screen.findByText("No se pudo preparar la protección de la sesión. Actualiza la página e inténtalo de nuevo.")).toBeInTheDocument();
        expect(popupWindow.close).toHaveBeenCalledTimes(1);
    });

    it("espera el callback Microsoft y falla solo cuando el popup vuelve al frontend con error", async () => {
        const user = userEvent.setup();
        const authorizationUrl = "https://login.microsoftonline.com/test/oauth2/v2.0/authorize";
        const popupWindow = {
            closed: false,
            close: vi.fn(() => {
                popupWindow.closed = true;
            }),
            location: {
                href: "about:blank",
            },
        };
        const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
            const path = getRequestPath(input);

            if (path === "/identity/session") {
                return createJsonResponse(anonymousSession);
            }

            if (path === "/identity/microsoft/start" && init?.method === "POST") {
                return createJsonResponse({ authorizationUrl });
            }

            return createJsonResponse({ message: `Ruta no mockeada: ${path}` }, 404);
        });

        installDesktopPointerDouble();
        vi.stubGlobal("fetch", fetchMock);
        vi.spyOn(window, "open").mockReturnValue(popupWindow as unknown as Window);
        window.history.replaceState(null, "", "/auth/login");

        render(<App />);

        await user.click(await screen.findByRole("button", { name: "Continuar con Microsoft" }));

        expect(screen.queryByText("No pudimos completar el inicio con Microsoft. Inténtalo de nuevo o selecciona otra cuenta.")).not.toBeInTheDocument();

        popupWindow.location.href = `${window.location.origin}/auth/login?microsoftStatus=failed`;

        expect(await screen.findByText("No pudimos completar el inicio con Microsoft. Inténtalo de nuevo o selecciona otra cuenta.")).toBeInTheDocument();
        expect(popupWindow.close).toHaveBeenCalledTimes(1);
    });

    it("propaga al padre el rechazo por cuenta Microsoft no asignada desde el popup", async () => {
        const user = userEvent.setup();
        const authorizationUrl = "https://login.microsoftonline.com/test/oauth2/v2.0/authorize";
        const popupWindow = {
            closed: false,
            close: vi.fn(() => {
                popupWindow.closed = true;
            }),
            location: {
                href: "about:blank",
            },
        };
        const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
            const path = getRequestPath(input);

            if (path === "/identity/session") {
                return createJsonResponse(anonymousSession);
            }

            if (path === "/identity/microsoft/start" && init?.method === "POST") {
                return createJsonResponse({ authorizationUrl });
            }

            return createJsonResponse({ message: `Ruta no mockeada: ${path}` }, 404);
        });

        installDesktopPointerDouble();
        vi.stubGlobal("fetch", fetchMock);
        vi.spyOn(window, "open").mockReturnValue(popupWindow as unknown as Window);
        window.history.replaceState(null, "", "/auth/login");

        render(<App />);

        await user.click(await screen.findByRole("button", { name: "Continuar con Microsoft" }));

        popupWindow.location.href = `${window.location.origin}/auth/login?microsoftStatus=unassigned`;

        expect(await screen.findByText("Tu cuenta Microsoft se validó, pero todavía no está asignada al CRM. Solicita que la vinculen a tu usuario interno.")).toBeInTheDocument();
        expect(screen.queryByText("No pudimos completar el inicio con Microsoft. Inténtalo de nuevo o selecciona otra cuenta.")).not.toBeInTheDocument();
        expect(popupWindow.close).toHaveBeenCalledTimes(1);
    });

    it("cierra el popup si el login hijo reporta fallo Microsoft despues de limpiar la query", async () => {
        const user = userEvent.setup();
        const authorizationUrl = "https://login.microsoftonline.com/test/oauth2/v2.0/authorize";
        const popupWindow = {
            closed: false,
            close: vi.fn(() => {
                popupWindow.closed = true;
            }),
            location: {
                href: "about:blank",
            },
        };
        const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
            const path = getRequestPath(input);

            if (path === "/identity/session") {
                return createJsonResponse(anonymousSession);
            }

            if (path === "/identity/microsoft/start" && init?.method === "POST") {
                return createJsonResponse({ authorizationUrl });
            }

            return createJsonResponse({ message: `Ruta no mockeada: ${path}` }, 404);
        });

        installDesktopPointerDouble();
        vi.stubGlobal("fetch", fetchMock);
        vi.spyOn(window, "open").mockReturnValue(popupWindow as unknown as Window);
        window.history.replaceState(null, "", "/auth/login");

        render(<App />);

        await user.click(await screen.findByRole("button", { name: "Continuar con Microsoft" }));

        popupWindow.location.href = `${window.location.origin}/auth/login`;
        window.dispatchEvent(
            new MessageEvent("message", {
                data: { status: "failed", type: "rocca:microsoft-login" },
                origin: window.location.origin,
                source: popupWindow as unknown as MessageEventSource,
            }),
        );

        expect(await screen.findByText("No pudimos completar el inicio con Microsoft. Inténtalo de nuevo o selecciona otra cuenta.")).toBeInTheDocument();
        expect(popupWindow.close).toHaveBeenCalledTimes(1);
    });

    it("muestra estado offline si no puede conectar con el servicio de identidad", async () => {
        vi.stubGlobal(
            "fetch",
            vi.fn(() => Promise.reject(new TypeError("network unavailable"))),
        );
        window.history.replaceState(null, "", "/home/administration");

        render(<App />);

        expect(await screen.findByRole("heading", { name: "Sin conexión" })).toBeInTheDocument();
        expect(screen.getByText("No pudimos contactar el servicio de identidad. Revisa tu red y vuelve a intentar.")).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Iniciar sesión" })).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Reintentar conexión" })).toBeInTheDocument();
        expect(screen.queryByText(/API/iu)).not.toBeInTheDocument();
    });

    it("muestra una explicacion persistente cuando falla el reintento de sesion", async () => {
        const user = userEvent.setup();

        vi.stubGlobal(
            "fetch",
            vi.fn(() => Promise.reject(new TypeError("network unavailable"))),
        );
        window.history.replaceState(null, "", "/home/administration");

        render(<App />);

        await user.click(await screen.findByRole("button", { name: "Reintentar conexión" }));

        expect(await screen.findByText("No se pudo reintentar la verificación. La sesión expiró, terminó o ya no es válida; inicia sesión nuevamente para continuar.")).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Iniciar sesión" })).toBeInTheDocument();
    });

    it("bloquea reintentos repetidos mientras el usuario ya recibio feedback", async () => {
        const user = userEvent.setup();
        const fetchMock = vi.fn(() => Promise.reject(new TypeError("network unavailable")));

        vi.stubGlobal("fetch", fetchMock);
        window.history.replaceState(null, "", "/home/administration");

        render(<App />);

        await user.click(await screen.findByRole("button", { name: "Reintentar conexión" }));

        const retryButton = await screen.findByRole("button", { name: "Reintentar conexión" });
        await waitFor(() => {
            expect(retryButton).toBeDisabled();
        });

        fireEvent.click(retryButton);
        fireEvent.click(retryButton);
        fireEvent.click(retryButton);

        expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it("muestra estado 500 si el servicio de identidad responde con error inesperado", async () => {
        vi.stubGlobal(
            "fetch",
            vi.fn((input: RequestInfo | URL) => {
                const path = getRequestPath(input);

                if (path === "/identity/session") {
                    return createJsonResponse({ message: "Internal server error" }, 500);
                }

                return createJsonResponse({ message: `Ruta no mockeada: ${path}` }, 404);
            }),
        );
        window.history.replaceState(null, "", "/home/administration");

        render(<App />);

        expect(await screen.findByRole("heading", { name: "Error inesperado" })).toBeInTheDocument();
        expect(screen.getByText("El sistema no pudo validar tu acceso por un error temporal. Intenta de nuevo en unos minutos.")).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Iniciar sesión" })).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Reintentar conexión" })).toBeInTheDocument();
    });

    it("muestra sesion expirada si el refresh ya no puede renovar el acceso", async () => {
        const fetchMock = vi.fn((input: RequestInfo | URL) => {
            const path = getRequestPath(input);

            if (path === "/identity/session") {
                return createJsonResponse({ message: "Token expirado" }, 401);
            }

            if (path === "/identity/refresh") {
                return createJsonResponse({ message: "Refresh expirado" }, 401);
            }

            return createJsonResponse({ message: `Ruta no mockeada: ${path}` }, 404);
        });

        vi.stubGlobal("fetch", fetchMock);
        window.history.replaceState(null, "", "/home/administration");

        render(<App />);

        expect(await screen.findByRole("heading", { name: "Sesión expirada" })).toBeInTheDocument();
        expect(screen.getByText("Por seguridad, tu sesión terminó. Inicia sesión nuevamente para continuar.")).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Iniciar sesión" })).toBeInTheDocument();
        expect(fetchMock).toHaveBeenCalledWith(
            buildApiUrl("/identity/refresh"),
            expect.objectContaining({
                credentials: "include",
                method: "POST",
            }),
        );
    });

    it("renueva y muestra sesion expirada cuando permissionVersion deja obsoleta la sesion", async () => {
        const fetchMock = vi.fn((input: RequestInfo | URL) => {
            const path = getRequestPath(input);

            if (path === "/identity/session") {
                return createJsonResponse({ message: "La sesion requiere revalidacion de permisos." }, 409);
            }

            if (path === "/identity/refresh") {
                return createJsonResponse({ message: "La sesion requiere revalidacion de permisos." }, 409);
            }

            return createJsonResponse({ message: `Ruta no mockeada: ${path}` }, 404);
        });

        vi.stubGlobal("fetch", fetchMock);
        window.history.replaceState(null, "", "/home/administration");

        render(<App />);

        expect(await screen.findByRole("heading", { name: "Sesión expirada" })).toBeInTheDocument();
        expect(fetchMock).toHaveBeenCalledWith(
            buildApiUrl("/identity/refresh"),
            expect.objectContaining({
                credentials: "include",
                method: "POST",
            }),
        );
        expect(fetchMock.mock.calls.filter(([input]) => getRequestPath(input) === "/identity/session")).toHaveLength(1);
    });

    it("muestra 404 real para rutas no registradas sin redirigir al login", async () => {
        mockIdentityFetch({ profile: authenticatedProfile, session: authenticatedSession });
        window.history.replaceState(null, "", "/home/no-existe");

        render(<App />);

        expect(await screen.findByRole("heading", { name: "Ruta no encontrada" })).toBeInTheDocument();
        expect(screen.getByText("La dirección solicitada no existe o fue movida dentro del CRM.")).toBeInTheDocument();
        expect(window.location.pathname).toBe("/home/no-existe");
        expect(screen.queryByRole("banner", { name: "Barra superior global CRM TINK" })).not.toBeInTheDocument();
    });
});
