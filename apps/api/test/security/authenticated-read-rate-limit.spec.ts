import rateLimit from "@fastify/rate-limit";
import { ConfigService } from "@nestjs/config";
import { Test } from "@nestjs/testing";
import Fastify, { type FastifyInstance } from "fastify";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AuthenticatedReadRateLimit } from "../../src/common/security/authenticated-read-rate-limit.js";

const servers: FastifyInstance[] = [];
const createLimiter = (userMax = 1, ipMax = 10, cache = 5_000) => new AuthenticatedReadRateLimit(new ConfigService({ AUTH_READ_USER_MAX: userMax, AUTH_READ_IP_MAX: ipMax, AUTH_READ_WINDOW_MS: 60_000, AUTH_READ_CACHE: cache }));

const createServer = async (limiter: AuthenticatedReadRateLimit) => {
    const app = Fastify();
    servers.push(app);
    await app.register(rateLimit, { global: false });
    app.get("/read", async (request, reply) => {
        // Test-only stand-in for the profile already verified by the auth guard.
        const userId = String(request.headers["x-test-verified-user"] ?? "user-a");
        if (!(await limiter.enforceAuthenticatedReadLimit(request, reply, userId))) return;
        return { ok: true };
    });
    await app.ready();
    return app;
};

afterEach(async () => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    for (const app of servers.splice(0)) await app.close();
});

describe("AuthenticatedReadRateLimit", () => {
    it("supports explicit Nest injection without emitted constructor metadata", async () => {
        const module = await Test.createTestingModule({ providers: [AuthenticatedReadRateLimit, { provide: ConfigService, useValue: new ConfigService() }] }).compile();
        expect(module.get(AuthenticatedReadRateLimit)).toBeInstanceOf(AuthenticatedReadRateLimit);
        await module.close();
    });

    it("bounds user storage and documents quota reset on cache eviction", async () => {
        const app = await createServer(createLimiter(1, 10, 1));
        expect((await app.inject("/read")).statusCode).toBe(200);
        expect((await app.inject("/read")).statusCode).toBe(429);
        expect((await app.inject({ url: "/read", headers: { "x-test-verified-user": "user-b" } })).statusCode).toBe(200);
        expect((await app.inject("/read")).statusCode).toBe(200);
    });

    it("creates one bounded pair per server without registering another plugin", async () => {
        const app = await createServer(createLimiter(10, 10));
        const factory = vi.spyOn(app, "createRateLimit");
        await app.inject("/read");
        await app.inject("/read");
        expect(factory).toHaveBeenCalledTimes(2);
        for (const [options] of factory.mock.calls) {
            expect(options).toMatchObject({ cache: 5_000, timeWindow: 60_000, skipOnError: false });
        }
    });

    it("shares an exact verified user quota across sessions and IPs and returns Retry-After", async () => {
        const app = await createServer(createLimiter());
        expect((await app.inject({ url: "/read", remoteAddress: "10.0.0.1", headers: { cookie: "session=one" } })).statusCode).toBe(200);
        const blocked = await app.inject({ url: "/read", remoteAddress: "10.0.0.2", headers: { cookie: "session=two" } });
        expect(blocked.statusCode).toBe(429);
        expect(Number(blocked.headers["retry-after"])).toBeGreaterThan(0);
        expect(blocked.json()).toEqual({ statusCode: 429, error: "Too Many Requests", message: "Demasiadas consultas. Intente mas tarde." });
        expect((await app.inject({ url: "/read", headers: { "x-test-verified-user": "user-aa" } })).statusCode).toBe(200);
    });

    it("limits effective IP across different users without trusting Origin", async () => {
        const app = await createServer(createLimiter(10, 1));
        expect((await app.inject({ url: "/read", headers: { origin: "https://one.test" } })).statusCode).toBe(200);
        expect((await app.inject({ url: "/read", headers: { origin: "https://two.test", "x-test-verified-user": "user-b" } })).statusCode).toBe(429);
        expect((await app.inject({ url: "/read", remoteAddress: "10.0.0.3", headers: { "x-test-verified-user": "user-c" } })).statusCode).toBe(200);
    });

    it("isolates Fastify instances and resets quotas after the window", async () => {
        const limiter = createLimiter();
        const first = await createServer(limiter);
        const second = await createServer(limiter);
        expect((await first.inject("/read")).statusCode).toBe(200);
        expect((await first.inject("/read")).statusCode).toBe(429);
        expect((await second.inject("/read")).statusCode).toBe(200);
        vi.spyOn(Date, "now").mockReturnValue(Date.now() + 60_001);
        expect((await first.inject("/read")).statusCode).toBe(200);
        vi.restoreAllMocks();
    });

    it("counts HEAD reads in the same quota", async () => {
        const app = await createServer(createLimiter());
        expect((await app.inject({ url: "/read", method: "HEAD" })).statusCode).toBe(200);
        expect((await app.inject("/read")).statusCode).toBe(429);
    });
});
