import { buildApiUrl } from "../../config/frontend-env";

const CSRF_HEADER_NAME = "X-CRM-CSRF-Token";
const JSON_CONTENT_TYPE = "application/json";
const IDENTITY_SESSION_PATH = "/identity/session";
const IDENTITY_REFRESH_PATH = "/identity/refresh";
const IDENTITY_LOGOUT_PATH = "/identity/logout";
/** Métodos que cambian estado. El BFF exige CSRF en todos ellos. */
const MUTABLE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

/**
 * Error HTTP controlado del BFF.
 */
export class ApiClientError extends Error {
    /**
     * Conserva estado y cuerpo para mapear errores sin exponer detalles al UI.
     */
    constructor(
        message: string,
        readonly status: number,
        readonly responseBody: unknown,
    ) {
        super(message);
        this.name = "ApiClientError";
    }
}

export interface ApiRequestOptions {
    readonly body?: unknown;
    readonly headers?: HeadersInit;
    readonly method?: "DELETE" | "GET" | "PATCH" | "POST" | "PUT";
    /**
     * Permite apagar el reintento tras 401.
     *
     * El refresh y el logout lo dejan en false para no encadenar otra
     * renovación sobre la misma llamada.
     */
    readonly retryOnUnauthorized?: boolean;
}

/** Una sola renovación en vuelo. Las llamadas que reciben 401 esperan esta promesa. */
let refreshPromise: Promise<void> | null = null;
let csrfToken: string | null = null;

const isMutableMethod = (method: string): boolean => MUTABLE_METHODS.has(method.toUpperCase());

/**
 * Lee el cuerpo solo si el BFF respondió JSON.
 *
 * Una página HTML de error no debe tumbar el cliente antes de convertir el
 * estado HTTP en `ApiClientError`.
 */
const parseResponseBody = async (response: Response): Promise<unknown> => {
    const contentType = response.headers.get("content-type") ?? "";

    if (!contentType.toLowerCase().includes(JSON_CONTENT_TYPE)) {
        return null;
    }

    return response.json();
};

const readCsrfTokenFromBody = (body: unknown): string | null => {
    if (!body || typeof body !== "object" || !("csrfToken" in body)) {
        return null;
    }

    const nextCsrfToken = (body as { readonly csrfToken?: unknown }).csrfToken;
    return typeof nextCsrfToken === "string" && nextCsrfToken.length > 0 ? nextCsrfToken : null;
};

const rememberCsrfTokenFromBody = (body: unknown): void => {
    const nextCsrfToken = readCsrfTokenFromBody(body);

    if (nextCsrfToken) {
        csrfToken = nextCsrfToken;
    }
};

const clearCsrfToken = (): void => {
    csrfToken = null;
};

const fetchIdentitySessionForCsrf = async (): Promise<void> => {
    const response = await fetch(buildApiUrl(IDENTITY_SESSION_PATH), {
        cache: "no-store",
        credentials: "include",
        method: "GET",
    });
    const responseBody = await parseResponseBody(response);

    if (!response.ok) {
        throw new ApiClientError(`Request BFF falló con estado ${String(response.status)}.`, response.status, responseBody);
    }

    rememberCsrfTokenFromBody(responseBody);
};

const ensureCsrfTokenForMutableRequest = async (method: string, path: string): Promise<void> => {
    if (!isMutableMethod(method) || csrfToken || path === IDENTITY_SESSION_PATH) {
        return;
    }

    await fetchIdentitySessionForCsrf();
};

/**
 * Arma los headers de una llamada al BFF.
 *
 * El CSRF solo va en métodos mutables y solo si el BFF ya lo entregó por JSON.
 * No se envía un header vacío: el API debe ver la ausencia, no un token inventado.
 */
const createRequestHeaders = (method: string, options: ApiRequestOptions): Headers => {
    const headers = new Headers(options.headers);

    if (options.body !== undefined && !headers.has("Content-Type")) {
        headers.set("Content-Type", JSON_CONTENT_TYPE);
    }

    if (isMutableMethod(method)) {
        if (csrfToken) {
            headers.set(CSRF_HEADER_NAME, csrfToken);
        }
    }

    return headers;
};

/**
 * Ejecuta una llamada sin reintentar.
 *
 * `credentials: "include"` manda la cookie de sesión. `cache: "no-store"` evita
 * que una respuesta vieja parezca una sesión vigente.
 */
const executeApiRequest = async <TResponse>(path: string, options: ApiRequestOptions): Promise<TResponse> => {
    const method = options.method ?? "GET";
    await ensureCsrfTokenForMutableRequest(method, path);

    const requestInit: RequestInit = {
        cache: "no-store",
        credentials: "include",
        headers: createRequestHeaders(method, options),
        method,
    };

    if (options.body !== undefined) {
        requestInit.body = JSON.stringify(options.body);
    }

    const response = await fetch(buildApiUrl(path), requestInit);
    const responseBody = await parseResponseBody(response);

    if (!response.ok) {
        throw new ApiClientError(`Request BFF falló con estado ${String(response.status)}.`, response.status, responseBody);
    }

    rememberCsrfTokenFromBody(responseBody);

    if (path === IDENTITY_LOGOUT_PATH) {
        clearCsrfToken();
    }

    return responseBody as TResponse;
};

/**
 * Renueva la sesión una sola vez aunque varias llamadas reciban 401 juntas.
 *
 * El propio refresh no se reintenta: si falla, la promesa compartida se limpia
 * y cada llamada original sigue con su error.
 */
export const refreshAuthenticatedSession = async (): Promise<void> => {
    if (!refreshPromise) {
        refreshPromise = executeApiRequest<unknown>(IDENTITY_REFRESH_PATH, {
            method: "POST",
            retryOnUnauthorized: false,
        })
            .then(() => undefined)
            .finally(() => {
                refreshPromise = null;
            });
    }

    return refreshPromise;
};

/**
 * Llamada al BFF con un solo reintento tras sesion vencida u obsoleta.
 *
 * No renueva si el error vino del propio refresh, si el caller lo apagó, o si
 * el estado no corresponde a autenticacion/sesion. El segundo intento ya no
 * puede volver a disparar refresh.
 */
export const apiRequest = async <TResponse>(path: string, options: ApiRequestOptions = {}): Promise<TResponse> => {
    try {
        return await executeApiRequest<TResponse>(path, options);
    } catch (error) {
        if (!(error instanceof ApiClientError) || ![401, 409].includes(error.status) || options.retryOnUnauthorized === false || path === IDENTITY_REFRESH_PATH) {
            throw error;
        }

        await refreshAuthenticatedSession();
        return executeApiRequest<TResponse>(path, {
            ...options,
            retryOnUnauthorized: false,
        });
    }
};
