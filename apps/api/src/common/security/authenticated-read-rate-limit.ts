import { Inject, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

type ReadLimiter = ReturnType<FastifyInstance["createRateLimit"]>;
type ReadLimiterPair = { byUser: ReadLimiter; byIp: ReadLimiter };

/**
 * Cupo de lecturas autenticadas, local al proceso. El reparto entre nodos no
 * existe todavia: dos instancias no comparten el conteo.
 *
 * El guard solo llama aqui despues de un perfil verificado, y solo en GET/HEAD.
 * Este servicio no decide quien esta autenticado. La llave de usuario es el
 * `publicId` que le pasan, nunca un campo del cliente.
 */
@Injectable()
export class AuthenticatedReadRateLimit {
    /** Un par de contadores por instancia de Fastify. No registra el plugin otra vez. */
    private readonly limiters = new WeakMap<FastifyInstance, ReadLimiterPair>();
    /**
     * El generador de llave no recibe el id por argumento. Se guarda en el
     * request durante la llamada y se borra en `finally`, tambien si el conteo
     * falla: el objeto no se queda marcado para una peticion posterior.
     */
    private readonly verifiedUsers = new WeakMap<FastifyRequest, string>();

    /** Limites ya validados al arranque. No altera el plugin global de identidad. */
    constructor(@Inject(ConfigService) private readonly config: ConfigService) {}

    /**
     * Incrementa usuario e IP aunque el otro cupo ya haya rechazado. Saltarse
     * el segundo conteo dejaria un canal sin agotar. `false` significa que la
     * respuesta 429 ya se envio; el guard no debe seguir.
     */
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

    /**
     * `createRateLimit` hereda el plugin ya registrado. Un segundo `register`
     * instalaria otra politica encima de la de identidad. `skipOnError: false`
     * niega la lectura si el contador falla, en lugar de dejarla pasar.
     */
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
