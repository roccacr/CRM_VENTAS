import type { FastifyRequest } from "fastify";

/**
 * Request con las cookies que parsea `@fastify/cookie`.
 *
 * Guards y controladores comparten este tipo para no divergir sobre el mismo
 * contrato. La cookie ausente es `undefined`: no se sustituye por una cadena
 * vacia, que podria parecer un token presentado.
 */
export type CookieRequest = FastifyRequest & {
    cookies: Record<string, string | undefined>;
};
