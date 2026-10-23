import { useCallback, useEffect, useRef, useState } from "react";

import { RouteErrorBoundary } from "./components/feedback/RouteErrorBoundary";
import { useCooldown } from "./hooks/useCooldown";
import type { LoginCredentials } from "./modules/auth/LoginPage";
import { AUTH_LOGIN_PATH, DEFAULT_HOME_PATH, isKnownPath, pushBrowserPath, replaceBrowserPath } from "./routes/app-routes";
import { AppRouteContent } from "./routes/AppRouteContent";
import { assertAuthenticatedLoginSession, type AuthState, getDefaultAuthenticatedPath, getRedirectPath, resolveAuthState, resolveBootstrapFailureState, resolveLoginState, resolveRouteState } from "./routes/auth-state";
import { subscribeToSessionRefresh } from "./services/api/api-client";
import { getLoginErrorMessage, getMicrosoftLoginErrorMessage } from "./services/auth/auth-error-messages";
import { getIdentityProfile, loginWithLocalCredentials, logoutIdentitySession, startMicrosoftLogin } from "./services/auth/auth-service";
import { closePopupIfOpen, finishMicrosoftPopupReturn, getMicrosoftCallbackStatus, getMicrosoftStatusMessage, isMicrosoftLoginPopupWindow, openMicrosoftPopup, waitForMicrosoftPopupSession } from "./services/auth/microsoft-popup-login";

const AUTH_RETRY_FAILURE_MESSAGE = "No se pudo reintentar la verificación. La sesión expiró, terminó o ya no es válida; inicia sesión nuevamente para continuar.";
/** Evita ráfagas de reintentos contra un servicio de identidad que acaba de fallar. */
const AUTH_RETRY_COOLDOWN_MS = 2500;

/**
 * Raíz segura: ninguna vista privada se renderiza sin sesión BFF vigente.
 *
 * Orquesta ruta, estado de sesión y flujos de login/logout. Las decisiones
 * de acceso viven en `routes/auth-state` y las pantallas en `AppRouteContent`.
 */
export function App() {
    const [isMicrosoftPopupReturn] = useState(isMicrosoftLoginPopupWindow);
    const [microsoftCallbackStatus] = useState(() => getMicrosoftCallbackStatus(window.location.search));
    const microsoftCallbackFailureMessage = microsoftCallbackStatus ? getMicrosoftStatusMessage(microsoftCallbackStatus) : null;
    const [path, setPath] = useState(() => window.location.pathname);
    const [authState, setAuthState] = useState<AuthState>({ status: "checking" });
    const [authCheckAttempt, setAuthCheckAttempt] = useState(0);
    const [sessionRevision, setSessionRevision] = useState(0);
    const [authRetryFeedback, setAuthRetryFeedback] = useState<string | null>(null);
    // En el popup el error se muestra en la ventana principal, no aquí.
    const [loginError, setLoginError] = useState<string | null>(isMicrosoftPopupReturn ? null : microsoftCallbackFailureMessage);
    const [isMicrosoftLoginPending, setIsMicrosoftLoginPending] = useState(false);
    const [isSubmittingLogin, setIsSubmittingLogin] = useState(false);
    const { hold: holdAuthRetry, isActive: isAuthRetryDisabled, release: releaseAuthRetry, start: startAuthRetryCooldown } = useCooldown(AUTH_RETRY_COOLDOWN_MS);
    /** Lee el estado vigente dentro del efecto de arranque sin volver a dispararlo en cada cambio de estado. */
    const authStateRef = useRef<AuthState>(authState);
    /** El error del callback Microsoft debe sobrevivir a la primera verificación anónima en login. */
    const keepMicrosoftCallbackErrorRef = useRef(microsoftCallbackFailureMessage !== null);
    /** Ruta que el login ya resolvió con sesión y perfil; el arranque no debe repetir la verificación. */
    const skipNextAuthBootstrapPathRef = useRef<string | null>(null);
    const logoutPendingRef = useRef(false);
    const sessionGenerationRef = useRef(0);
    const checkingRefreshRestartsRef = useRef(0);
    const loginGenerationRef = useRef<number | null>(null);

    /** Estado y referencia se publican juntos; una operacion invalidada nunca puede restaurarlos. */
    const applyAuthState = useCallback((nextState: AuthState, generation: number): boolean => {
        if (generation !== sessionGenerationRef.current) return false;
        authStateRef.current = nextState;
        setAuthState(nextState);
        return true;
    }, []);

    useEffect(
        () => () => {
            sessionGenerationRef.current += 1;
            loginGenerationRef.current = null;
        },
        [],
    );

    useEffect(
        () =>
            subscribeToSessionRefresh((outcome) => {
                const currentState = authStateRef.current;
                if (logoutPendingRef.current) return;
                sessionGenerationRef.current += 1;
                const wasLoggingIn = loginGenerationRef.current !== null;
                loginGenerationRef.current = null;
                setIsSubmittingLogin(false);
                setIsMicrosoftLoginPending(false);
                if (outcome === "rejected") {
                    releaseAuthRetry();
                    applyAuthState({ status: "anonymous" }, sessionGenerationRef.current);
                    replaceBrowserPath(AUTH_LOGIN_PATH);
                    setPath(AUTH_LOGIN_PATH);
                    return;
                }
                // Reiniciar una vez es seguro; una segunda invalidacion cierra acceso sin ciclos.
                if (currentState.status === "checking") {
                    if (checkingRefreshRestartsRef.current >= 1) {
                        applyAuthState({ status: "access-problem", problem: "expired" }, sessionGenerationRef.current);
                        setAuthRetryFeedback(AUTH_RETRY_FAILURE_MESSAGE);
                        startAuthRetryCooldown();
                        return;
                    }
                    checkingRefreshRestartsRef.current += 1;
                } else {
                    if (!wasLoggingIn && currentState.status !== "authenticated" && currentState.status !== "forbidden") return;
                    checkingRefreshRestartsRef.current = 0;
                }
                skipNextAuthBootstrapPathRef.current = null;
                applyAuthState({ status: "checking" }, sessionGenerationRef.current);
                setSessionRevision((revision) => revision + 1);
            }),
        [applyAuthState, releaseAuthRetry, startAuthRetryCooldown],
    );

    /** Atrás y Adelante no pasan por React; este efecto vuelve a leer la URL. */
    useEffect(() => {
        const handlePopState = () => {
            setPath(window.location.pathname);
        };

        window.addEventListener("popstate", handlePopState);

        return () => {
            window.removeEventListener("popstate", handlePopState);
        };
    }, []);

    useEffect(() => {
        if (window.location.pathname !== AUTH_LOGIN_PATH || !microsoftCallbackStatus) return;
        const url = new URL(window.location.href);
        url.searchParams.delete("microsoftStatus");
        window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
    }, [microsoftCallbackStatus]);

    useEffect(() => {
        if (isMicrosoftPopupReturn) {
            finishMicrosoftPopupReturn(microsoftCallbackStatus);
        }
    }, [isMicrosoftPopupReturn, microsoftCallbackStatus]);

    const navigate = useCallback((nextPath: string): void => {
        pushBrowserPath(nextPath);
        setPath(nextPath);
    }, []);

    /** Access corrections and login/logout replace the current history entry. */
    const redirect = useCallback((nextPath: string): void => {
        replaceBrowserPath(nextPath);
        setPath(nextPath);
    }, []);

    /**
     * Valida la sesión antes de pintar una vista.
     *
     * Con perfil ya cargado, navegar entre rutas solo reevalúa permisos sin
     * llamar al API. `authCheckAttempt` fuerza una verificación completa sin
     * cambiar de ruta, e `isCancelled` descarta respuestas que llegan después
     * de desmontar o de un nuevo intento.
     */
    useEffect(() => {
        let isCancelled = false;
        const generation = sessionGenerationRef.current;
        /** Evita aplicar el resultado de un arranque de sesión cancelado o reemplazado por otro más reciente. */
        const isCurrentBootstrap = (): boolean => !isCancelled && generation === sessionGenerationRef.current;
        const currentAuthState = authStateRef.current;

        if (authCheckAttempt === 0 && (currentAuthState.status === "authenticated" || currentAuthState.status === "forbidden")) {
            const nextState = isKnownPath(path) ? resolveRouteState(currentAuthState.profile, path) : currentAuthState;
            const redirectPath = getRedirectPath(nextState, path);

            if (nextState.status !== currentAuthState.status) {
                applyAuthState(nextState, generation);
            }

            if (redirectPath) {
                redirect(redirectPath);
            }

            return;
        }

        if (skipNextAuthBootstrapPathRef.current === path) {
            skipNextAuthBootstrapPathRef.current = null;
            return;
        }

        /** Aplica el estado de autenticación solo si el arranque sigue vigente. */
        const applyResolvedAuthState = (nextState: AuthState, didRetryFail: boolean): void => {
            if (!isCurrentBootstrap()) {
                return;
            }

            if (nextState.status === "anonymous" && path === AUTH_LOGIN_PATH && keepMicrosoftCallbackErrorRef.current) {
                keepMicrosoftCallbackErrorRef.current = false;
            } else {
                setLoginError(null);
            }

            setAuthRetryFeedback(didRetryFail ? AUTH_RETRY_FAILURE_MESSAGE : null);
            checkingRefreshRestartsRef.current = 0;
            applyAuthState(nextState, generation);

            if (didRetryFail) {
                startAuthRetryCooldown();
            } else {
                releaseAuthRetry();
            }

            const redirectPath = getRedirectPath(nextState, path);

            if (redirectPath) {
                redirect(redirectPath);
            }
        };

        /** Resuelve la sesión al cargar o al cambiar de ruta; se ignora mientras hay un cierre de sesión en curso. */
        const bootstrapSession = async (): Promise<void> => {
            if (logoutPendingRef.current) return;
            try {
                const nextState = await resolveAuthState(path, (user) => {
                    if (isCurrentBootstrap()) {
                        applyAuthState({ status: "checking", user }, generation);
                    }
                });
                applyResolvedAuthState(nextState, false);
            } catch (error) {
                const nextState = resolveBootstrapFailureState(error, path);
                applyResolvedAuthState(nextState, authCheckAttempt > 0 && nextState.status === "access-problem");
            }
        };

        void bootstrapSession();

        return () => {
            isCancelled = true;
        };
    }, [applyAuthState, authCheckAttempt, redirect, path, releaseAuthRetry, sessionRevision, startAuthRetryCooldown]);

    /**
     * Tras un login exitoso, el perfil decide la pantalla.
     *
     * La respuesta de login no abre el shell por sí sola: sin ningún perfil
     * operativo visible, el usuario queda autenticado pero en acceso denegado.
     */
    const completeAuthenticatedLogin = async (generation: number): Promise<void> => {
        if (generation !== sessionGenerationRef.current) return;
        const profile = await getIdentityProfile();
        if (generation !== sessionGenerationRef.current) return;
        const nextState = resolveLoginState(profile);
        const nextPath = getDefaultAuthenticatedPath(profile) ?? DEFAULT_HOME_PATH;

        applyAuthState(nextState, generation);
        skipNextAuthBootstrapPathRef.current = nextPath;
        redirect(nextPath);
    };

    /** Login local. El error se relanza para que el formulario no lo tome como éxito. */
    const handleLocalLogin = async (credentials: LoginCredentials): Promise<void> => {
        const generation = ++sessionGenerationRef.current;
        loginGenerationRef.current = generation;
        setIsSubmittingLogin(true);
        setLoginError(null);

        try {
            const session = await loginWithLocalCredentials(credentials);
            assertAuthenticatedLoginSession(session);
            await completeAuthenticatedLogin(generation);
        } catch (error) {
            if (generation === sessionGenerationRef.current) setLoginError(getLoginErrorMessage(error));
            throw error;
        } finally {
            if (loginGenerationRef.current === generation) {
                loginGenerationRef.current = null;
                setIsSubmittingLogin(false);
            }
        }
    };

    /**
     * Login Microsoft iniciado por el BFF.
     *
     * Escritorio usa popup para conservar el CRM abierto. Sin popup se hace
     * redirect completo y el estado pendiente se mantiene hasta que la página
     * navega.
     */
    const handleMicrosoftLogin = async (): Promise<void> => {
        const generation = ++sessionGenerationRef.current;
        loginGenerationRef.current = generation;
        setIsSubmittingLogin(true);
        setIsMicrosoftLoginPending(true);
        setLoginError(null);
        const popupWindow = openMicrosoftPopup();

        try {
            const authorizationUrl = await startMicrosoftLogin();
            if (generation !== sessionGenerationRef.current) {
                closePopupIfOpen(popupWindow);
                return;
            }

            if (!popupWindow) {
                window.location.assign(authorizationUrl);
                return;
            }

            popupWindow.location.href = authorizationUrl;
            await waitForMicrosoftPopupSession(popupWindow);
            await completeAuthenticatedLogin(generation);
        } catch (error) {
            closePopupIfOpen(popupWindow);
            if (generation === sessionGenerationRef.current) setLoginError(getMicrosoftLoginErrorMessage(error));
        }

        if (loginGenerationRef.current === generation) {
            loginGenerationRef.current = null;
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
        const generation = ++sessionGenerationRef.current;
        loginGenerationRef.current = null;
        logoutPendingRef.current = true;
        releaseAuthRetry();
        applyAuthState({ status: "anonymous" }, generation);
        setIsSubmittingLogin(true);
        redirect(AUTH_LOGIN_PATH);
        void logoutIdentitySession().finally(() => {
            if (generation !== sessionGenerationRef.current) return;
            logoutPendingRef.current = false;
            setIsSubmittingLogin(false);
            applyAuthState({ status: "anonymous" }, generation);
            redirect(AUTH_LOGIN_PATH);
        });
    };

    /** El botón queda bloqueado hasta que la verificación termine; si vuelve a fallar, entra en espera. */
    const handleRetryAuthCheck = (): void => {
        if (isAuthRetryDisabled || authState.status === "checking") {
            return;
        }

        holdAuthRetry();
        const generation = ++sessionGenerationRef.current;
        checkingRefreshRestartsRef.current = 0;
        setAuthRetryFeedback(null);
        applyAuthState({ status: "checking" }, generation);
        setAuthCheckAttempt((currentAttempt) => currentAttempt + 1);
    };

    return (
        <RouteErrorBoundary resetKey={path}>
            <AppRouteContent authRetryFeedback={authRetryFeedback} authState={authState} isAuthRetryDisabled={isAuthRetryDisabled} isMicrosoftSessionPending={isMicrosoftPopupReturn || isMicrosoftLoginPending} isSubmittingLogin={isSubmittingLogin} loginError={loginError} onLocalLogin={handleLocalLogin} onLogout={handleLogout} onMicrosoftLogin={handleMicrosoftLogin} onNavigate={navigate} onRetryAuthCheck={handleRetryAuthCheck} path={path} />
        </RouteErrorBoundary>
    );
}
