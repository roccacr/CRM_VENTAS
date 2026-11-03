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
    const native = vi.fn().mockResolvedValue({ ...emptyFollowUpSource(), sourceTotals: { native: 0, legacy: 0 } });
    const distribution = vi.fn().mockResolvedValue({ totalOrders: 1, series: ["closed", "addendum"], projects: [{ id: null, name: "Sin proyecto", total: 1, counts: { closed: 1, addendum: 1 } }] });
    const legacy = vi.fn().mockReturnValue("legacy-projection");
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
                { provide: FollowUpRepository, useValue: { readCombined: native, projectDistribution: distribution } },
                { provide: HomeSummaryRepository, useValue: { readSnapshot: async (read: (tx: object) => Promise<unknown>) => read({}) } },
                { provide: FOLLOW_UP_LEGACY_READER, useValue: { enabled: () => true, projection: legacy } },
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
    it("returns unfiltered aggregates without fetching order lists", async () => {
        const response = await app.inject({ url: "/formalization/home/project-distribution", headers: { cookie: `${SESSION_COOKIE_NAME}=session` } });
        expect(response.statusCode).toBe(200);
        expect(response.headers["cache-control"]).toBe("no-store");
        expect(response.json()).toMatchObject({ schemaVersion: 1, totalOrders: 1, projects: [{ id: null, total: 1, counts: { closed: 1, addendum: 1 } }] });
        expect(distribution).toHaveBeenCalledOnce();
        expect(native).not.toHaveBeenCalled();
    });
    it("rejects distribution filters and explicit deny before SQL", async () => {
        const requestDistribution = (suffix = "") => app.inject({ url: "/formalization/home/project-distribution" + suffix, headers: { cookie: `${SESSION_COOKIE_NAME}=session` } });
        expect((await requestDistribution("?page=2")).statusCode).toBe(400);
        profile.permissions.push({ code: "formalizacion.home.stages.read", effect: "deny", scope: null, source: "override" });
        expect((await requestDistribution()).statusCode).toBe(403);
        expect(distribution).not.toHaveBeenCalled();
        expect(legacy).not.toHaveBeenCalled();
    });
    it("rejects distribution without membership before SQL", async () => {
        profile.roles = [];
        expect((await app.inject({ url: "/formalization/home/project-distribution", headers: { cookie: `${SESSION_COOKIE_NAME}=session` } })).statusCode).toBe(403);
        expect(native).not.toHaveBeenCalled();
        expect(legacy).not.toHaveBeenCalled();
    });
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
        legacy.mockImplementationOnce(() => {
            throw new Error("unavailable");
        });
        const response = await request();
        expect(response.statusCode).toBe(503);
        expect(response.json()).not.toHaveProperty("items");
    });
});
