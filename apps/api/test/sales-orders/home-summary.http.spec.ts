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
import { HomeSummaryController } from "../../src/modules/crm/sales/sales-orders/home-summary.module.js";
import { HOME_SUMMARY_LEGACY_READER } from "../../src/modules/crm/sales/sales-orders/home-summary.port.js";
import { HomeSummaryRepository } from "../../src/modules/crm/sales/sales-orders/home-summary.repository.js";
import { HomeSummaryService } from "../../src/modules/crm/sales/sales-orders/home-summary.service.js";
import { emptyStageCounts, type StageAggregateRow, stageCountsFromRow } from "../../src/modules/crm/sales/sales-orders/home-summary.types.js";

describe("Home summary HTTP without database providers", () => {
    let app: NestFastifyApplication;
    let roles: { code: string; status: string }[];
    let permissions: { code: string; effect: string }[];
    const tx = {};
    const aggregate = vi.fn().mockResolvedValue(emptyStageCounts());
    const legacyAggregate = vi.fn().mockResolvedValue({ counts: emptyStageCounts(), duplicatesExcluded: 0 });
    const identity = {
        getCurrentUser: vi.fn((session?: string) => {
            if (!session) throw new UnauthorizedException();
            return Promise.resolve({ roles, permissions, user: { publicId: "actor" } });
        }),
    };
    beforeAll(async () => {
        const module = await Test.createTestingModule({
            controllers: [HomeSummaryController],
            providers: [HomeSummaryService, { provide: IdentityService, useValue: identity }, { provide: HomeSummaryRepository, useValue: { readSnapshot: async (read: (transaction: object) => Promise<unknown>) => read(tx), aggregate } }, { provide: HOME_SUMMARY_LEGACY_READER, useValue: { enabled: () => true, aggregate: legacyAggregate } }, { provide: AuthenticatedReadRateLimit, useValue: { enforceAuthenticatedReadLimit: () => true } }, { provide: APP_GUARD, useClass: AuthGuard }],
        }).compile();
        app = module.createNestApplication<NestFastifyApplication>(new FastifyAdapter(), { logger: false });
        await app.register(cookie);
        await app.init();
        await app.getHttpAdapter().getInstance().ready();
    });
    beforeEach(() => {
        vi.clearAllMocks();
        roles = [{ code: "formalizacion", status: "active" }];
        permissions = [{ code: "formalizacion.home.stages.read", effect: "allow" }];
    });
    afterAll(async () => {
        await app.close();
    });
    it("returns the canonical response and no-store for an active role without approval permissions", async () => {
        const response = await app.inject({ url: "/formalization/home/summary", headers: { cookie: `${SESSION_COOKIE_NAME}=session` } });
        expect(response.statusCode).toBe(200);
        expect(response.headers["cache-control"]).toBe("no-store");
        expect(response.json()).toMatchObject({ schemaVersion: 1, counts: emptyStageCounts(), sources: { legacyEnabled: true, duplicatesExcluded: 0 } });
        expect(aggregate).toHaveBeenCalledOnce();
        expect(legacyAggregate).toHaveBeenCalledOnce();
    });
    it("rejects an unauthenticated read before aggregate SQL", async () => {
        expect((await app.inject({ url: "/formalization/home/summary" })).statusCode).toBe(401);
        expect(aggregate).not.toHaveBeenCalled();
        expect(legacyAggregate).not.toHaveBeenCalled();
    });
    it("accepts effective Owner inheritance but rejects its direct stage deny before either source", async () => {
        roles.push({ code: "owner", status: "active" });
        const request = { url: "/formalization/home/summary", headers: { cookie: `${SESSION_COOKIE_NAME}=session` } };
        expect((await app.inject(request)).statusCode).toBe(200);
        permissions.push({ code: "formalizacion.home.stages.read", effect: "deny" });
        expect((await app.inject(request)).statusCode).toBe(403);
        expect(aggregate).toHaveBeenCalledOnce();
        expect(legacyAggregate).toHaveBeenCalledOnce();
    });
    it("reads fresh annual closure counts on every request", async () => {
        aggregate.mockResolvedValueOnce({ ...emptyStageCounts(), closedThisYear: 1 }).mockResolvedValueOnce({ ...emptyStageCounts(), closedThisYear: 2 });
        const request = { url: "/formalization/home/summary", headers: { cookie: `${SESSION_COOKIE_NAME}=session` } };
        const first = await app.inject(request);
        const second = await app.inject(request);
        expect(first.json()).toMatchObject({ counts: { closedThisYear: 1 } });
        expect(second.json()).toMatchObject({ counts: { closedThisYear: 2 } });
        expect(first.headers["cache-control"]).toBe("no-store");
        expect(second.headers["cache-control"]).toBe("no-store");
        expect(aggregate).toHaveBeenCalledTimes(2);
        expect(legacyAggregate).toHaveBeenCalledTimes(2);
    });
    it.each([{ row: undefined }, { row: {} as StageAggregateRow }, { row: { toSend: "1.0000000000000001" } as StageAggregateRow }])("returns 503 rather than a false zero for malformed aggregate $row", async ({ row }) => {
        aggregate.mockImplementationOnce(() => Promise.resolve().then(() => stageCountsFromRow(row)));
        const response = await app.inject({ url: "/formalization/home/summary", headers: { cookie: `${SESSION_COOKIE_NAME}=session` } });
        expect(response.statusCode).toBe(503);
        expect(response.json()).not.toHaveProperty("counts");
        expect(legacyAggregate).not.toHaveBeenCalled();
    });
    it("rejects the next request when role revocation removes its effective read grant", async () => {
        const request = { url: "/formalization/home/summary", headers: { cookie: `${SESSION_COOKIE_NAME}=session` } };
        expect((await app.inject(request)).statusCode).toBe(200);
        roles = [
            { code: "formalizacion", status: "inactive" },
            { code: "owner", status: "active" },
        ];
        // La identidad real recalcula los permisos al revocar el rol; no conserva sus grants en memoria.
        permissions = [];
        expect((await app.inject(request)).statusCode).toBe(403);
        expect(aggregate).toHaveBeenCalledOnce();
        expect(legacyAggregate).toHaveBeenCalledOnce();
    });
});
