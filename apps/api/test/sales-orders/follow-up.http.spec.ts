import "reflect-metadata";

import cookie from "@fastify/cookie";
import { UnauthorizedException } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { FastifyAdapter, type NestFastifyApplication } from "@nestjs/platform-fastify";
import { Test } from "@nestjs/testing";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { AuthGuard } from "../../src/common/security/auth.guard.js";
import { AuthenticatedReadRateLimit } from "../../src/common/security/authenticated-read-rate-limit.js";
import { SESSION_COOKIE_NAME } from "../../src/common/security/http-security.constants.js";
import { IdentityService } from "../../src/modules/crm/identity/identity.service.js";
import type { IdentityProfile } from "../../src/modules/crm/identity/identity.types.js";
import { emptyFollowUpSource } from "../../src/modules/crm/sales/sales-orders/follow-up.contract.js";
import { FOLLOW_UP_LEGACY_READER } from "../../src/modules/crm/sales/sales-orders/follow-up.port.js";
import { FollowUpRepository } from "../../src/modules/crm/sales/sales-orders/follow-up.repository.js";
import { FollowUpService } from "../../src/modules/crm/sales/sales-orders/follow-up.service.js";
import { FollowUpController } from "../../src/modules/crm/sales/sales-orders/home-summary.module.js";
import { HomeSummaryRepository } from "../../src/modules/crm/sales/sales-orders/home-summary.repository.js";

describe("Formalization follow-up HTTP (persistence mocked)", () => {
    let app: NestFastifyApplication;
    let profile: IdentityProfile;
    const native = vi.fn().mockResolvedValue(emptyFollowUpSource());
    const legacy = vi.fn().mockResolvedValue(emptyFollowUpSource());
    const identity = {
        getCurrentUser: vi.fn((session?: string) => {
            if (!session) throw new UnauthorizedException();
            return Promise.resolve(profile);
        }),
    };
    beforeAll(async () => {
        const module = await Test.createTestingModule({
            controllers: [FollowUpController],
            providers: [
                FollowUpService,
                { provide: IdentityService, useValue: identity },
                { provide: FollowUpRepository, useValue: { read: native } },
                { provide: HomeSummaryRepository, useValue: { readSnapshot: async (read: (tx: object) => Promise<unknown>) => read({}) } },
                { provide: FOLLOW_UP_LEGACY_READER, useValue: { enabled: () => true, read: legacy } },
                { provide: AuthenticatedReadRateLimit, useValue: { enforceAuthenticatedReadLimit: () => true } },
                { provide: APP_GUARD, useClass: AuthGuard },
            ],
        }).compile();
        app = module.createNestApplication<NestFastifyApplication>(new FastifyAdapter(), { logger: false });
        await app.register(cookie);
        await app.init();
        await app.getHttpAdapter().getInstance().ready();
    });
    beforeEach(() => {
        vi.clearAllMocks();
        profile = { roles: [{ code: "formalizacion", name: "Formalizacion", status: "active" }], user: { publicId: "actor" }, permissions: [{ code: "formalizacion.home.stages.read", effect: "allow", scope: "own_area", source: "role" }] } as IdentityProfile;
    });
    afterAll(async () => {
        await app.close();
    });
    const request = (query = "") => app.inject({ url: "/formalization/home/follow-up" + query, headers: { cookie: `${SESSION_COOKIE_NAME}=session` } });
    it("requires authentication before reading either source", async () => {
        expect((await app.inject({ url: "/formalization/home/follow-up" })).statusCode).toBe(401);
        expect(native).not.toHaveBeenCalled();
        expect(legacy).not.toHaveBeenCalled();
    });
    it("returns one canonical no-store response from both authorized sources", async () => {
        const response = await request();
        expect(response.statusCode).toBe(200);
        expect(response.headers["cache-control"]).toBe("no-store");
        expect(response.json()).toMatchObject({ schemaVersion: 1, page: { number: 1, size: 25, total: 0 }, sources: { native: { total: 0 }, legacy: { enabled: true, total: 0 } } });
        expect(native).toHaveBeenCalledOnce();
        expect(legacy).toHaveBeenCalledOnce();
    });
    it.each(["?pageSize=101", "?page=1e2", "?queue=bad", "?projectId=1", "?extra=x"])("rejects malformed query %s before SQL", async (query) => {
        expect((await request(query)).statusCode).toBe(400);
        expect(native).not.toHaveBeenCalled();
        expect(legacy).not.toHaveBeenCalled();
    });
    it("blocks approval queue without the independent permission", async () => {
        expect((await request("?queue=approvals")).statusCode).toBe(403);
        expect(native).not.toHaveBeenCalled();
    });
    it("stops the next request after deny even for effective Owner", async () => {
        profile.roles.push({ code: "owner", name: "Owner", status: "active" });
        expect((await request()).statusCode).toBe(200);
        profile.permissions.push({ code: "formalizacion.home.stages.read", effect: "deny", scope: null, source: "override" });
        expect((await request()).statusCode).toBe(403);
        expect(native).toHaveBeenCalledOnce();
        expect(legacy).toHaveBeenCalledOnce();
    });
    it("does not hide a failed source behind an empty successful table", async () => {
        legacy.mockRejectedValueOnce(new Error("unavailable"));
        const response = await request();
        expect(response.statusCode).toBe(503);
        expect(response.json()).not.toHaveProperty("items");
    });
});
