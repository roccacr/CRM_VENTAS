import "reflect-metadata";

import cookie from "@fastify/cookie";
import { Controller, Post } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { FastifyAdapter, type NestFastifyApplication } from "@nestjs/platform-fastify";
import { Test } from "@nestjs/testing";
import { afterEach, expect, it } from "vitest";

import { CsrfGuard } from "../../src/common/security/csrf.guard.js";
import { LocalServiceTokenGuard } from "../../src/common/security/local-service-token.guard.js";
import { NetsuiteLocalEventsController } from "../../src/integrations/netsuite/netsuite-local-events.controller.js";
import { NetsuiteOrderEventService } from "../../src/integrations/netsuite/netsuite-order-event.service.js";

const secret = "a".repeat(64);
const payload = { schemaVersion: 1, source: { system: "netsuite", accountId: "4552704_SB1", environment: "sandbox" }, event: { recordType: "salesorder", netsuiteId: "123", eventType: "xedit", observedAt: "2026-10-30T20:00:00.000Z" }, snapshot: { status: 200, data: { type: "salesorder", id: "123", fields: { tranid: "OV-123", custbody90: true }, sublists: { item: [{ item: "Unit", quantity: 1 }] } } } };
@Controller("browser")
class BrowserController {
    @Post() create() {
        return { ok: true };
    }
}
let app: NestFastifyApplication | undefined;
afterEach(async () => {
    await app?.close();
    app = undefined;
});
async function fixture(overrides: Record<string, unknown> = {}) {
    const config = new ConfigService({ NODE_ENV: "development", NETSUITE_LOCAL_EVENTS_ENABLED: true, NETSUITE_LOCAL_EVENTS_SECRET: secret, COOKIE_SECRET: "b".repeat(64), ...overrides });
    const module = await Test.createTestingModule({
        controllers: [NetsuiteLocalEventsController, BrowserController],
        providers: [
            {
                provide: NetsuiteOrderEventService,
                useValue: {
                    receive: () => {
                        throw new Error("v1 must not persist");
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
    app.useGlobalGuards(module.get(CsrfGuard));
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
    return app;
}
it("receives a mapped sandbox order without cookies and explicitly confirms no persistence", async () => {
    const server = await fixture();
    const response = await server.inject({ method: "POST", url: "/integrations/netsuite/local/order-events", headers: { authorization: `Bearer ${secret}` }, payload });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ schemaVersion: 1, received: true, persisted: false, netsuiteId: "123" });
});
it.each([undefined, "Bearer bad", `Bearer ${"c".repeat(64)}`])("rejects absent or invalid machine proof", async (authorization) => {
    const server = await fixture();
    const response = await server.inject({ method: "POST", url: "/integrations/netsuite/local/order-events", headers: authorization ? { authorization } : {}, payload });
    expect(response.statusCode).toBe(401);
});
it.each([{ NODE_ENV: "production" }, { NETSUITE_LOCAL_EVENTS_ENABLED: false }, { NETSUITE_LOCAL_EVENTS_SECRET: "" }])("fails closed when local reception is unavailable", async (config) => {
    const server = await fixture(config);
    expect((await server.inject({ method: "POST", url: "/integrations/netsuite/local/order-events", headers: { authorization: `Bearer ${secret}` }, payload })).statusCode).toBe(403);
});
it.each([
    { ...payload, source: { ...payload.source, accountId: "4552704" } },
    { ...payload, event: { ...payload.event, recordType: "lead" } },
    { ...payload, snapshot: { ...payload.snapshot, data: { ...payload.snapshot.data, id: "456" } } },
    { ...payload, snapshot: { ...payload.snapshot, _csrf: "never allow raw browser fields" } },
    { ...payload, event: { ...payload.event, eventType: "delete" } },
])("rejects a different source, mismatched order or unexpected snapshot", async (body) => {
    const server = await fixture();
    expect((await server.inject({ method: "POST", url: "/integrations/netsuite/local/order-events", headers: { authorization: `Bearer ${secret}` }, payload: body })).statusCode).toBe(400);
});
it("does not exempt browser mutations from CSRF even with a machine token", async () => {
    const server = await fixture();
    expect((await server.inject({ method: "POST", url: "/browser", headers: { authorization: `Bearer ${secret}` }, payload: {} })).statusCode).toBe(403);
});
it("checks proof in its own guard too when the global guard is absent", () => {
    const guard = new LocalServiceTokenGuard(new ConfigService({ NODE_ENV: "development", NETSUITE_LOCAL_EVENTS_ENABLED: true, NETSUITE_LOCAL_EVENTS_SECRET: secret }));
    const request = { headers: {} };
    expect(() => guard.canActivate({ getHandler: () => function handler() {}, switchToHttp: () => ({ getRequest: () => request }) } as never)).toThrow("Credencial de integracion invalida.");
});
