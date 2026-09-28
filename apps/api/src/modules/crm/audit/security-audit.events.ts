// ============================================================================
// Catalogo de eventos de auditoria de seguridad.
//
// Mantener los codigos centralizados evita textos sueltos en servicios y hace
// mas facil auditar cambios futuros de identidad.
// ============================================================================

/** Evento registrado cuando se recibe una solicitud neutral de reset local. */
export const LOCAL_RESET_REQUESTED_EVENT = {
    eventType: "local_reset_requested",
    reason: "local_reset_request",
    summary: "Solicitud neutral de activacion/reset local recibida.",
} as const;

/** Evento registrado cuando un token de reset se consume correctamente. */
export const LOCAL_RESET_COMPLETED_EVENT = {
    eventType: "local_reset_completed",
    reason: "local_password_updated",
    summary: "Clave local actualizada mediante token de activacion/reset.",
} as const;

/** Evento registrado cuando una identidad local queda bloqueada temporalmente. */
export const LOCAL_IDENTITY_LOCKED_EVENT = {
    eventType: "local_identity_locked",
    reason: "local_login_lockout",
    summary: "Identidad local bloqueada temporalmente por intentos fallidos.",
} as const;

/** Evento registrado cuando una sesion backend se revoca por logout. */
export const LOGOUT_REQUESTED_EVENT = {
    eventType: "logout",
    reason: "logout_requested",
    summary: "Sesion de identidad cerrada.",
} as const;

/** Evento registrado cuando falla un login local sin revelar si el correo existe. */
export const LOCAL_LOGIN_FAILED_EVENT = {
    eventType: "local_login_failed",
    reason: "invalid_local_credentials",
    summary: "Intento de login local rechazado.",
} as const;

/** Evento registrado cuando se crea una sesion por login local. */
export const LOCAL_LOGIN_SUCCEEDED_EVENT = {
    eventType: "local_login_succeeded",
    reason: "local_credentials_verified",
    summary: "Sesion creada por login local.",
} as const;

/** Evento registrado cuando se crea una sesion por Microsoft. */
export const MICROSOFT_LOGIN_SUCCEEDED_EVENT = {
    eventType: "microsoft_login_succeeded",
    reason: "microsoft_oidc_verified",
    summary: "Sesion creada por Microsoft OIDC.",
} as const;

/** Evento registrado cuando Microsoft exige login interactivo otra vez. */
export const MICROSOFT_INTERACTION_REQUIRED_EVENT = {
    eventType: "microsoft_interaction_required",
    reason: "microsoft_interaction_required",
    summary: "Microsoft requiere login interactivo; sesiones CRM del proveedor revocadas.",
} as const;

/** Evento registrado cuando refresh rota correctamente una familia de tokens. */
export const REFRESH_ROTATED_EVENT = {
    eventType: "refresh_rotated",
    reason: "refresh_rotation",
    summary: "Refresh token rotado correctamente.",
} as const;

/** Evento registrado cuando se detecta reuso de refresh token. */
export const REFRESH_REUSE_DETECTED_EVENT = {
    eventType: "refresh_reuse_detected",
    reason: "refresh_token_reuse",
    summary: "Reuso de refresh token detectado; sesiones del usuario revocadas.",
} as const;

/** Evento registrado cuando el usuario revoca una sesion propia. */
export const SESSION_REVOKED_EVENT = {
    eventType: "session_revoked",
    reason: "user_session_revoke",
    summary: "Sesion activa revocada por el usuario.",
} as const;
