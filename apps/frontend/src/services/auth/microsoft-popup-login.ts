import { getIdentitySession } from "./auth-service";
import { isAuthenticatedSession } from "./identity-contracts";

/**
 * Login Microsoft en popup (escritorio).
 *
 * El popup nunca entrega tokens al frontend: solo recorre Microsoft y el
 * callback del BFF, que deja la cookie HttpOnly. La ventana principal confirma
 * el resultado consultando `/identity/session`.
 */

const MICROSOFT_POPUP_FEATURES = "popup,width=520,height=720,menubar=no,toolbar=no,location=no,status=no,resizable=yes,scrollbars=yes";
const MICROSOFT_POPUP_NAME = "rocca-microsoft-login";
const MICROSOFT_POPUP_MESSAGE_TYPE = "rocca:microsoft-login";
const MICROSOFT_POPUP_SESSION_MARKER_KEY = "rocca.microsoftPopup";
const MICROSOFT_STATUS_QUERY_PARAM = "microsoftStatus";
/** Deja ver el estado final en el popup antes de cerrarlo. */
const MICROSOFT_POPUP_CLOSE_DELAY_MS = 1_250;
/** Margen tras cerrar el popup: el callback pudo crear la cookie justo antes. */
const MICROSOFT_POPUP_CLOSED_GRACE_MS = 15_000;
const MICROSOFT_POPUP_POLL_MS = 750;
const MICROSOFT_POPUP_TIMEOUT_MS = 120_000;
const MICROSOFT_POPUP_MIN_WIDTH_PX = 768;

/** Valores de `?microsoftStatus=` que el BFF agrega al volver al frontend con error. */
const MICROSOFT_STATUS_MESSAGES = {
    failed: "No pudimos completar el inicio con Microsoft. Inténtalo de nuevo o selecciona otra cuenta.",
    unassigned: "Tu cuenta Microsoft se validó, pero todavía no está asignada al CRM. Solicita que la vinculen a tu usuario interno.",
    unauthorized: "Tu cuenta Microsoft se validó, pero tu usuario CRM no está autorizado para iniciar sesión. Contacta a soporte o a tu administrador.",
} as const;

export type MicrosoftStatus = keyof typeof MICROSOFT_STATUS_MESSAGES;

interface MicrosoftPopupMessage {
    readonly status: MicrosoftStatus;
    readonly type: typeof MICROSOFT_POPUP_MESSAGE_TYPE;
}

const MICROSOFT_LOGIN_ERROR_MESSAGES: readonly string[] = Object.values(MICROSOFT_STATUS_MESSAGES);

const isMicrosoftStatus = (value: unknown): value is MicrosoftStatus => typeof value === "string" && Object.hasOwn(MICROSOFT_STATUS_MESSAGES, value);

/** Mensaje visible para un estado Microsoft. */
export const getMicrosoftStatusMessage = (status: MicrosoftStatus): string => MICROSOFT_STATUS_MESSAGES[status];

/** Permite conservar el texto propio de Microsoft en vez del mensaje genérico de login. */
export const isMicrosoftLoginErrorMessage = (message: string): boolean => MICROSOFT_LOGIN_ERROR_MESSAGES.includes(message);

/** Lee `?microsoftStatus=`; cualquier valor desconocido se ignora. */
export const getMicrosoftCallbackStatus = (search: string): MicrosoftStatus | null => {
    const status = new URLSearchParams(search).get(MICROSOFT_STATUS_QUERY_PARAM);
    return isMicrosoftStatus(status) ? status : null;
};

/** En escritorio se conserva el CRM abierto con popup; en táctil el redirect completo es más estable. */
const shouldUseMicrosoftPopup = (): boolean => window.matchMedia("(pointer: fine)").matches && window.innerWidth >= MICROSOFT_POPUP_MIN_WIDTH_PX;

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

/**
 * Indica si esta instancia del frontend corre dentro del popup Microsoft.
 *
 * Se usan dos señales porque algunos navegadores pierden `window.name` al
 * pasar por otros orígenes y otros aíslan el sessionStorage del popup.
 */
export const isMicrosoftLoginPopupWindow = (): boolean => window.name === MICROSOFT_POPUP_NAME || hasMicrosoftPopupSessionMarker();

/**
 * Abre el popup en blanco antes de pedir la URL al BFF.
 *
 * Tiene que abrirse en el mismo tick del clic; si espera la respuesta del API,
 * el navegador lo trata como popup no solicitado y lo bloquea. Devuelve null
 * cuando el dispositivo debe usar redirect completo.
 */
export const openMicrosoftPopup = (): Window | null => {
    if (!shouldUseMicrosoftPopup()) {
        return null;
    }

    const popupWindow = window.open("about:blank", MICROSOFT_POPUP_NAME, MICROSOFT_POPUP_FEATURES);

    try {
        popupWindow?.sessionStorage.setItem(MICROSOFT_POPUP_SESSION_MARKER_KEY, "1");
    } catch {
        // Si el navegador aísla el popup antes de navegar, queda `window.name` como señal.
    }

    return popupWindow;
};

/** Cierra el popup si sigue abierto. */
export const closePopupIfOpen = (popupWindow: Window | null): void => {
    if (popupWindow && !popupWindow.closed) {
        popupWindow.close();
    }
};

/**
 * Cierre del lado del popup cuando el callback vuelve al frontend.
 *
 * Avisa al opener antes de cerrar para que la ventana principal muestre el
 * motivo del rechazo sin esperar al timeout. El mensaje se limita al mismo
 * origen.
 */
export const finishMicrosoftPopupReturn = (status: MicrosoftStatus | null): void => {
    const openerWindow = window.opener as Window | null;

    clearMicrosoftPopupSessionMarker();

    if (status && openerWindow && openerWindow !== window && typeof openerWindow.postMessage === "function") {
        const message: MicrosoftPopupMessage = { status, type: MICROSOFT_POPUP_MESSAGE_TYPE };
        openerWindow.postMessage(message, window.location.origin);
    }

    window.setTimeout(() => {
        window.close();
    }, MICROSOFT_POPUP_CLOSE_DELAY_MS);
};

const isMicrosoftPopupMessage = (value: unknown): value is MicrosoftPopupMessage => typeof value === "object" && value !== null && "type" in value && "status" in value && value.type === MICROSOFT_POPUP_MESSAGE_TYPE && isMicrosoftStatus(value.status);

/** Solo acepta mensajes del popup que abrió esta ventana y del mismo origen. */
const getMicrosoftPopupMessage = (event: MessageEvent, popupWindow: Window): MicrosoftPopupMessage | null => {
    const data: unknown = event.data;
    return event.origin === window.location.origin && event.source === popupWindow && isMicrosoftPopupMessage(data) ? data : null;
};

/**
 * Lee el estado de error de la URL del popup cuando ya volvió al frontend.
 *
 * Mientras el popup está en Microsoft o en el API, leer su `location` lanza un
 * error de origen cruzado; es esperado y se trata como "sin resultado aún".
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
 * Espera a que el BFF confirme la sesión creada por el callback de Microsoft.
 *
 * Resuelve con una sesión válida. Rechaza con un mensaje visible si el popup
 * informa un error, si vence el timeout o si el usuario lo cierra y la sesión
 * no aparece dentro del margen de gracia.
 */
export const waitForMicrosoftPopupSession = (popupWindow: Window): Promise<void> =>
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

        const failLogin = (status: MicrosoftStatus = "failed"): void => {
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
                    reject(new Error(MICROSOFT_STATUS_MESSAGES.failed));
                });
            }
        };

        window.addEventListener("message", handlePopupMessage);
        intervalId = window.setInterval(() => {
            void checkSession();
        }, MICROSOFT_POPUP_POLL_MS);
        void checkSession();
    });
