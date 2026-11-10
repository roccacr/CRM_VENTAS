import type { LoggerOptions } from "pino";

/**
 * Rutas que Pino borra antes de escribir. Vive fuera del modulo para probarla
 * sin arrancar la aplicacion.
 *
 * Cubre el header de autorizacion, la cookie de sesion, el CSRF, `Set-Cookie`,
 * el query completo y los campos de clave, reset y tokens. El query se redacta
 * entero porque un codigo OIDC o un token de reset viajan ahi, no solo en el cuerpo.
 */
export const APP_LOG_REDACT_PATHS = ["req.headers.authorization", "req.headers.cookie", "req.headers.x-crm-csrf-token", "res.headers.set-cookie", "req.query", "req.body.password", "req.body.newPassword", "req.body.resetToken", "password", "newPassword", "resetToken", "sessionToken", "refreshToken"];

/**
 * Request que si puede quedar en el log. Lista los campos a mano: devolver el
 * objeto original arrastraria la URL cruda, el cuerpo y referencias que la
 * censura por ruta no alcanza.
 *
 * De `url` solo queda el path. Query y fragmento se cortan: el callback OIDC
 * lleva el codigo de autorizacion en el query.
 */
export function APP_LOG_REQUEST_SERIALIZER(request: Record<string, unknown>): Record<string, unknown> {
    // Los campos explicitos evitan que una referencia al request original se salte la censura.
    return {
        id: request.id,
        method: request.method,
        url: typeof request.url === "string" ? request.url.split(/[?#]/, 1)[0] : undefined,
        headers: request.headers,
        remoteAddress: request.remoteAddress,
        remotePort: request.remotePort,
        query: request.query === undefined ? undefined : "[REDACTED]",
    };
}

/**
 * Presentacion del log segun el entorno. Produccion conserva el JSON compacto y
 * el serializer de arriba. Desarrollo indenta despues de serializar y censurar;
 * el hook no ve el request crudo. Ahi tambien se omiten los headers, para que
 * la consola local no imprima cookies.
 */
export function appLogPresentation(environment: string | undefined): Pick<LoggerOptions, "serializers" | "hooks"> {
    if (environment !== "development") return { serializers: { req: APP_LOG_REQUEST_SERIALIZER } };
    return {
        serializers: {
            req: (request: Record<string, unknown>) => {
                const { id, method, url } = APP_LOG_REQUEST_SERIALIZER(request);
                return { id, method, url };
            },
            res: (response: Record<string, unknown>) => ({ statusCode: response.statusCode }),
        },
        hooks: {
            // Pino llama esto despues de serializar y censurar. No se formatea el request ni un snapshot crudo.
            streamWrite: (line: string) => {
                try {
                    const entry: unknown = JSON.parse(line);
                    return `${JSON.stringify(entry, null, 2)}\n`;
                } catch {
                    return line;
                }
            },
        },
    };
}
