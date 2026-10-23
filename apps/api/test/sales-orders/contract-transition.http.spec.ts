import "reflect-metadata";

import cookie from "@fastify/cookie";
import { ValidationPipe } from "@nestjs/common";
import { SELF_DECLARED_DEPS_METADATA } from "@nestjs/common/constants.js";
import { FastifyAdapter, type NestFastifyApplication } from "@nestjs/platform-fastify";
import { Test } from "@nestjs/testing";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { SESSION_COOKIE_NAME } from "../../src/common/security/http-security.constants.js";
import { REQUIRE_PERMISSION_METADATA } from "../../src/common/security/require-permission.decorator.js";
import { ROUTE_SECURITY_METADATA } from "../../src/common/security/route-security.decorator.js";
import { ContractTransitionController } from "../../src/modules/crm/sales/sales-orders/contract-transition.controller.js";
import { ContractTransitionService } from "../../src/modules/crm/sales/sales-orders/contract-transition.service.js";

describe("contract transition HTTP boundary (no network or database)", () => {
    let app: NestFastifyApplication;
    const transition = vi.fn().mockResolvedValue({ sequence: 1 });
    const body = { source: "native", id: "01ARZ3NDEKTSV4RRFFQ69G5FAV", expectedSequence: 0, operationId: "550e8400-e29b-41d4-a716-446655440000" };
    beforeAll(async () => {
        const module = await Test.createTestingModule({ controllers: [ContractTransitionController], providers: [{ provide: ContractTransitionService, useValue: { transition } }] }).compile();
        app = module.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
        await app.register(cookie);
        app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true }));
        await app.init();
        await app.getHttpAdapter().getInstance().ready();
    });
    afterAll(async () => {
        await app.close();
    });
    it.each(["send", "revert"] as const)("uses fixed %s permission metadata and explicit injection", (action) => {
        const handler = Reflect.get(ContractTransitionController.prototype, action) as object;
        expect(Reflect.getMetadata(ROUTE_SECURITY_METADATA, handler)).toBe("permission");
        expect(Reflect.getMetadata(REQUIRE_PERMISSION_METADATA, handler)).toEqual({ kind: "all", codes: [`formalizacion.contracts.${action}`] });
        expect(Reflect.getMetadata(SELF_DECLARED_DEPS_METADATA, ContractTransitionController)).toContainEqual({ index: 0, param: ContractTransitionService });
    });
    it.each(["send", "revert"] as const)("POST %s fixes action and forwards session and request evidence", async (action) => {
        transition.mockClear();
        const response = await app.inject({ method: "POST", url: `/formalization/contracts/${action}`, headers: { cookie: `${SESSION_COOKIE_NAME}=session`, "user-agent": "double" }, payload: { ...body, ...(action === "revert" ? { reason: "Correction" } : {}) } });
        expect(response.statusCode).toBe(200);
        expect(response.headers["cache-control"]).toBe("no-store");
        expect(transition).toHaveBeenCalledWith("session", action, expect.objectContaining(body), expect.objectContaining({ userAgent: "double" }));
    });
    it("rejects body action overrides and unknown fields", async () => {
        transition.mockClear();
        const response = await app.inject({ method: "POST", url: "/formalization/contracts/send", payload: { ...body, action: "revert", actorPublicId: "forged" } });
        expect(response.statusCode).toBe(400);
        expect(transition).not.toHaveBeenCalled();
    });
});
