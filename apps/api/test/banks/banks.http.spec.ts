import "reflect-metadata";

import cookie from "@fastify/cookie";
import { Reflector } from "@nestjs/core";
import { FastifyAdapter, type NestFastifyApplication } from "@nestjs/platform-fastify";
import { Test } from "@nestjs/testing";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { AuthGuard } from "../../src/common/security/auth.guard.js";
import type { AuthenticatedReadRateLimit } from "../../src/common/security/authenticated-read-rate-limit.js";
import { BanksController } from "../../src/modules/crm/banks/banks.controller.js";
import { BanksRepository } from "../../src/modules/crm/banks/banks.repository.js";
import { BanksService } from "../../src/modules/crm/banks/banks.service.js";
import { IdentityService } from "../../src/modules/crm/identity/identity.service.js";
import type { IdentityProfile } from "../../src/modules/crm/identity/identity.types.js";

const bankId = "01K8SJ7KXKWWPMAWEA8NXGWW83",
    advisorId = "01K8SJ7KXKWWPMAWEA8NXGWW84";
const root = "/catalogs/banks/items";
const base = { moduleCode: "ventas", name: "Banco", reason: "Motivo requerido" };
const contact = { ...base, name: "Ejecutivo", email: " TEST@EXAMPLE.COM ", phone: "123", area: "Crédito" };
describe("Banks HTTP contracts and authorization", () => {
    let app: NestFastifyApplication;
    let profile: IdentityProfile;
    const bank = { publicId: bankId, name: "Banco", status: "active", version: 1, createdAt: "2026-11-03T12:00:00.000Z", updatedAt: "2026-11-03T12:00:00.000Z", advisorCount: 0 };
    const advisor = { ...bank, publicId: advisorId, bankPublicId: bankId, email: "test@example.com", phone: "123", area: "Crédito" };
    const persistence = { listBanks: vi.fn().mockResolvedValue({ items: [bank], total: 1 }), getBank: vi.fn().mockResolvedValue(bank), listAdvisors: vi.fn().mockResolvedValue({ items: [advisor], total: 1 }), mutateBank: vi.fn().mockResolvedValue(bank), mutateAdvisor: vi.fn().mockResolvedValue(advisor) };
    const identity = { getCurrentUser: vi.fn().mockImplementation(() => Promise.resolve(profile)) };
    beforeAll(async () => {
        const module = await Test.createTestingModule({ controllers: [BanksController], providers: [BanksService, { provide: BanksRepository, useValue: persistence }, { provide: IdentityService, useValue: identity }] }).compile();
        app = module.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
        await app.register(cookie);
        app.useGlobalGuards(new AuthGuard(new Reflector(), identity as unknown as IdentityService, { enforceAuthenticatedReadLimit: () => true } as unknown as AuthenticatedReadRateLimit));
        await app.init();
        await app.getHttpAdapter().getInstance().ready();
    });
    beforeEach(() => {
        vi.clearAllMocks();
        profile = { roles: [{ code: "owner", status: "active" }], user: { status: "active", publicId: "actor-session" }, orgUnits: [], permissions: ["read", "create", "update", "inactivate"].map((action) => ({ code: `ventas.catalog_bank.${action}`, effect: "allow" })) } as unknown as IdentityProfile;
    });
    afterAll(async () => app.close());
    it("returns direct bank/detail/mutation objects and paginated lists", async () => {
        expect((await app.inject({ method: "GET", url: `${root}?moduleCode=ventas` })).json()).toEqual({ items: [bank], total: 1 });
        expect((await app.inject({ method: "GET", url: `${root}/${bankId}?moduleCode=ventas` })).json()).toEqual(bank);
        expect((await app.inject({ method: "POST", url: root, payload: base })).json()).toEqual(bank);
        expect((await app.inject({ method: "PATCH", url: `${root}/${bankId}`, payload: { ...base, expectedVersion: 1 } })).statusCode).toBe(200);
        expect((await app.inject({ method: "PATCH", url: `${root}/${bankId}/status`, payload: { moduleCode: "ventas", status: "inactive", reason: base.reason, expectedVersion: 1 } })).statusCode).toBe(200);
        expect((await app.inject({ method: "GET", url: `${root}/${bankId}/advisors?moduleCode=ventas` })).json()).toEqual({ items: [advisor], total: 1 });
        expect((await app.inject({ method: "POST", url: `${root}/${bankId}/advisors`, payload: contact })).json()).toEqual(advisor);
        expect((await app.inject({ method: "PATCH", url: `${root}/${bankId}/advisors/${advisorId}`, payload: { ...contact, expectedVersion: 1 } })).json()).toEqual(advisor);
        expect((await app.inject({ method: "PATCH", url: `${root}/${bankId}/advisors/${advisorId}/status`, payload: { moduleCode: "ventas", status: "active", reason: base.reason, expectedVersion: 1 } })).statusCode).toBe(200);
        expect(persistence.mutateAdvisor).toHaveBeenCalledWith({ bankId, advisorId }, { kind: "update", name: "Ejecutivo", email: "test@example.com", phone: "123", area: "Crédito", expectedVersion: 1 }, expect.objectContaining({ actorPublicId: "actor-session" }));
    });
    it("validates DTOs with esbuild and rejects numeric identities, extra fields and missing versions", async () => {
        expect((await app.inject({ method: "GET", url: `${root}/123?moduleCode=ventas` })).statusCode).toBe(400);
        expect((await app.inject({ method: "PATCH", url: `${root}/${bankId}`, payload: base })).statusCode).toBe(400);
        expect((await app.inject({ method: "POST", url: root, payload: { ...base, actorPublicId: "spoofed" } })).statusCode).toBe(400);
        expect((await app.inject({ method: "PATCH", url: `${root}/${bankId}/advisors/${advisorId}`, payload: { ...contact, expectedVersion: 1, bankPublicId: advisorId } })).statusCode).toBe(400);
        expect(persistence.mutateBank).not.toHaveBeenCalled();
        expect(persistence.mutateAdvisor).not.toHaveBeenCalled();
    });
    it("requires role and read permission before executing any operation", async () => {
        profile.roles = [];
        expect((await app.inject({ method: "POST", url: root, payload: base })).statusCode).toBe(403);
        profile.roles = [{ code: "owner", status: "active" } as IdentityProfile["roles"][number]];
        profile.permissions = profile.permissions.filter((p) => !p.code.endsWith(".read"));
        expect((await app.inject({ method: "POST", url: `${root}/${bankId}/advisors`, payload: contact })).statusCode).toBe(403);
        expect(persistence.mutateBank).not.toHaveBeenCalled();
        expect(persistence.mutateAdvisor).not.toHaveBeenCalled();
    });
});
