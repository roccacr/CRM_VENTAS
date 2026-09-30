import CheckOutlined from "@ant-design/icons/CheckOutlined";
import LockOutlined from "@ant-design/icons/LockOutlined";
import { type Dispatch, type SetStateAction, useCallback, useEffect, useRef, useState } from "react";

import { buildApiUrl } from "./config/frontend-env";
import { type LoginCredentials, LoginPage } from "./modules/auth/LoginPage";
import { getVisibleNavigationWorkspaces, GlobalHomeShell } from "./modules/home/GlobalHomeShell";
import { ApiClientError } from "./services/api/api-client";
import { getIdentityProfile, getIdentitySession, loginWithLocalCredentials, logoutIdentitySession, startMicrosoftLogin } from "./services/auth/auth-service";
import type { IdentityProfile, SessionResponse } from "./services/auth/identity-contracts";

const AUTH_LOGIN_PATH = "/auth/login";
const GLOBAL_HOME_PATH = "/home/global";
const GLOBAL_HOME_PERMISSION = "global.dashboard.read";
const ROCCA_LOGO_SRC = "/Logo/logo2.jpg";
const AUTH_RETRY_FAILURE_MESSAGE = "No se pudo reintentar la verificación. La sesión expiró, terminó o ya no es válida; inicia sesión nuevamente para continuar.";
const AUTH_RETRY_COOLDOWN_MS = 2500;
const SESSION_STATUS_MIN_VISIBLE_MS = 900;
const SESSION_STATUS_VALIDATED_VISIBLE_MS = 550;
const MICROSOFT_POPUP_FEATURES = "popup,width=520,height=720,menubar=no,toolbar=no,location=no,status=no,resizable=yes,scrollbars=yes";
const MICROSOFT_POPUP_NAME = "rocca-microsoft-login";
const MICROSOFT_POPUP_CLOSE_DELAY_MS = 1_250;
const MICROSOFT_POPUP_CLOSED_GRACE_MS = 15_000;
const MICROSOFT_POPUP_POLL_MS = 750;
const MICROSOFT_POPUP_TIMEOUT_MS = 120_000;
const MICROSOFT_POPUP_UNAVAILABLE_MESSAGE = "No pudimos completar el inicio con Microsoft. Inténtalo de nuevo o selecciona otra cuenta.";
const MICROSOFT_POPUP_UNASSIGNED_MESSAGE = "Tu cuenta Microsoft se validó, pero todavía no está asignada al CRM. Solicita que la vinculen a tu usuario interno.";
const MICROSOFT_POPUP_UNAUTHORIZED_MESSAGE = "Tu cuenta Microsoft se validó, pero tu usuario CRM no está autorizado para iniciar sesión. Contacta a soporte o a tu administrador.";
const CSRF_SESSION_FAILURE_MESSAGE = "No se pudo preparar la protección de la sesión. Actualiza la página e inténtalo de nuevo.";
const API_CSRF_FAILURE_MESSAGE = "No se pudo completar la accion con los permisos actuales.";
const MICROSOFT_POPUP_MESSAGE_TYPE = "rocca:microsoft-login";
const MICROSOFT_POPUP_SESSION_MARKER_KEY = "rocca.microsoftPopup";
const MICROSOFT_STATUS_QUERY_PARAM = "microsoftStatus";
const MICROSOFT_STATUS_FAILED = "failed";
const MICROSOFT_STATUS_UNASSIGNED = "unassigned";
const MICROSOFT_STATUS_UNAUTHORIZED = "unauthorized";
const MICROSOFT_STATUS_MESSAGES = {
    [MICROSOFT_STATUS_FAILED]: MICROSOFT_POPUP_UNAVAILABLE_MESSAGE,
    [MICROSOFT_STATUS_UNASSIGNED]: MICROSOFT_POPUP_UNASSIGNED_MESSAGE,
    [MICROSOFT_STATUS_UNAUTHORIZED]: MICROSOFT_POPUP_UNAUTHORIZED_MESSAGE,
} as const;
const WORKSPACE_ROUTE_BY_CODE: Record<string, string> = {
    all: GLOBAL_HOME_PATH,
    "crm-tink": "/home/crm",
    administration: "/home/administration",
    finance: "/home/finance",
    formalization: "/home/formalization",
    marketing: "/home/marketing",
};
const WORKSPACE_CODE_BY_HOME_ROUTE: Record<string, string> = Object.fromEntries(Object.entries(WORKSPACE_ROUTE_BY_CODE).map(([code, route]) => [route, code]));

type AccessProblemKind = "expired" | "offline" | "server" | "unexpected";
type SessionStatusUser = NonNullable<SessionResponse["user"]>;
type SessionStatusPhase = "checking" | "validated";
type AuthenticatedSessionResponse = SessionResponse & { readonly session: NonNullable<SessionResponse["session"]>; readonly user: SessionStatusUser };
type AuthState = { readonly status: "anonymous" } | { readonly status: "authenticated"; readonly profile: IdentityProfile } | { readonly phase?: SessionStatusPhase; readonly status: "checking"; readonly user?: SessionStatusUser } | { readonly problem: AccessProblemKind; readonly status: "access-problem" } | { readonly status: "forbidden"; readonly profile: IdentityProfile };
type MicrosoftStatus = keyof typeof MICROSOFT_STATUS_MESSAGES;
type MicrosoftPopupMessage = { readonly status: MicrosoftStatus; readonly type: typeof MICROSOFT_POPUP_MESSAGE_TYPE };
interface StartAuthRetryInput {
    readonly authStatus: AuthState["status"];
    readonly isAuthRetryDisabled: boolean;
    readonly setAuthCheckAttempt: Dispatch<SetStateAction<number>>;
    readonly setAuthRetryFeedback: Dispatch<SetStateAction<string | null>>;
    readonly setAuthState: Dispatch<SetStateAction<AuthState>>;
    readonly setIsAuthRetryDisabled: Dispatch<SetStateAction<boolean>>;
}

/**
 * Textos visibles de un fallo de acceso.
 *
 * No incluyen estado HTTP, stack ni detalle del BFF.
 */
const ACCESS_PROBLEM_COPY: Record<AccessProblemKind, { readonly description: string; readonly title: string }> = {
    expired: {
        description: "Por seguridad, tu sesión terminó. Inicia sesión nuevamente para continuar.",
        title: "Sesión expirada",
    },
    offline: {
        description: "No pudimos contactar el servicio de identidad. Revisa tu red y vuelve a intentar.",
        title: "Sin conexión",
    },
    server: {
        description: "El sistema no pudo validar tu acceso por un error temporal. Intenta de nuevo en unos minutos.",
        title: "Error inesperado",
    },
    unexpected: {
        description: "No pudimos confirmar tu sesión. Intenta iniciar sesión nuevamente o reintenta la conexión.",
        title: "Acceso requerido",
    },
};

/**
 * Decide si este permiso quedó permitido en el perfil.
 *
 * `deny` borra un `allow` del mismo código y bloquea uno posterior. Otros
 * códigos no entran en la cuenta. Esto no autoriza la ruta: el API lo hace.
 */
const hasEffectivePermission = (profile: IdentityProfile, permissionCode: string): boolean => {
    const denied = new Set<string>();
    const allowed = new Set<string>();

    for (const permission of profile.permissions) {
        if (permission.code !== permissionCode) {
            continue;
        }

        if (permission.effect === "deny") {
            denied.add(permission.code);
            allowed.delete(permission.code);
            continue;
        }

        if (!denied.has(permission.code)) {
            allowed.add(permission.code);
        }
    }

    return allowed.has(permissionCode);
};

/** Login y rutas home registradas. Cualquier otra URL queda en "no encontrada". */
const isKnownPath = (path: string): boolean => path === AUTH_LOGIN_PATH || path in WORKSPACE_CODE_BY_HOME_ROUTE;

/** Devuelve el perfil operativo asociado a una ruta `/home/*`. */
const getWorkspaceCodeForPath = (path: string): string | undefined => WORKSPACE_CODE_BY_HOME_ROUTE[path];

/**
 * Corrige la URL sin apilar historial.
 *
 * `replaceState` evita que Atrás vuelva a una ruta que el guard ya rechazó.
 */
const replaceBrowserPath = (path: string): void => {
    if (window.location.pathname !== path || window.location.search || window.location.hash) {
        window.history.replaceState(null, "", path);
    }
};

const getApiErrorMessage = (error: ApiClientError): string | null => {
    const responseBody = error.responseBody;

    if (!responseBody || typeof responseBody !== "object" || !("message" in responseBody)) {
        return null;
    }

    const message = (responseBody as { readonly message?: unknown }).message;
    return typeof message === "string" ? message : null;
};

const isCsrfSessionFailure = (error: unknown): boolean => error instanceof ApiClientError && error.status === 403 && getApiErrorMessage(error) === API_CSRF_FAILURE_MESSAGE;

/**
 * Mensaje de login neutro.
 *
 * 400, 401, 403 y 429 dicen lo mismo para no revelar si el correo existe o si
 * la cuenta está bloqueada.
 */
const getLoginErrorMessage = (error: unknown): string => {
    if (isCsrfSessionFailure(error)) {
        return CSRF_SESSION_FAILURE_MESSAGE;
    }

    if (error instanceof ApiClientError && [400, 401, 403, 429].includes(error.status)) {
        return "No pudimos validar esas credenciales. Revisa el correo, la contraseña o el acceso asignado.";
    }

    return "No pudimos conectar con el servicio de identidad. Inténtalo de nuevo.";
};

/** La bandera `authenticated` no alcanza: tienen que venir sesión y usuario. */
const isAuthenticatedSession = (session: SessionResponse): session is AuthenticatedSessionResponse => session.authenticated && Boolean(session.session) && Boolean(session.user);

const getSessionStatusDisplayName = (user: SessionStatusUser): string => user.displayName.trim() || user.email.trim() || "Usuario actual";

const getSessionStatusInitials = (user: SessionStatusUser): string => {
    const words = getSessionStatusDisplayName(user)
        .replace(/@.*/u, "")
        .split(/\s+/u)
        .map((word) => word.trim())
        .filter(Boolean);

    if (words.length === 0) {
        return "U";
    }

    return words
        .slice(0, 2)
        .map((word) => word[0]?.toUpperCase() ?? "")
        .join("");
};

const buildSessionStatusPhotoUrl = (profileImageUrl: string): string => new URL(profileImageUrl.startsWith("http") ? profileImageUrl : buildApiUrl(profileImageUrl)).toString();

const wait = (durationMs: number): Promise<void> =>
    new Promise((resolve) => {
        window.setTimeout(resolve, durationMs);
    });

const waitForSessionStatusExit = (startedAt: number): Promise<void> => {
    const elapsedMs = Date.now() - startedAt;
    return wait(Math.max(SESSION_STATUS_VALIDATED_VISIBLE_MS, SESSION_STATUS_MIN_VISIBLE_MS - elapsedMs));
};

const assertAuthenticatedLoginSession = (session: SessionResponse): void => {
    if (!session.authenticated) {
        throw new ApiClientError("Login local no autenticado.", 401, session);
    }
};

/** `fetch` falla con TypeError cuando no hay red. Un 401 del BFF no entra aquí. */
const isNetworkFailure = (error: unknown): boolean => error instanceof TypeError && /fetch|network|failed|load|conex/iu.test(error.message);

/** En escritorio se conserva el CRM abierto y Microsoft vive en popup. En tactil, redirect completo. */
const shouldUseMicrosoftPopup = (): boolean => window.matchMedia("(pointer: fine)").matches && window.innerWidth >= 768;

const hasMicrosoftPopupSessionMarker = (): boolean => {
    try {
        return window.sessionStorage.getItem(MICROSOFT_POPUP_SESSION_MARKER_KEY) === "1";
    } catch {
        return false;
    }
};

const clearMicrosoftPopupSessionMarker = (): void => {
    try {
        window.sessionStorage.removeItem(MICROSOFT_POPUP_SESSION_MARKER_KEY);
    } catch {
        // El navegador puede bloquear sessionStorage en contextos restringidos.
    }
};

/** Identifica solo ventanas marcadas por el flujo Microsoft. */
const isMicrosoftLoginPopupWindow = (): boolean => window.name === MICROSOFT_POPUP_NAME || hasMicrosoftPopupSessionMarker();

/** Abre el popup pronto para que el navegador lo asocie al clic del usuario. */
const openMicrosoftPopup = (): Window | null => {
    if (!shouldUseMicrosoftPopup()) {
        return null;
    }

    const popupWindow = window.open("about:blank", MICROSOFT_POPUP_NAME, MICROSOFT_POPUP_FEATURES);

    try {
        popupWindow?.sessionStorage.setItem(MICROSOFT_POPUP_SESSION_MARKER_KEY, "1");
    } catch {
        // Si el navegador aisla el popup antes de navegar, seguimos con window.name/opener.
    }

    return popupWindow;
};

/** Cierra una ventana controlada por el login si sigue abierta. */
const closePopupIfOpen = (popupWindow: Window | null): void => {
    if (popupWindow && !popupWindow.closed) {
        popupWindow.close();
    }
};

const isMicrosoftLoginErrorMessage = (message: string): boolean => message === MICROSOFT_POPUP_UNAVAILABLE_MESSAGE || message === MICROSOFT_POPUP_UNASSIGNED_MESSAGE || message === MICROSOFT_POPUP_UNAUTHORIZED_MESSAGE;

/** Mantiene mensajes propios de Microsoft cuando el popup fue bloqueado, cerrado o rechazado por el CRM. */
const getMicrosoftLoginErrorMessage = (error: unknown): string => {
    if (isCsrfSessionFailure(error)) {
        return CSRF_SESSION_FAILURE_MESSAGE;
    }

    return error instanceof Error && isMicrosoftLoginErrorMessage(error.message) ? error.message : getLoginErrorMessage(error);
};

const getMicrosoftCallbackStatus = (search: string): MicrosoftStatus | null => {
    const searchParams = new URLSearchParams(search);
    const status = searchParams.get(MICROSOFT_STATUS_QUERY_PARAM);

    return status === MICROSOFT_STATUS_FAILED || status === MICROSOFT_STATUS_UNASSIGNED || status === MICROSOFT_STATUS_UNAUTHORIZED ? status : null;
};

const isMicrosoftPopupMessage = (value: unknown): value is MicrosoftPopupMessage => typeof value === "object" && value !== null && "type" in value && "status" in value && value.type === MICROSOFT_POPUP_MESSAGE_TYPE && (value.status === MICROSOFT_STATUS_FAILED || value.status === MICROSOFT_STATUS_UNASSIGNED || value.status === MICROSOFT_STATUS_UNAUTHORIZED);

/** Confirma que el mensaje vino del popup controlado y del mismo frontend. */
const getMicrosoftPopupMessage = (event: MessageEvent, popupWindow: Window): MicrosoftPopupMessage | null => {
    const data: unknown = event.data;

    if (event.origin === window.location.origin && event.source === popupWindow && isMicrosoftPopupMessage(data)) {
        return data;
    }

    return null;
};

/**
 * Lee el resultado del popup solo cuando ya volvió al frontend.
 *
 * Mientras está en Microsoft o en el API, el navegador bloquea el acceso por
 * origen cruzado; eso es esperado y se ignora.
 */
const getMicrosoftPopupFailureStatus = (popupWindow: Window): MicrosoftStatus | null => {
    try {
        const popupUrl = new URL(popupWindow.location.href);
        return popupUrl.origin === window.location.origin ? getMicrosoftCallbackStatus(popupUrl.search) : null;
    } catch {
        return null;
    }
};

const getMicrosoftPopupClosedAt = (popupWindow: Window, currentClosedAt: number | null): number | null => (popupWindow.closed ? (currentClosedAt ?? Date.now()) : currentClosedAt);

const didMicrosoftPopupClosedGraceExpire = (closedAt: number | null): boolean => closedAt !== null && Date.now() - closedAt > MICROSOFT_POPUP_CLOSED_GRACE_MS;

/**
 * Espera a que el BFF confirme la cookie de Microsoft creada por el callback.
 *
 * El popup no entrega tokens al frontend. Solo dispara el callback del API; el
 * padre consulta `/identity/session` hasta ver una sesión válida o hasta que el
 * usuario cierre la ventana.
 */
const waitForMicrosoftPopupSession = (popupWindow: Window): Promise<void> =>
    new Promise((resolve, reject) => {
        const startedAt = Date.now();
        let popupClosedAt: number | null = null;
        let intervalId: number | null = null;

        const stopPolling = (): void => {
            window.removeEventListener("message", handlePopupMessage);

            if (intervalId !== null) {
                window.clearInterval(intervalId);
                intervalId = null;
            }
        };

        const settle = (callback: () => void): void => {
            stopPolling();
            callback();
        };

        const failLogin = (status: MicrosoftStatus = MICROSOFT_STATUS_FAILED): void => {
            settle(() => {
                popupWindow.close();
                reject(new Error(MICROSOFT_STATUS_MESSAGES[status]));
            });
        };

        const handlePopupMessage = (event: MessageEvent): void => {
            const message = getMicrosoftPopupMessage(event, popupWindow);

            if (message) {
                failLogin(message.status);
            }
        };

        const checkSession = async (): Promise<void> => {
            const popupFailureStatus = getMicrosoftPopupFailureStatus(popupWindow);

            if (popupFailureStatus) {
                failLogin(popupFailureStatus);
                return;
            }

            if (Date.now() - startedAt > MICROSOFT_POPUP_TIMEOUT_MS) {
                failLogin();
                return;
            }

            try {
                const session = await getIdentitySession();

                if (isAuthenticatedSession(session)) {
                    settle(() => {
                        popupWindow.close();
                        resolve();
                    });
                    return;
                }
            } catch {
                // Mientras Microsoft termina el callback, la sesión puede no existir.
            }

            popupClosedAt = getMicrosoftPopupClosedAt(popupWindow, popupClosedAt);

            if (didMicrosoftPopupClosedGraceExpire(popupClosedAt)) {
                settle(() => {
                    reject(new Error(MICROSOFT_POPUP_UNAVAILABLE_MESSAGE));
                });
            }
        };

        window.addEventListener("message", handlePopupMessage);
        intervalId = window.setInterval(() => {
            void checkSession();
        }, MICROSOFT_POPUP_POLL_MS);
        void checkSession();
    });

/**
 * Lee sesión y, si hay sesión, el perfil.
 *
 * Sin `global.dashboard.read` el estado es `forbidden`: la URL de home no abre el shell.
 */
const hasAccessToHomeRoute = (profile: IdentityProfile, currentPath: string): boolean => {
    const workspaceCode = getWorkspaceCodeForPath(currentPath);

    if (!workspaceCode) {
        return true;
    }

    if (workspaceCode === "all") {
        return hasEffectivePermission(profile, GLOBAL_HOME_PERMISSION);
    }

    return getVisibleNavigationWorkspaces(profile.permissions).some((workspace) => workspace.code === workspaceCode);
};

const resolveAuthState = async (currentPath: string, onAuthenticatedSession?: (user: SessionStatusUser) => void): Promise<AuthState> => {
    const session = await getIdentitySession();

    if (!isAuthenticatedSession(session)) {
        return { status: "anonymous" };
    }

    onAuthenticatedSession?.(session.user);

    const profile = await getIdentityProfile();

    return hasAccessToHomeRoute(profile, currentPath) ? { profile, status: "authenticated" } : { profile, status: "forbidden" };
};

const getAuthenticatedGlobalHomeState = (profile: IdentityProfile): AuthState => (hasEffectivePermission(profile, GLOBAL_HOME_PERMISSION) ? { profile, status: "authenticated" } : { profile, status: "forbidden" });

const startAuthRetryCheck = ({ authStatus, isAuthRetryDisabled, setAuthCheckAttempt, setAuthRetryFeedback, setAuthState, setIsAuthRetryDisabled }: StartAuthRetryInput): void => {
    if (isAuthRetryDisabled || authStatus === "checking") {
        return;
    }

    setIsAuthRetryDisabled(true);
    setAuthRetryFeedback(null);
    setAuthState({ status: "checking" });
    setAuthCheckAttempt((currentAttempt) => currentAttempt + 1);
};

/**
 * Traduce un fallo de arranque protegido a una pantalla, no al formulario de login.
 *
 * Un 401 aquí es sesión vencida. El usuario puede ir a login o reintentar; no
 * se asume que ya estaba anónimo.
 */
const resolveAuthFailureState = (error: unknown): AuthState => {
    if (error instanceof ApiClientError && [401, 409].includes(error.status)) {
        return { problem: "expired", status: "access-problem" };
    }

    if (error instanceof ApiClientError && error.status >= 500) {
        return { problem: "server", status: "access-problem" };
    }

    if (isNetworkFailure(error)) {
        return { problem: "offline", status: "access-problem" };
    }

    return { problem: "unexpected", status: "access-problem" };
};

/**
 * Login es una ruta publica: si el API cae durante la verificacion inicial,
 * el usuario debe poder ver el formulario e intentar entrar manualmente.
 */
const resolveBootstrapFailureState = (error: unknown, currentPath: string): AuthState => (currentPath === AUTH_LOGIN_PATH ? { status: "anonymous" } : resolveAuthFailureState(error));

/**
 * Destino al corregir la URL.
 *
 * Una ruta desconocida no se redirige. Anónimo sale de home hacia login.
 * Autenticado o sin permiso salen de login hacia home; allí el estado decide
 * si se pinta el shell o la pantalla de acceso denegado.
 */
const getRedirectPath = (state: AuthState, currentPath: string): string | null => {
    if (!isKnownPath(currentPath)) {
        return null;
    }

    if (state.status === "anonymous") {
        return currentPath === AUTH_LOGIN_PATH ? null : AUTH_LOGIN_PATH;
    }

    if (state.status === "authenticated" || state.status === "forbidden") {
        return currentPath === AUTH_LOGIN_PATH ? GLOBAL_HOME_PATH : null;
    }

    return null;
};

/**
 * Estado compacto para verificaciones de sesión y errores de autorización.
 */
function SessionStatusAvatarContent({ user }: { readonly user: SessionStatusUser }) {
    const [isImageUnavailable, setIsImageUnavailable] = useState(false);
    const displayName = getSessionStatusDisplayName(user);
    const imageSrc = user.profileImageUrl && !isImageUnavailable ? buildSessionStatusPhotoUrl(user.profileImageUrl) : null;

    return imageSrc ? (
        <img
            className="app-auth-loader__avatar-image"
            src={imageSrc}
            alt={`Foto de ${displayName}`}
            onError={() => {
                setIsImageUnavailable(true);
            }}
        />
    ) : (
        <span className="app-auth-loader__avatar-initials">{getSessionStatusInitials(user)}</span>
    );
}

function SessionStatusAvatar({ phase, user }: { readonly phase: SessionStatusPhase; readonly user: SessionStatusUser | null }) {
    const isValidated = phase === "validated";
    const className = `app-auth-loader__spinner-shell${user ? " app-auth-loader__spinner-shell--user" : ""}${isValidated ? " app-auth-loader__spinner-shell--validated" : ""}`;

    return (
        <span className={className} aria-hidden={user ? undefined : true}>
            <span className="app-auth-loader__spinner" />
            {user ? <SessionStatusAvatarContent user={user} /> : null}
            {isValidated ? (
                <span className="app-auth-loader__validated-badge" aria-hidden="true">
                    <CheckOutlined />
                </span>
            ) : null}
        </span>
    );
}

function SessionStatusScreen({ phase, user }: { readonly phase: SessionStatusPhase; readonly user: SessionStatusUser | null }) {
    const displayName = user ? getSessionStatusDisplayName(user) : null;
    const isValidated = phase === "validated";

    return (
        <main className="app-auth-state app-auth-state--loading">
            <section className="app-auth-loader" role="status" aria-live="polite" aria-labelledby="app-auth-loader-title">
                <img className="app-auth-state__logo" src={ROCCA_LOGO_SRC} width="1121" height="405" alt="ROCCA Development Group" />
                <SessionStatusAvatar key={`${phase}-${user?.profileImageUrl ?? "profile-fallback"}`} phase={phase} user={user} />
                <div className="app-auth-loader__copy">
                    <h1 id="app-auth-loader-title">{isValidated ? "Sesión validada" : "Verificando sesión"}</h1>
                    {displayName ? <p className="app-auth-loader__user-name">{displayName}</p> : null}
                    <p>{isValidated ? "Entrando a tu espacio de trabajo…" : "Preparando tu entorno de trabajo…"}</p>
                </div>
            </section>
        </main>
    );
}

interface AuthStateCardProps {
    readonly description: string;
    readonly isSecondaryActionDisabled?: boolean;
    readonly onPrimaryAction: () => void;
    readonly onSecondaryAction?: () => void;
    readonly primaryActionLabel: string;
    readonly secondaryActionLabel?: string;
    readonly supportMessage?: string | null | undefined;
    readonly title: string;
}

/**
 * Tarjeta enterprise para errores de acceso sin exponer lenguaje tecnico.
 */
function AuthStateCard({ description, isSecondaryActionDisabled = false, onPrimaryAction, onSecondaryAction, primaryActionLabel, secondaryActionLabel, supportMessage, title }: AuthStateCardProps) {
    return (
        <main className="app-auth-state">
            <section className="app-auth-card" aria-labelledby="app-auth-card-title">
                <img className="app-auth-state__logo" src={ROCCA_LOGO_SRC} width="1121" height="405" alt="ROCCA Development Group" />
                <span className="app-auth-card__icon" aria-hidden="true">
                    <LockOutlined />
                </span>
                <div className="app-auth-card__copy">
                    <h1 id="app-auth-card-title">{title}</h1>
                    <p>{description}</p>
                </div>
                <button className="app-auth-card__primary" type="button" onClick={onPrimaryAction}>
                    {primaryActionLabel}
                </button>
                {onSecondaryAction && secondaryActionLabel ? (
                    <button className="app-auth-card__secondary" type="button" disabled={isSecondaryActionDisabled} onClick={onSecondaryAction}>
                        {secondaryActionLabel}
                    </button>
                ) : null}
                {supportMessage ? (
                    <p className="app-auth-card__feedback" role="status">
                        {supportMessage}
                    </p>
                ) : null}
            </section>
        </main>
    );
}

/**
 * Pantalla defensiva cuando la sesión existe pero no tiene permiso de entrada.
 */
function ForbiddenScreen({ onLogout }: { readonly onLogout: () => void }) {
    return <AuthStateCard description="Tu usuario está autenticado, pero no tiene permiso para abrir el Resumen Global." onPrimaryAction={onLogout} primaryActionLabel="Volver a iniciar sesión" title="Acceso no autorizado" />;
}

/** Ruta que no está en el mapa. No muestra datos de sesión. */
function NotFoundScreen({ onNavigateHome }: { readonly onNavigateHome: () => void }) {
    return <AuthStateCard description="La dirección solicitada no existe o fue movida dentro del CRM." onPrimaryAction={onNavigateHome} primaryActionLabel="Volver al inicio" title="Ruta no encontrada" />;
}

/** Fallo de arranque. Ofrece login o un reintento; no abre el shell. */
function AccessProblemScreen({ isRetryDisabled, onLogin, onRetry, problem, retryMessage }: { readonly isRetryDisabled: boolean; readonly onLogin: () => void; readonly onRetry: () => void; readonly problem: AccessProblemKind; readonly retryMessage?: string | null }) {
    const copy = ACCESS_PROBLEM_COPY[problem];

    return <AuthStateCard description={copy.description} isSecondaryActionDisabled={isRetryDisabled} onPrimaryAction={onLogin} onSecondaryAction={onRetry} primaryActionLabel="Iniciar sesión" secondaryActionLabel="Reintentar conexión" supportMessage={retryMessage} title={copy.title} />;
}

interface AppRouteContentProps {
    readonly authRetryFeedback: string | null;
    readonly authState: AuthState;
    readonly isAuthRetryDisabled: boolean;
    readonly isMicrosoftLoginPending: boolean;
    readonly isMicrosoftPopupReturn: boolean;
    readonly isSubmittingLogin: boolean;
    readonly loginError: string | null;
    readonly onLocalLogin: (credentials: LoginCredentials) => Promise<void>;
    readonly onLogout: () => void;
    readonly onMicrosoftLogin: () => Promise<void>;
    readonly onNavigate: (nextPath: string) => void;
    readonly onRetryAuthCheck: () => void;
    readonly path: string;
}

const shouldShowSessionStatusScreen = (authState: AuthState, isMicrosoftPopupReturn: boolean, isMicrosoftLoginPending: boolean): boolean => authState.status === "checking" || isMicrosoftPopupReturn || isMicrosoftLoginPending;

const getCheckingSessionStatusUser = (authState: AuthState): SessionStatusUser | null => (authState.status === "checking" ? (authState.user ?? null) : null);

const getCheckingSessionStatusPhase = (authState: AuthState): SessionStatusPhase => (authState.status === "checking" ? (authState.phase ?? "checking") : "checking");

function AppRouteContent({ authRetryFeedback, authState, isAuthRetryDisabled, isMicrosoftLoginPending, isMicrosoftPopupReturn, isSubmittingLogin, loginError, onLocalLogin, onLogout, onMicrosoftLogin, onNavigate, onRetryAuthCheck, path }: AppRouteContentProps) {
    if (shouldShowSessionStatusScreen(authState, isMicrosoftPopupReturn, isMicrosoftLoginPending)) {
        return <SessionStatusScreen phase={getCheckingSessionStatusPhase(authState)} user={getCheckingSessionStatusUser(authState)} />;
    }

    if (authState.status === "access-problem") {
        return (
            <AccessProblemScreen
                isRetryDisabled={isAuthRetryDisabled}
                onLogin={() => {
                    onNavigate(AUTH_LOGIN_PATH);
                }}
                onRetry={onRetryAuthCheck}
                problem={authState.problem}
                retryMessage={authRetryFeedback}
            />
        );
    }

    if (!isKnownPath(path)) {
        return (
            <NotFoundScreen
                onNavigateHome={() => {
                    onNavigate(authState.status === "authenticated" ? GLOBAL_HOME_PATH : AUTH_LOGIN_PATH);
                }}
            />
        );
    }

    if (authState.status === "forbidden") {
        return <ForbiddenScreen onLogout={onLogout} />;
    }

    const workspaceCode = getWorkspaceCodeForPath(path);

    if (authState.status === "authenticated" && workspaceCode) {
        return (
            <GlobalHomeShell
                key={workspaceCode}
                currentUser={authState.profile.user}
                effectivePermissions={authState.profile.permissions}
                initialWorkspaceCode={workspaceCode}
                onLogout={onLogout}
                onWorkspaceChange={(nextWorkspaceCode) => {
                    onNavigate(WORKSPACE_ROUTE_BY_CODE[nextWorkspaceCode] ?? GLOBAL_HOME_PATH);
                }}
                sessionDebugPayload={authState.profile}
            />
        );
    }

    return <LoginPage authError={loginError} isSubmitting={isSubmittingLogin} onLocalLogin={onLocalLogin} onMicrosoftLogin={onMicrosoftLogin} />;
}

/**
 * Raíz segura: ninguna vista privada se renderiza sin sesión BFF vigente.
 */
export function App() {
    const [initialMicrosoftCallbackStatus] = useState<MicrosoftStatus | null>(() => getMicrosoftCallbackStatus(window.location.search));
    const [initialMicrosoftCallbackFailureMessage] = useState<string | null>(() => (initialMicrosoftCallbackStatus ? MICROSOFT_STATUS_MESSAGES[initialMicrosoftCallbackStatus] : null));
    const [isMicrosoftPopupReturn] = useState(() => isMicrosoftLoginPopupWindow());
    const [path, setPath] = useState(() => window.location.pathname);
    const [authState, setAuthState] = useState<AuthState>({ status: "checking" });
    const [authCheckAttempt, setAuthCheckAttempt] = useState(0);
    const retryCooldownTimerRef = useRef<number | null>(null);
    const microsoftCallbackFailureMessageRef = useRef(initialMicrosoftCallbackFailureMessage);
    const [authRetryFeedback, setAuthRetryFeedback] = useState<string | null>(null);
    const [isAuthRetryDisabled, setIsAuthRetryDisabled] = useState(false);
    const [loginError, setLoginError] = useState<string | null>(isMicrosoftPopupReturn ? null : initialMicrosoftCallbackFailureMessage);
    const [isMicrosoftLoginPending, setIsMicrosoftLoginPending] = useState(false);
    const [isSubmittingLogin, setIsSubmittingLogin] = useState(false);
    const skipNextAuthBootstrapPathRef = useRef<string | null>(null);

    /** Atrás y Adelante no disparan el estado de React. Este efecto los vuelve a leer. */
    useEffect(() => {
        const handlePopState = () => {
            setPath(window.location.pathname);
        };

        window.addEventListener("popstate", handlePopState);

        return () => {
            window.removeEventListener("popstate", handlePopState);
        };
    }, []);

    /** Mantiene la barra de direcciones alineada cuando el estado de ruta cambia. */
    useEffect(() => {
        replaceBrowserPath(path);
    }, [path]);

    /**
     * Si esta instancia corre dentro del popup Microsoft, avisa al opener antes
     * de limpiar la query para que la ventana principal no pierda la señal.
     */
    useEffect(() => {
        const openerWindow = window.opener as Window | null;

        if (!isMicrosoftPopupReturn) {
            return;
        }

        clearMicrosoftPopupSessionMarker();

        if (initialMicrosoftCallbackStatus && openerWindow && openerWindow !== window && typeof openerWindow.postMessage === "function") {
            openerWindow.postMessage({ status: initialMicrosoftCallbackStatus, type: MICROSOFT_POPUP_MESSAGE_TYPE }, window.location.origin);
        }

        window.setTimeout(() => {
            window.close();
        }, MICROSOFT_POPUP_CLOSE_DELAY_MS);
    }, [initialMicrosoftCallbackStatus, isMicrosoftPopupReturn]);

    const navigate = useCallback((nextPath: string): void => {
        replaceBrowserPath(nextPath);
        setPath(nextPath);
    }, []);

    const clearAuthRetryCooldown = useCallback((): void => {
        if (retryCooldownTimerRef.current !== null) {
            window.clearTimeout(retryCooldownTimerRef.current);
            retryCooldownTimerRef.current = null;
        }

        setIsAuthRetryDisabled(false);
    }, []);

    const scheduleAuthRetryCooldown = useCallback((): void => {
        if (retryCooldownTimerRef.current !== null) {
            window.clearTimeout(retryCooldownTimerRef.current);
        }

        setIsAuthRetryDisabled(true);
        retryCooldownTimerRef.current = window.setTimeout(() => {
            retryCooldownTimerRef.current = null;
            setIsAuthRetryDisabled(false);
        }, AUTH_RETRY_COOLDOWN_MS);
    }, []);

    useEffect(
        () => () => {
            if (retryCooldownTimerRef.current !== null) {
                window.clearTimeout(retryCooldownTimerRef.current);
            }
        },
        [],
    );

    /**
     * Comprueba la sesión antes de pintar una vista.
     *
     * `isCancelled` ignora una respuesta que llega después de desmontar o de
     * un reintento. `authCheckAttempt` vuelve a disparar el efecto sin cambiar de ruta.
     */
    useEffect(() => {
        let isCancelled = false;

        if (skipNextAuthBootstrapPathRef.current === path) {
            skipNextAuthBootstrapPathRef.current = null;
            return () => {
                isCancelled = true;
            };
        }

        const bootstrapSession = async (): Promise<void> => {
            const startedAt = Date.now();

            try {
                const nextState = await resolveAuthState(path, (user) => {
                    if (!isCancelled) {
                        setAuthState({ status: "checking", user });
                    }
                });

                if (nextState.status === "authenticated" && !isCancelled) {
                    setAuthState({ phase: "validated", status: "checking", user: nextState.profile.user });
                    await waitForSessionStatusExit(startedAt);
                }

                applyResolvedAuthState(nextState, false);
            } catch (error) {
                const nextState = resolveBootstrapFailureState(error, path);
                applyResolvedAuthState(nextState, authCheckAttempt > 0 && nextState.status === "access-problem");
            }
        };

        const applyResolvedAuthState = (nextState: AuthState, didRetryFail: boolean): void => {
            if (isCancelled) {
                return;
            }

            if (nextState.status === "anonymous" && path === AUTH_LOGIN_PATH && microsoftCallbackFailureMessageRef.current !== null) {
                microsoftCallbackFailureMessageRef.current = null;
            } else {
                setLoginError(null);
            }
            setAuthRetryFeedback(didRetryFail ? AUTH_RETRY_FAILURE_MESSAGE : null);
            setAuthState(nextState);

            if (didRetryFail) {
                scheduleAuthRetryCooldown();
            } else {
                clearAuthRetryCooldown();
            }

            const redirectPath = getRedirectPath(nextState, path);

            if (redirectPath) {
                navigate(redirectPath);
            }
        };

        void bootstrapSession();

        return () => {
            isCancelled = true;
        };
    }, [authCheckAttempt, clearAuthRetryCooldown, navigate, path, scheduleAuthRetryCooldown]);

    /**
     * Después del login, el perfil decide la pantalla.
     *
     * La respuesta de login no abre el shell. Sin el permiso de home, el
     * usuario queda autenticado pero en la pantalla de acceso denegado.
     */
    const completeAuthenticatedLogin = async (): Promise<void> => {
        const startedAt = Date.now();
        const profile = await getIdentityProfile();
        const nextState = getAuthenticatedGlobalHomeState(profile);

        if (nextState.status === "authenticated") {
            setAuthState({ phase: "validated", status: "checking", user: profile.user });
            await waitForSessionStatusExit(startedAt);
        }

        setAuthState(nextState);
        skipNextAuthBootstrapPathRef.current = GLOBAL_HOME_PATH;
        navigate(GLOBAL_HOME_PATH);
    };

    /**
     * Login local. El error se vuelve a lanzar para que el formulario no lo tome como éxito.
     */
    const handleLocalLogin = async (credentials: LoginCredentials): Promise<void> => {
        setIsSubmittingLogin(true);
        setLoginError(null);

        try {
            const session = await loginWithLocalCredentials(credentials);
            assertAuthenticatedLoginSession(session);
            await completeAuthenticatedLogin();
        } catch (error) {
            setLoginError(getLoginErrorMessage(error));
            throw error;
        } finally {
            setIsSubmittingLogin(false);
        }
    };

    /**
     * Arranca Microsoft desde el BFF.
     *
     * Escritorio usa popup para conservar el CRM abierto. Móvil conserva el
     * redirect completo porque es más estable en navegadores táctiles.
     */
    const handleMicrosoftLogin = async (): Promise<void> => {
        setIsSubmittingLogin(true);
        setIsMicrosoftLoginPending(true);
        setLoginError(null);
        const popupWindow = openMicrosoftPopup();

        try {
            const authorizationUrl = await startMicrosoftLogin();

            if (popupWindow) {
                popupWindow.location.href = authorizationUrl;
                await waitForMicrosoftPopupSession(popupWindow);
                await completeAuthenticatedLogin();
                setIsMicrosoftLoginPending(false);
                setIsSubmittingLogin(false);
                return;
            }

            window.location.assign(authorizationUrl);
        } catch (error) {
            closePopupIfOpen(popupWindow);
            setLoginError(getMicrosoftLoginErrorMessage(error));
            setIsMicrosoftLoginPending(false);
            setIsSubmittingLogin(false);
        }
    };

    /**
     * Pide el logout y, pase o falle, deja la UI en anónimo.
     *
     * Un error de red no debe mantener visible el shell. No hay tokens locales que borrar.
     */
    const handleLogout = (): void => {
        void logoutIdentitySession().finally(() => {
            setAuthState({ status: "anonymous" });
            navigate(AUTH_LOGIN_PATH);
        });
    };

    /** Vuelve a comprobar la sesión. El contador cambia la dependencia del efecto sin mover la ruta. */
    const handleRetryAuthCheck = (): void => {
        startAuthRetryCheck({
            authStatus: authState.status,
            isAuthRetryDisabled,
            setAuthCheckAttempt,
            setAuthRetryFeedback,
            setAuthState,
            setIsAuthRetryDisabled,
        });
    };

    return <AppRouteContent authRetryFeedback={authRetryFeedback} authState={authState} isAuthRetryDisabled={isAuthRetryDisabled} isMicrosoftLoginPending={isMicrosoftLoginPending} isMicrosoftPopupReturn={isMicrosoftPopupReturn} isSubmittingLogin={isSubmittingLogin} loginError={loginError} onLocalLogin={handleLocalLogin} onLogout={handleLogout} onMicrosoftLogin={handleMicrosoftLogin} onNavigate={navigate} onRetryAuthCheck={handleRetryAuthCheck} path={path} />;
}
