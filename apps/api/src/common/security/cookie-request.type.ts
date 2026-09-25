import type { FastifyRequest } from "fastify";

/**
 * Request Fastify con cookies parseadas por `@fastify/cookie`.
 *
 * Se comparte entre controller y guards para evitar tipos locales divergentes
 * alrededor del mismo contrato HTTP.
 */
export type CookieRequest = FastifyRequest & {
    cookies: Record<string, string | undefined>;
};
