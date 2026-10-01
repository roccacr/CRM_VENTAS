import { apiRequest } from "../api/api-client";
import {
    type CreateSystemUserPayload,
    type IdentityProfile,
    type IdentityRoleCatalogItem,
    type IdentitySecurityCatalog,
    type IdentityUserAccessSummary,
    type ListSystemUsersOptions,
    type LocalLoginCredentials,
    parseCreatedSystemUser,
    parseIdentityProfile,
    parseIdentitySecurityCatalog,
    parseIdentityUserAccess,
    parseMicrosoftStartResponse,
    parseReplacedIdentityRolePermissions,
    parseSessionResponse,
    parseSystemUsersListResponse,
    parseUpdatedIdentityRole,
    type ReplaceIdentityRolePermissionsPayload,
    type ReplaceIdentityRolePermissionsResponse,
    type ReplaceIdentityUserAccessPayload,
    type SessionResponse,
    type SystemUserDirectoryItem,
    type SystemUsersListResponse,
    type UpdateIdentityRolePayload,
} from "./identity-contracts";

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
const IDENTITY_USERS_PATH = "/identity/users";
const IDENTITY_ROLES_PATH = "/identity/roles";
const IDENTITY_SECURITY_CATALOG_PATH = `${IDENTITY_ROLES_PATH}/security-catalog`;

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

/**
 * Pide una página del directorio.
 *
 * Omite los filtros vacíos para no mandar `status` ni `search` en blanco.
 * La respuesta se valida antes de llegar a la pantalla.
 */
export const getSystemUsers = async (options: ListSystemUsersOptions): Promise<SystemUsersListResponse> => {
    const query = new URLSearchParams();

    if (options.status) {
        query.set("status", options.status);
    }

    if (options.search) {
        query.set("search", options.search);
    }

    if (options.limit) {
        query.set("limit", String(options.limit));
    }

    if (options.cursor) {
        query.set("cursor", options.cursor);
    }

    if (options.sort) {
        query.set("sort", options.sort);
    }

    if (options.direction) {
        query.set("direction", options.direction);
    }

    const path = query.size > 0 ? `${IDENTITY_USERS_PATH}?${query.toString()}` : IDENTITY_USERS_PATH;
    return parseSystemUsersListResponse(await apiRequest<unknown>(path));
};

/** Crea un usuario del sistema. El API valida permisos y audita al actor. */
export const createSystemUser = async (payload: CreateSystemUserPayload): Promise<SystemUserDirectoryItem> =>
    parseCreatedSystemUser(
        await apiRequest<unknown>(IDENTITY_USERS_PATH, {
            body: payload,
            method: "POST",
        }),
    );

/** Renombra un rol sin cambiar su codigo estable. */
export const updateIdentityRole = async (roleCode: string, payload: UpdateIdentityRolePayload): Promise<IdentityRoleCatalogItem> =>
    parseUpdatedIdentityRole(
        await apiRequest<unknown>(`${IDENTITY_ROLES_PATH}/${encodeURIComponent(roleCode)}`, {
            body: payload,
            method: "PATCH",
        }),
    );

/** Lee catalogo persistido de roles, modulos, permisos y auditoria reciente. */
export const getIdentitySecurityCatalog = async (): Promise<IdentitySecurityCatalog> => parseIdentitySecurityCatalog(await apiRequest<unknown>(IDENTITY_SECURITY_CATALOG_PATH));

/** Lee los permisos activos persistidos de un rol. */
export const getIdentityRolePermissions = async (roleCode: string): Promise<ReplaceIdentityRolePermissionsResponse> => parseReplacedIdentityRolePermissions(await apiRequest<unknown>(`${IDENTITY_ROLES_PATH}/${encodeURIComponent(roleCode)}/permissions`));

/** Reemplaza los permisos activos de un rol. */
export const replaceIdentityRolePermissions = async (roleCode: string, payload: ReplaceIdentityRolePermissionsPayload): Promise<ReplaceIdentityRolePermissionsResponse> =>
    parseReplacedIdentityRolePermissions(
        await apiRequest<unknown>(`${IDENTITY_ROLES_PATH}/${encodeURIComponent(roleCode)}/permissions`, {
            body: payload,
            method: "PUT",
        }),
    );

/** Lee roles, módulos y permisos directos de un usuario. */
export const getIdentityUserAccess = async (userPublicId: string): Promise<IdentityUserAccessSummary> => parseIdentityUserAccess(await apiRequest<unknown>(`${IDENTITY_USERS_PATH}/${encodeURIComponent(userPublicId)}/access`));

/** Reemplaza roles, módulos y permisos directos de un usuario. */
export const replaceIdentityUserAccess = async (userPublicId: string, payload: ReplaceIdentityUserAccessPayload): Promise<IdentityUserAccessSummary> =>
    parseIdentityUserAccess(
        await apiRequest<unknown>(`${IDENTITY_USERS_PATH}/${encodeURIComponent(userPublicId)}/access`, {
            body: payload,
            method: "PUT",
        }),
    );
