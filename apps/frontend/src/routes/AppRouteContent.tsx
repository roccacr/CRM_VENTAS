import { AccessProblemScreen, ForbiddenScreen, NotFoundScreen, SessionStatusScreen } from "../components/feedback/AuthStateScreens";
import { AdministrationSectionPage } from "../modules/administration/pages/AdministrationSectionPage";
import { type LoginCredentials, LoginPage } from "../modules/auth/LoginPage";
import { ALL_WORKSPACE_CODE, GlobalHomeShell } from "../modules/home/GlobalHomeShell";
import type { IdentityUser } from "../services/auth/identity-contracts";
import { type AppRoute, AUTH_LOGIN_PATH, DEFAULT_HOME_PATH, getAppRoute, getWorkspaceHomePath, isKnownPath } from "./app-routes";
import type { AuthState, SessionStatusPhase } from "./auth-state";

export interface AppRouteContentProps {
    readonly authRetryFeedback: string | null;
    readonly authState: AuthState;
    readonly isAuthRetryDisabled: boolean;
    /** Login Microsoft en curso o esta ventana es el popup que vuelve del callback. */
    readonly isMicrosoftSessionPending: boolean;
    readonly isSubmittingLogin: boolean;
    readonly loginError: string | null;
    readonly onLocalLogin: (credentials: LoginCredentials) => Promise<void>;
    readonly onLogout: () => void;
    readonly onMicrosoftLogin: () => Promise<void>;
    readonly onNavigate: (nextPath: string) => void;
    readonly onRetryAuthCheck: () => void;
    readonly path: string;
}

/** Página propia de la ruta o, si todavía no existe, el placeholder de sección. */
function RoutePage({ currentUser, route }: { readonly currentUser: IdentityUser; readonly route: AppRoute }) {
    return route.Page ? <route.Page currentUser={currentUser} /> : <AdministrationSectionPage title={route.title} />;
}

const getSessionStatusView = (authState: AuthState): { readonly phase: SessionStatusPhase; readonly user: IdentityUser | null } => (authState.status === "checking" ? { phase: authState.phase ?? "checking", user: authState.user ?? null } : { phase: "checking", user: null });

/**
 * Elige la única pantalla visible según estado de sesión y ruta.
 *
 * El orden importa: la verificación y los fallos de acceso se resuelven antes
 * de mirar la ruta, para que ninguna vista privada se pinte con un estado
 * dudoso. El shell solo aparece con sesión autenticada y ruta registrada.
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

    if (!isKnownPath(path)) {
        return (
            <NotFoundScreen
                onNavigateHome={() => {
                    onNavigate(authState.status === "authenticated" ? DEFAULT_HOME_PATH : AUTH_LOGIN_PATH);
                }}
            />
        );
    }

    if (authState.status === "forbidden") {
        return <ForbiddenScreen onLogout={onLogout} />;
    }

    const route = getAppRoute(path);

    if (authState.status === "authenticated" && route) {
        return (
            <GlobalHomeShell
                activeMenuItemCode={route.menuItemCode}
                // `initialWorkspaceCode` solo se lee al montar; la key remonta el shell cuando la ruta cambia de perfil operativo.
                key={route.workspaceCode}
                currentUser={authState.profile.user}
                effectivePermissions={authState.profile.permissions}
                initialWorkspaceCode={route.workspaceCode}
                onLogout={onLogout}
                onMenuItemSelect={onNavigate}
                onWorkspaceChange={(nextWorkspaceCode) => {
                    // "Todos" cambia el alcance del menú, no la página visible.
                    if (nextWorkspaceCode !== ALL_WORKSPACE_CODE) {
                        onNavigate(getWorkspaceHomePath(nextWorkspaceCode));
                    }
                }}
            >
                <RoutePage currentUser={authState.profile.user} route={route} />
            </GlobalHomeShell>
        );
    }

    return <LoginPage authError={loginError} isSubmitting={isSubmittingLogin} onLocalLogin={onLocalLogin} onMicrosoftLogin={onMicrosoftLogin} />;
}
