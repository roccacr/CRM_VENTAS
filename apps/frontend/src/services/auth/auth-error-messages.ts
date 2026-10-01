import { ApiClientError } from "../api/api-client";
import { isMicrosoftLoginErrorMessage } from "./microsoft-popup-login";

/**
 * Traducción de errores de login a texto visible.
 *
 * Ningún mensaje expone estado HTTP, stack ni detalle del BFF.
 */

const CSRF_SESSION_FAILURE_MESSAGE = "No se pudo preparar la protección de la sesión. Actualiza la página e inténtalo de nuevo.";
const INVALID_CREDENTIALS_MESSAGE = "No pudimos validar esas credenciales. Revisa el correo, la contraseña o el acceso asignado.";
const IDENTITY_UNAVAILABLE_MESSAGE = "No pudimos conectar con el servicio de identidad. Inténtalo de nuevo.";
/** Texto exacto que el API devuelve cuando rechaza el token CSRF. */
const API_CSRF_FAILURE_MESSAGE = "No se pudo completar la accion con los permisos actuales.";
const NEUTRAL_LOGIN_FAILURE_STATUSES: readonly number[] = [400, 401, 403, 429];

const getApiErrorMessage = (error: ApiClientError): string | null => {
    const responseBody = error.responseBody;

    if (!responseBody || typeof responseBody !== "object" || !("message" in responseBody)) {
        return null;
    }

    const message = (responseBody as { readonly message?: unknown }).message;
    return typeof message === "string" ? message : null;
};

/** Un 403 de CSRF se distingue de un 403 de credenciales para pedir recargar, no reintentar la clave. */
const isCsrfSessionFailure = (error: unknown): boolean => error instanceof ApiClientError && error.status === 403 && getApiErrorMessage(error) === API_CSRF_FAILURE_MESSAGE;

/**
 * Mensaje de login local.
 *
 * 400, 401, 403 y 429 dicen lo mismo para no revelar si el correo existe o si
 * la cuenta está bloqueada.
 */
export const getLoginErrorMessage = (error: unknown): string => {
    if (isCsrfSessionFailure(error)) {
        return CSRF_SESSION_FAILURE_MESSAGE;
    }

    if (error instanceof ApiClientError && NEUTRAL_LOGIN_FAILURE_STATUSES.includes(error.status)) {
        return INVALID_CREDENTIALS_MESSAGE;
    }

    return IDENTITY_UNAVAILABLE_MESSAGE;
};

/** Conserva el motivo propio de Microsoft (popup cerrado, cuenta sin asignar o no autorizada). */
export const getMicrosoftLoginErrorMessage = (error: unknown): string => {
    if (!isCsrfSessionFailure(error) && error instanceof Error && isMicrosoftLoginErrorMessage(error.message)) {
        return error.message;
    }

    return getLoginErrorMessage(error);
};
