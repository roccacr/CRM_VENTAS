/**
 * Campos sensibles que Pino debe censurar antes de escribir logs.
 *
 * Esta lista vive fuera de `AppModule` para poder probarla sin ejecutar el
 * bootstrap de configuracion. Debe cubrir cookies, headers y cuerpos que
 * transportan secretos o tokens de identidad.
 */
export const APP_LOG_REDACT_PATHS = ["req.headers.authorization", "req.headers.cookie", "req.headers.x-crm-csrf-token", "res.headers.set-cookie", "req.body.password", "req.body.newPassword", "req.body.resetToken", "password", "newPassword", "resetToken", "sessionToken", "refreshToken"];
