import type { LoggerOptions } from "pino";

/**
 * Campos sensibles que Pino debe censurar antes de escribir logs.
 *
 * Esta lista vive fuera de `AppModule` para poder probarla sin ejecutar el
 * bootstrap de configuracion. Debe cubrir cookies, headers y cuerpos que
 * transportan secretos o tokens de identidad.
 */
export const APP_LOG_REDACT_PATHS = ["req.headers.authorization", "req.headers.cookie", "req.headers.x-crm-csrf-token", "res.headers.set-cookie", "req.query", "req.body.password", "req.body.newPassword", "req.body.resetToken", "password", "newPassword", "resetToken", "sessionToken", "refreshToken"];

/** Retains request context but never logs query/fragment values, including OIDC credentials. */
export function APP_LOG_REQUEST_SERIALIZER(request: Record<string, unknown>): Record<string, unknown> {
    // Explicit fields prevent raw/original request references from bypassing sanitization.
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

/** Development console only; production retains compact JSON and existing serializers/redaction. */
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
            // Pino runs this after serialization/redaction; never format raw requests or snapshots.
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
