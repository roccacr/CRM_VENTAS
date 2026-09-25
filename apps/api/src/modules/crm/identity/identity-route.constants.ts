// ============================================================================
// Rutas canonicas del modulo de identidad.
//
// Mantener estos literales en un solo lugar evita que el controller y los
// guardrails HTTP (CSRF/rate limit) diverjan silenciosamente cuando una ruta se
// renombra.
// ============================================================================

/** Prefijo publico del modulo de identidad en HTTP. */
export const IDENTITY_CONTROLLER_PATH = "identity";

/** Ruta relativa para consultar sesion anonima/autenticada. */
export const IDENTITY_SESSION_ROUTE = "session";

/** Ruta relativa para consultar el perfil autenticado actual. */
export const IDENTITY_ME_ROUTE = "me";

/** Ruta relativa para cerrar sesion. */
export const IDENTITY_LOGOUT_ROUTE = "logout";

/** Ruta relativa para rotacion futura de refresh token. */
export const IDENTITY_REFRESH_ROUTE = "refresh";

/** Ruta relativa para iniciar Microsoft OIDC. */
export const IDENTITY_MICROSOFT_START_ROUTE = "microsoft/start";

/** Ruta relativa para recibir callback Microsoft OIDC. */
export const IDENTITY_MICROSOFT_CALLBACK_ROUTE = "microsoft/callback";

/** Ruta relativa de login local dentro del controller de identidad. */
export const IDENTITY_LOCAL_LOGIN_ROUTE = "local/login";

/** Ruta relativa de solicitud de reset local dentro del controller de identidad. */
export const IDENTITY_LOCAL_REQUEST_RESET_ROUTE = "local/request-reset";

/** Ruta relativa para completar activacion/reset local. */
export const IDENTITY_LOCAL_COMPLETE_RESET_ROUTE = "local/complete-reset";

/** Path absoluto del endpoint de refresh; tambien restringe la cookie refresh. */
export const IDENTITY_REFRESH_PATH = `/${IDENTITY_CONTROLLER_PATH}/${IDENTITY_REFRESH_ROUTE}`;

/** Path absoluto usado por hooks Fastify que reciben la URL completa. */
export const IDENTITY_LOCAL_LOGIN_PATH = `/${IDENTITY_CONTROLLER_PATH}/${IDENTITY_LOCAL_LOGIN_ROUTE}`;

/** Path absoluto usado por hooks Fastify que reciben la URL completa. */
export const IDENTITY_LOCAL_REQUEST_RESET_PATH = `/${IDENTITY_CONTROLLER_PATH}/${IDENTITY_LOCAL_REQUEST_RESET_ROUTE}`;
