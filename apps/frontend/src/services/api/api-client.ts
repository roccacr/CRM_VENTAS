/**
 * Cliente HTTP del BFF.
 *
 * Envía la cookie de sesión y el token CSRF solo en métodos que cambian estado.
 * Un 401 o un conflicto de sesion obsoleta renueva la sesión una sola vez. El cliente no lee ni guarda
 * access tokens, refresh tokens ni secretos de Microsoft.
 */
import { buildApiUrl } from "../../config/frontend-env";

const CSRF_HEADER_NAME = "X-CRM-CSRF-Token";
const JSON_CONTENT_TYPE = "application/json";
const STALE_PERMISSION_SESSION_MESSAGE = "La sesion requiere revalidacion de permisos.";
const IDENTITY_SESSION_PATH = "/identity/session";
const IDENTITY_REFRESH_PATH = "/identity/refresh";
const IDENTITY_LOGOUT_PATH = "/identity/logout";
const IDENTITY_CONTEXT_CHANGE_PATHS = new Set([IDENTITY_LOGOUT_PATH, "/identity/local/login", "/identity/microsoft/start"]);
const IDENTITY_GENERATION_BOUND_PATHS = new Set(["/identity/me", IDENTITY_REFRESH_PATH]);
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

/** Opciones de una petición al API; las cookies de sesión y la protección CSRF las gestiona el cliente. */
export interface ApiRequestOptions {
    readonly body?: unknown;
    /** Cancela la espera y evita despachar una mutación después de cerrar su formulario. No revierte cambios ya recibidos por el servidor. */
    readonly signal?: AbortSignal;
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

/** Una sola renovacion en vuelo por generacion; logout/login no heredan promesas antiguas. */
let refreshFlight: { readonly generation: number; readonly promise: Promise<void> } | null = null;
/** Token CSRF en memoria. No se persiste: se vuelve a leer de la sesión del BFF. */
let csrfToken: string | null = null;
let sessionGeneration = 0;
const sessionRefreshListeners = new Set<(outcome: "refreshed" | "rejected") => void>();

/** Invalida perfiles visibles tras una renovacion compartida, sin exponer datos de sesion. */
export const subscribeToSessionRefresh = (listener: (outcome: "refreshed" | "rejected") => void): (() => void) => {
    sessionRefreshListeners.add(listener);
    return () => {
        sessionRefreshListeners.delete(listener);
    };
};

/** POST, PUT, PATCH y DELETE exigen CSRF. GET no cambia estado. */
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

/** Un conflicto de negocio no refresca la sesión ni repite una mutación. */
const readConflictMessage = (body: unknown): string | null => {
    if (!body || typeof body !== "object" || !("message" in body)) return null;
    return typeof body.message === "string" && body.message.trim().length > 0 ? body.message : null;
};

/** Un conflicto de negocio y una petición marcada para no reintentar no repiten una mutación. */
const shouldRenewSession = (error: unknown, path: string, options: ApiRequestOptions): boolean => {
    if (!(error instanceof ApiClientError) || options.retryOnUnauthorized === false || path === IDENTITY_REFRESH_PATH) return false;
    return error.status === 401 || (error.status === 409 && readConflictMessage(error.responseBody) === STALE_PERMISSION_SESSION_MESSAGE);
};

/** Perfiles y refresh obsoletos no pueden publicar autorizacion ni rotar el CSRF en memoria. */
const assertCurrentIdentityResponse = (path: string, generation: number): void => {
    if (IDENTITY_GENERATION_BOUND_PATHS.has(path) && generation !== sessionGeneration) {
        throw new ApiClientError("La respuesta fue invalidada por un cambio de sesion.", 409, null);
    }
};

/** Acepta solo un `csrfToken` string no vacío. Un cuerpo sin ese campo no inventa uno. */
const readCsrfTokenFromBody = (body: unknown): string | null => {
    if (!body || typeof body !== "object" || !("csrfToken" in body)) {
        return null;
    }

    const nextCsrfToken = (body as { readonly csrfToken?: unknown }).csrfToken;
    return typeof nextCsrfToken === "string" && nextCsrfToken.length > 0 ? nextCsrfToken : null;
};

/** Actualiza el token en memoria cuando el BFF lo rota en una respuesta JSON. */
const rememberCsrfTokenFromBody = (body: unknown): void => {
    const nextCsrfToken = readCsrfTokenFromBody(body);

    if (nextCsrfToken) {
        csrfToken = nextCsrfToken;
    }
};

/** Tras logout el token deja de servir. La siguiente mutación tendrá que pedir sesión de nuevo. */
const clearCsrfToken = (): void => {
    csrfToken = null;
};

/** Pide `/identity/session` solo para obtener el CSRF. No abre el shell ni guarda la sesión en estado de React. */
const fetchIdentitySessionForCsrf = async (): Promise<void> => {
    const generation = sessionGeneration;
    const response = await fetch(buildApiUrl(IDENTITY_SESSION_PATH), {
        cache: "no-store",
        credentials: "include",
        method: "GET",
    });
    const responseBody = await parseResponseBody(response);

    // Un preflight anterior no reemplaza la prueba de un login más nuevo.
    assertCurrentIdentityResponse(IDENTITY_REFRESH_PATH, generation);

    if (!response.ok) {
        throw new ApiClientError((response.status === 409 ? readConflictMessage(responseBody) : null) ?? `Request BFF falló con estado ${String(response.status)}.`, response.status, responseBody);
    }

    rememberCsrfTokenFromBody(responseBody);
};

/**
 * Garantiza CSRF antes de una mutación.
 *
 * No lo pide si el método es de lectura, si ya hay token, o si la propia
 * llamada es la de sesión: esa respuesta es la que lo entrega.
 */
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

/** Una cancelación durante esperas previas impide despachar o reintentar la operación. */
const assertRequestNotAborted = (signal: AbortSignal | undefined): void => {
    signal?.throwIfAborted();
};

/**
 * Ejecuta una llamada sin reintentar.
 *
 * `credentials: "include"` manda la cookie de sesión. `cache: "no-store"` evita
 * que una respuesta vieja parezca una sesión vigente.
 */
const executeApiRequest = async <TResponse>(path: string, options: ApiRequestOptions): Promise<TResponse> => {
    assertRequestNotAborted(options.signal);
    const generation = sessionGeneration;
    const method = options.method ?? "GET";
    await ensureCsrfTokenForMutableRequest(method, path);
    // El preflight CSRF puede resolver después de que se cierre la edición.
    assertRequestNotAborted(options.signal);

    const requestInit: RequestInit = {
        cache: "no-store",
        credentials: "include",
        ...(options.signal ? { signal: options.signal } : {}),
        headers: createRequestHeaders(method, options),
        method,
    };

    if (options.body !== undefined) {
        requestInit.body = JSON.stringify(options.body);
    }

    const response = await fetch(buildApiUrl(path), requestInit);
    const responseBody = await parseResponseBody(response);

    assertCurrentIdentityResponse(path, generation);

    if (!response.ok) {
        throw new ApiClientError((response.status === 409 ? readConflictMessage(responseBody) : null) ?? `Request BFF falló con estado ${String(response.status)}.`, response.status, responseBody);
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
 * Si CSRF rechaza el refresh, relee la prueba y lo intenta una sola vez.
 * Las cookies pueden haber vencido o rotado en otra pestana. Si falla, la promesa compartida se limpia
 * y cada llamada original sigue con su error.
 */
export const refreshAuthenticatedSession = async (): Promise<void> => {
    if (!refreshFlight || refreshFlight.generation !== sessionGeneration) {
        const generation = sessionGeneration;
        const promise = executeApiRequest<unknown>(IDENTITY_REFRESH_PATH, { method: "POST", retryOnUnauthorized: false })
            .catch(async (error: unknown) => {
                if (!(error instanceof ApiClientError) || error.status !== 403) throw error;
                assertCurrentIdentityResponse(IDENTITY_REFRESH_PATH, generation);
                await fetchIdentitySessionForCsrf();
                assertCurrentIdentityResponse(IDENTITY_REFRESH_PATH, generation);
                return executeApiRequest<unknown>(IDENTITY_REFRESH_PATH, {
                    method: "POST",
                    retryOnUnauthorized: false,
                });
            })
            .then(() => {
                assertCurrentIdentityResponse(IDENTITY_REFRESH_PATH, generation);
                sessionGeneration += 1;
                sessionRefreshListeners.forEach((listener) => {
                    listener("refreshed");
                });
            })
            .catch((error: unknown) => {
                if (generation === sessionGeneration && error instanceof ApiClientError && error.status === 401) {
                    sessionGeneration += 1;
                    sessionRefreshListeners.forEach((listener) => {
                        listener("rejected");
                    });
                }
                throw error;
            })
            .finally(() => {
                if (refreshFlight?.promise === promise) refreshFlight = null;
            });
        refreshFlight = { generation, promise };
    }

    return refreshFlight.promise;
};

/** Solo una lectura idempotente puede recuperarse de un fallo temporal de una dependencia. */
const canRetryUnavailableRead = (error: unknown, options: ApiRequestOptions): boolean => (options.method ?? "GET") === "GET" && error instanceof ApiClientError && error.status === 503;

/**
 * Llamada al BFF con un reintento acotado de lectura 503 o tras sesion vencida u obsoleta.
 *
 * No renueva si el error vino del propio refresh, si el caller lo apagó, o si
 * el estado no corresponde a autenticacion/sesion. El segundo intento ya no
 * puede volver a disparar refresh.
 */
export const apiRequest = async <TResponse>(path: string, options: ApiRequestOptions = {}): Promise<TResponse> => {
    assertRequestNotAborted(options.signal);
    if (IDENTITY_CONTEXT_CHANGE_PATHS.has(path)) sessionGeneration += 1;
    const generation = sessionGeneration;
    try {
        return await executeApiRequest<TResponse>(path, options);
    } catch (error) {
        assertRequestNotAborted(options.signal);
        // No se renueva ni se repite una operación de un contexto autenticado anterior.
        if (generation !== sessionGeneration) throw error;
        // Solo las lecturas seguras recuperan un fallo temporal de dependencia. Una escritura incierta conserva su clave de operación.
        if (canRetryUnavailableRead(error, options)) {
            await new Promise<void>((resolve) => setTimeout(resolve, 500));
            if (generation !== sessionGeneration) throw error;
            return executeApiRequest<TResponse>(path, options);
        }
        if (!shouldRenewSession(error, path, options)) throw error;

        await refreshAuthenticatedSession();
        return executeApiRequest<TResponse>(path, {
            ...options,
            retryOnUnauthorized: false,
        });
    }
};

/** Entrega solo la prueba CSRF que ya está en memoria. Una respuesta vieja de otra cuenta no autoriza un socket. */
export const getAuthenticatedCsrfToken = async (): Promise<string> => {
    const generation = sessionGeneration;
    if (refreshFlight?.generation === generation) await refreshFlight.promise;
    const currentGeneration = sessionGeneration;
    await fetchIdentitySessionForCsrf();
    assertCurrentIdentityResponse(IDENTITY_REFRESH_PATH, currentGeneration);
    if (!csrfToken) throw new ApiClientError("No se pudo comprobar la sesion.", 403, null);
    return csrfToken;
};
