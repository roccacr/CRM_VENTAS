import "reflect-metadata";

import { FastifyAdapter, type NestFastifyApplication } from "@nestjs/platform-fastify";
import { Test } from "@nestjs/testing";
import { afterEach, describe, expect, it, vi } from "vitest";

import { HealthController } from "../../src/common/health/health.controller.js";
import { HealthModule } from "../../src/common/health/health.module.js";
import { HealthService } from "../../src/common/health/health.service.js";
import { ROUTE_SECURITY_METADATA } from "../../src/common/security/route-security.decorator.js";
import { DatabaseService } from "../../src/database/database.service.js";

function setup() {
    const executeQuery = vi.fn().mockResolvedValue({ rows: [{ ready: 1 }] });
    const service = new HealthService({ db: { executeQuery } } as unknown as DatabaseService);
    return { executeQuery, service };
}

describe("native readiness probe", () => {
    afterEach(() => vi.useRealTimers());

    it("uses only SELECT 1 and reports success", async () => {
        const { executeQuery, service } = setup();
        await expect(service.isReady()).resolves.toBe(true);
        expect(executeQuery).toHaveBeenCalledWith(expect.objectContaining({ sql: "SELECT 1", parameters: [] }));
    });

    it("turns database failure into an unavailable result without exposing the error", async () => {
        const { executeQuery, service } = setup();
        executeQuery.mockRejectedValue(new Error("SQL secret connection password"));
        await expect(service.isReady()).resolves.toBe(false);
        executeQuery.mockResolvedValue({ rows: [] });
        await expect(service.isReady()).resolves.toBe(true);
    });

    it("bounds response time, shares concurrent work, and retains the slot until the query settles", async () => {
        vi.useFakeTimers();
        const { executeQuery, service } = setup();
        let finish!: (value: { rows: [] }) => void;
        executeQuery.mockReturnValue(
            new Promise((resolve) => {
                finish = resolve;
            }),
        );
        const first = service.isReady();
        const second = service.isReady();
        await vi.advanceTimersByTimeAsync(1_000);
        await expect(first).resolves.toBe(false);
        await expect(second).resolves.toBe(false);
        await expect(service.isReady()).resolves.toBe(false);
        expect(executeQuery).toHaveBeenCalledTimes(1);
        finish({ rows: [] });
        await vi.advanceTimersByTimeAsync(0);
        executeQuery.mockResolvedValue({ rows: [] });
        await expect(service.isReady()).resolves.toBe(true);
        expect(executeQuery).toHaveBeenCalledTimes(2);
        expect(vi.getTimerCount()).toBe(0);
    });
});

describe("public health HTTP surface", () => {
    let app: NestFastifyApplication | undefined;
    afterEach(async () => {
        await app?.close();
    });

    it("wires the module without a real database, keeps liveness independent and returns bounded readiness bodies", async () => {
        const executeQuery = vi.fn().mockResolvedValue({ rows: [] });
        const module = await Test.createTestingModule({ imports: [HealthModule] })
            .overrideProvider(DatabaseService)
            .useValue({ db: { executeQuery } })
            .compile();
        app = module.createNestApplication<NestFastifyApplication>(new FastifyAdapter(), { logger: false });
        await app.init();
        await app.getHttpAdapter().getInstance().ready();
        const live = await app.inject({ method: "GET", url: "/health/live" });
        expect(live.statusCode).toBe(200);
        expect(live.json()).toEqual({ status: "ok" });
        expect(live.headers["cache-control"]).toBe("no-store");
        expect(executeQuery).not.toHaveBeenCalled();
        expect((await app.inject({ method: "GET", url: "/health/ready" })).json()).toEqual({ status: "ready" });
        executeQuery.mockRejectedValue(new Error("SQL private hostname password"));
        const failed = await app.inject({ method: "GET", url: "/health/ready" });
        expect(failed.statusCode).toBe(503);
        expect(failed.json()).toEqual({ statusCode: 503, error: "Service Unavailable", message: "Servicio no disponible." });
        expect(failed.headers["cache-control"]).toBe("no-store");
        expect((await app.inject({ method: "GET", url: "/health/live" })).statusCode).toBe(200);
        for (const method of ["live", "ready"] as const) {
            const handler: unknown = Object.getOwnPropertyDescriptor(HealthController.prototype, method)?.value;
            if (typeof handler !== "function") throw new Error("Missing health handler");
            expect(Reflect.getMetadata(ROUTE_SECURITY_METADATA, handler)).toBe("public");
        }
    });
});
