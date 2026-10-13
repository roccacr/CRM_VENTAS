/**
 * Única salida visual de la raíz.
 *
 * Elige login, verificación, problema de acceso, no encontrada, prohibido o el
 * shell. Ninguna vista privada se pinta mientras la sesión sigue en duda.
 */
import LockOutlined from "@ant-design/icons/LockOutlined";
import QuestionCircleOutlined from "@ant-design/icons/QuestionCircleOutlined";
import Button from "antd/es/button";
import Result from "antd/es/result";

import { AccessProblemScreen, NotFoundScreen, SessionStatusScreen } from "../components/feedback/AuthStateScreens";
import { AdministrationSectionPage } from "../modules/administration/pages/AdministrationSectionPage";
import { type LoginCredentials, LoginPage } from "../modules/auth/LoginPage";
import { ALL_WORKSPACE_CODE, GlobalHomeShell } from "../modules/home/GlobalHomeShell";
import type { IdentityProfile, IdentityUser } from "../services/auth/identity-contracts";
import { type AppRoute, AUTH_LOGIN_PATH, getAppRoute, isKnownPath } from "./app-routes";
import { type AuthState, getDefaultAuthenticatedPath, resolveRouteState, type SessionStatusPhase } from "./auth-state";

/** Datos que la raíz ya resolvió. Este componente solo elige qué pantalla pintar. */
export interface AppRouteContentProps {
    /** Aviso del reintento de sesión. `null` cuando no hay un intento en curso. */
    readonly authRetryFeedback: string | null;
    /** Estado de autenticación ya clasificado. */
    readonly authState: AuthState;
    /** Evita disparar otro reintento mientras el anterior no termina. */
    readonly isAuthRetryDisabled: boolean;
    /** Login Microsoft en curso o esta ventana es el popup que vuelve del callback. */
    readonly isMicrosoftSessionPending: boolean;
    /** El POST de credenciales locales todavía no respondió. */
    readonly isSubmittingLogin: boolean;
    /** Error visible del login. `null` cuando no hay fallo. */
    readonly loginError: string | null;
    /** Envía correo y contraseña al BFF. No guarda la contraseña. */
    readonly onLocalLogin: (credentials: LoginCredentials) => Promise<void>;
    /** Cierra la sesión en el BFF. */
    readonly onLogout: () => void;
    /** Pide la URL de Microsoft y abre popup o redirect. */
    readonly onMicrosoftLogin: () => Promise<void>;
    /** Cambia la ruta privada sin decidir si el usuario puede verla. */
    readonly onNavigate: (nextPath: string) => void;
    /** Vuelve a leer sesión y perfil. */
    readonly onRetryAuthCheck: () => void;
    /** Ruta actual, sin query ni hash. */
    readonly path: string;
}

/** Página propia de la ruta o, si todavía no existe, el placeholder de sección. */
function RoutePage({ currentUser, route }: { readonly currentUser: IdentityUser; readonly route: AppRoute }) {
    return route.Page ? <route.Page currentUser={currentUser} /> : <AdministrationSectionPage title={route.title} />;
}

const getSessionStatusView = (authState: AuthState): { readonly phase: SessionStatusPhase; readonly user: IdentityUser | null } => (authState.status === "checking" ? { phase: authState.phase ?? "checking", user: authState.user ?? null } : { phase: "checking", user: null });

/** Authenticated feedback stays inside the original shell; denied pages never mount. */
function AuthenticatedRouteContent({ profile, path, onLogout, onNavigate }: { readonly profile: IdentityProfile; readonly path: string; readonly onLogout: () => void; readonly onNavigate: (path: string) => void }) {
    const route = getAppRoute(path);
    // Navigation props can precede App's effect: authorize the current URL now.
    const permittedRoute = resolveRouteState(profile, path).status === "authenticated" ? route : undefined;
    const defaultPath = getDefaultAuthenticatedPath(profile);
    const shellRoute = permittedRoute ?? getAppRoute(defaultPath ?? "");
    const workspaceCode = shellRoute?.workspaceCode ?? ALL_WORKSPACE_CODE;
    return (
        <GlobalHomeShell
            activeMenuItemCode={shellRoute?.menuItemCode}
            key={workspaceCode}
            currentUser={profile.user}
            effectivePermissions={profile.permissions}
            initialWorkspaceCode={workspaceCode}
            orgUnits={profile.orgUnits}
            onLogout={onLogout}
            onMenuItemSelect={onNavigate}
            onWorkspaceChange={(code) => {
                if (code === ALL_WORKSPACE_CODE) return;
                const destination = getDefaultAuthenticatedPath(profile, code);
                if (destination) onNavigate(destination);
            }}
        >
            {permittedRoute ? <RoutePage currentUser={profile.user} route={permittedRoute} /> : <AuthenticatedRouteFeedback unknown={!isKnownPath(path)} defaultPath={defaultPath} onNavigate={onNavigate} />}
        </GlobalHomeShell>
    );
}

/** A missing permitted landing page offers no invented navigation destination. */
function AuthenticatedRouteFeedback({ unknown, defaultPath, onNavigate }: { readonly unknown: boolean; readonly defaultPath: string | null; readonly onNavigate: (path: string) => void }) {
    return (
        <section className="global-home-dashboard" role="alert" aria-labelledby="route-feedback-title">
            <Result
                icon={unknown ? <QuestionCircleOutlined /> : <LockOutlined />}
                status="warning"
                title={
                    <span id="route-feedback-title" role="heading" aria-level={1}>
                        {unknown ? "Ruta no encontrada" : "Acceso no autorizado"}
                    </span>
                }
                subTitle={unknown ? "La dirección solicitada no existe o fue movida dentro del CRM." : "Tu usuario está autenticado, pero no tiene permiso para abrir esta vista."}
                extra={
                    defaultPath ? (
                        <Button
                            onClick={() => {
                                onNavigate(defaultPath);
                            }}
                        >
                            Volver al inicio
                        </Button>
                    ) : undefined
                }
            />
        </section>
    );
}

/**
 * Elige la única pantalla visible según estado de sesión y ruta.
 *
 * El orden importa: la verificación y los fallos de acceso se resuelven antes
 * de mirar la ruta, para que ninguna vista privada se pinte con un estado
 * dudoso. Una sesión válida conserva el shell incluso ante una URL denegada
 * o desconocida; la página privada nunca se monta antes de comprobar la ruta.
 */
export function AppRouteContent({ authRetryFeedback, authState, isAuthRetryDisabled, isMicrosoftSessionPending, isSubmittingLogin, loginError, onLocalLogin, onLogout, onMicrosoftLogin, onNavigate, onRetryAuthCheck, path }: AppRouteContentProps) {
    if (authState.status === "checking" || isMicrosoftSessionPending) {
        const { phase, user } = getSessionStatusView(authState);
        return <SessionStatusScreen phase={phase} user={user} />;
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

    if (authState.status === "authenticated" || authState.status === "forbidden") {
        return <AuthenticatedRouteContent profile={authState.profile} path={path} onLogout={onLogout} onNavigate={onNavigate} />;
    }

    if (!isKnownPath(path)) {
        return (
            <NotFoundScreen
                onNavigateHome={() => {
                    onNavigate(AUTH_LOGIN_PATH);
                }}
            />
        );
    }

    return <LoginPage authError={loginError} isSubmitting={isSubmittingLogin} onLocalLogin={onLocalLogin} onMicrosoftLogin={onMicrosoftLogin} />;
}
