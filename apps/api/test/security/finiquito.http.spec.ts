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
const body = { source: "native", id: "01ARZ3NDEKTSV4RRFFQ69G5FAV", status: "pending_send", expectedVersion: 0, operationId: "550e8400-e29b-41d4-a716-446655440000" };
const grant = (code: string, effect = "allow") => ({ code, effect, scope: "all_areas" });

describe("finiquito HTTP con sesión, CSRF y permisos reales", () => {
    let app: NestFastifyApplication;
    let permissions = [grant("formalizacion.orders.stage.update"), grant("formalizacion.orders.read")];
    const finiquito = vi.fn().mockResolvedValue({ eligible: true, status: "pending_send", version: 1, originStage: "bank_management" });
    const getCurrentUser = vi.fn((token: string | undefined) => {
        if (token !== session) return Promise.reject(new UnauthorizedException());
        return Promise.resolve({ user: { publicId: "authenticated-actor" }, roles: [{ code: "formalizacion", status: "active" }], permissions });
    });
    beforeAll(async () => {
        const module = await Test.createTestingModule({
            controllers: [FormalizationStageController],
            providers: [ContractTransitionService, { provide: ContractTransitionRepository, useValue: { finiquito } }, { provide: IdentityService, useValue: { getCurrentUser } }, { provide: ConfigService, useValue: new ConfigService({ COOKIE_SECRET: secret }) }, { provide: AuthenticatedReadRateLimit, useValue: { enforceAuthenticatedReadLimit: () => Promise.resolve(true) } }, { provide: APP_GUARD, useClass: CsrfGuard }, { provide: APP_GUARD, useClass: AuthGuard }],
        }).compile();
        app = module.createNestApplication<NestFastifyApplication>(new FastifyAdapter(), { logger: false });
        await app.register(cookie);
        await app.init();
        await app.getHttpAdapter().getInstance().ready();
    });
    beforeEach(() => {
        vi.clearAllMocks();
        permissions = [grant("formalizacion.orders.stage.update"), grant("formalizacion.orders.read")];
    });
    afterAll(async () => {
        await app.close();
    });
    const headers = (): Record<string, string> => {
        const token = createSignedCsrfToken(secret, session);
        return { cookie: `${SESSION_COOKIE_NAME}=${session}; ${CSRF_COOKIE_NAME}=${token}`, [CSRF_HEADER_NAME_LOWERCASE]: token };
    };
    it("sin sesión devuelve 401", async () => {
        const token = createSignedCsrfToken(secret);
        const response = await app.inject({ method: "POST", url: "/formalization/orders/finiquito", payload: body, headers: { cookie: `${CSRF_COOKIE_NAME}=${token}`, [CSRF_HEADER_NAME_LOWERCASE]: token } });
        expect(response.statusCode).toBe(401);
        expect(finiquito).not.toHaveBeenCalled();
    });
    it("sin CSRF no llega al repositorio", async () => {
        const response = await app.inject({ method: "POST", url: "/formalization/orders/finiquito", payload: body, headers: { cookie: `${SESSION_COOKIE_NAME}=${session}` } });
        expect(response.statusCode).toBe(403);
        expect(finiquito).not.toHaveBeenCalled();
    });
    it.each(["formalizacion.orders.read", "formalizacion.orders.stage.update"])("sin %s no escribe", async (code) => {
        permissions = permissions.filter((permission) => permission.code !== code);
        const response = await app.inject({ method: "POST", url: "/formalization/orders/finiquito", payload: body, headers: headers() });
        expect(response.statusCode).toBe(403);
        expect(finiquito).not.toHaveBeenCalled();
    });
    it("un deny explícito prevalece", async () => {
        permissions.push(grant("formalizacion.orders.stage.update", "deny"));
        const response = await app.inject({ method: "POST", url: "/formalization/orders/finiquito", payload: body, headers: headers() });
        expect(response.statusCode).toBe(403);
        expect(finiquito).not.toHaveBeenCalled();
    });
    it("con permisos deriva actor y devuelve estado guardado", async () => {
        const response = await app.inject({ method: "POST", url: "/formalization/orders/finiquito", payload: body, headers: headers() });
        expect(response.statusCode).toBe(200);
        expect(response.json()).toMatchObject({ status: "pending_send", version: 1 });
        expect(finiquito).toHaveBeenCalledWith(expect.objectContaining({ actorPublicId: "authenticated-actor" }), expect.objectContaining({ status: "pending_send", expectedVersion: 0 }));
    });
    it("la consulta solo requiere lectura y no concede escritura", async () => {
        permissions = [grant("formalizacion.orders.read")];
        const response = await app.inject({ method: "GET", url: `/formalization/orders/finiquito?source=native&id=${body.id}`, headers: { cookie: `${SESSION_COOKIE_NAME}=${session}` } });
        expect(response.statusCode).toBe(200);
        expect(response.json()).toMatchObject({ canUpdate: false });
        expect(finiquito).toHaveBeenCalledWith(expect.any(Object), undefined);
    });
});
