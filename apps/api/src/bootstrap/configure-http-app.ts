import cookie from "@fastify/cookie";
import helmet from "@fastify/helmet";
import { ValidationPipe } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { NestFastifyApplication } from "@nestjs/platform-fastify";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";

import { CORS_ALLOWED_HEADERS, CORS_ALLOWED_METHODS, HSTS_MAX_AGE_SECONDS, IDENTITY_CACHE_CONTROL_HEADER, IDENTITY_NO_STORE_CACHE_CONTROL, OPENAPI_DESCRIPTION, OPENAPI_DOC_PATH, OPENAPI_TAG, OPENAPI_TITLE, OPENAPI_VERSION, SESSION_COOKIE_NAME } from "../common/security/http-security.constants.js";
import { registerIdentityRateLimit } from "../modules/crm/identity/identity-rate-limit.js";
import { IDENTITY_CONTROLLER_PATH } from "../modules/crm/identity/identity-route.constants.js";

// ============================================================================
// Bootstrap HTTP de la app API (NestJS + Fastify).
//
// Este archivo debe mantenerse como composicion/orquestacion. No debe crecer
// como un bloque gigante con cookies, Helmet, rate limit, CORS, validacion y
// Swagger mezclados. Cada concern vive en una funcion de responsabilidad unica
// y `configureHttpApp` conserva el contrato publico usado por `main.ts` y por
// las pruebas e2e.
// ============================================================================

interface HttpSecurityConfig {
    auditHashSecret: string;
    cookieSecret: string;
    frontendOrigin: string;
}

const IDENTITY_PATH_PREFIX = `/${IDENTITY_CONTROLLER_PATH}`;
const IDENTITY_PATH_PREFIX_WITH_SLASH = `${IDENTITY_PATH_PREFIX}/`;

/**
 * Decodifica el path sin permitir que una URL malformada rompa el hook.
 */
const safelyDecodeRequestPath = (path: string): string => {
    try {
        return decodeURIComponent(path);
    } catch {
        return path;
    }
};

/**
 * Lee el path resuelto por Fastify cuando existe, o el path crudo decodificado
 * para cubrir 404 y URLs con caracteres `%XX`.
 */
const readNoStoreRequestPath = (requestUrl: string, resolvedRouteUrl: string | undefined): string => {
    if (resolvedRouteUrl) {
        return resolvedRouteUrl;
    }

    const rawPath = requestUrl.split("?")[0] ?? requestUrl;
    return safelyDecodeRequestPath(rawPath);
};

/**
 * Lee la configuracion critica del hardening HTTP.
 *
 * Regla de seguridad:
 * - `AUDIT_HASH_SECRET` no puede faltar porque auditoria y rate limit de
 *   identidad dependen de HMAC sin PII cruda.
 * - `COOKIE_SECRET` no puede caer a string vacio porque firmaria cookies con
 *   un secreto trivial.
 * - `FRONTEND_ORIGIN` no puede caer a string vacio porque CORS con
 *   credenciales necesita un origen explicito y auditable.
 *
 * Por eso este runtime falla rapido durante bootstrap si falta cualquiera de
 * estas variables. Es mejor no levantar que operar con seguridad ambigua.
 */
const readHttpSecurityConfig = (config: ConfigService): HttpSecurityConfig => {
    const auditHashSecret = config.get<string>("AUDIT_HASH_SECRET");
    const cookieSecret = config.get<string>("COOKIE_SECRET");
    const frontendOrigin = config.get<string>("FRONTEND_ORIGIN");

    if (!auditHashSecret) {
        throw new Error("AUDIT_HASH_SECRET es obligatorio para hashear identificadores sensibles de auditoria y rate limit.");
    }

    if (!cookieSecret) {
        throw new Error("COOKIE_SECRET es obligatorio para firmar cookies de sesion CRM.");
    }

    if (!frontendOrigin) {
        throw new Error("FRONTEND_ORIGIN es obligatorio para configurar CORS con credenciales.");
    }

    return { auditHashSecret, cookieSecret, frontendOrigin };
};

/**
 * Registra soporte de cookies firmadas en Fastify.
 *
 * Responsabilidad unica:
 * - habilita parseo/firma de cookies;
 * - no decide nombres de cookies;
 * - no decide expiraciones;
 * - no decide politica de sesion.
 *
 * Esa separacion evita que el bootstrap HTTP termine mezclado con reglas de
 * identidad. La politica BFF vive en identidad y en constantes compartidas.
 */
const registerCookieSupport = async (app: NestFastifyApplication, cookieSecret: string): Promise<void> => {
    await app.register(cookie, { secret: cookieSecret });
};

/**
 * Aplica cabeceras HTTP de seguridad con Helmet.
 *
 * Las directivas son deliberadamente restrictivas: este API no debe ser
 * embebido en iframes, no necesita plugins legacy y no debe cargar recursos
 * externos para funcionar. Si un futuro endpoint necesita una excepcion, debe
 * justificarse en arquitectura antes de abrir la politica.
 */
const registerSecurityHeaders = async (app: NestFastifyApplication): Promise<void> => {
    await app.register(helmet, {
        contentSecurityPolicy: {
            directives: {
                defaultSrc: ["'self'"], // Recursos por defecto solo desde el propio origen.
                baseUri: ["'self'"], // Evita que un XSS cambie la base de URLs relativas.
                frameAncestors: ["'none'"], // Bloquea clickjacking por embedding en iframe.
                objectSrc: ["'none'"], // Bloquea vectores legacy tipo object/embed.
            },
        },
        frameguard: {
            action: "deny", // Refuerzo para navegadores que no respeten frame-ancestors.
        },
        hsts: {
            maxAge: HSTS_MAX_AGE_SECONDS, // Ventana centralizada en constantes.
            includeSubDomains: true, // Evita downgrade HTTP en subdominios.
        },
    });
};

/**
 * Marca todas las respuestas `/identity/*` como no cacheables desde el primer
 * hook HTTP.
 *
 * Debe vivir en Fastify `onRequest`, no en un interceptor de controller:
 * guards, rate-limit y 404 pueden responder antes de que Nest llegue al
 * controller. La politica protege sesion/correo/permisos incluso cuando la
 * respuesta sea un error temprano.
 */
const registerIdentityNoStoreHeader = (app: NestFastifyApplication): void => {
    const fastify = app.getHttpAdapter().getInstance();

    fastify.addHook("onRequest", async (request, reply) => {
        const requestPath = readNoStoreRequestPath(request.url, request.routeOptions.url);

        if (requestPath === IDENTITY_PATH_PREFIX || requestPath.startsWith(IDENTITY_PATH_PREFIX_WITH_SLASH)) {
            reply.header(IDENTITY_CACHE_CONTROL_HEADER, IDENTITY_NO_STORE_CACHE_CONTROL);
        }
    });
};

/**
 * Configura CORS para el frontend autorizado.
 *
 * Como el BFF usa cookies, `credentials: true` es obligatorio. Eso vuelve
 * prohibido usar wildcard (`*`) y obliga a tomar el origin desde configuracion
 * validada por `readHttpSecurityConfig`.
 */
const configureCors = (app: NestFastifyApplication, frontendOrigin: string): void => {
    app.enableCors({
        origin: frontendOrigin, // Unico frontend autorizado para enviar cookies.
        credentials: true, // Requerido para BFF con cookies HttpOnly.
        methods: CORS_ALLOWED_METHODS,
        allowedHeaders: CORS_ALLOWED_HEADERS, // Incluye CSRF header en casing canonico y lowercase.
    });
};

/**
 * Activa validacion global de DTOs.
 *
 * Reglas:
 * - `whitelist` elimina propiedades que no existen en DTOs.
 * - `forbidNonWhitelisted` falla con 400 en vez de ignorar payload sospechoso.
 * - `transform` permite que Nest convierta primitivas antes de llegar al
 *   controller.
 *
 * Esta funcion existe para que ningun controller tenga que repetir pipes.
 */
const registerGlobalValidation = (app: NestFastifyApplication): void => {
    app.useGlobalPipes(
        new ValidationPipe({
            whitelist: true,
            forbidNonWhitelisted: true,
            transform: true,
        }),
    );
};

/**
 * Publica Swagger/OpenAPI solo para el contrato minimo de identidad.
 *
 * La ley actual permite OpenAPI de identidad, no OpenAPI comercial. Por eso
 * titulo, version, tag y ruta viven como constantes explicitas. El flag
 * `OPENAPI_ENABLED` permite apagar la exposicion del contrato sin tocar codigo.
 */
const registerOpenApiDocs = (app: NestFastifyApplication, config: ConfigService): void => {
    if (config.get<boolean>("OPENAPI_ENABLED") !== true) {
        return;
    }

    const openApiConfig = new DocumentBuilder().setTitle(OPENAPI_TITLE).setDescription(OPENAPI_DESCRIPTION).setVersion(OPENAPI_VERSION).addTag(OPENAPI_TAG).addCookieAuth(SESSION_COOKIE_NAME).build();

    const document = SwaggerModule.createDocument(app, openApiConfig);
    SwaggerModule.setup(OPENAPI_DOC_PATH, app, document);
};

/**
 * Punto unico de configuracion HTTP de la app.
 *
 * Orden intencional:
 * 1. Leer config critica y fallar rapido si falta.
 * 2. Registrar cookies antes de que identidad dependa de ellas.
 * 3. Aplicar cabeceras de seguridad.
 * 4. Aplicar no-store a `/identity/*` antes de guards/rate-limit/404.
 * 5. Aplicar rate limit de identidad antes de rutas sensibles.
 * 6. Restringir CORS al frontend aprobado.
 * 7. Activar validacion global.
 * 8. Publicar OpenAPI de identidad si esta habilitado.
 *
 * La funcion publica solo orquesta. Si aparece un nuevo concern, debe entrar
 * como modulo/funcion enfocada, no como logica inline mezclada.
 */
export const configureHttpApp = async (app: NestFastifyApplication): Promise<void> => {
    const config = app.get(ConfigService);
    const { auditHashSecret, cookieSecret, frontendOrigin } = readHttpSecurityConfig(config);

    await registerCookieSupport(app, cookieSecret);
    await registerSecurityHeaders(app);
    registerIdentityNoStoreHeader(app);
    await registerIdentityRateLimit(app, config, auditHashSecret);
    configureCors(app, frontendOrigin);
    registerGlobalValidation(app);
    registerOpenApiDocs(app, config);
};
