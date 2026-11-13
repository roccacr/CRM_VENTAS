import "reflect-metadata";

import cookie from "@fastify/cookie";
import { UnauthorizedException } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { FastifyAdapter, type NestFastifyApplication } from "@nestjs/platform-fastify";
import { Test } from "@nestjs/testing";
import fc from "fast-check";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { AuthGuard } from "../../src/common/security/auth.guard.js";
import { AuthenticatedReadRateLimit } from "../../src/common/security/authenticated-read-rate-limit.js";
import { SESSION_COOKIE_NAME } from "../../src/common/security/http-security.constants.js";
import { IdentityService } from "../../src/modules/crm/identity/identity.service.js";
import type { IdentityProfile } from "../../src/modules/crm/identity/identity.types.js";
import { resolveModuleRoleAccess } from "../../src/modules/crm/identity/identity-module-policy.js";
import { canEnterSales, isCurrentSalesPermission, withDefaultSalesModule } from "../../src/modules/crm/sales/sales-access.js";
import { SalesHomeController } from "../../src/modules/crm/sales/sales-home.module.js";

const fixture = (role: string): IdentityProfile => ({
    auth: { availableProviders: ["local"], currentProvider: "local", localStatus: "active", microsoft: null, primaryProvider: "microsoft" },
    roles: [{ code: role, name: role, status: "active" }],
    orgUnits: [{ code: "ventas", name: "Ventas", publicId: "sales", membership: "member", scope: "all_areas", status: "active" }],
    permissions: [{ code: "ventas.home.read", effect: "allow", scope: "self", source: "role" }],
    user: { displayName: "Synthetic actor", email: "actor@example.test", publicId: "actor", status: "active", permissionVersion: 1, profileImageUrl: null },
    session: { publicId: "session", status: "active", expiresAt: "2099-01-01T00:00:00Z", expiresInSeconds: 60, permissionVersion: 1 },
});

describe("Sales Inicio through the real AuthGuard and controller, without database", () => {
    let app: NestFastifyApplication;
    let profile = fixture("ventas");
    const read = () => app.inject({ url: "/sales/home", headers: { cookie: `${SESSION_COOKIE_NAME}=synthetic-session` } });
    beforeAll(async () => {
        const module = await Test.createTestingModule({
            controllers: [SalesHomeController],
            providers: [
                {
                    provide: IdentityService,
                    useValue: {
                        getCurrentUser: (token: string | undefined) => {
                            if (token !== "synthetic-session") throw new UnauthorizedException();
                            return Promise.resolve(profile);
                        },
                    },
                },
                { provide: AuthenticatedReadRateLimit, useValue: { enforceAuthenticatedReadLimit: () => true } },
                { provide: APP_GUARD, useClass: AuthGuard },
            ],
        }).compile();
        app = module.createNestApplication<NestFastifyApplication>(new FastifyAdapter(), { logger: false });
        await app.register(cookie);
        await app.init();
        await app.getHttpAdapter().getInstance().ready();
    });
    afterAll(async () => {
        await app.close();
    });

    it.each(["owner", "jefe_general", "jefe_ventas", "ventas"])("allows %s only Inicio and rejects its next request after a deny", async (role) => {
        profile = fixture(role);
        const response = await read();
        expect(response.statusCode).toBe(200);
        expect(response.json()).toEqual({ module: "ventas", sections: ["home"] });
        profile.permissions.push({ code: "ventas.home.read", effect: "deny", scope: null, source: "override" });
        expect((await read()).statusCode).toBe(403);
    });
    it.each(["mercadeo", "formalizacion", "jefe_mercadeo", "jefe_formalizaciones", "", "OWNER", "ventas "])("rejects unauthorized role %j despite membership and personal grant", async (role) => {
        profile = fixture(role);
        profile.permissions = profile.permissions.map((permission) => ({ ...permission, source: "override" }));
        expect((await read()).statusCode).toBe(403);
    });
    it.each(["role", "membership", "permission"])("rejects revoked %s without reading business records", async (part) => {
        profile = fixture("owner");
        if (part === "role") profile.roles = profile.roles.map((role) => ({ ...role, status: "inactive" }));
        if (part === "membership") profile.orgUnits = [];
        if (part === "permission") profile.permissions = [];
        expect((await read()).statusCode).toBe(403);
    });
    it("rejects an anonymous request", async () => {
        expect((await app.inject({ url: "/sales/home" })).statusCode).toBe(401);
    });
    it("fuzzes unrecognized roles through the HTTP boundary", async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.string().filter((role) => !["owner", "jefe_general", "jefe_ventas", "ventas"].includes(role)),
                async (role) => {
                    profile = fixture(role);
                    expect((await read()).statusCode).toBe(403);
                },
            ),
            { seed: 130078, numRuns: 50 },
        );
    });
    it("keeps deny precedence independent of permission order", () => {
        fc.assert(
            fc.property(fc.boolean(), (reverse) => {
                const actor = fixture("owner");
                actor.permissions.push({ code: "ventas.home.read", effect: "deny", scope: null, source: "override" });
                if (reverse) actor.permissions.reverse();
                expect(canEnterSales(actor)).toBe(false);
            }),
            { seed: 130078 },
        );
    });
    it("does not promote another chief into Sales through a residual module membership", () => {
        const chief = { code: "jefe_mercadeo", name: "Chief", status: "active" };
        const mappings = [chief, { code: "ventas", name: "Ventas", status: "active" }].map((role) => ({ ...role, moduleCode: "ventas", mappingStatus: "active", moduleStatus: "active", moduleDeleted: null }));
        const access = resolveModuleRoleAccess([chief], mappings, ["ventas"]);
        expect(access.roles.some((role) => role.code === "ventas")).toBe(false);
        expect(canEnterSales({ ...fixture("ventas"), roles: access.roles })).toBe(false);
    });
    it("keeps General within its selected module ceiling", () => {
        const general = { code: "jefe_general", name: "General", status: "active", permissionInheritance: "selected_modules" as const };
        const mappings = [general, { code: "ventas", name: "Ventas", status: "active" }].map((role) => ({ ...role, moduleCode: "ventas", mappingStatus: "active", moduleStatus: "active", moduleDeleted: null }));
        expect(resolveModuleRoleAccess([general], mappings, []).moduleCodes).toEqual([]);
        expect(resolveModuleRoleAccess([general], mappings, ["ventas"]).moduleCodes).toEqual(["ventas"]);
    });
    it.each(["owner", "jefe_general", "jefe_ventas", "ventas"])("assigns the Sales module by default for %s without touching other modules", (role) => {
        expect(withDefaultSalesModule([role], ["mercadeo"])).toEqual(["mercadeo", "ventas"]);
        expect(withDefaultSalesModule([role], ["ventas"])).toEqual(["ventas"]);
        expect(withDefaultSalesModule([` ${role.toUpperCase()} `], [])).toEqual(["ventas"]);
        expect(withDefaultSalesModule(["mercadeo"], ["mercadeo"])).toEqual(["mercadeo"]);
    });
    it.each(["lead.read", "opportunity.read", "estimate.read", "ventas.calendar.read", "ventas.catalog_project.read"])("retires %s without removing another module", (code) => {
        expect(isCurrentSalesPermission(code, "ventas")).toBe(false);
        expect(isCurrentSalesPermission("mercadeo.catalog_project.read", "mercadeo")).toBe(true);
        expect(isCurrentSalesPermission("lead.profile.read", "lead")).toBe(true);
        expect(isCurrentSalesPermission("ventas.notes.read", "ventas")).toBe(false);
    });
});
