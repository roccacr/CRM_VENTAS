import "reflect-metadata";

import cookie from "@fastify/cookie";
import { ValidationPipe } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { APP_GUARD } from "@nestjs/core";
import { FastifyAdapter, type NestFastifyApplication } from "@nestjs/platform-fastify";
import { Test } from "@nestjs/testing";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { CsrfGuard } from "../../src/common/security/csrf.guard.js";
import { createSignedCsrfToken } from "../../src/common/security/csrf-token.js";
import { CSRF_COOKIE_NAME, CSRF_HEADER_NAME_LOWERCASE, SESSION_COOKIE_NAME } from "../../src/common/security/http-security.constants.js";
import { BrokersController } from "../../src/modules/crm/brokers/brokers.controller.js";
import { BrokersRepository } from "../../src/modules/crm/brokers/brokers.repository.js";
import { BrokersService } from "../../src/modules/crm/brokers/brokers.service.js";
import { CampaignsController } from "../../src/modules/crm/campaigns/campaigns.controller.js";
import { CampaignsRepository } from "../../src/modules/crm/campaigns/campaigns.repository.js";
import { CampaignsService } from "../../src/modules/crm/campaigns/campaigns.service.js";
import { CATALOG_CONTEXT_MODULES, CATALOG_DEFINITIONS } from "../../src/modules/crm/catalogs/catalogs.constants.js";
import { CatalogsController } from "../../src/modules/crm/catalogs/catalogs.controller.js";
import { CatalogsRepository } from "../../src/modules/crm/catalogs/catalogs.repository.js";
import { CatalogsService } from "../../src/modules/crm/catalogs/catalogs.service.js";
import { ClassesController } from "../../src/modules/crm/classes/classes.controller.js";
import { ClassesRepository } from "../../src/modules/crm/classes/classes.repository.js";
import { ClassesService } from "../../src/modules/crm/classes/classes.service.js";
import { IdentityRepository } from "../../src/modules/crm/identity/identity.repository.js";
import { IdentityService } from "../../src/modules/crm/identity/identity.service.js";
import type { IdentityProfile } from "../../src/modules/crm/identity/identity.types.js";
import { IdentityAuditRecorder } from "../../src/modules/crm/identity/identity-audit-recorder.service.js";
import { IdentityMicrosoftSessionService } from "../../src/modules/crm/identity/identity-microsoft-session.service.js";
import { IdentityTokenService } from "../../src/modules/crm/identity/identity-token.service.js";
import { LocationsController } from "../../src/modules/crm/locations/locations.controller.js";
import { LocationsRepository } from "../../src/modules/crm/locations/locations.repository.js";
import { LocationsService } from "../../src/modules/crm/locations/locations.service.js";
import { ProjectsController } from "../../src/modules/crm/projects/projects.controller.js";
import { ProjectsRepository } from "../../src/modules/crm/projects/projects.repository.js";
import { ProjectsService } from "../../src/modules/crm/projects/projects.service.js";
import { SubsidiariesController } from "../../src/modules/crm/subsidiaries/subsidiaries.controller.js";
import { SubsidiariesRepository } from "../../src/modules/crm/subsidiaries/subsidiaries.repository.js";
import { SubsidiariesService } from "../../src/modules/crm/subsidiaries/subsidiaries.service.js";

const domains = [
    { code: "projects", controller: ProjectsController, service: ProjectsService, repository: ProjectsRepository },
    { code: "campaigns", controller: CampaignsController, service: CampaignsService, repository: CampaignsRepository },
    { code: "classes", controller: ClassesController, service: ClassesService, repository: ClassesRepository },
    { code: "locations", controller: LocationsController, service: LocationsService, repository: LocationsRepository },
    { code: "subsidiaries", controller: SubsidiariesController, service: SubsidiariesService, repository: SubsidiariesRepository },
    { code: "brokers", controller: BrokersController, service: BrokersService, repository: BrokersRepository },
];
const actions = [
    { name: "create", grant: "create", method: "POST" as const, suffix: "", write: "createCatalogItem" as const, expected: 201 },
    { name: "update", grant: "update", method: "PATCH" as const, suffix: "/record", write: "updateCatalogItem" as const, expected: 200 },
    { name: "inactivate", grant: "inactivate", method: "PATCH" as const, suffix: "/record/status", write: "updateCatalogItemStatus" as const, status: "inactive", expected: 200 },
    { name: "reactivate", grant: "update", method: "PATCH" as const, suffix: "/record/status", write: "updateCatalogItemStatus" as const, status: "active", expected: 200 },
];
const secret = "catalog-http-cookie-secret";
const session = "catalog-http-session";
const cases = domains.flatMap((domain) => CATALOG_CONTEXT_MODULES.flatMap((context) => actions.map((action) => ({ domain, context, action, name: domain.code + "/" + context + "/" + action.name }))));

function createProfile(context: string, codes: string[] = []): IdentityProfile {
    return {
        auth: { availableProviders: ["local"], currentProvider: "local", localStatus: "active", microsoft: null, primaryProvider: "microsoft" },
        orgUnits: [{ code: context, name: context, publicId: "area", status: "active", scope: "all_areas", membership: "member" }],
        permissions: codes.map((code) => ({ code, effect: "allow", scope: "all_areas", source: "role" })),
        roles: [],
        session: { publicId: "session", status: "active", permissionVersion: 1, expiresAt: new Date(Date.now() + 60000).toISOString(), expiresInSeconds: 60 },
        user: { publicId: "actor", displayName: "Actor", email: "actor@example.test", status: "active", permissionVersion: 1, profileImageUrl: null },
    };
}

describe.each(["dedicated", "shared"] as const)("catalog exact HTTP authorization (%s)", (surface) => {
    let app: NestFastifyApplication;
    let profile: IdentityProfile;
    const persistence = () => ({
        createCatalogItem: vi.fn().mockResolvedValue({ publicId: "record" }),
        updateCatalogItem: vi.fn().mockResolvedValue({ publicId: "record" }),
        updateCatalogItemStatus: vi.fn().mockResolvedValue({ publicId: "record" }),
        listCatalogItems: vi.fn().mockResolvedValue({ items: [], total: 0 }),
    });
    const stores = domains.map(() => persistence());
    const shared = persistence();
    const identityRepository = { findBySessionTokenHash: vi.fn().mockImplementation(() => Promise.resolve(profile)) };
    beforeAll(async () => {
        const module = await Test.createTestingModule({
            controllers: surface === "shared" ? [CatalogsController] : domains.map((domain) => domain.controller),
            providers: [
                IdentityService,
                IdentityTokenService,
                CatalogsService,
                ...domains.map((domain) => domain.service),
                { provide: IdentityRepository, useValue: identityRepository },
                { provide: IdentityAuditRecorder, useValue: {} },
                { provide: IdentityMicrosoftSessionService, useValue: {} },
                { provide: ConfigService, useValue: new ConfigService({ COOKIE_SECRET: secret, AUTH_TOKEN_HASH_SECRET: "catalog-test-hash-secret" }) },
                { provide: CatalogsRepository, useValue: shared },
                ...domains.map((domain, index) => ({ provide: domain.repository, useValue: stores[index] })),
                { provide: APP_GUARD, useClass: CsrfGuard },
            ],
        }).compile();
        app = module.createNestApplication<NestFastifyApplication>(new FastifyAdapter(), { logger: false });
        await app.register(cookie);
        app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true }));
        await app.init();
        await app.getHttpAdapter().getInstance().ready();
    });
    beforeEach(() => {
        vi.clearAllMocks();
    });
    afterAll(async () => {
        await app.close();
    });

    describe.each(cases)("$name", ({ domain, context, action }) => {
        const definition = CATALOG_DEFINITIONS.find((item) => item.routeCode === domain.code);
        if (!definition) throw new Error("Missing catalog definition");
        const prefix = context + "." + definition.moduleCode + ".";
        const grant = prefix + action.grant;
        const store = surface === "shared" ? shared : stores[domains.indexOf(domain)];
        if (!store) throw new Error("Missing persistence fixture");
        function request(csrf: "valid" | "missing" | "mismatch" = "valid") {
            const signed = createSignedCsrfToken(secret, session);
            return app.inject({ method: action.method, url: "/catalogs/" + domain.code + "/items" + action.suffix, payload: "status" in action ? { moduleCode: context, status: action.status, reason: "Permission regression" } : { moduleCode: context, name: "Catalog fixture", reason: "Permission regression" }, headers: { cookie: SESSION_COOKIE_NAME + "=" + session + "; " + CSRF_COOKIE_NAME + "=" + signed, [CSRF_HEADER_NAME_LOWERCASE]: { valid: signed, missing: "", mismatch: "wrong" }[csrf] } });
        }
        function expectNoWrites() {
            for (const candidate of [...stores, shared]) {
                expect(candidate.createCatalogItem).not.toHaveBeenCalled();
                expect(candidate.updateCatalogItem).not.toHaveBeenCalled();
                expect(candidate.updateCatalogItemStatus).not.toHaveBeenCalled();
            }
        }
        it.each(["none", "wrong-context", "read-only", "wrong-action", "deny", "allow-and-deny", "owner-label", "inactive-area"] as const)("rejects %s with zero writes", async (mode) => {
            const otherContext = context === "ventas" ? "formalizacion" : "ventas";
            const codes = { none: [], "wrong-context": [otherContext + "." + definition.moduleCode + "." + action.grant], "read-only": [prefix + "read"], "wrong-action": [prefix + (action.grant === "inactivate" ? "update" : "inactivate")], deny: [], "allow-and-deny": [grant], "owner-label": [], "inactive-area": [grant] }[mode];
            profile = createProfile(context, codes);
            if (mode === "deny" || mode === "allow-and-deny") profile.permissions.push({ code: grant, effect: "deny", scope: null, source: "override" });
            if (mode === "owner-label") profile.roles = [{ code: "owner", name: "Owner", status: "active" }];
            if (mode === "inactive-area") profile.orgUnits = profile.orgUnits.map((unit) => ({ ...unit, status: "inactive" }));
            expect((await request()).statusCode).toBe(403);
            expectNoWrites();
        });
        it("rejects an exact deny for Owner even when an allow is present", async () => {
            profile = createProfile(context, [grant]);
            profile.roles = [{ code: "owner", name: "Owner", status: "active" }];
            profile.orgUnits = [];
            profile.permissions.push({ code: grant, effect: "deny", scope: null, source: "override" });
            expect((await request()).statusCode).toBe(403);
            expectNoWrites();
        });
        it("rejects the same action grant for a different catalog", async () => {
            profile = createProfile(context, [context + ".catalog_unrelated." + action.grant]);
            expect((await request()).statusCode).toBe(403);
            expectNoWrites();
        });
        it("requires context membership for non-Owner even with an exact grant", async () => {
            profile = createProfile(context, [grant]);
            profile.orgUnits = [];
            expect((await request()).statusCode).toBe(403);
            expectNoWrites();
        });
        it.each([false, true])("exact grant writes once; Owner=%s needs no area", async (owner) => {
            profile = createProfile(context, [grant]);
            if (owner) {
                profile.roles = [{ code: "owner", name: "Owner", status: "active" }];
                profile.orgUnits = [];
            }
            expect((await request()).statusCode).toBe(action.expected);
            expect(store[action.write]).toHaveBeenCalledOnce();
            const writes = [...stores, shared].flatMap((candidate) => [candidate.createCatalogItem, candidate.updateCatalogItem, candidate.updateCatalogItemStatus]);
            expect(writes.reduce((sum, write) => sum + write.mock.calls.length, 0)).toBe(1);
        });
        it("rechecks a revoked grant on the same session and makes no additional writes", async () => {
            profile = createProfile(context, [grant]);
            expect((await request()).statusCode).toBe(action.expected);
            profile = createProfile(context);
            expect((await request()).statusCode).toBe(403);
            expect(store[action.write]).toHaveBeenCalledOnce();
            expect(identityRepository.findBySessionTokenHash).toHaveBeenCalledTimes(2);
        });
        it.each(["missing", "mismatch"] as const)("rejects %s CSRF before authorization or writes", async (csrf) => {
            profile = createProfile(context, [grant]);
            expect((await request(csrf)).statusCode).toBe(403);
            expect(identityRepository.findBySessionTokenHash).not.toHaveBeenCalled();
            expectNoWrites();
        });
    });
});
