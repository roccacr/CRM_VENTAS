import "reflect-metadata";

import cookie from "@fastify/cookie";
import { FastifyAdapter, type NestFastifyApplication } from "@nestjs/platform-fastify";
import { Test } from "@nestjs/testing";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { IdentityService } from "../../src/modules/crm/identity/identity.service.js";
import { UnitFilesController } from "../../src/modules/crm/unit-files/unit-files.controller.js";
import { UnitFilesRepository } from "../../src/modules/crm/unit-files/unit-files.repository.js";
import { UnitFilesService } from "../../src/modules/crm/unit-files/unit-files.service.js";

describe("Unit Files HTTP criteria validation without emitted decorator metadata", () => {
    let app: NestFastifyApplication;
    const service = { list: vi.fn((_session: unknown, filter: unknown) => filter), options: vi.fn((_session: unknown, filter: unknown) => filter) };
    beforeAll(async () => {
        const module = await Test.createTestingModule({ controllers: [UnitFilesController], providers: [{ provide: UnitFilesService, useValue: service }] }).compile();
        app = module.createNestApplication<NestFastifyApplication>(new FastifyAdapter(), { logger: false });
        await app.register(cookie);
        await app.init();
        await app.getHttpAdapter().getInstance().ready();
    });
    afterAll(async () => {
        await app.close();
    });
    it("transforms comma-separated CRM project IDs and supplies the bounded default", async () => {
        const response = await app.inject({ method: "GET", url: "/unit-files?moduleCode=administration&projectIds=01M4RCK911NS2ZNCRYPBD40B9W" });
        expect(response.statusCode).toBe(200);
        expect(response.json()).toMatchObject({ projectIds: ["01M4RCK911NS2ZNCRYPBD40B9W"], limit: 50 });
    });
    it("rejects unfiltered and excessive requests before reaching the service", async () => {
        service.list.mockClear();
        expect((await app.inject({ method: "GET", url: "/unit-files?moduleCode=administration" })).statusCode).toBe(400);
        expect((await app.inject({ method: "GET", url: "/unit-files?moduleCode=administration&projectIds=01M4RCK911NS2ZNCRYPBD40B9W&limit=200" })).statusCode).toBe(400);
        expect(service.list).not.toHaveBeenCalled();
    });
    it("retains code matching and exact unit criteria independently", async () => {
        const result = await app.inject({ method: "GET", url: "/unit-files?moduleCode=administration&projectIds=01M4RCK911NS2ZNCRYPBD40B9W&codeMatch=ff03&code=AM-FF031" });
        expect(result.statusCode).toBe(200);
        expect(result.json()).toMatchObject({ codeMatch: "ff03", code: "AM-FF031" });
    });
    it("validates scoped dropdown requests and routes options before the detail wildcard", async () => {
        const url = "/unit-files/options?moduleCode=administration&projectIds=01M4RCK911NS2ZNCRYPBD40B9W";
        const result = await app.inject({ method: "GET", url: url + "&kind=housingType&search=A" });
        expect(result.statusCode).toBe(200);
        expect(result.json()).toMatchObject({ projectIds: ["01M4RCK911NS2ZNCRYPBD40B9W"], kind: "housingType", search: "A", limit: 50 });
        expect((await app.inject({ method: "GET", url: url + "&kind=unknown" })).statusCode).toBe(400);
        expect((await app.inject({ method: "GET", url: "/unit-files/options?moduleCode=administration&kind=code" })).statusCode).toBe(400);
    });
});

describe("Unit Files HTTP effective permission enforcement", () => {
    let app: NestFastifyApplication;
    const identity = { getCurrentUser: vi.fn() };
    const repository = { projects: vi.fn(), list: vi.fn(), detail: vi.fn(), findPromotedId: vi.fn(), options: vi.fn(), facets: vi.fn() };
    beforeAll(async () => {
        const module = await Test.createTestingModule({ controllers: [UnitFilesController], providers: [UnitFilesService, { provide: IdentityService, useValue: identity }, { provide: UnitFilesRepository, useValue: repository }] }).compile();
        app = module.createNestApplication<NestFastifyApplication>(new FastifyAdapter(), { logger: false });
        await app.register(cookie);
        await app.init();
        await app.getHttpAdapter().getInstance().ready();
    });
    afterAll(async () => {
        await app.close();
    });
    const query = "moduleCode=administration&projectIds=01M4RCK911NS2ZNCRYPBD40B9W";
    const urls = [`/unit-files?${query}`, "/unit-files/legacy:unit-files:1?moduleCode=administration", `/unit-files/options?${query}&kind=code`, `/unit-files/facets?${query}&kind=code`, "/unit-files/projects?moduleCode=administration"];
    it.each(urls)("returns 403 for Owner without allow or with explicit deny before data reads: %s", async (url) => {
        for (const permissions of [
            [],
            [
                { code: "administration.catalog_file.read", effect: "allow" },
                { code: "administration.catalog_file.read", effect: "deny" },
            ],
        ]) {
            identity.getCurrentUser.mockResolvedValue({ roles: [{ code: "owner", status: "active" }], orgUnits: [], permissions });
            expect((await app.inject({ method: "GET", url })).statusCode).toBe(403);
            for (const read of Object.values(repository)) expect(read).not.toHaveBeenCalled();
        }
    });
});
