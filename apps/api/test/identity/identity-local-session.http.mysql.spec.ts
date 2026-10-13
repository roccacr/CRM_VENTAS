import "reflect-metadata";

import cookie from "@fastify/cookie";
import { ConfigService } from "@nestjs/config";
import { APP_GUARD } from "@nestjs/core";
import { FastifyAdapter, type NestFastifyApplication } from "@nestjs/platform-fastify";
import { Test } from "@nestjs/testing";
import { argon2id, hash } from "argon2";
import { config } from "dotenv";
import { sql, type Transaction } from "kysely";
import { ulid } from "ulid";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { CsrfGuard } from "../../src/common/security/csrf.guard.js";
import { CSRF_COOKIE_NAME, CSRF_HEADER_NAME_LOWERCASE, REFRESH_COOKIE_NAME, SESSION_COOKIE_NAME } from "../../src/common/security/http-security.constants.js";
import { validateEnv } from "../../src/config/env.validation.js";
import { DatabaseService } from "../../src/database/database.service.js";
import type { CrmDatabase } from "../../src/database/database.types.js";
import { SecurityAuditService } from "../../src/modules/crm/audit/security-audit.service.js";
import { IdentityController } from "../../src/modules/crm/identity/identity.controller.js";
import { IdentityRepository } from "../../src/modules/crm/identity/identity.repository.js";
import { IdentityService } from "../../src/modules/crm/identity/identity.service.js";
import type { IdentityProfile } from "../../src/modules/crm/identity/identity.types.js";
import { IdentityAccessManagementController } from "../../src/modules/crm/identity/identity-access-management.controller.js";
import { IdentityAccessManagementRepository } from "../../src/modules/crm/identity/identity-access-management.repository.js";
import { IdentityAccessManagementService } from "../../src/modules/crm/identity/identity-access-management.service.js";
import { IdentityAuditRecorder } from "../../src/modules/crm/identity/identity-audit-recorder.service.js";
import { IdentityLocalRepository } from "../../src/modules/crm/identity/identity-local.repository.js";
import { IdentityMicrosoftRepository } from "../../src/modules/crm/identity/identity-microsoft.repository.js";
import { IdentityMicrosoftSessionService } from "../../src/modules/crm/identity/identity-microsoft-session.service.js";
import { IdentityProfileRepository } from "../../src/modules/crm/identity/identity-profile.repository.js";
import { IdentitySessionRepository } from "../../src/modules/crm/identity/identity-session.repository.js";
import { IdentityTokenService } from "../../src/modules/crm/identity/identity-token.service.js";
import { IdentityUserDirectoryRepository } from "../../src/modules/crm/identity/identity-user-directory.repository.js";
import { EffectivePermissionService } from "../../src/modules/crm/permissions/effective-permission.service.js";
import { readCookieAttribute, readCookieValue, readSetCookieHeaders } from "../support/set-cookie.js";

const FIXTURE_PASSWORD = "Rollback-only-local-password-42!";

/** Isolated localhost cookie jar. Enforces cookie path and expiry across simulated page reloads. */
class LocalCookieJar {
    private readonly cookies = new Map<string, { value: string; path: string; expires: number }>();

    constructor(private readonly app: NestFastifyApplication) {}

    snapshot(name: string) {
        const stored = this.cookies.get(name);
        if (!stored) throw new Error(`Missing test cookie: ${name}`);
        return { ...stored };
    }

    cookieHeader(url: string): string {
        return [...this.cookies]
            .filter(([, item]) => item.expires > Date.now() && (url === item.path || url.startsWith(item.path.endsWith("/") ? item.path : `${item.path}/`)))
            .map(([name, item]) => `${name}=${item.value}`)
            .join("; ");
    }

    async send(method: "GET" | "POST" | "PUT", url: string, payload?: object) {
        const response = await this.app.inject({ method, url, ...(payload ? { payload } : {}), headers: { cookie: this.cookieHeader(url), [CSRF_HEADER_NAME_LOWERCASE]: this.cookies.get(CSRF_COOKIE_NAME)?.value ?? "" } });
        for (const header of readSetCookieHeaders(response.headers["set-cookie"])) {
            const name = header.slice(0, header.indexOf("="));
            const path = readCookieAttribute(header, "Path");
            const expires = readCookieAttribute(header, "Expires");
            this.cookies.set(name, { value: readCookieValue(header), path: typeof path === "string" ? path : "/", expires: typeof expires === "string" ? new Date(expires).getTime() : Number.POSITIVE_INFINITY });
        }
        return response;
    }

    async login(email: string): Promise<void> {
        expect((await this.send("GET", "/identity/session")).statusCode).toBe(200);
        const response = await this.send("POST", "/identity/local/login", { email, password: FIXTURE_PASSWORD });
        expect(response.statusCode).toBe(200);
        expect(response.json<{ authenticated: boolean }>().authenticated).toBe(true);
    }

    async profile(): Promise<IdentityProfile> {
        const response = await this.send("GET", "/identity/me");
        expect(response.statusCode).toBe(200);
        return response.json<IdentityProfile>();
    }
}

interface Fixture {
    app: NestFastifyApplication;
    service: DatabaseService;
    actorEmail: string;
    targetEmail: string;
    targetPublicId: string;
    oldRoleCode: string;
    nextRoleCode: string;
    orgUnitCode: string;
}

async function createHttpApp(service: DatabaseService, settings: ConfigService): Promise<NestFastifyApplication> {
    const module = await Test.createTestingModule({
        controllers: [IdentityController, IdentityAccessManagementController],
        providers: [
            IdentityService,
            IdentityRepository,
            IdentityTokenService,
            IdentityAuditRecorder,
            IdentityLocalRepository,
            IdentityProfileRepository,
            IdentitySessionRepository,
            IdentityMicrosoftRepository,
            IdentityUserDirectoryRepository,
            IdentityAccessManagementService,
            IdentityAccessManagementRepository,
            SecurityAuditService,
            EffectivePermissionService,
            { provide: DatabaseService, useValue: service },
            { provide: ConfigService, useValue: settings },
            { provide: IdentityMicrosoftSessionService, useValue: {} },
            { provide: APP_GUARD, useClass: CsrfGuard },
        ],
    }).compile();
    const app = module.createNestApplication<NestFastifyApplication>(new FastifyAdapter(), { logger: false });
    await app.register(cookie);
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
    return app;
}

describe.skipIf(process.env.IDENTITY_LOCAL_HTTP_MYSQL_TESTS !== "1")("local HTTP session persistence on CRM_THINK_V2, rollback only", () => {
    let database: DatabaseService;
    let settings: ConfigService;
    let passwordHash: string;
    beforeAll(async () => {
        config({ quiet: true });
        const environment = validateEnv(process.env);
        database = new DatabaseService(new ConfigService(environment));
        settings = new ConfigService({ ...environment, NODE_ENV: "development" });
        passwordHash = await hash(FIXTURE_PASSWORD, { type: argon2id });
    });
    afterAll(async () => {
        await database.onModuleDestroy();
    });

    const withRollback = async (run: (fixture: Fixture) => Promise<void>) => {
        const rollback = new Error("Rollback local HTTP fixtures");
        const actorPublicId = ulid();
        const targetPublicId = ulid();
        try {
            await database.db.transaction().execute(async (transaction) => {
                const current = await sql<{ name: string }>`SELECT DATABASE() AS name`.execute(transaction);
                expect(current.rows[0]?.name).toBe("CRM_THINK_V2");
                const scoped: Transaction<CrmDatabase> = new Proxy(transaction, {
                    get(target, property) {
                        if (property === "transaction")
                            return () => ({
                                execute: async (operation: (executor: Transaction<CrmDatabase>) => Promise<unknown>) => {
                                    await sql`SAVEPOINT local_http_operation`.execute(transaction);
                                    try {
                                        const result = await operation(scoped);
                                        await sql`RELEASE SAVEPOINT local_http_operation`.execute(transaction);
                                        return result;
                                    } catch (error) {
                                        await sql`ROLLBACK TO SAVEPOINT local_http_operation`.execute(transaction).catch(() => undefined);
                                        throw error;
                                    }
                                },
                            });
                        const value: unknown = Reflect.get(target, property, target);
                        return typeof value === "function" ? (value.bind(target) as unknown) : value;
                    },
                });
                const actorEmail = `${actorPublicId.toLowerCase()}@example.invalid`;
                const targetEmail = `${targetPublicId.toLowerCase()}@example.invalid`;
                const adminRoleCode = `http_${ulid().toLowerCase()}`;
                const oldRoleCode = `http_${ulid().toLowerCase()}`;
                const nextRoleCode = `http_${ulid().toLowerCase()}`;
                const orgUnitCode = `http_${ulid().toLowerCase()}`;
                for (const [id, email, roleCode, permissionCode] of [
                    [actorPublicId, actorEmail, adminRoleCode, "role.assign"],
                    [targetPublicId, targetEmail, oldRoleCode, "lead.read"],
                ] as const) {
                    await sql`INSERT INTO sec_user (public_id_user,email_user,normalized_email_user,display_name_user,status_user) VALUES (${id},${email},${email},'Rollback HTTP user','active')`.execute(transaction);
                    await sql`INSERT INTO sec_auth_identity (user_id_auth_identity,provider_code_auth_identity,email_auth_identity,normalized_email_auth_identity,password_hash_auth_identity,status_auth_identity) SELECT id_user,'local',${email},${email},${passwordHash},'active' FROM sec_user WHERE public_id_user=${id}`.execute(transaction);
                    await sql`INSERT INTO sec_role (code_role,name_role,status_role) VALUES (${roleCode},'Rollback HTTP role','active')`.execute(transaction);
                    await sql`INSERT INTO sec_user_role (user_id_user_role,role_id_user_role,status_user_role) SELECT u.id_user,r.id_role,'active' FROM sec_user u JOIN sec_role r ON r.code_role=${roleCode} WHERE u.public_id_user=${id}`.execute(transaction);
                    await sql`INSERT INTO sec_role_permission (role_id_role_permission,permission_id_role_permission,status_role_permission) SELECT r.id_role,p.id_permission,'active' FROM sec_role r JOIN sec_permission p ON p.code_permission=${permissionCode} WHERE r.code_role=${roleCode}`.execute(transaction);
                }
                await sql`INSERT INTO sec_role (code_role,name_role,status_role) VALUES (${nextRoleCode},'Rollback updated role','active')`.execute(transaction);
                await sql`INSERT INTO sec_role_permission (role_id_role_permission,permission_id_role_permission,status_role_permission) SELECT r.id_role,p.id_permission,'active' FROM sec_role r JOIN sec_permission p ON p.code_permission='lead.create' WHERE r.code_role=${nextRoleCode}`.execute(transaction);
                await sql`INSERT INTO sec_org_unit (public_id_org_unit,code_org_unit,name_org_unit,status_org_unit,sort_order_org_unit) VALUES (${ulid()},${orgUnitCode},'Rollback HTTP area','active',0)`.execute(transaction);
                await sql`INSERT INTO sec_user_org_unit (user_id_user_org_unit,org_unit_id_user_org_unit,membership_code_user_org_unit,scope_code_user_org_unit,status_user_org_unit) SELECT u.id_user,o.id_org_unit,'member','self','active' FROM sec_user u JOIN sec_org_unit o ON o.code_org_unit=${orgUnitCode} WHERE u.public_id_user=${targetPublicId}`.execute(transaction);
                const service: DatabaseService = { db: scoped, onModuleDestroy: async () => {} };
                const app = await createHttpApp(service, settings);
                try {
                    await run({ app, service, actorEmail, targetEmail, targetPublicId, oldRoleCode, nextRoleCode, orgUnitCode });
                } finally {
                    await app.close();
                }
                throw rollback;
            });
        } catch (error) {
            if (error !== rollback) throw error;
        }
        expect(await database.db.selectFrom("sec_user").select("id_user").where("public_id_user", "in", [actorPublicId, targetPublicId]).execute()).toEqual([]);
    };

    it("keeps normal local login across repeated session/me reloads and rotates valid cookies", async () => {
        await withRollback(async ({ app, targetEmail, targetPublicId }) => {
            const jar = new LocalCookieJar(app);
            await jar.login(targetEmail);
            const original = await jar.profile();
            const originalSessionCookie = jar.snapshot(SESSION_COOKIE_NAME);
            const originalRefreshCookie = jar.snapshot(REFRESH_COOKIE_NAME);
            expect(original.user.publicId).toBe(targetPublicId);
            expect(original.auth.currentProvider).toBe("local");
            for (let reload = 0; reload < 3; reload += 1) {
                const session = await jar.send("GET", "/identity/session");
                expect(session.json<{ authenticated: boolean }>().authenticated).toBe(true);
                expect((await jar.profile()).session.publicId).toBe(original.session.publicId);
            }
            expect(jar.cookieHeader("/identity/session")).not.toContain(`${REFRESH_COOKIE_NAME}=`);
            expect(jar.cookieHeader("/identity/refresh")).toContain(`${REFRESH_COOKIE_NAME}=`);
            vi.useFakeTimers({ toFake: ["Date"] });
            try {
                vi.setSystemTime(Date.now() + 6 * 60_000);
                expect((await jar.send("GET", "/identity/session")).json<{ authenticated: boolean }>().authenticated).toBe(true);
                expect((await jar.profile()).session.publicId).toBe(original.session.publicId);
                expect((await jar.send("POST", "/identity/refresh")).statusCode).toBe(200);
                expect(jar.snapshot(SESSION_COOKIE_NAME).value).not.toBe(originalSessionCookie.value);
                expect(jar.snapshot(REFRESH_COOKIE_NAME).value).not.toBe(originalRefreshCookie.value);
                expect(jar.snapshot(SESSION_COOKIE_NAME).expires).toBeLessThanOrEqual(originalSessionCookie.expires);
                expect(jar.snapshot(REFRESH_COOKIE_NAME).expires).toBeLessThanOrEqual(originalRefreshCookie.expires);
            } finally {
                vi.useRealTimers();
            }
            expect((await jar.profile()).session.publicId).toBe(original.session.publicId);
            expect(jar.cookieHeader("/identity/session")).toContain(`${SESSION_COOKIE_NAME}=`);
        });
    }, 120_000);

    it("retains refresh after access replacement and rotates into updated grants without login", async () => {
        await withRollback(async ({ app, service, actorEmail, targetEmail, targetPublicId, nextRoleCode, orgUnitCode }) => {
            const actor = new LocalCookieJar(app);
            const target = new LocalCookieJar(app);
            const secondSession = new LocalCookieJar(app);
            await actor.login(actorEmail);
            await target.login(targetEmail);
            await secondSession.login(targetEmail);
            const actorOriginal = await actor.profile();
            const secondOriginal = await secondSession.profile();
            const original = await target.profile();
            expect(original.permissions).toContainEqual(expect.objectContaining({ code: "lead.read", effect: "allow" }));
            const response = await actor.send("PUT", `/identity/users/${targetPublicId}/access`, { roleCodes: [nextRoleCode], orgUnitCodes: [orgUnitCode], permissionOverrides: [], reason: "Rollback HTTP access replacement" });
            expect(response.statusCode).toBe(200);
            expect((await target.send("GET", "/identity/session")).json<{ authenticated: boolean }>().authenticated).toBe(false);
            expect((await target.send("GET", "/identity/me")).statusCode).toBe(401);
            const oldSession = await service.db.selectFrom("sec_auth_session").select("status_auth_session as status").where("public_id_auth_session", "=", original.session.publicId).executeTakeFirstOrThrow();
            expect(oldSession.status).toBe("active");
            expect((await target.send("POST", "/identity/refresh")).statusCode).toBe(200);
            const fresh = await target.profile();
            expect(fresh.session.publicId).toBe(original.session.publicId);
            expect(fresh.session.permissionVersion).toBeGreaterThan(original.session.permissionVersion);
            expect(fresh.session.permissionVersion).toBe(fresh.user.permissionVersion);
            expect(fresh.permissions).toContainEqual(expect.objectContaining({ code: "lead.create", effect: "allow" }));
            expect(fresh.permissions.some((permission) => permission.code === "lead.read" && permission.effect === "allow")).toBe(false);
            expect((await target.send("GET", "/identity/session")).json<{ authenticated: boolean }>().authenticated).toBe(true);
            expect((await secondSession.send("GET", "/identity/me")).statusCode).toBe(401);
            expect((await secondSession.send("POST", "/identity/refresh")).statusCode).toBe(200);
            const secondFresh = await secondSession.profile();
            expect(secondFresh.session.publicId).toBe(secondOriginal.session.publicId);
            expect(secondFresh.permissions).toContainEqual(expect.objectContaining({ code: "lead.create", effect: "allow" }));
            expect(secondFresh.permissions.some((permission) => permission.code === "lead.read" && permission.effect === "allow")).toBe(false);
            expect(await actor.profile()).toMatchObject({ user: actorOriginal.user, session: { publicId: actorOriginal.session.publicId, permissionVersion: actorOriginal.session.permissionVersion, status: "active", expiresAt: actorOriginal.session.expiresAt } });
        });
    }, 120_000);

    it("retains identity and refresh when the same access assignments are saved", async () => {
        await withRollback(async ({ app, actorEmail, targetEmail, targetPublicId, oldRoleCode, orgUnitCode }) => {
            const actor = new LocalCookieJar(app);
            const target = new LocalCookieJar(app);
            await actor.login(actorEmail);
            await target.login(targetEmail);
            const original = await target.profile();
            expect((await actor.send("PUT", `/identity/users/${targetPublicId}/access`, { roleCodes: [oldRoleCode], orgUnitCodes: [orgUnitCode], permissionOverrides: [], reason: "Rollback same access assignments" })).statusCode).toBe(200);
            expect((await target.send("GET", "/identity/me")).statusCode).toBe(401);
            expect((await target.send("POST", "/identity/refresh")).statusCode).toBe(200);
            const refreshed = await target.profile();
            expect(refreshed.session.publicId).toBe(original.session.publicId);
            expect(refreshed.roles).toEqual(original.roles);
            expect(refreshed.permissions).toEqual(original.permissions);
            expect(refreshed.user.permissionVersion).toBeGreaterThan(original.user.permissionVersion);
        });
    }, 120_000);

    it("refreshes a stale version after ordinary role permission replacement with only the new grants", async () => {
        await withRollback(async ({ app, actorEmail, targetEmail, oldRoleCode }) => {
            const actor = new LocalCookieJar(app);
            const target = new LocalCookieJar(app);
            await actor.login(actorEmail);
            await target.login(targetEmail);
            const original = await target.profile();
            expect((await actor.send("PUT", `/identity/roles/${oldRoleCode}/permissions`, { permissionCodes: ["lead.create"], reason: "Rollback HTTP role update" })).statusCode).toBe(200);
            expect((await target.send("GET", "/identity/session")).json<{ authenticated: boolean }>().authenticated).toBe(false);
            expect((await target.send("GET", "/identity/me")).statusCode).toBe(401);
            expect((await target.send("POST", "/identity/refresh")).statusCode).toBe(200);
            const refreshed = await target.profile();
            expect(refreshed.session.publicId).toBe(original.session.publicId);
            expect(refreshed.session.permissionVersion).toBeGreaterThan(original.session.permissionVersion);
            expect(refreshed.session.permissionVersion).toBe(refreshed.user.permissionVersion);
            expect(refreshed.permissions).toContainEqual(expect.objectContaining({ code: "lead.create", effect: "allow" }));
            expect(refreshed.permissions.some((permission) => permission.code === "lead.read" && permission.effect === "allow")).toBe(false);
        });
    }, 120_000);

    it("rolls back rotation when refresh audit fails so the original cookies remain usable", async () => {
        await withRollback(async ({ app, service, targetEmail }) => {
            const target = new LocalCookieJar(app);
            await target.login(targetEmail);
            const original = await target.profile();
            const readTokens = () => service.db.selectFrom("sec_refresh_token as refresh").innerJoin("sec_auth_session as session", "session.id_auth_session", "refresh.auth_session_id_refresh_token").select(["refresh.id_refresh_token as id", "refresh.status_refresh_token as status"]).where("session.public_id_auth_session", "=", original.session.publicId).execute();
            const before = await readTokens();
            const audit = app.get(SecurityAuditService);
            const record = audit.record.bind(audit);
            const hook = vi.spyOn(audit, "record").mockImplementationOnce(async (...args) => {
                await record(...args);
                throw new Error("Rollback refresh audit unavailable");
            });
            try {
                expect((await target.send("POST", "/identity/refresh")).statusCode).toBe(500);
                expect(await readTokens()).toEqual(before);
                expect((await target.profile()).session.publicId).toBe(original.session.publicId);
            } finally {
                hook.mockRestore();
            }
            expect((await target.send("POST", "/identity/refresh")).statusCode).toBe(200);
            expect((await target.profile()).session.publicId).toBe(original.session.publicId);
        });
    }, 120_000);

    it("does not strand rotated cookies when permissions change between rotation and profile loading", async () => {
        await withRollback(async ({ app, actorEmail, targetEmail, oldRoleCode }) => {
            const actor = new LocalCookieJar(app);
            const target = new LocalCookieJar(app);
            await actor.login(actorEmail);
            await target.login(targetEmail);
            const actorProfile = await actor.profile();
            const sessions = app.get(IdentitySessionRepository);
            const rotate = sessions.rotateRefreshSession.bind(sessions);
            // Deterministically schedule an access edit in the post-commit/pre-profile window.
            const hook = vi.spyOn(sessions, "rotateRefreshSession").mockImplementationOnce(async (input) => {
                const result = await rotate(input);
                await app.get(IdentityAccessManagementRepository).replaceRolePermissions({ actorPublicId: actorProfile.user.publicId, code: oldRoleCode, permissionCodes: ["lead.create"], reason: "Rollback refresh interleaving" });
                return result;
            });
            try {
                const response = await target.send("POST", "/identity/refresh");
                expect(response.statusCode).toBe(200);
                expect(readSetCookieHeaders(response.headers["set-cookie"])).not.toEqual([]);
                expect((await target.send("POST", "/identity/refresh")).statusCode).toBe(200);
                const profile = await target.profile();
                expect(profile.permissions).toContainEqual(expect.objectContaining({ code: "lead.create", effect: "allow" }));
                expect(profile.permissions.some((permission) => permission.code === "lead.read" && permission.effect === "allow")).toBe(false);
            } finally {
                hook.mockRestore();
            }
        });
    }, 120_000);
});
