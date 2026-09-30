/**
 * Origen local solo para `vite dev` y pruebas.
 *
 * Producción no usa este valor: sin `VITE_API_ORIGIN` el arranque falla.
 */
const DEFAULT_DEVELOPMENT_API_ORIGIN = "http://localhost:3000";
const LOCAL_DEVELOPMENT_CANONICAL_HOSTNAME = "localhost";
const LOCAL_DEVELOPMENT_HOST_ALIASES = new Set(["127.0.0.1"]);

/**
 * Acepta solo un origin.
 *
 * Un path, query o hash apuntaría a otra ruta del BFF sin que el resto del
 * cliente lo note. La barra final se ignora para no rechazar un origin válido.
 */
const normalizeOrigin = (value: string): string => {
    const parsedUrl = new URL(value);

    if (parsedUrl.origin !== value.replace(/\/$/u, "")) {
        throw new Error("VITE_API_ORIGIN debe ser un origin puro, sin path, query ni hash.");
    }

    return parsedUrl.origin;
};

/**
 * Resuelve el origin del BFF al cargar el módulo.
 *
 * Fuera de desarrollo y test no hay valor por defecto: un build sin origin
 * no debe llamar a localhost en silencio.
 */
const resolveApiOrigin = (): string => {
    const configuredOrigin = import.meta.env.VITE_API_ORIGIN?.trim();

    if (configuredOrigin) {
        return normalizeOrigin(configuredOrigin);
    }

    if (import.meta.env.DEV || import.meta.env.MODE === "test") {
        return DEFAULT_DEVELOPMENT_API_ORIGIN;
    }

    throw new Error("VITE_API_ORIGIN es obligatorio para conectar el frontend con el BFF de identidad.");
};

/** Origin ya validado. Se calcula una vez para que todas las llamadas usen el mismo BFF. */
export const API_ORIGIN = resolveApiOrigin();

/** Une origin y path con una sola barra, aunque el path llegue sin ella. */
export const buildApiUrl = (path: string): string => `${API_ORIGIN}${path.startsWith("/") ? path : `/${path}`}`;

/**
 * En desarrollo, OAuth y cookies deben usar el mismo host canonico.
 *
 * `127.0.0.1` y `localhost` son origenes distintos para CORS, cookies y
 * postMessage; Microsoft y el API local estan configurados contra localhost.
 */
export const getCanonicalLocalDevelopmentUrl = (currentHref: string, isDevelopment = import.meta.env.DEV): string | null => {
    if (!isDevelopment) {
        return null;
    }

    const currentUrl = new URL(currentHref);

    if (!LOCAL_DEVELOPMENT_HOST_ALIASES.has(currentUrl.hostname)) {
        return null;
    }

    currentUrl.hostname = LOCAL_DEVELOPMENT_CANONICAL_HOSTNAME;

    return currentUrl.toString();
};
