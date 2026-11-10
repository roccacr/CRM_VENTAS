/**
 * Literales del contrato HTTP/BFF. Bootstrap, guards, controladores y pruebas
 * importan estos nombres. Repetir el string en un consumidor hace que CORS,
 * CSRF, cookies y OpenAPI puedan divergir sin que el tipo lo note.
 */

/** 180 dias. Helmet y la documentacion tienen que usar la misma ventana. */
export const HSTS_MAX_AGE_SECONDS = 15_552_000;

/**
 * Cookies del BFF. El frontend no lee sesion, refresh ni tokens de Microsoft.
 * `crm_csrf` tambien es HttpOnly: el BFF devuelve el valor vigente en JSON y el
 * cliente lo repite por header. La cookie sola no alcanza para mutar.
 */
export const SESSION_COOKIE_NAME = "crm_session";
export const REFRESH_COOKIE_NAME = "crm_refresh";
export const CSRF_COOKIE_NAME = "crm_csrf";
export const MICROSOFT_OIDC_CHALLENGE_COOKIE_NAME = "crm_ms_oidc";

/**
 * Path de las cookies que cubren todo el BFF. El refresh no usa este path: el
 * suyo se declara junto a la ruta que puede presentarlo.
 */
export const ROOT_COOKIE_PATH = "/";

/**
 * Identidad no se cachea. La respuesta lleva sesion, correo, roles, areas y
 * permisos efectivos; un proxy o el navegador no pueden reutilizarla.
 */
export const IDENTITY_CACHE_CONTROL_HEADER = "Cache-Control";
export const IDENTITY_NO_STORE_CACHE_CONTROL = "no-store";

/**
 * Header CSRF canonico y su forma en minusculas. Fastify y algunos proxies
 * entregan el nombre ya normalizado; aceptar solo una grafia romperia el
 * double-submit sin cambiar el secreto.
 */
export const CSRF_HEADER_NAME = "X-CRM-CSRF-Token";
export const CSRF_HEADER_NAME_LOWERCASE = CSRF_HEADER_NAME.toLowerCase();
export const CSRF_TOKEN_BYTES = 32;

/**
 * Longitud base64url sin padding. `Buffer.toString("base64url")` omite `=`,
 * asi que el regex tiene que medir los caracteres utiles, no el bloque con relleno.
 */
const calculateBase64UrlLength = (byteLength: number): number => Math.ceil((byteLength * 4) / 3);

export const CSRF_TOKEN_BASE64URL_LENGTH = calculateBase64UrlLength(CSRF_TOKEN_BYTES);
export const CSRF_TOKEN_SIGNATURE_LENGTH = calculateBase64UrlLength(32);
export const CSRF_TOKEN_SEPARATOR = ".";
export const CSRF_TOKEN_FORMAT = new RegExp(`^[A-Za-z0-9_-]{${CSRF_TOKEN_BASE64URL_LENGTH.toString()}}\\${CSRF_TOKEN_SEPARATOR}[A-Za-z0-9_-]{${CSRF_TOKEN_SIGNATURE_LENGTH.toString()}}$`);

/** Forma exacta que emite el BFF. Una firma de otra longitud ni siquiera llega a `timingSafeEqual`. */
export const isValidCsrfTokenFormat = (token: string): boolean => CSRF_TOKEN_FORMAT.test(token);

/** Metodos y headers que el BFF admite. `credentials` se activa en el bootstrap, no aqui. */
export const CORS_ALLOWED_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"];
export const CORS_ALLOWED_HEADERS = ["Content-Type", CSRF_HEADER_NAME, CSRF_HEADER_NAME_LOWERCASE];

/**
 * OpenAPI publicado solo para identidad. El contrato sale del bootstrap; un
 * controlador comercial no debe volver a declarar estas rutas ni este titulo.
 */
export const OPENAPI_DOC_PATH = "openapi/identity";
export const OPENAPI_TITLE = "Habita Identity API";
export const OPENAPI_DESCRIPTION = "Contrato minimo de identidad del runtime BFF.";
export const OPENAPI_VERSION = "1.0.0";
export const OPENAPI_TAG = "identity";
