// ============================================================================
// Politica HTTP/BFF compartida por bootstrap, guards, controllers y pruebas.
//
// Estos literales son parte del contrato de seguridad de identidad. Se
// centralizan para evitar drift entre CORS, CSRF, cookies y OpenAPI.
//
// Regla del proyecto:
// si un valor se usa en mas de un archivo, no debe repetirse como magic string.
// Se declara aqui con nombre de negocio/seguridad y se importa desde los
// consumidores.
// ============================================================================

// 180 dias. Mantenerlo centralizado evita que Helmet y documentacion terminen
// usando ventanas distintas.
export const HSTS_MAX_AGE_SECONDS = 15_552_000;

// Cookies BFF. El frontend nunca lee tokens; solo interactua con el backend.
// `crm_csrf` no es HttpOnly porque el navegador debe enviarlo tambien por
// header en el patron double-submit.
export const SESSION_COOKIE_NAME = "crm_session";
export const REFRESH_COOKIE_NAME = "crm_refresh";
export const CSRF_COOKIE_NAME = "crm_csrf";

// Path raiz usado solo por cookies que deben aplicar a todo el BFF de identidad.
// La cookie de refresh usa un path restringido declarado junto a su ruta HTTP.
export const ROOT_COOKIE_PATH = "/";

// Respuestas de identidad no deben quedar cacheadas por navegador o proxy
// porque contienen sesion, correo, roles, areas y permisos efectivos.
export const IDENTITY_CACHE_CONTROL_HEADER = "Cache-Control";
export const IDENTITY_NO_STORE_CACHE_CONTROL = "no-store";

// Header canonico CSRF y variante lowercase. Algunos servidores/proxies
// normalizan headers a lowercase; derivarlo evita repetir literales.
export const CSRF_HEADER_NAME = "X-CRM-CSRF-Token";
export const CSRF_HEADER_NAME_LOWERCASE = CSRF_HEADER_NAME.toLowerCase();
export const CSRF_TOKEN_BYTES = 32;

/**
 * Calcula la longitud base64url sin padding para un buffer de N bytes.
 *
 * `Buffer.toString("base64url")` omite `=`, por eso la longitud observable es
 * la cantidad real de caracteres utiles producidos por los bytes aleatorios.
 */
const calculateBase64UrlLength = (byteLength: number): number => Math.ceil((byteLength * 4) / 3);

export const CSRF_TOKEN_BASE64URL_LENGTH = calculateBase64UrlLength(CSRF_TOKEN_BYTES);
export const CSRF_TOKEN_FORMAT = new RegExp(`^[A-Za-z0-9_-]{${CSRF_TOKEN_BASE64URL_LENGTH.toString()}}$`);

/**
 * Valida que un token CSRF tenga el formato que emite el BFF.
 */
export const isValidCsrfTokenFormat = (token: string): boolean => CSRF_TOKEN_FORMAT.test(token);

// CORS del BFF. `credentials: true` se configura en bootstrap; por eso aqui
// solo viven los metodos y headers permitidos.
export const CORS_ALLOWED_METHODS = ["GET", "POST", "OPTIONS"];
export const CORS_ALLOWED_HEADERS = ["Content-Type", CSRF_HEADER_NAME, CSRF_HEADER_NAME_LOWERCASE];

// OpenAPI autorizado solo para identidad. No mover estos valores a controllers:
// el contrato se publica desde bootstrap, no desde un endpoint comercial.
export const OPENAPI_DOC_PATH = "openapi/identity";
export const OPENAPI_TITLE = "CRM TINK Identity API";
export const OPENAPI_DESCRIPTION = "Contrato minimo de identidad del runtime BFF.";
export const OPENAPI_VERSION = "1.0.0";
export const OPENAPI_TAG = "identity";
