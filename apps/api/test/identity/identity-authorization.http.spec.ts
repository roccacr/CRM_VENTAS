import "reflect-metadata";

import cookie from "@fastify/cookie";
import { ConfigService } from "@nestjs/config";
import { APP_GUARD } from "@nestjs/core";
import { FastifyAdapter, type NestFastifyApplication } from "@nestjs/platform-fastify";
import { Test } from "@nestjs/testing";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { CsrfGuard } from "../../src/common/security/csrf.guard.js";
import { createSignedCsrfToken } from "../../src/common/security/csrf-token.js";
import { CSRF_COOKIE_NAME, CSRF_HEADER_NAME_LOWERCASE, SESSION_COOKIE_NAME } from "../../src/common/security/http-security.constants.js";
import { IdentityController } from "../../src/modules/crm/identity/identity.controller.js";
import { IdentityRepository } from "../../src/modules/crm/identity/identity.repository.js";
import { IdentityService } from "../../src/modules/crm/identity/identity.service.js";
import type { IdentityProfile, SystemUserDirectoryItem } from "../../src/modules/crm/identity/identity.types.js";
import { IdentityAccessManagementController } from "../../src/modules/crm/identity/identity-access-management.controller.js";
import { IdentityAccessManagementRepository } from "../../src/modules/crm/identity/identity-access-management.repository.js";
import { IdentityAccessManagementService } from "../../src/modules/crm/identity/identity-access-management.service.js";
import { IdentityAuditRecorder } from "../../src/modules/crm/identity/identity-audit-recorder.service.js";
import { IdentityMicrosoftSessionService } from "../../src/modules/crm/identity/identity-microsoft-session.service.js";
import { IdentityTokenService } from "../../src/modules/crm/identity/identity-token.service.js";

const SESSION_TOKEN = "http-authorization-test-session";
const COOKIE_SECRET = "http-authorization-test-cookie-secret";
const userPayload = { displayName: "Target person", email: "target@example.test", roleCode: "ventas", roleCodes: ["ventas"], orgUnitCodes: ["ventas"], accessMethods: ["local"], externalReferences: [], reason: "Authorization regression" };

interface Endpoint {
    name: string;
    method: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
    url: string;
    permissions: string[];
    payload?: Record<string, unknown>;
    status: number;
}

const endpoints: Endpoint[] = [
    { name: "users list", method: "GET", url: "/identity/users", permissions: ["user.view_list"], status: 200 },
    { name: "user detail", method: "GET", url: "/identity/users/target", permissions: ["user.view_detail"], status: 200 },
    { name: "user create", method: "POST", url: "/identity/users", permissions: ["user.create", "role.assign"], payload: { ...userPayload, initialStatus: "active" }, status: 201 },
    { name: "user profile update", method: "PATCH", url: "/identity/users/target", permissions: ["user.update"], payload: userPayload, status: 200 },
    { name: "user activate", method: "PATCH", url: "/identity/users/target/status", permissions: ["user.activate"], payload: { status: "active", reason: userPayload.reason }, status: 200 },
    { name: "user deactivate", method: "PATCH", url: "/identity/users/target/status", permissions: ["user.deactivate"], payload: { status: "inactive", reason: userPayload.reason }, status: 200 },
    { name: "user block", method: "PATCH", url: "/identity/users/target/status", permissions: ["user.deactivate"], payload: { status: "blocked", reason: userPayload.reason }, status: 200 },
    { name: "security catalog", method: "GET", url: "/identity/roles/security-catalog", permissions: ["role.assign"], status: 200 },
    { name: "role permissions read", method: "GET", url: "/identity/roles/ventas/permissions", permissions: ["role.assign"], status: 200 },
    { name: "role rename", method: "PATCH", url: "/identity/roles/ventas", permissions: ["role.assign"], payload: { name: "Sales renamed", reason: userPayload.reason }, status: 200 },
    { name: "role permissions replace", method: "PUT", url: "/identity/roles/ventas/permissions", permissions: ["role.assign"], payload: { permissionCodes: ["lead.read"], reason: userPayload.reason }, status: 200 },
    { name: "role delete", method: "DELETE", url: "/identity/roles/ventas", permissions: ["role.assign"], status: 200 },
    { name: "user access read", method: "GET", url: "/identity/users/target/access", permissions: ["role.assign"], status: 200 },
    { name: "user access replace", method: "PUT", url: "/identity/users/target/access", permissions: ["role.assign"], payload: { roleCodes: ["ventas"], orgUnitCodes: ["ventas"], permissionOverrides: [], reason: userPayload.reason }, status: 200 },
];

function createProfile(permissions: readonly string[] = [], effect: "allow" | "deny" = "allow"): IdentityProfile {
    return {
        auth: { availableProviders: ["local"], currentProvider: "local", localStatus: "active", microsoft: null, primaryProvider: "microsoft" },
        orgUnits: [],
        permissions: permissions.map((code): IdentityProfile["permissions"][number] => (effect === "deny" ? { code, effect: "deny", scope: null, source: "override" } : { code, effect: "allow", scope: "all_areas", source: "role" })),
        roles: [],
        session: { expiresAt: new Date(Date.now() + 60_000).toISOString(), expiresInSeconds: 60, permissionVersion: 1, publicId: "session", status: "active" },
        user: { displayName: "Actor", email: "actor@example.test", permissionVersion: 1, profileImageUrl: null, publicId: "actor", status: "active" },
    };
}

describe("identity HTTP authorization with real services and CSRF, persistence only mocked", () => {
    let app: NestFastifyApplication;
    let profile: IdentityProfile;
    const target: SystemUserDirectoryItem = { email: userPayload.email, externalReferences: [], invitedBy: null, isCurrentUser: false, lastActivityAt: null, mfaStatus: "not_configured", name: userPayload.displayName, orgUnit: { code: "ventas", name: "Sales", publicId: "area" }, profileImageUrl: null, provider: "local", publicId: "target", roleChangedAt: null, roles: [{ code: "ventas", name: "Sales" }], status: "active" };
    const repository = {
        findBySessionTokenHash: vi.fn<IdentityRepository["findBySessionTokenHash"]>().mockImplementation(() => Promise.resolve(profile)),
        listSystemUsers: vi.fn<IdentityRepository["listSystemUsers"]>().mockResolvedValue({ items: [], page: { limit: 25, nextCursor: null, total: 0 }, summary: { active: 0, all: 0, blocked: 0, inactive: 0, pending: 0 } }),
        findSystemUserByPublicId: vi.fn<IdentityRepository["findSystemUserByPublicId"]>().mockResolvedValue(target),
        createSystemUser: vi.fn<IdentityRepository["createSystemUser"]>().mockResolvedValue(target),
        updateSystemUser: vi.fn<IdentityRepository["updateSystemUser"]>().mockResolvedValue(target),
        updateSystemUserStatus: vi.fn<IdentityRepository["updateSystemUserStatus"]>().mockResolvedValue(target),
    };
    const role = { code: "ventas", description: null, name: "Sales", status: "active" };
    const access = { user: { email: target.email, name: target.name, publicId: target.publicId, status: target.status }, roles: [{ ...role }], orgUnits: [{ code: "ventas", name: "Sales", publicId: "area" }], permissionOverrides: [] };
    const accessRepository = {
        readSecurityCatalog: vi.fn<IdentityAccessManagementRepository["readSecurityCatalog"]>().mockResolvedValue({ auditEvents: [], modules: [], rolePermissions: {}, roles: [] }),
        readRolePermissions: vi.fn<IdentityAccessManagementRepository["readRolePermissions"]>().mockResolvedValue({ role, permissionCodes: ["lead.read"] }),
        updateRole: vi.fn<IdentityAccessManagementRepository["updateRole"]>().mockResolvedValue(role),
        replaceRolePermissions: vi.fn<IdentityAccessManagementRepository["replaceRolePermissions"]>().mockResolvedValue({ role, permissionCodes: ["lead.read"] }),
        deleteRole: vi.fn<IdentityAccessManagementRepository["deleteRole"]>().mockResolvedValue({ status: "deleted", role }),
        readUserAccess: vi.fn<IdentityAccessManagementRepository["readUserAccess"]>().mockResolvedValue(access),
        replaceUserAccess: vi.fn<IdentityAccessManagementRepository["replaceUserAccess"]>().mockResolvedValue(access),
    };
    const writes = [repository.createSystemUser, repository.updateSystemUser, repository.updateSystemUserStatus, accessRepository.updateRole, accessRepository.replaceRolePermissions, accessRepository.deleteRole, accessRepository.replaceUserAccess];
    const businessCalls = [...writes, repository.listSystemUsers, repository.findSystemUserByPublicId, accessRepository.readSecurityCatalog, accessRepository.readRolePermissions, accessRepository.readUserAccess];
    const writeCount = () => writes.reduce((total, write) => total + write.mock.calls.length, 0);

    beforeAll(async () => {
        const module = await Test.createTestingModule({
            controllers: [IdentityController, IdentityAccessManagementController],
            providers: [
                IdentityService,
                IdentityAccessManagementService,
                IdentityTokenService,
                { provide: ConfigService, useValue: new ConfigService({ COOKIE_SECRET, AUTH_TOKEN_HASH_SECRET: "http-test-hash-secret" }) },
                { provide: IdentityRepository, useValue: repository },
                { provide: IdentityAccessManagementRepository, useValue: accessRepository },
                { provide: IdentityAuditRecorder, useValue: {} },
                { provide: IdentityMicrosoftSessionService, useValue: {} },
                { provide: APP_GUARD, useClass: CsrfGuard },
            ],
        }).compile();
        app = module.createNestApplication<NestFastifyApplication>(new FastifyAdapter(), { logger: false });
        await app.register(cookie);
        await app.init();
        await app.getHttpAdapter().getInstance().ready();
    });
    beforeEach(() => {
        vi.clearAllMocks();
        profile = createProfile();
    });
    afterAll(async () => {
        await app.close();
    });

    function request(endpoint: Endpoint, options: { authenticated?: boolean; csrf?: "missing" | "mismatch" | "forged" | "other-session" } = {}) {
        const session = options.authenticated === false ? undefined : SESSION_TOKEN;
        const csrf = createSignedCsrfToken(COOKIE_SECRET, session);
        const signedTokens = { missing: csrf, mismatch: csrf, forged: createSignedCsrfToken("incorrect-secret", session), "other-session": createSignedCsrfToken(COOKIE_SECRET, "another-session") };
        const cookieToken = options.csrf ? signedTokens[options.csrf] : csrf;
        const sessionCookie = session ? `${SESSION_COOKIE_NAME}=${session}; ` : "";
        const headerTokens = { missing: "", mismatch: "different-token", forged: cookieToken, "other-session": cookieToken };
        return app.inject({ method: endpoint.method, url: endpoint.url, ...(endpoint.payload ? { payload: endpoint.payload } : {}), headers: { cookie: `${sessionCookie}${CSRF_COOKIE_NAME}=${cookieToken}`, [CSRF_HEADER_NAME_LOWERCASE]: options.csrf ? headerTokens[options.csrf] : csrf } });
    }

    describe.each(endpoints)("$name", (endpoint) => {
        it.each(["missing", "wrong", "deny", "owner-label"] as const)("rejects %s permissions without persistence calls", async (mode) => {
            const profiles = { missing: createProfile(), wrong: createProfile(["lead.read"]), deny: createProfile(endpoint.permissions, "deny"), "owner-label": { ...createProfile(), roles: [{ code: "owner", name: "Owner", status: "active" }] } };
            profile = profiles[mode];
            expect((await request(endpoint)).statusCode).toBe(403);
            for (const call of businessCalls) expect(call).not.toHaveBeenCalled();
        });
        it("allows only the exact permissions through the real authorization service", async () => {
            profile = createProfile(endpoint.permissions);
            expect((await request(endpoint)).statusCode).toBe(endpoint.status);
            expect(repository.findBySessionTokenHash).toHaveBeenCalledOnce();
            expect(businessCalls.reduce((total, call) => total + call.mock.calls.length, 0)).toBeGreaterThan(0);
            expect(writeCount()).toBe(endpoint.method === "GET" ? 0 : 1);
        });
        it("rejects a missing session before persistence", async () => {
            profile = createProfile(endpoint.permissions);
            expect((await request(endpoint, { authenticated: false })).statusCode).toBe(401);
            expect(repository.findBySessionTokenHash).not.toHaveBeenCalled();
            expect(writeCount()).toBe(0);
        });
        it("rejects stale permissionVersion before any business persistence", async () => {
            profile = createProfile(endpoint.permissions);
            profile.user.permissionVersion = 2;
            expect((await request(endpoint)).statusCode).toBe(409);
            for (const call of businessCalls) expect(call).not.toHaveBeenCalled();
        });
        it("rejects an invalid or revoked session returned as null without business persistence", async () => {
            profile = createProfile(endpoint.permissions);
            repository.findBySessionTokenHash.mockResolvedValueOnce(null);
            expect((await request(endpoint)).statusCode).toBe(401);
            expect(repository.findBySessionTokenHash).toHaveBeenCalledOnce();
            for (const call of businessCalls) expect(call).not.toHaveBeenCalled();
            expect(writeCount()).toBe(0);
        });
        it("reloads revoked permissions on the next request with the same cookie", async () => {
            profile = createProfile(endpoint.permissions);
            expect((await request(endpoint)).statusCode).toBe(endpoint.status);
            const before = businessCalls.map((call) => call.mock.calls.length);
            profile = createProfile();
            expect((await request(endpoint)).statusCode).toBe(403);
            expect(businessCalls.map((call) => call.mock.calls.length)).toEqual(before);
            expect(repository.findBySessionTokenHash).toHaveBeenCalledTimes(2);
            expect(repository.findBySessionTokenHash.mock.calls[0]).toEqual(repository.findBySessionTokenHash.mock.calls[1]);
        });
    });

    describe.each(endpoints.filter((endpoint) => endpoint.method !== "GET"))("$name CSRF", (endpoint) => {
        it.each(["missing", "mismatch", "forged", "other-session"] as const)("rejects %s proof before authorization or writes", async (csrf) => {
            profile = createProfile(endpoint.permissions);
            expect((await request(endpoint, { csrf })).statusCode).toBe(403);
            expect(repository.findBySessionTokenHash).not.toHaveBeenCalled();
            expect(writeCount()).toBe(0);
        });
    });

    it.each([{ permissions: ["user.create"] }, { permissions: ["role.assign"] }])("creation requires both user.create and role.assign, not just $permissions", async ({ permissions }) => {
        profile = createProfile(permissions);
        const endpoint = endpoints.find((item) => item.name === "user create");
        if (!endpoint) throw new Error("Missing create case");
        expect((await request(endpoint)).statusCode).toBe(403);
        expect(writeCount()).toBe(0);
    });

    it("requires user.assign_password before persisting creation with an initial password", async () => {
        profile = createProfile(["user.create", "role.assign"]);
        const endpoint: Endpoint = { name: "password assignment", method: "POST", url: "/identity/users", permissions: ["user.create", "role.assign", "user.assign_password"], payload: { ...userPayload, initialStatus: "active", password: "Http-test-only-password-42!" }, status: 201 };
        expect((await request(endpoint)).statusCode).toBe(403);
        expect(repository.findBySessionTokenHash).toHaveBeenCalledOnce();
        expect(repository.createSystemUser).not.toHaveBeenCalled();
        expect(writeCount()).toBe(0);
    });

    it.each([{ roleCode: "mercadeo", roleCodes: ["mercadeo"] }, { orgUnitCodes: ["mercadeo"] }])("requires role.assign when update changes %j", async (changes) => {
        const endpoint: Endpoint = { name: "assignment update", method: "PATCH", url: "/identity/users/target", permissions: ["user.update", "role.assign"], payload: { ...userPayload, ...changes }, status: 200 };
        profile = createProfile(["user.update"]);
        expect((await request(endpoint)).statusCode).toBe(403);
        expect(writeCount()).toBe(0);
        profile = createProfile(endpoint.permissions);
        expect((await request(endpoint)).statusCode).toBe(200);
        expect(repository.updateSystemUser).toHaveBeenCalledOnce();
    });
});
