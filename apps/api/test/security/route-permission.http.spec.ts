import "reflect-metadata";

import cookie from "@fastify/cookie";
import { Controller, Get, RequestMethod, type Type } from "@nestjs/common";
import { METHOD_METADATA, MODULE_METADATA, PATH_METADATA, SELF_DECLARED_DEPS_METADATA } from "@nestjs/common/constants.js";
import type * as NestConfig from "@nestjs/config";
import { ConfigService } from "@nestjs/config";
import { APP_GUARD, MetadataScanner } from "@nestjs/core";
import { FastifyAdapter, type NestFastifyApplication } from "@nestjs/platform-fastify";
import { Test } from "@nestjs/testing";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { AuthGuard } from "../../src/common/security/auth.guard.js";
import { AuthenticatedReadRateLimit } from "../../src/common/security/authenticated-read-rate-limit.js";
import { CsrfGuard } from "../../src/common/security/csrf.guard.js";
import { createSignedCsrfToken } from "../../src/common/security/csrf-token.js";
import { CSRF_COOKIE_NAME, CSRF_HEADER_NAME_LOWERCASE, SESSION_COOKIE_NAME } from "../../src/common/security/http-security.constants.js";
import { type PermissionRequirement, REQUIRE_PERMISSION_METADATA, RequirePermission } from "../../src/common/security/require-permission.decorator.js";
import { ROUTE_SECURITY_METADATA, RouteSecurity } from "../../src/common/security/route-security.decorator.js";
import { CATALOG_DEFINITIONS } from "../../src/modules/crm/catalogs/catalogs.constants.js";
import { IdentityService } from "../../src/modules/crm/identity/identity.service.js";
import type { IdentityProfile } from "../../src/modules/crm/identity/identity.types.js";
import { IdentityAccessManagementController } from "../../src/modules/crm/identity/identity-access-management.controller.js";

// Read real Nest registration metadata without ConfigModule loading .env or constructing DB providers.
vi.mock("@nestjs/config", async (load) => {
    const actual = await load<typeof NestConfig>();
    return { ...actual, ConfigModule: { forRoot: () => ({ module: actual.ConfigModule }) } };
});
const { AppModule } = await import("../../src/app.module.js");

function controllersFrom(module: Type<object>, seen = new Set<Type<object>>()): Type<object>[] {
    if (seen.has(module)) return [];
    seen.add(module);
    const controllers = (Reflect.getMetadata(MODULE_METADATA.CONTROLLERS, module) ?? []) as Type<object>[];
    const imports = (Reflect.getMetadata(MODULE_METADATA.IMPORTS, module) ?? []) as (Type<object> | { module: Type<object> })[];
    return [...controllers, ...imports.flatMap((entry) => controllersFrom(typeof entry === "function" ? entry : entry.module, seen))];
}

@Controller(["descriptor-probe", "descriptor-alias"])
class AliasProbeController {
    static calls = 0;
    @Get(["read", "other"])
    @RouteSecurity("permission")
    @RequirePermission({ kind: "all", codes: ["user.view_list"] })
    read() {
        AliasProbeController.calls++;
        return { ok: true };
    }
}

function routesFrom(controllers: Type<object>[]) {
    return controllers.flatMap((controller) =>
        new MetadataScanner().getAllMethodNames(controller.prototype as object).flatMap((name) => {
            const handler = Reflect.get(controller.prototype as object, name) as object;
            const method = Reflect.getMetadata(METHOD_METADATA, handler) as RequestMethod | undefined;
            if (method === undefined || Reflect.getOwnMetadata(ROUTE_SECURITY_METADATA, handler) !== "permission") return [];
            const prefixes = Reflect.getMetadata(PATH_METADATA, controller) as string | string[];
            const paths = Reflect.getMetadata(PATH_METADATA, handler) as string | string[];
            const requirement = Reflect.getOwnMetadata(REQUIRE_PERMISSION_METADATA, handler) as PermissionRequirement | undefined;
            return [prefixes].flat().flatMap((prefix) =>
                [paths].flat().map((path) => ({
                    controller,
                    handler,
                    name,
                    method: RequestMethod[method] as "GET" | "POST" | "PATCH" | "PUT" | "DELETE",
                    path:
                        "/" +
                        [prefix, path]
                            .flatMap((part) => part.split("/"))
                            .filter(Boolean)
                            .join("/"),
                    requirement,
                })),
            );
        }),
    );
}

const controllers = [...new Set(controllersFrom(AppModule))];
const routes = routesFrom(controllers);
function requireDescriptors(entries: ReturnType<typeof routesFrom>) {
    const missing = entries.filter((entry) => !entry.requirement);
    if (missing.length) throw new Error("Missing permission descriptors: " + missing.map((entry) => entry.method + " " + entry.path).join(", "));
}

const secret = "route-permission-http-cookie-secret";
const session = "route-permission-session";
function profileWith(codes: string[] = []): IdentityProfile {
    return {
        auth: { availableProviders: ["local"], currentProvider: "local", localStatus: "active", microsoft: null, primaryProvider: "microsoft" },
        orgUnits: [],
        roles: [],
        permissions: codes.map((code) => ({ code, effect: "allow", scope: "all_areas", source: "role" })),
        session: { expiresAt: new Date(Date.now() + 60_000).toISOString(), expiresInSeconds: 60, permissionVersion: 1, publicId: "session", status: "active" },
        user: { displayName: "Actor", email: "actor@example.test", permissionVersion: 1, profileImageUrl: null, publicId: "actor", status: "active" },
    };
}

// Expected permissions come from the inspected service contracts, independently of route metadata.
function expectedCatalogCodes(route: (typeof routes)[number]): string[] {
    const code = route.path.split("/")[2];
    const definition = CATALOG_DEFINITIONS.find((item) => item.routeCode === (code === ":catalogCode" ? "files" : code));
    if (!definition) throw new Error("Unknown catalog route " + route.path);
    const action = route.method === "GET" ? "read" : route.method === "POST" ? "create" : route.path.endsWith("/status") ? "inactivate" : "update";
    return ["ventas." + definition.moduleCode + "." + action];
}

function expectedCodes(route: (typeof routes)[number]): string[] {
    if (route.path.startsWith("/catalogs/")) return expectedCatalogCodes(route);
    if (route.path.startsWith("/unit-files")) return ["ventas.catalog_file.read"];
    if (route.path.startsWith("/formalization/")) return ["formalizacion.home.approvals.read"];
    if (route.path.startsWith("/audit")) return ["role.assign"];
    return expectedIdentityCodes(route);
}

function expectedIdentityCodes(route: (typeof routes)[number]): string[] {
    const accessMethods = ["readSecurityCatalog", "updateRole", "readRolePermissions", "replaceRolePermissions", "readUserAccess", "replaceUserAccess", "deleteRole"];
    if (route.controller === IdentityAccessManagementController && accessMethods.includes(route.name)) return ["role.assign"];
    const identity: Record<string, string[]> = { users: ["user.view_list"], userDetail: ["user.view_detail"], createUser: ["user.create", "role.assign"], updateUser: ["user.update"], updateUserStatus: ["user.deactivate"] };
    const codes = identity[route.name];
    if (route.controller.name === "IdentityController" && codes) return codes;
    throw new Error("No expected permission mapping for " + route.method + " " + route.path);
}

describe("real module permission inventory and HTTP boundary (no environment or database)", () => {
    let app: NestFastifyApplication;
    let profile: IdentityProfile;
    const current = vi.fn().mockImplementation(() => Promise.resolve(profile));
    const domainCalls: ReturnType<typeof vi.fn>[] = [];
    const handlers = new Map<object, ReturnType<typeof vi.spyOn>>();
    // The explicit provider setup exposes every domain call for the full controller inventory.
    // eslint-disable-next-line complexity, sonarjs/cognitive-complexity
    beforeAll(async () => {
        const providers = new Map<unknown, Record<string, unknown>>();
        for (const controller of controllers) {
            const deps = (Reflect.getMetadata(SELF_DECLARED_DEPS_METADATA, controller) ?? []) as { param: Type<object> }[];
            for (const { param } of deps) {
                if (providers.has(param) || param === ConfigService) continue;
                const stub: Record<string, unknown> = {};
                for (const name of new MetadataScanner().getAllMethodNames(param.prototype as object)) {
                    const call = vi.fn().mockResolvedValue({ ok: true });
                    stub[name] = call;
                    domainCalls.push(call);
                }
                providers.set(param, stub);
            }
        }
        const identity = providers.get(IdentityService);
        if (!identity) throw new Error("Identity provider missing");
        identity.getCurrentUser = current;
        const module = await Test.createTestingModule({
            controllers: [...controllers.filter((controller) => routes.some((route) => route.controller === controller)), AliasProbeController],
            providers: [...[...providers].map(([provide, useValue]) => ({ provide: provide as Type<object>, useValue })), { provide: ConfigService, useValue: new ConfigService({ COOKIE_SECRET: secret }) }, { provide: AuthenticatedReadRateLimit, useValue: { enforceAuthenticatedReadLimit: () => Promise.resolve(true) } }, { provide: APP_GUARD, useClass: CsrfGuard }, { provide: APP_GUARD, useClass: AuthGuard }],
        }).compile();
        app = module.createNestApplication<NestFastifyApplication>(new FastifyAdapter(), { logger: false });
        await app.register(cookie);
        // Install before Nest binds handlers, and preserve method-local security/HTTP metadata.
        for (const route of routes) {
            const handler = vi.spyOn(app.get(route.controller), route.name as never);
            for (const key of Reflect.getMetadataKeys(route.handler) as unknown[]) Reflect.defineMetadata(key, Reflect.getMetadata(key, route.handler), handler);
            handlers.set(route.handler, handler);
        }
        await app.init();
        await app.getHttpAdapter().getInstance().ready();
    });
    beforeEach(() => {
        vi.clearAllMocks();
        profile = profileWith();
    });
    afterAll(async () => {
        await app.close();
    });

    it("requires a descriptor on all 49 registered permission handlers", () => {
        expect(new Set(routes.map((route) => route.handler)).size).toBe(49);
        requireDescriptors(routes);
    });
    it("inventory rejects missing metadata on every controller and method alias", () => {
        const aliases = routesFrom([AliasProbeController]);
        expect(aliases.map((route) => route.path)).toEqual(["/descriptor-probe/read", "/descriptor-probe/other", "/descriptor-alias/read", "/descriptor-alias/other"]);
        expect(() => {
            requireDescriptors(aliases.map((route) => ({ ...route, requirement: undefined })));
        }).toThrow("GET /descriptor-alias/other");
    });

    function request(route: (typeof routes)[number]) {
        let url = route.path.replace(":catalogCode", "files").replace(/:[A-Za-z]+/g, "target");
        const query = new URLSearchParams({ moduleCode: "ventas" });
        if (["/unit-files", "/unit-files/options", "/unit-files/facets"].includes(url)) query.set("projectIds", "01ARZ3NDEKTSV4RRFFQ69G5FAV");
        if (["/unit-files/options", "/unit-files/facets"].includes(url)) query.set("kind", "code");
        if (url === "/audit") query.set("sectionCode", "catalogs");
        if (route.method === "GET") url += "?" + query.toString();
        const csrf = createSignedCsrfToken(secret, session);
        return app.inject({ method: route.method, url, ...(route.method === "GET" || route.method === "DELETE" ? {} : { payload: { moduleCode: "ventas", status: "inactive", reason: "Permission regression", name: "Value" } }), headers: { cookie: `${SESSION_COOKIE_NAME}=${session}; ${CSRF_COOKIE_NAME}=${csrf}`, [CSRF_HEADER_NAME_LOWERCASE]: csrf } });
    }
    describe.each(routes)("$method $path", (route) => {
        it.each(["missing", "unrelated", "deny", "owner-deny"])("blocks %s before handler/domain operations", async (mode) => {
            profile = profileWith(mode === "unrelated" ? ["unrelated.read"] : mode === "missing" ? [] : expectedCodes(route));
            if (mode === "deny" || mode === "owner-deny") profile.permissions.push(...expectedCodes(route).map((code) => ({ code, effect: "deny" as const, scope: null, source: "override" as const })));
            if (mode === "owner-deny") profile.roles = [{ code: "owner", name: "Owner", status: "active" }];
            expect((await request(route)).statusCode).toBe(403);
            expect(handlers.get(route.handler)).not.toHaveBeenCalled();
            for (const call of domainCalls) expect(call).not.toHaveBeenCalled();
        });
        it("accepts the existing exact mapping and stops the next request after revocation", async () => {
            profile = profileWith(expectedCodes(route));
            const first = await request(route);
            expect(first.statusCode).toBe(route.method === "POST" ? 201 : 200);
            const before = domainCalls.map((call) => call.mock.calls.length);
            profile = profileWith();
            expect((await request(route)).statusCode).toBe(403);
            expect(domainCalls.map((call) => call.mock.calls.length)).toEqual(before);
            expect(current).toHaveBeenCalledTimes(2);
        });
    });
    it.each(routesFrom([AliasProbeController]))("enforces $path alias before handler entry", async (route) => {
        const before = AliasProbeController.calls;
        expect((await request(route)).statusCode).toBe(403);
        expect(AliasProbeController.calls).toBe(before);
        profile = profileWith(["user.view_list"]);
        expect((await request(route)).statusCode).toBe(200);
        expect(AliasProbeController.calls).toBe(before + 1);
    });

    it("retains the audit active-Owner exemption but deliberately blocks an explicit role.assign deny", async () => {
        profile.roles = [{ code: "owner", name: "Owner", status: "active" }];
        expect((await app.inject({ url: "/audit/options", headers: { cookie: `${SESSION_COOKIE_NAME}=${session}` } })).statusCode).toBe(200);
        const before = domainCalls.map((call) => call.mock.calls.length);
        profile.permissions.push({ code: "role.assign", effect: "deny", scope: null, source: "override" });
        expect((await app.inject({ url: "/audit/options", headers: { cookie: `${SESSION_COOKIE_NAME}=${session}` } })).statusCode).toBe(403);
        expect(domainCalls.map((call) => call.mock.calls.length)).toEqual(before);
    });

    it.each([
        ["/catalogs/projects/items?moduleCode=%20ventas%20", "ventas.catalog_project.read", 200],
        ["/catalogs/projects/items?moduleCode=VENTAS", "ventas.catalog_project.read", 403],
        ["/catalogs/projects/items?moduleCode=ventas&moduleCode=mercadeo", "ventas.catalog_project.read", 403],
        ["/catalogs/projects/items", "ventas.catalog_project.read", 403],
        ["/unit-files/projects?moduleCode=%20ventas%20", "ventas.catalog_file.read", 403],
        ["/unit-files/projects?moduleCode=VENTAS", "ventas.catalog_file.read", 403],
        ["/unit-files/projects?moduleCode=ventas", "ventas.catalog_file.read", 200],
        ["/unit-files?moduleCode=ventas&projectIds=invalid", "ventas.catalog_file.read", 400],
        ["/audit?moduleCode=ventas", "role.assign", 400],
    ] as const)("matches DTO context interpretation and validation for %s", async (url, code, status) => {
        profile = profileWith([code]);
        expect((await app.inject({ url, headers: { cookie: `${SESSION_COOKIE_NAME}=${session}` } })).statusCode).toBe(status);
        if (status !== 200) for (const call of domainCalls) expect(call).not.toHaveBeenCalled();
    });

    it.each([
        ["active", "user.activate", 200],
        ["active", "user.deactivate", 403],
        ["inactive", "user.deactivate", 200],
        ["blocked", "user.deactivate", 200],
        ["inactive", "user.activate", 403],
        ["unknown", "user.activate", 403],
    ] as const)("selects user status %s permission %s", async (status, code, expected) => {
        profile = profileWith([code]);
        const csrf = createSignedCsrfToken(secret, session);
        const response = await app.inject({ method: "PATCH", url: "/identity/users/target/status", payload: { status, reason: "Regression" }, headers: { cookie: `${SESSION_COOKIE_NAME}=${session}; ${CSRF_COOKIE_NAME}=${csrf}`, [CSRF_HEADER_NAME_LOWERCASE]: csrf } });
        expect(response.statusCode).toBe(expected);
        if (expected === 403) for (const call of domainCalls) expect(call).not.toHaveBeenCalled();
    });

    it("uses catalog write body context even when a different query context is authorized", async () => {
        profile = profileWith(["ventas.catalog_project.update"]);
        const csrf = createSignedCsrfToken(secret, session);
        const headers = { cookie: `${SESSION_COOKIE_NAME}=${session}; ${CSRF_COOKIE_NAME}=${csrf}`, [CSRF_HEADER_NAME_LOWERCASE]: csrf };
        expect((await app.inject({ method: "PATCH", url: "/catalogs/projects/items/target?moduleCode=ventas", payload: { moduleCode: "mercadeo", name: "Value", reason: "Regression" }, headers })).statusCode).toBe(403);
        for (const call of domainCalls) expect(call).not.toHaveBeenCalled();
    });
});
