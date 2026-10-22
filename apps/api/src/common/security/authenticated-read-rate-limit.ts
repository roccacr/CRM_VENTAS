import { Inject, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

type ReadLimiter = ReturnType<FastifyInstance["createRateLimit"]>;
type ReadLimiterPair = { byUser: ReadLimiter; byIp: ReadLimiter };

/**
 * S09 process-local quotas. S10 distributed enforcement remains pending.
 * The auth guard supplies a verified user ID only for protected GET/HEAD routes.
 */
@Injectable()
export class AuthenticatedReadRateLimit {
    private readonly limiters = new WeakMap<FastifyInstance, ReadLimiterPair>();
    private readonly verifiedUsers = new WeakMap<FastifyRequest, string>();

    /** Uses validated runtime limits without registering or changing the Fastify plugin. */
    constructor(@Inject(ConfigService) private readonly config: ConfigService) {}

    /** Returns false after sending 429; authentication/authorization must remain in the caller. */
    async enforceAuthenticatedReadLimit(request: FastifyRequest, reply: FastifyReply, verifiedUserPublicId: string): Promise<boolean> {
        const pair = this.limiters.get(request.server) ?? this.createLimiters(request.server);
        this.verifiedUsers.set(request, verifiedUserPublicId);
        try {
            // Increment both counters, including requests blocked by the other quota.
            const user = await pair.byUser(request);
            const ip = await pair.byIp(request);
            const userRetry = !user.isAllowed && user.isExceeded ? Math.max(1, user.ttlInSeconds) : 0;
            const ipRetry = !ip.isAllowed && ip.isExceeded ? Math.max(1, ip.ttlInSeconds) : 0;
            if (userRetry === 0 && ipRetry === 0) return true;
            reply
                .header("Retry-After", Math.max(1, userRetry, ipRetry))
                .code(429)
                .send({
                    statusCode: 429,
                    error: "Too Many Requests",
                    message: "Demasiadas consultas. Intente mas tarde.",
                });
            return false;
        } finally {
            this.verifiedUsers.delete(request);
        }
    }

    private createLimiters(server: FastifyInstance): ReadLimiterPair {
        // createRateLimit inherits the already registered plugin; never register it twice.
        // Explicit cache applies to each child store, independently of identity limits.
        const options = { cache: this.config.getOrThrow<number>("AUTH_READ_CACHE"), timeWindow: this.config.getOrThrow<number>("AUTH_READ_WINDOW_MS"), skipOnError: false };
        const pair = {
            byUser: server.createRateLimit({
                ...options,
                max: this.config.getOrThrow<number>("AUTH_READ_USER_MAX"),
                keyGenerator: (request) => `authenticated-read:user:${this.verifiedUsers.get(request) ?? ""}`,
            }),
            byIp: server.createRateLimit({
                ...options,
                max: this.config.getOrThrow<number>("AUTH_READ_IP_MAX"),
                keyGenerator: (request) => `authenticated-read:ip:${request.ip}`,
            }),
        };
        this.limiters.set(server, pair);
        return pair;
    }
}
