import "reflect-metadata";

import cookie from "@fastify/cookie";
import { UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { APP_GUARD } from "@nestjs/core";
import { FastifyAdapter, type NestFastifyApplication } from "@nestjs/platform-fastify";
import { Test } from "@nestjs/testing";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { AuthGuard } from "../../src/common/security/auth.guard.js";
import { AuthenticatedReadRateLimit } from "../../src/common/security/authenticated-read-rate-limit.js";
import { CsrfGuard } from "../../src/common/security/csrf.guard.js";
import { createSignedCsrfToken } from "../../src/common/security/csrf-token.js";
import { CSRF_COOKIE_NAME, CSRF_HEADER_NAME_LOWERCASE, SESSION_COOKIE_NAME } from "../../src/common/security/http-security.constants.js";
import { IdentityService } from "../../src/modules/crm/identity/identity.service.js";
import { FormalizationStageController } from "../../src/modules/crm/sales/sales-orders/contract-transition.controller.js";
import { ContractTransitionRepository } from "../../src/modules/crm/sales/sales-orders/contract-transition.repository.js";
import { ContractTransitionService } from "../../src/modules/crm/sales/sales-orders/contract-transition.service.js";

const secret = "completion-http-test-only-cookie-secret";
const session = "completion-http-test-session";
const body = { source: "native", id: "01ARZ3NDEKTSV4RRFFQ69G5FAV", expectedSequence: 0, operationId: "550e8400-e29b-41d4-a716-446655440000", targetState: "closed" };
const grant = (code: string, effect = "allow") => ({ code, effect, scope: "all_areas" });

describe("closure HTTP with real CSRF/auth guards and transition service", () => {
    let app: NestFastifyApplication;
    let permissions = [grant("formalizacion.orders.stage.update"), grant("formalizacion.orders.stage.closed")];
    const transition = vi.fn().mockResolvedValue({ state: "closed", sequence: 1 });
    const getCurrentUser = vi.fn((token: string | undefined) => {
        if (token !== session) return Promise.reject(new UnauthorizedException());
        return Promise.resolve({ user: { publicId: "authenticated-actor" }, roles: [{ code: "formalizacion", status: "active" }], permissions });
    });
    beforeAll(async () => {
        const module = await Test.createTestingModule({
            controllers: [FormalizationStageController],
            providers: [ContractTransitionService, { provide: ContractTransitionRepository, useValue: { transition } }, { provide: IdentityService, useValue: { getCurrentUser } }, { provide: ConfigService, useValue: new ConfigService({ COOKIE_SECRET: secret }) }, { provide: AuthenticatedReadRateLimit, useValue: { enforceAuthenticatedReadLimit: () => Promise.resolve(true) } }, { provide: APP_GUARD, useClass: CsrfGuard }, { provide: APP_GUARD, useClass: AuthGuard }],
        }).compile();
        app = module.createNestApplication<NestFastifyApplication>(new FastifyAdapter(), { logger: false });
        await app.register(cookie);
        await app.init();
        await app.getHttpAdapter().getInstance().ready();
    });
    beforeEach(() => {
        vi.clearAllMocks();
        permissions = [grant("formalizacion.orders.stage.update"), grant("formalizacion.orders.stage.closed")];
    });
    afterAll(async () => {
        await app.close();
    });
    const headers = (): Record<string, string> => {
        const token = createSignedCsrfToken(secret, session);
        return { cookie: `${SESSION_COOKIE_NAME}=${session}; ${CSRF_COOKIE_NAME}=${token}`, [CSRF_HEADER_NAME_LOWERCASE]: token };
    };
    it("rejects a missing session with 401 after a valid anonymous CSRF proof", async () => {
        const token = createSignedCsrfToken(secret);
        const response = await app.inject({ method: "POST", url: "/formalization/orders/stage", payload: body, headers: { cookie: `${CSRF_COOKIE_NAME}=${token}`, [CSRF_HEADER_NAME_LOWERCASE]: token } });
        expect(response.statusCode).toBe(401);
        expect(transition).not.toHaveBeenCalled();
    });
    it.each(["missing", "mismatch", "other-session"])("rejects %s CSRF before identity or persistence", async (mode) => {
        const requestHeaders = headers();
        if (mode === "missing") Reflect.deleteProperty(requestHeaders, CSRF_HEADER_NAME_LOWERCASE);
        if (mode === "mismatch") requestHeaders[CSRF_HEADER_NAME_LOWERCASE] = createSignedCsrfToken(secret, session);
        if (mode === "other-session") {
            const wrong = createSignedCsrfToken(secret, "another-session");
            requestHeaders.cookie = `${SESSION_COOKIE_NAME}=${session}; ${CSRF_COOKIE_NAME}=${wrong}`;
            requestHeaders[CSRF_HEADER_NAME_LOWERCASE] = wrong;
        }
        const response = await app.inject({ method: "POST", url: "/formalization/orders/stage", payload: body, headers: requestHeaders });
        expect(response.statusCode).toBe(403);
        expect(getCurrentUser).not.toHaveBeenCalled();
        expect(transition).not.toHaveBeenCalled();
    });
    it("rejects a destination deny despite valid CSRF and selector permission", async () => {
        permissions.push(grant("formalizacion.orders.stage.closed", "deny"));
        const response = await app.inject({ method: "POST", url: "/formalization/orders/stage", payload: body, headers: headers() });
        expect(response.statusCode).toBe(403);
        expect(getCurrentUser).toHaveBeenCalledTimes(2);
        expect(transition).not.toHaveBeenCalled();
    });
    it("delegates closure exactly once with valid CSRF and both permissions", async () => {
        const response = await app.inject({ method: "POST", url: "/formalization/orders/stage", payload: body, headers: headers() });
        expect(response.statusCode).toBe(200);
        expect(response.json()).toEqual({ state: "closed", sequence: 1 });
        expect(transition).toHaveBeenCalledTimes(1);
        expect(transition).toHaveBeenCalledWith(expect.objectContaining({ ...body, action: "set", actorPublicId: "authenticated-actor", canSkipStages: false }));
    });
});
