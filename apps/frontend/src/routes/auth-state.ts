import { getVisibleNavigationWorkspaces } from "../modules/home/GlobalHomeShell";
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
 * Comprueba que el perfil operativo de la ruta sea visible con los permisos efectivos.
 *
 * Login no pertenece a ningún perfil, así que no se bloquea aquí.
 */
const hasAccessToRoute = (profile: IdentityProfile, path: string): boolean => {
    const workspaceCode = getAppRoute(path)?.workspaceCode;

    if (!workspaceCode) {
        return true;
    }

    return getVisibleNavigationWorkspaces(profile.permissions).some((workspace) => workspace.code === workspaceCode);
};

/**
 * Primera ruta privada que el usuario puede abrir.
 *
 * Se prefiere un perfil operativo real sobre "all". Devuelve null cuando no
 * hay ningún perfil visible: el usuario está autenticado pero sin acceso.
 */
export const getDefaultAuthenticatedPath = (profile: IdentityProfile): string | null => {
    const visibleWorkspaces = getVisibleNavigationWorkspaces(profile.permissions);
    const firstOperationalWorkspace = visibleWorkspaces.find((workspace) => workspace.code !== "all") ?? visibleWorkspaces[0];

    return firstOperationalWorkspace ? getWorkspaceHomePath(firstOperationalWorkspace.code) : null;
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
        if (path === AUTH_LOGIN_PATH || !isKnownPath(path)) {
            return { status: "anonymous" };
        }

        try {
            await refreshAuthenticatedSession();
        } catch {
            return { status: "anonymous" };
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
