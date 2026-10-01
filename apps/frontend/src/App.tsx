import { useCallback, useEffect, useRef, useState } from "react";

import { useCooldown } from "./hooks/useCooldown";
import type { LoginCredentials } from "./modules/auth/LoginPage";
import { AUTH_LOGIN_PATH, DEFAULT_HOME_PATH, isKnownPath, replaceBrowserPath } from "./routes/app-routes";
import { AppRouteContent } from "./routes/AppRouteContent";
import { assertAuthenticatedLoginSession, type AuthState, getDefaultAuthenticatedPath, getRedirectPath, resolveAuthState, resolveBootstrapFailureState, resolveLoginState, resolveRouteState } from "./routes/auth-state";
import { getLoginErrorMessage, getMicrosoftLoginErrorMessage } from "./services/auth/auth-error-messages";
import { getIdentityProfile, loginWithLocalCredentials, logoutIdentitySession, startMicrosoftLogin } from "./services/auth/auth-service";
import { closePopupIfOpen, finishMicrosoftPopupReturn, getMicrosoftCallbackStatus, getMicrosoftStatusMessage, isMicrosoftLoginPopupWindow, openMicrosoftPopup, waitForMicrosoftPopupSession } from "./services/auth/microsoft-popup-login";

const AUTH_RETRY_FAILURE_MESSAGE = "No se pudo reintentar la verificación. La sesión expiró, terminó o ya no es válida; inicia sesión nuevamente para continuar.";
/** Evita ráfagas de reintentos contra un servicio de identidad que acaba de fallar. */
const AUTH_RETRY_COOLDOWN_MS = 2500;
/** Evita que el loader parpadee cuando la sesión responde casi al instante. */
const SESSION_STATUS_MIN_VISIBLE_MS = 900;
/** Tiempo mínimo del check de "Sesión validada" para que llegue a percibirse. */
const SESSION_STATUS_VALIDATED_VISIBLE_MS = 550;

const wait = (durationMs: number): Promise<void> =>
    new Promise((resolve) => {
        window.setTimeout(resolve, durationMs);
    });

/** Respeta la duración mínima total del loader y siempre deja ver el check final. */
const waitForSessionStatusExit = (startedAt: number): Promise<void> => wait(Math.max(SESSION_STATUS_VALIDATED_VISIBLE_MS, SESSION_STATUS_MIN_VISIBLE_MS - (Date.now() - startedAt)));

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

    useEffect(() => {
        authStateRef.current = authState;
    }, [authState]);

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
        replaceBrowserPath(path);
    }, [path]);

    useEffect(() => {
        if (isMicrosoftPopupReturn) {
            finishMicrosoftPopupReturn(microsoftCallbackStatus);
        }
    }, [isMicrosoftPopupReturn, microsoftCallbackStatus]);

    const navigate = useCallback((nextPath: string): void => {
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
        const currentAuthState = authStateRef.current;

        if (authCheckAttempt === 0 && (currentAuthState.status === "authenticated" || currentAuthState.status === "forbidden")) {
            const nextState = isKnownPath(path) ? resolveRouteState(currentAuthState.profile, path) : currentAuthState;
            const redirectPath = getRedirectPath(nextState, path);

            if (nextState.status !== currentAuthState.status) {
                setAuthState(nextState);
            }

            if (redirectPath) {
                navigate(redirectPath);
            }

            return;
        }

        if (skipNextAuthBootstrapPathRef.current === path) {
            skipNextAuthBootstrapPathRef.current = null;
            return;
        }

        const applyResolvedAuthState = (nextState: AuthState, didRetryFail: boolean): void => {
            if (isCancelled) {
                return;
            }

            if (nextState.status === "anonymous" && path === AUTH_LOGIN_PATH && keepMicrosoftCallbackErrorRef.current) {
                keepMicrosoftCallbackErrorRef.current = false;
            } else {
                setLoginError(null);
            }

            setAuthRetryFeedback(didRetryFail ? AUTH_RETRY_FAILURE_MESSAGE : null);
            setAuthState(nextState);

            if (didRetryFail) {
                startAuthRetryCooldown();
            } else {
                releaseAuthRetry();
            }

            const redirectPath = getRedirectPath(nextState, path);

            if (redirectPath) {
                navigate(redirectPath);
            }
        };

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

        void bootstrapSession();

        return () => {
            isCancelled = true;
        };
    }, [authCheckAttempt, navigate, path, releaseAuthRetry, startAuthRetryCooldown]);

    /**
     * Tras un login exitoso, el perfil decide la pantalla.
     *
     * La respuesta de login no abre el shell por sí sola: sin ningún perfil
     * operativo visible, el usuario queda autenticado pero en acceso denegado.
     */
    const completeAuthenticatedLogin = async (): Promise<void> => {
        const startedAt = Date.now();
        const profile = await getIdentityProfile();
        const nextState = resolveLoginState(profile);
        const nextPath = getDefaultAuthenticatedPath(profile) ?? DEFAULT_HOME_PATH;

        if (nextState.status === "authenticated") {
            setAuthState({ phase: "validated", status: "checking", user: profile.user });
            await waitForSessionStatusExit(startedAt);
        }

        setAuthState(nextState);
        skipNextAuthBootstrapPathRef.current = nextPath;
        navigate(nextPath);
    };

    /** Login local. El error se relanza para que el formulario no lo tome como éxito. */
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
     * Login Microsoft iniciado por el BFF.
     *
     * Escritorio usa popup para conservar el CRM abierto. Sin popup se hace
     * redirect completo y el estado pendiente se mantiene hasta que la página
     * navega.
     */
    const handleMicrosoftLogin = async (): Promise<void> => {
        setIsSubmittingLogin(true);
        setIsMicrosoftLoginPending(true);
        setLoginError(null);
        const popupWindow = openMicrosoftPopup();

        try {
            const authorizationUrl = await startMicrosoftLogin();

            if (!popupWindow) {
                window.location.assign(authorizationUrl);
                return;
            }

            popupWindow.location.href = authorizationUrl;
            await waitForMicrosoftPopupSession(popupWindow);
            await completeAuthenticatedLogin();
        } catch (error) {
            closePopupIfOpen(popupWindow);
            setLoginError(getMicrosoftLoginErrorMessage(error));
        }

        setIsMicrosoftLoginPending(false);
        setIsSubmittingLogin(false);
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

    /** El botón queda bloqueado hasta que la verificación termine; si vuelve a fallar, entra en espera. */
    const handleRetryAuthCheck = (): void => {
        if (isAuthRetryDisabled || authState.status === "checking") {
            return;
        }

        holdAuthRetry();
        setAuthRetryFeedback(null);
        setAuthState({ status: "checking" });
        setAuthCheckAttempt((currentAttempt) => currentAttempt + 1);
    };

    return <AppRouteContent authRetryFeedback={authRetryFeedback} authState={authState} isAuthRetryDisabled={isAuthRetryDisabled} isMicrosoftSessionPending={isMicrosoftPopupReturn || isMicrosoftLoginPending} isSubmittingLogin={isSubmittingLogin} loginError={loginError} onLocalLogin={handleLocalLogin} onLogout={handleLogout} onMicrosoftLogin={handleMicrosoftLogin} onNavigate={navigate} onRetryAuthCheck={handleRetryAuthCheck} path={path} />;
}
