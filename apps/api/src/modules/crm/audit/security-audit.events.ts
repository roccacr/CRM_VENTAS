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

/** Evento registrado cuando una sesion backend se revoca por logout. */
export const LOGOUT_REQUESTED_EVENT = {
    eventType: "logout",
    reason: "logout_requested",
    summary: "Sesion de identidad cerrada.",
} as const;
