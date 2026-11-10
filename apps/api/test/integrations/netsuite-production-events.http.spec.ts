import "reflect-metadata";

import cookie from "@fastify/cookie";
import { Controller, Post, Put } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { FastifyAdapter, type NestFastifyApplication } from "@nestjs/platform-fastify";
import { Test } from "@nestjs/testing";
import { afterEach, expect, it } from "vitest";

import { CsrfGuard } from "../../src/common/security/csrf.guard.js";
import { LocalServiceTokenGuard } from "../../src/common/security/local-service-token.guard.js";
import { LocalServiceToken } from "../../src/common/security/local-service-token.guard.js";
import { NetsuiteLocalEventsController } from "../../src/integrations/netsuite/netsuite-local-events.controller.js";
import { NetsuiteOrderEventService } from "../../src/integrations/netsuite/netsuite-order-event.service.js";
import { NetsuiteOrderImportQueue } from "../../src/integrations/netsuite/netsuite-order-import.queue.js";
import { NetsuiteProductionEventsController } from "../../src/integrations/netsuite/netsuite-production-events.controller.js";

const secret = "a".repeat(64);
const payload = { schemaVersion: 2, source: { system: "netsuite", accountId: "4552704", environment: "production" }, event: { recordType: "salesorder", netsuiteId: "123", eventType: "xedit", observedAt: "2026-10-30T20:00:00.000Z", eventId: "11111111-1111-4111-8111-111111111111", sourceModifiedAt: "2026-10-30T20:00:00.000Z" }, snapshot: { status: 200, data: { type: "salesorder", id: "123", fields: { tranid: "OV-123", custbody90: true }, sublists: { item: [{ item: "Unit", quantity: 1 }] } } } };
@Controller("browser")
class BrowserController {
    @Put("machine")
    @LocalServiceToken("production")
    update() {
        return { ok: true };
    }

    @Post() create() {
        return { ok: true };
    }
}
let app: NestFastifyApplication | undefined;
afterEach(async () => {
    await app?.close();
    app = undefined;
});
async function fixture(overrides: Record<string, unknown> = {}, globalCsrf = true) {
    const config = new ConfigService({ NODE_ENV: "production", FRONTEND_ORIGIN: "https://habita.roccacr.com", NETSUITE_ENVIRONMENT: "production", NETSUITE_PRODUCTION_EVENTS_ENABLED: true, NETSUITE_PRODUCTION_EVENTS_SECRET: secret, NETSUITE_LOCAL_EVENTS_SECRET: "c".repeat(64), COOKIE_SECRET: "b".repeat(64), ...overrides });
    const module = await Test.createTestingModule({
        controllers: [NetsuiteProductionEventsController, NetsuiteLocalEventsController, BrowserController],
        providers: [
            { provide: NetsuiteOrderImportQueue, useValue: { enqueueMissingEvent: (_event: unknown, result: unknown) => result } },
            {
                provide: NetsuiteOrderEventService,
                useValue: {
                    receive: () => {
                        return { received: true, persisted: true };
                    },
                },
            },
            LocalServiceTokenGuard,
            CsrfGuard,
            { provide: ConfigService, useValue: config },
        ],
    }).compile();
    app = module.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
    await app.register(cookie);
    if (globalCsrf) app.useGlobalGuards(module.get(CsrfGuard));
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
    return app;
}
it("receives a durable production order using dedicated machine proof without cookies", async () => {
    const server = await fixture();
    const response = await server.inject({ method: "POST", url: "/integrations/netsuite/production/order-events", headers: { authorization: `Bearer ${secret}` }, payload });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ received: true, persisted: true });
});
it.each([undefined, "Bearer bad", `Bearer ${"c".repeat(64)}`])("rejects missing proof or Sandbox secret", async (authorization) => {
    const server = await fixture();
    expect((await server.inject({ method: "POST", url: "/integrations/netsuite/production/order-events", headers: authorization ? { authorization } : {}, payload })).statusCode).toBe(401);
});
it.each([{ NODE_ENV: "development" }, { NETSUITE_PRODUCTION_EVENTS_ENABLED: false }, { NETSUITE_PRODUCTION_EVENTS_SECRET: "" }, { NETSUITE_ENVIRONMENT: "sandbox" }, { FRONTEND_ORIGIN: "http://localhost:3000" }, { NETSUITE_LOCAL_EVENTS_SECRET: secret }])("fails closed for untrusted deployment: %j", async (config) => {
    const server = await fixture(config);
    expect((await server.inject({ method: "POST", url: "/integrations/netsuite/production/order-events", headers: { authorization: `Bearer ${secret}` }, payload })).statusCode).toBe(403);
});
it.each([
    { ...payload, source: { ...payload.source, accountId: "4552704_SB1" } },
    { ...payload, source: { ...payload.source, environment: "sandbox" } },
    { ...payload, schemaVersion: 1 },
])("rejects crossed source or receipt-only events", async (body) => {
    const server = await fixture();
    expect((await server.inject({ method: "POST", url: "/integrations/netsuite/production/order-events", headers: { authorization: `Bearer ${secret}` }, payload: body })).statusCode).toBe(400);
});
it("does not exempt browser mutations and validates production proof for PUT", async () => {
    const server = await fixture();
    expect((await server.inject({ method: "POST", url: "/browser", headers: { authorization: `Bearer ${secret}` }, payload: {} })).statusCode).toBe(403);
    expect((await server.inject({ method: "PUT", url: "/browser/machine", headers: { authorization: `Bearer ${"c".repeat(64)}` }, payload: {} })).statusCode).toBe(401);
    expect((await server.inject({ method: "PUT", url: "/browser/machine", headers: { authorization: `Bearer ${secret}` }, payload: {} })).statusCode).toBe(200);
});
it("local controller rejects production source even with its own valid proof", async () => {
    const server = await fixture({ NODE_ENV: "development", NETSUITE_LOCAL_EVENTS_ENABLED: true });
    expect((await server.inject({ method: "POST", url: "/integrations/netsuite/local/order-events", headers: { authorization: `Bearer ${"c".repeat(64)}` }, payload })).statusCode).toBe(400);
});

it("independently checks production proof when global CSRF registration is absent", async () => {
    const server = await fixture({}, false);
    expect((await server.inject({ method: "POST", url: "/integrations/netsuite/production/order-events", payload })).statusCode).toBe(401);
    expect((await server.inject({ method: "POST", url: "/integrations/netsuite/production/order-events", headers: { authorization: `Bearer ${secret}` }, payload })).statusCode).toBe(200);
});
