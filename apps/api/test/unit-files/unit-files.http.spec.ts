import "reflect-metadata";

import cookie from "@fastify/cookie";
import { FastifyAdapter, type NestFastifyApplication } from "@nestjs/platform-fastify";
import { Test } from "@nestjs/testing";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { UnitFilesController } from "../../src/modules/crm/unit-files/unit-files.controller.js";
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
