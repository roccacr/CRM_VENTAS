/**
 * Decisión de qué pantalla puede abrirse.
 *
 * Lee sesión y perfil en el BFF. La visibilidad del menú es solo UX: el API
 * vuelve a autorizar cada llamada. Un fallo en login deja ver el formulario;
 * un fallo en una ruta privada muestra el problema de acceso.
 */
import { ASSIGNED_WORKSPACES, getVisibleNavigationWorkspaces } from "../modules/home/GlobalHomeShell";
import { ApiClientError, refreshAuthenticatedSession } from "../services/api/api-client";
import { getIdentityProfile, getIdentitySession } from "../services/auth/auth-service";
import { type IdentityProfile, type IdentityUser, isAuthenticatedSession, type SessionResponse } from "../services/auth/identity-contracts";
import { AUTH_LOGIN_PATH, getAppRoute, getWorkspaceHomePath, isKnownPath } from "./app-routes";

/**
 * Estado de autenticación de la raíz.
 *
 * Decide qué pantalla puede pintarse. La visibilidad por permisos es solo UX:
 * el API vuelve a autorizar cada llamada.
 */

export type AccessProblemKind = "expired" | "offline" | "server" | "unexpected";

/** `validated` mantiene visible el avatar con check un instante antes de abrir el shell. */
export type SessionStatusPhase = "checking" | "validated";

export type AuthState = { readonly status: "anonymous" } | { readonly status: "authenticated"; readonly profile: IdentityProfile } | { readonly phase?: SessionStatusPhase; readonly status: "checking"; readonly user?: IdentityUser } | { readonly problem: AccessProblemKind; readonly status: "access-problem" } | { readonly status: "forbidden"; readonly profile: IdentityProfile };

/** Con perfil cargado, la única diferencia entre entrar o no es el permiso sobre la vista. */
const toProfileState = (profile: IdentityProfile, canEnter: boolean): AuthState => (canEnter ? { profile, status: "authenticated" } : { profile, status: "forbidden" });

/**
 * Comprueba la vista exacta contra los items y URLs del menu filtrado.
 *
 * Login no pertenece a ningún perfil, así que no se bloquea aquí.
 */
const hasAccessToRoute = (profile: IdentityProfile, path: string): boolean => {
    const route = getAppRoute(path);
    const workspaceCode = route?.workspaceCode;

    if (!workspaceCode) {
        return true;
    }

    const workspace = getVisibleNavigationWorkspaces(profile.permissions, profile.orgUnits).find((item) => item.code === workspaceCode);
    if (!workspace) return false;

    const homePath = getWorkspaceHomePath(workspaceCode);
    const definition = ASSIGNED_WORKSPACES.find((item) => item.code === workspaceCode);
    const hasHomeMenuItem = definition?.menuItems.some((item) => item.routePath === homePath);
    // Administration has a landing page but no home menu item or separate home permission.
    if (path === homePath && !hasHomeMenuItem) return true;

    const menuItems = workspace.menuItems.flatMap((item) => [item, ...(item.children ?? [])]);
    // Legacy Sales/Accounting items share a home URL despite having different item codes.
    return menuItems.some((item) => item.code === route.menuItemCode || item.routePath === path);
};

/**
 * Primera ruta privada que el usuario puede abrir.
 *
 * Se prefiere un perfil operativo real sobre "all". Devuelve null cuando no
 * hay ningún perfil visible: el usuario está autenticado pero sin acceso.
 */
export const getDefaultAuthenticatedPath = (profile: IdentityProfile, workspaceCode?: string): string | null => {
    const visibleWorkspaces = getVisibleNavigationWorkspaces(profile.permissions, profile.orgUnits);
    const workspace = visibleWorkspaces.find((item) => (workspaceCode ? item.code === workspaceCode : item.code !== "all"));
    if (!workspace) return null;
    const homePath = getWorkspaceHomePath(workspace.code);
    if (hasAccessToRoute(profile, homePath)) return homePath;

    const paths = workspace.menuItems.flatMap((item) => [item.routePath, ...(item.children?.map((child) => child.routePath) ?? [])]);
    return paths.find((path) => path !== undefined && getAppRoute(path) !== undefined && hasAccessToRoute(profile, path)) ?? null;
};

/** Reevalúa una ruta con el perfil ya cargado, sin volver a pedir sesión al API. */
export const resolveRouteState = (profile: IdentityProfile, path: string): AuthState => toProfileState(profile, hasAccessToRoute(profile, path));

/** Estado tras un login exitoso: entra solo si existe alguna ruta privada visible. */
export const resolveLoginState = (profile: IdentityProfile): AuthState => toProfileState(profile, getDefaultAuthenticatedPath(profile) !== null);

/**
 * Lee la sesión y, solo si existe, el perfil efectivo.
 *
 * `onAuthenticatedSession` permite mostrar el avatar del usuario mientras
 * todavía se carga `/identity/me`.
 */
export const resolveAuthState = async (path: string, onAuthenticatedSession?: (user: IdentityUser) => void): Promise<AuthState> => {
    let session = await getIdentitySession();

    if (!isAuthenticatedSession(session)) {
        // Login and unknown URLs have no registered private page to recover.
        if (!getAppRoute(path)) {
            return { status: "anonymous" };
        }

        try {
            await refreshAuthenticatedSession();
        } catch (error) {
            // Only an explicit rejection proves the refresh is invalid. Transport,
            // server and CSRF failures must not force login or replay a rotation.
            if (error instanceof ApiClientError && error.status === 401) return { status: "anonymous" };
            throw error;
        }

        session = await getIdentitySession();

        if (!isAuthenticatedSession(session)) {
            return { status: "anonymous" };
        }
    }

    onAuthenticatedSession?.(session.user);

    return resolveRouteState(await getIdentityProfile(), path);
};

/** Un login local que responde 2xx sin sesión se trata igual que credenciales rechazadas. */
export const assertAuthenticatedLoginSession = (session: SessionResponse): void => {
    if (!session.authenticated) {
        throw new ApiClientError("Login local no autenticado.", 401, session);
    }
};

/** `fetch` lanza TypeError cuando no hay red. Un 401 del BFF no entra aquí. */
const isNetworkFailure = (error: unknown): boolean => error instanceof TypeError && /fetch|network|failed|load|conex/iu.test(error.message);

/**
 * Traduce un fallo al validar una ruta privada en una pantalla de acceso.
 *
 * Un 401 o 409 aquí es sesión vencida: el usuario puede ir a login o
 * reintentar; no se asume que ya estaba anónimo.
 */
const resolveAccessProblem = (error: unknown): AccessProblemKind => {
    if (error instanceof ApiClientError && [401, 409].includes(error.status)) {
        return "expired";
    }

    if (error instanceof ApiClientError && error.status >= 500) {
        return "server";
    }

    return isNetworkFailure(error) ? "offline" : "unexpected";
};

/**
 * Estado ante un fallo del arranque.
 *
 * Login es una ruta pública: si el API cae durante la verificación inicial,
 * el usuario debe poder ver el formulario e intentar entrar manualmente.
 */
export const resolveBootstrapFailureState = (error: unknown, path: string): AuthState => (path === AUTH_LOGIN_PATH ? { status: "anonymous" } : { problem: resolveAccessProblem(error), status: "access-problem" });

/**
 * Destino al corregir la URL, o null si la ruta actual ya es correcta.
 *
 * Una ruta desconocida no se redirige (muestra "no encontrada"). Anónimo sale
 * de las rutas privadas hacia login. Autenticado sale de login hacia su
 * primera ruta visible. Sin permiso se queda en la ruta para ver el aviso.
 */
export const getRedirectPath = (state: AuthState, path: string): string | null => {
    if (!isKnownPath(path)) {
        return null;
    }

    if (state.status === "anonymous") {
        return path === AUTH_LOGIN_PATH ? null : AUTH_LOGIN_PATH;
    }

    return state.status === "authenticated" && path === AUTH_LOGIN_PATH ? getDefaultAuthenticatedPath(state.profile) : null;
};
