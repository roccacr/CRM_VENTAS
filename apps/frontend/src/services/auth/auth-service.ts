import { apiRequest } from "../api/api-client";
import { type IdentityProfile, type LocalLoginCredentials, parseIdentityProfile, parseMicrosoftStartResponse, parseSessionResponse, type SessionResponse } from "./identity-contracts";

/**
 * Rutas de identidad del BFF.
 *
 * El navegador no habla con Microsoft Graph. Microsoft entra por la URL que
 * devuelve el API.
 */
const IDENTITY_SESSION_PATH = "/identity/session";
const IDENTITY_ME_PATH = "/identity/me";
const IDENTITY_LOCAL_LOGIN_PATH = "/identity/local/login";
const IDENTITY_LOGOUT_PATH = "/identity/logout";
const IDENTITY_MICROSOFT_START_PATH = "/identity/microsoft/start";

/** Estado de sesión al arrancar. No trae permisos ni tokens. */
export const getIdentitySession = async (): Promise<SessionResponse> => parseSessionResponse(await apiRequest<unknown>(IDENTITY_SESSION_PATH));

/** Perfil efectivo. Los permisos de esta respuesta son la única ayuda visual de autorización. */
export const getIdentityProfile = async (): Promise<IdentityProfile> => parseIdentityProfile(await apiRequest<unknown>(IDENTITY_ME_PATH));

/**
 * Login local contra el BFF.
 *
 * El cuerpo es correo y contraseña. La respuesta se valida como sesión; el
 * cliente no lee ni guarda tokens del cuerpo.
 */
export const loginWithLocalCredentials = async (credentials: LocalLoginCredentials): Promise<SessionResponse> =>
    parseSessionResponse(
        await apiRequest<unknown>(IDENTITY_LOCAL_LOGIN_PATH, {
            body: credentials,
            method: "POST",
        }),
    );

/**
 * Pide al BFF la URL de autorización de Microsoft.
 *
 * El caller debe navegar a esa URL. Este módulo no arma el enlace ni conserva
 * el resultado.
 */
export const startMicrosoftLogin = async (): Promise<string> => {
    const response = parseMicrosoftStartResponse(
        await apiRequest<unknown>(IDENTITY_MICROSOFT_START_PATH, {
            method: "POST",
        }),
    );

    return response.authorizationUrl;
};

/**
 * Cierra la sesión en el BFF.
 *
 * No reintenta con refresh: un 401 de logout no debe abrir otra renovación.
 * React no borra tokens porque no los tiene.
 */
export const logoutIdentitySession = async (): Promise<void> => {
    await apiRequest<unknown>(IDENTITY_LOGOUT_PATH, {
        method: "POST",
        retryOnUnauthorized: false,
    });
};
