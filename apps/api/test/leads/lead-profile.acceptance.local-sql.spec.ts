import "reflect-metadata";

import cookie from "@fastify/cookie";
import { UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { APP_GUARD } from "@nestjs/core";
import { FastifyAdapter, type NestFastifyApplication } from "@nestjs/platform-fastify";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { Test } from "@nestjs/testing";
import { type Kysely, sql } from "kysely";
import { afterAll, beforeAll, beforeEach, describe, expect, it, type MockInstance, vi } from "vitest";

import { AuthGuard } from "../../src/common/security/auth.guard.js";
import { AuthenticatedReadRateLimit } from "../../src/common/security/authenticated-read-rate-limit.js";
import { CsrfGuard } from "../../src/common/security/csrf.guard.js";
import { SESSION_COOKIE_NAME } from "../../src/common/security/http-security.constants.js";
import { DatabaseService } from "../../src/database/database.service.js";
import type { CrmDatabase } from "../../src/database/database.types.js";
import { LegacyLeadProfileReader } from "../../src/integrations/legacy-crm/legacy-lead-profile.reader.js";
import { IdentityService } from "../../src/modules/crm/identity/identity.service.js";
import type { IdentityProfile } from "../../src/modules/crm/identity/identity.types.js";
import { LEAD_PROFILE_LEGACY_READER, type LeadProfileResponseDto } from "../../src/modules/crm/leads/lead-profile.contract.js";
import { LeadProfileController } from "../../src/modules/crm/leads/lead-profile.controller.js";
import { LeadProfileRepository } from "../../src/modules/crm/leads/lead-profile.repository.js";
import { LeadProfileService } from "../../src/modules/crm/leads/lead-profile.service.js";
import { EffectivePermissionService } from "../../src/modules/crm/permissions/effective-permission.service.js";
import type { PermissionInput, PermissionOverrideInput } from "../../src/modules/crm/permissions/permission.types.js";
import { createProfileSqlFixture, PROFILE_NATIVE_ID } from "./lead-profile.sql-fixture.js";

// Únicamente fixtures locales y SQL real: no lee .env ni usa identidades o datos de producción.
describe.skipIf(process.env.LEAD_PROFILE_LOCAL_SQL_TESTS !== "1")("matriz de aceptación del perfil: HTTP + InnoDB aislado", () => {
    let db: Kysely<CrmDatabase> | undefined;
    let app: NestFastifyApplication | undefined;
    let reads: MockInstance<LeadProfileRepository["read"]>;

    /** Solo la emisión/autenticación de sesiones se simula; permisos y datos se leen del SQL local. */
    async function profileForSession(session?: string): Promise<IdentityProfile> {
        if (!db) throw new Error("Fixture SQL no inicializado");
        const users: Record<string, number> = { role: 2, direct: 3, missing: 4, deny: 5 };
        const id = users[session ?? ""];
        if (!id) throw new UnauthorizedException("Sesión de prueba no válida.");
        const rolePermissions = (
            await sql<PermissionInput>`SELECT p.code_permission AS code,'all_areas' AS scope FROM sec_user_role ur JOIN sec_role r ON r.id_role=ur.role_id_user_role JOIN sec_role_permission rp ON rp.role_id_role_permission=r.id_role JOIN sec_permission p ON p.id_permission=rp.permission_id_role_permission WHERE ur.user_id_user_role=${id} AND ur.status_user_role='active' AND ur.revoked_at_user_role IS NULL AND r.status_role='active' AND r.deleted_at_role IS NULL AND rp.status_role_permission='active' AND p.status_permission='active'`.execute(
                db,
            )
        ).rows;
        const overrides = (await sql<PermissionOverrideInput>`SELECT p.code_permission AS code,'all_areas' AS scope,o.effect_user_permission_override AS effect FROM sec_user_permission_override o JOIN sec_permission p ON p.id_permission=o.permission_id_user_permission_override WHERE o.user_id_user_permission_override=${id} AND p.status_permission='active'`.execute(db)).rows;
        return {
            auth: { availableProviders: ["local"], currentProvider: "local", localStatus: "active", microsoft: null, primaryProvider: "microsoft" },
            orgUnits: [],
            roles: [],
            permissions: new EffectivePermissionService().calculate({ rolePermissions, overrides }).permissions,
            session: { expiresAt: "2099-01-01T00:00:00Z", expiresInSeconds: 3600, permissionVersion: 1, publicId: "local-session", status: "active" },
            user: { displayName: "Persona ficticia", email: "fixture@example.test", permissionVersion: 1, profileImageUrl: null, publicId: `fixture-${String(id)}`, status: "active" },
        };
    }

    beforeAll(async () => {
        db = await createProfileSqlFixture();
        const module = await Test.createTestingModule({
            controllers: [LeadProfileController],
            providers: [
                LeadProfileService,
                LeadProfileRepository,
                { provide: DatabaseService, useValue: { db } },
                { provide: LEAD_PROFILE_LEGACY_READER, useValue: new LegacyLeadProfileReader({ isConfigured: () => true } as never) },
                { provide: IdentityService, useValue: { getCurrentUser: profileForSession } },
                { provide: ConfigService, useValue: new ConfigService({ COOKIE_SECRET: "lead-profile-local-cookie-secret" }) },
                { provide: AuthenticatedReadRateLimit, useValue: { enforceAuthenticatedReadLimit: () => Promise.resolve(true) } },
                { provide: APP_GUARD, useClass: CsrfGuard },
                { provide: APP_GUARD, useClass: AuthGuard },
            ],
        }).compile();
        app = module.createNestApplication<NestFastifyApplication>(new FastifyAdapter(), { logger: false });
        await app.register(cookie);
        await app.init();
        await app.getHttpAdapter().getInstance().ready();
        reads = vi.spyOn(module.get(LeadProfileRepository), "read");
    });
    beforeEach(() => {
        reads.mockClear();
    });
    afterAll(async () => {
        await app?.close();
        await db?.destroy();
    });

    function request(session: string, query: string) {
        if (!app) throw new Error("HTTP no inicializado");
        return app.inject({ method: "GET", url: `/leads/profile?${query}`, headers: { cookie: `${SESSION_COOKIE_NAME}=${session}` } });
    }
    const field = (profile: LeadProfileResponseDto, code: string) => profile.sections.flatMap((section) => section.fields).find((entry) => entry.code === code);

    it("publica en OpenAPI los parámetros y el DTO de salida completo también bajo tsx", () => {
        if (!app) throw new Error("HTTP no inicializado");
        const document = SwaggerModule.createDocument(app, new DocumentBuilder().setTitle("Perfil local").setVersion("1").build());
        const operation = document.paths["/leads/profile"]?.get;
        expect(operation?.parameters).toEqual(expect.arrayContaining([expect.objectContaining({ name: "source", required: true }), expect.objectContaining({ name: "id", required: true }), expect.objectContaining({ name: "cursor", required: false }), expect.objectContaining({ name: "orderPage", required: false })]));
        expect(operation?.responses["200"]).toMatchObject({ content: { "application/json": { schema: { required: ["schemaVersion", "observedAt", "id", "source", "sources", "sections", "history", "orders"], properties: { sections: { type: "array" }, history: { type: "object" }, orders: { required: ["native", "legacy"] } } } } } });
    });

    it.each(["role", "direct"])("con permiso %s: lead legacy completo, perfil ampliado, historial y órdenes", async (session) => {
        const response = await request(session, "source=legacy&id=11");
        expect(response.statusCode).toBe(200);
        expect(response.headers["cache-control"]).toBe("no-store");
        const body = response.json<LeadProfileResponseDto>();
        expect(body.source).toBe("legacy");
        expect(body.sources).toEqual(["legacy"]);
        expect(field(body, "fullName")).toMatchObject({ value: "Solo legacy", source: "legacy" });
        expect(field(body, "profession")).toMatchObject({ value: "Profesión legacy", source: "legacy" });
        expect(body.history.items).toContainEqual(expect.objectContaining({ detail: "Historia legacy pura", source: "legacy" }));
        expect(body.orders.legacy.items).toContainEqual(expect.objectContaining({ number: "OV-LEGACY" }));
    });
    it.each(["role", "direct"])("con permiso %s: lead nativo unificado con ambas BD", async (session) => {
        const response = await request(session, `source=native&id=${PROFILE_NATIVE_ID}`);
        expect(response.statusCode).toBe(200);
        const body = response.json<LeadProfileResponseDto>();
        expect(body.source).toBe("native");
        expect(body.sources).toEqual(["native", "legacy"]);
        expect(field(body, "fullName")).toMatchObject({ value: "Nombre nativo", source: "native", legacyValue: "Nombre anterior" });
        expect(field(body, "email")).toMatchObject({ value: "anterior@example.test", source: "legacy" });
        expect(field(body, "profession")).toMatchObject({ value: "Profesión complementaria", source: "legacy" });
        expect(body.history.items.map((entry) => entry.source)).toEqual(expect.arrayContaining(["native", "legacy"]));
        expect(body.orders.native.items).toContainEqual(expect.objectContaining({ number: "OV-NATIVA" }));
        expect(body.orders.legacy.items).toContainEqual(expect.objectContaining({ source: "native", number: "OV-NATIVA-PUENTE" }));
        expect(body.orders.legacy.items.some((order) => order.number === "OV-ANTERIOR")).toBe(false);
    });
    it("una URL legacy del lead ya nativo conserva el perfil unificado", async () => {
        const response = await request("role", "source=legacy&id=12");
        expect(response.statusCode).toBe(200);
        expect(response.json<LeadProfileResponseDto>()).toMatchObject({ id: PROFILE_NATIVE_ID, source: "native", sources: ["native", "legacy"] });
    });
    it.each(["missing", "deny"])("sin permiso efectivo %s: URL directa responde 403 sin consultar perfiles", async (session) => {
        expect((await request(session, "source=legacy&id=11")).statusCode).toBe(403);
        expect((await request(session, `source=native&id=${PROFILE_NATIVE_ID}`)).statusCode).toBe(403);
        expect(reads).not.toHaveBeenCalled();
    });
    it.each(["source=legacy&id=999999", "source=native&id=01ARZ3NDEKTSV4RRFFQ69G5FAZ"])("inexistente: 404 y mensaje no encontrado: %s", async (query) => {
        const response = await request("role", query);
        expect(response.statusCode).toBe(404);
        expect(response.json<{ message: string }>().message).toMatch(/no encontrado/iu);
    });
    it.each(["source=other&id=11", "source=legacy&id=11&orderPage=0", "source=legacy&id=11&orderPage=abc"])("rechaza parámetros inválidos también con tsx/Vitest: %s", async (query) => {
        expect((await request("role", query)).statusCode).toBe(400);
        expect(reads).not.toHaveBeenCalled();
    });
    it("sin sesión válida: 401", async () => {
        expect((await request("invalid", "source=legacy&id=11")).statusCode).toBe(401);
        expect(reads).not.toHaveBeenCalled();
    });
    it("revocar el permiso del rol bloquea la próxima solicitud y conserva el permiso personal independiente", async () => {
        if (!db) throw new Error("Fixture SQL no inicializado");
        expect((await request("role", "source=legacy&id=11")).statusCode).toBe(200);
        await sql`UPDATE sec_role_permission SET status_role_permission='inactive' WHERE role_id_role_permission=2`.execute(db);
        try {
            reads.mockClear();
            expect((await request("role", "source=legacy&id=11")).statusCode).toBe(403);
            expect(reads).not.toHaveBeenCalled();
            expect((await request("direct", "source=legacy&id=11")).statusCode).toBe(200);
        } finally {
            await sql`UPDATE sec_role_permission SET status_role_permission='active' WHERE role_id_role_permission=2`.execute(db);
        }
    });
});
