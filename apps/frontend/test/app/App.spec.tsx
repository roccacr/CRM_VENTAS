import "@testing-library/jest-dom/vitest";

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
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

const mockIdentityFetch = (options: { readonly profile?: IdentityProfile; readonly session: SessionResponse }) => {
    let currentSession = options.session;
    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
        const path = getRequestPath(input);

        if (path === "/identity/session") {
            return createJsonResponse(currentSession);
        }

        if (path === "/identity/me") {
            return options.profile ? createJsonResponse(options.profile) : createJsonResponse({ message: "No autenticado" }, 401);
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

const expectGlobalSummaryHeading = () =>
    waitFor(() => {
        expect(screen.getByRole("heading", { name: "Resumen Global" })).toBeInTheDocument();
    }, { timeout: 4_000 });

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
        window.history.replaceState(null, "", "/home/global");

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
        window.history.replaceState(null, "", "/home/global");

        render(<App />);

        expect(await screen.findByRole("status", { name: "Verificando sesión" })).toBeInTheDocument();
        expect(screen.getByText("Roberto Carlos")).toBeInTheDocument();
        expect(screen.getByRole("img", { name: "Foto de Roberto Carlos" })).toHaveAttribute("src", buildApiUrl("/identity/me/photo"));
    });

    it("muestra iniciales y nombre del usuario durante la verificacion si no hay foto", async () => {
        mockAuthenticatedSessionWithPendingProfile(authenticatedSession);
        window.history.replaceState(null, "", "/home/global");

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

        await waitFor(() => {
            expect(closeSpy).toHaveBeenCalledTimes(1);
        }, { timeout: 2_000 });
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
        await waitFor(() => {
            expect(closeSpy).toHaveBeenCalledTimes(1);
        }, { timeout: 2_000 });
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
        window.history.replaceState(null, "", "/home/global");

        render(<App />);

        expect(await screen.findByRole("heading", { name: "Verificando sesión" })).toBeInTheDocument();
        expect(screen.queryByRole("heading", { name: "Resumen Global" })).not.toBeInTheDocument();
        await waitFor(() => {
            expect(closeSpy).toHaveBeenCalledTimes(1);
        }, { timeout: 2_000 });
    });

    it("bloquea el acceso directo a /home/global si no hay sesion backend", async () => {
        mockIdentityFetch({ session: anonymousSession });
        window.history.replaceState(null, "", "/home/global");

        render(<App />);

        expect(await screen.findByRole("heading", { name: "Bienvenido" })).toBeInTheDocument();
        expect(window.location.pathname).toBe("/auth/login");
        expect(screen.queryByRole("banner", { name: "Barra superior global CRM TINK" })).not.toBeInTheDocument();
    });

    it("renderiza /home/global solo con sesion y permiso efectivo de Resumen Global", async () => {
        mockIdentityFetch({ profile: authenticatedProfile, session: authenticatedSession });
        window.history.replaceState(null, "", "/home/global");

        render(<App />);

        expect(await screen.findByRole("heading", { name: "Sesión validada" })).toBeInTheDocument();
        expect(await screen.findByRole("banner", { name: "Barra superior global CRM TINK" })).toBeInTheDocument();
        expect(screen.getByRole("heading", { name: "Resumen Global" })).toBeInTheDocument();
        expect(screen.getByLabelText("Datos de sesion recibidos desde el API")).toHaveTextContent('"displayName": "Roberto Carlos"');
        expect(screen.getByLabelText("Datos de sesion recibidos desde el API")).toHaveTextContent('"permissions"');
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
        window.history.replaceState(null, "", "/home/global");

        render(<App />);

        const avatarButton = await screen.findByRole("button", { name: "Perfil actual: Roberto Carlos" });
        const firstImage = avatarButton.querySelector("img");

        expect(firstImage).toHaveAttribute("src", buildApiUrl("/identity/me/photo"));
        expect(avatarButton.querySelector(".global-home-user-avatar__presence")).toBeInTheDocument();

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

    it("no renderiza el shell cuando la sesion existe pero falta global.dashboard.read", async () => {
        const profileWithoutGlobalAccess: IdentityProfile = {
            ...authenticatedProfile,
            permissions: authenticatedProfile.permissions.filter((permission) => permission.code !== "global.dashboard.read"),
        };

        mockIdentityFetch({ profile: profileWithoutGlobalAccess, session: authenticatedSession });
        window.history.replaceState(null, "", "/home/global");

        render(<App />);

        expect(await screen.findByRole("heading", { name: "Acceso no autorizado" })).toBeInTheDocument();
        expect(screen.queryByRole("banner", { name: "Barra superior global CRM TINK" })).not.toBeInTheDocument();
    });

    it("permite una ruta interna cuando existe algun permiso efectivo del perfil", async () => {
        const financeOnlyProfile: IdentityProfile = {
            ...authenticatedProfile,
            permissions: [
                {
                    code: "finance.collections.read",
                    effect: "allow",
                    scope: "all_areas",
                    source: "role",
                },
            ],
        };

        mockIdentityFetch({ profile: financeOnlyProfile, session: authenticatedSession });
        window.history.replaceState(null, "", "/home/finance");

        render(<App />);

        expect(await screen.findByRole("heading", { name: "Resumen Financiero" })).toBeInTheDocument();
        expect(window.location.pathname).toBe("/home/finance");
        expect(screen.queryByText("Orígenes de Leads")).not.toBeInTheDocument();
    });

    it("bloquea /home/global cuando el usuario solo tiene permisos de otro perfil", async () => {
        const financeOnlyProfile: IdentityProfile = {
            ...authenticatedProfile,
            permissions: [
                {
                    code: "finance.collections.read",
                    effect: "allow",
                    scope: "all_areas",
                    source: "role",
                },
            ],
        };

        mockIdentityFetch({ profile: financeOnlyProfile, session: authenticatedSession });
        window.history.replaceState(null, "", "/home/global");

        render(<App />);

        expect(await screen.findByRole("heading", { name: "Acceso no autorizado" })).toBeInTheDocument();
        expect(screen.queryByRole("heading", { name: "Resumen Global" })).not.toBeInTheDocument();
    });

    it("conecta el login local con el BFF y navega al sistema autenticado", async () => {
        const user = userEvent.setup();
        const fetchMock = mockIdentityFetch({ profile: authenticatedProfile, session: anonymousSession });
        window.history.replaceState(null, "", "/auth/login");

        render(<App />);

        await user.type(await screen.findByLabelText("Correo administrativo", { selector: "input" }), "roberto@roccacr.com");
        await user.type(screen.getByLabelText("Contraseña", { selector: "input" }), "PasswordSeguro123!");
        await user.click(screen.getByRole("button", { name: "Ingresar" }));

        await waitFor(() => {
            expect(window.location.pathname).toBe("/home/global");
        }, { timeout: 2_500 });
        await expectGlobalSummaryHeading();
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
        window.history.replaceState(null, "", "/home/global");

        render(<App />);

        await expectGlobalSummaryHeading();
        await user.click(screen.getByRole("button", { name: "Abrir menú de navegación" }));
        await user.click(await screen.findByRole("button", { name: "Cerrar Sesión" }));

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
        window.history.replaceState(null, "", "/home/global");

        render(<App />);

        await expectGlobalSummaryHeading();
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
        await waitFor(() => {
            expect(window.location.pathname).toBe("/home/global");
        }, { timeout: 2_500 });
        await expectGlobalSummaryHeading();
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
        popupWindow.location.href = `${window.location.origin}/home/global`;
        popupWindow.closed = true;

        await waitFor(() => {
            expect(window.location.pathname).toBe("/home/global");
        }, { timeout: 2_500 });
        await expectGlobalSummaryHeading();
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

        await waitFor(() => {
            expect(window.location.pathname).toBe("/home/global");
        }, { timeout: 3_000 });
        await expectGlobalSummaryHeading();
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
        window.history.replaceState(null, "", "/home/global");

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
        window.history.replaceState(null, "", "/home/global");

        render(<App />);

        await user.click(await screen.findByRole("button", { name: "Reintentar conexión" }));

        expect(await screen.findByText("No se pudo reintentar la verificación. La sesión expiró, terminó o ya no es válida; inicia sesión nuevamente para continuar.")).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Iniciar sesión" })).toBeInTheDocument();
    });

    it("bloquea reintentos repetidos mientras el usuario ya recibio feedback", async () => {
        const user = userEvent.setup();
        const fetchMock = vi.fn(() => Promise.reject(new TypeError("network unavailable")));

        vi.stubGlobal("fetch", fetchMock);
        window.history.replaceState(null, "", "/home/global");

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
        window.history.replaceState(null, "", "/home/global");

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
        window.history.replaceState(null, "", "/home/global");

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
        window.history.replaceState(null, "", "/home/global");

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
