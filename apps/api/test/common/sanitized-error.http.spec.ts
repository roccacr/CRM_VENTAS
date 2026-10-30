import "reflect-metadata";

import { Controller, Get, HttpException, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { FastifyAdapter, type NestFastifyApplication } from "@nestjs/platform-fastify";
import { Test } from "@nestjs/testing";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { configureHttpApp } from "../../src/bootstrap/configure-http-app.js";

const secret = "SELECT password FROM private_table at db.internal with token=secret";
let failure: unknown;

@Controller("synthetic-errors")
class ErrorController {
    @Get()
    fail(): never {
        throw failure;
    }
}

describe("global error sanitation through HTTP bootstrap", () => {
    let app: NestFastifyApplication;
    const log = vi.spyOn(Logger.prototype, "error").mockImplementation(() => undefined);
    beforeAll(async () => {
        const config = {
            get: (key: string) => {
                if (key === "OPENAPI_ENABLED") return false;
                if (key === "FRONTEND_ORIGIN") return "http://localhost:5173";
                if (key === "COOKIE_SECRET" || key === "AUDIT_HASH_SECRET") return "synthetic-test-secret";
                if (key.endsWith("_CACHE") || key.endsWith("_MAX") || key.endsWith("_WINDOW_MS")) return 100;
                return undefined;
            },
        };
        const module = await Test.createTestingModule({ controllers: [ErrorController], providers: [{ provide: ConfigService, useValue: config }] }).compile();
        app = module.createNestApplication<NestFastifyApplication>(new FastifyAdapter(), { logger: false });
        await configureHttpApp(app);
        await app.init();
        await app.getHttpAdapter().getInstance().ready();
    });
    afterAll(async () => {
        await app.close();
        log.mockRestore();
    });

    it.each([400, 401, 403, 404, 409, 422, 429])("preserves the existing %i response contract", async (status) => {
        const body = { statusCode: status, message: ["existing validation"], error: "Existing", code: "domain_code" };
        failure = new HttpException(body, status);
        const response = await app.inject({ method: "GET", url: "/synthetic-errors" });
        expect(response.statusCode).toBe(status);
        expect(response.json()).toEqual(body);
    });

    it.each([500, 502, 503, 504])("sanitizes %i exception bodies and logs only server correlation/status", async (status) => {
        log.mockClear();
        failure = new HttpException({ message: secret, sql: secret, stack: secret }, status);
        const response = await app.inject({ method: "GET", url: "/synthetic-errors", headers: { "x-request-id": secret, "x-correlation-id": secret } });
        expect(response.statusCode).toBe(status);
        expect(response.json()).toEqual(status === 503 ? { statusCode: 503, error: "Service Unavailable", message: "Servicio no disponible." } : { statusCode: status, message: "Internal server error" });
        const correlation = response.headers["x-correlation-id"];
        expect(correlation).toMatch(/^[0-9a-f-]{36}$/);
        expect(log.mock.calls).toEqual([[{ correlation_id: correlation, statusCode: status, error_code: "unclassified", error_class: "http_error" }]]);
        expect(JSON.stringify({ body: response.body, logs: log.mock.calls })).not.toContain(secret);
    });

    it("sanitizes unknown errors without passing the original exception to Nest logging", async () => {
        log.mockClear();
        failure = new Error(secret);
        const response = await app.inject({ method: "GET", url: "/synthetic-errors" });
        expect(response.statusCode).toBe(500);
        expect(response.json()).toEqual({ statusCode: 500, message: "Internal server error" });
        expect(log.mock.calls).toEqual([[{ correlation_id: response.headers["x-correlation-id"], statusCode: 500, error_code: "unclassified", error_class: "server_error" }]]);
    });

    it("preserves string and http-error-shaped 4xx bodies without logging raw exceptions", async () => {
        log.mockClear();
        failure = new HttpException("existing message", 409);
        expect((await app.inject({ method: "GET", url: "/synthetic-errors" })).json()).toEqual({ statusCode: 409, message: "existing message" });
        failure = { statusCode: 429, message: "existing limit" };
        expect((await app.inject({ method: "GET", url: "/synthetic-errors" })).json()).toEqual({ statusCode: 429, message: "existing limit" });
        expect(log).not.toHaveBeenCalled();
    });

    it.each([{ statusCode: 503, message: secret }, secret, null])("sanitizes third-party and non-Error thrown values: %j", async (value) => {
        log.mockClear();
        failure = value;
        const response = await app.inject({ method: "GET", url: "/synthetic-errors" });
        const statusCode = typeof value === "object" && value !== null ? 503 : 500;
        expect(response.statusCode).toBe(statusCode);
        expect(response.json()).toEqual(statusCode === 503 ? { statusCode: 503, error: "Service Unavailable", message: "Servicio no disponible." } : { statusCode, message: "Internal server error" });
        expect(log.mock.calls).toEqual([[{ correlation_id: response.headers["x-correlation-id"], statusCode, error_code: "unclassified", error_class: "server_error" }]]);
    });

    it.each(["ECONNRESET", "ER_LOCK_DEADLOCK", secret])("logs only allowlisted diagnostic codes: %s", async (code) => {
        log.mockClear();
        failure = Object.assign(new Error(secret), { code, sql: secret });
        const response = await app.inject({ method: "GET", url: "/synthetic-errors" });
        const statusCode = code === "ECONNRESET" ? 503 : 500;
        expect(response.statusCode).toBe(statusCode);
        expect(log.mock.calls).toEqual([[{ correlation_id: response.headers["x-correlation-id"], statusCode, error_code: code === secret ? "unclassified" : code, error_class: "server_error" }]]);
        expect(JSON.stringify({ body: response.body, logs: log.mock.calls })).not.toContain(secret);
    });
    it("preserves only the fixed reconciliation code, never exception details", async () => {
        failure = new HttpException({ code: "FORMALIZATION_APPROVAL_RECONCILIATION_REQUIRED", message: secret, sql: secret }, 503);
        const response = await app.inject({ method: "GET", url: "/synthetic-errors" });
        expect(response.statusCode).toBe(503);
        expect(response.json()).toMatchObject({ code: "FORMALIZATION_APPROVAL_RECONCILIATION_REQUIRED" });
        expect(response.body).not.toContain(secret);
    });
});
