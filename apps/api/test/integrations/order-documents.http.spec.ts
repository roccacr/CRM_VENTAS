import "reflect-metadata";

import cookie from "@fastify/cookie";
import { UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { APP_GUARD } from "@nestjs/core";
import { FastifyAdapter, type NestFastifyApplication } from "@nestjs/platform-fastify";
import { Test } from "@nestjs/testing";
import { afterAll, beforeAll, beforeEach, expect, it, vi } from "vitest";

import { AuthGuard } from "../../src/common/security/auth.guard.js";
import { AuthenticatedReadRateLimit } from "../../src/common/security/authenticated-read-rate-limit.js";
import { CsrfGuard } from "../../src/common/security/csrf.guard.js";
import { createSignedCsrfToken } from "../../src/common/security/csrf-token.js";
import { CSRF_COOKIE_NAME, CSRF_HEADER_NAME_LOWERCASE, SESSION_COOKIE_NAME } from "../../src/common/security/http-security.constants.js";
import { OrderDocumentsController } from "../../src/integrations/microsoft365/order-documents.module.js";
import { OrderDocumentsService } from "../../src/integrations/microsoft365/order-documents.service.js";
import { IdentityService } from "../../src/modules/crm/identity/identity.service.js";
import type { IdentityProfile } from "../../src/modules/crm/identity/identity.types.js";
const secret = "order-documents-http-test-secret-32";
const session = "session-test";
const path = "/formalization/orders/legacy/78/documents";
let app: NestFastifyApplication;
let profile: IdentityProfile;
const graph = { folder: vi.fn(), files: vi.fn().mockResolvedValue([]), createFolder: vi.fn().mockResolvedValue({}) };
const orders = {
    resolve: vi.fn().mockImplementation((_target, check: (order: unknown) => void) => {
        check({ active: true });
        return Promise.resolve({ source: "legacy", id: "78", netsuiteId: "10518461" });
    }),
};
const identity = {
    getCurrentUser: vi.fn().mockImplementation((token: string | undefined) => {
        if (!token) throw new UnauthorizedException();
        return Promise.resolve(profile);
    }),
    withMicrosoftAccess: vi.fn().mockImplementation((_s, _scopes, callback: (token: string) => unknown) => callback("test-token")),
};
const audit = { record: vi.fn().mockResolvedValue(undefined) };
beforeAll(async () => {
    const config = new ConfigService({ COOKIE_SECRET: secret, ENABLE_ORDER_DOCUMENTS: true, MICROSOFT_DOCUMENTS_GROUP_ID: "group", MICROSOFT_ORDER_DOCUMENTS_ROOT_ID: "root" });
    const service = new OrderDocumentsService(identity as never, orders as never, config, graph as never, audit as never);
    const module = await Test.createTestingModule({
        controllers: [OrderDocumentsController],
        providers: [
            { provide: OrderDocumentsService, useValue: service },
            { provide: IdentityService, useValue: identity },
            { provide: ConfigService, useValue: config },
            { provide: AuthenticatedReadRateLimit, useValue: { enforceAuthenticatedReadLimit: () => Promise.resolve(true) } },
            { provide: APP_GUARD, useClass: CsrfGuard },
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
beforeEach(() => {
    vi.clearAllMocks();
    graph.folder.mockResolvedValue({ id: "folder", name: "10518461" });
    profile = {
        user: { publicId: "user", displayName: "Actor", email: "actor@example.test", status: "active", permissionVersion: 1, profileImageUrl: null },
        auth: { availableProviders: ["local"], currentProvider: "local", localStatus: "active", microsoft: null, primaryProvider: "microsoft" },
        roles: [{ code: "formalizacion", name: "Formalización", status: "active" }],
        orgUnits: [],
        permissions: ["formalizacion.orders.read", "formalizacion.orders.documents.read", "formalizacion.orders.documents.write"].map((code) => ({ code, effect: "allow", scope: "all_areas", source: "role" })),
        session: { expiresAt: new Date(Date.now() + 60000).toISOString(), expiresInSeconds: 60, permissionVersion: 1, publicId: "session", status: "active" },
    };
});
function headers(csrf = true) {
    const token = createSignedCsrfToken(secret, session);
    return { cookie: `${SESSION_COOKIE_NAME}=${session}${csrf ? `; ${CSRF_COOKIE_NAME}=${token}` : ""}`, ...(csrf ? { [CSRF_HEADER_NAME_LOWERCASE]: token } : {}) };
}
it("sin sesión responde401 antes de consultar Graph", async () => {
    expect((await app.inject({ method: "GET", url: path })).statusCode).toBe(401);
    expect(graph.folder).not.toHaveBeenCalled();
});
it.each(["formalizacion.orders.read", "formalizacion.orders.documents.read"])("sin %s responde403 antes de Graph", async (code) => {
    profile.permissions = profile.permissions.filter((p) => p.code !== code);
    expect((await app.inject({ method: "GET", url: path, headers: headers() })).statusCode).toBe(403);
    expect(graph.folder).not.toHaveBeenCalled();
});
it("un lector consulta documentos de la referencia correcta con no-store", async () => {
    const response = await app.inject({ method: "GET", url: path, headers: headers() });
    expect(response.statusCode).toBe(200);
    expect(response.headers["cache-control"]).toBe("no-store");
    expect(response.json()).toMatchObject({ reference: "10518461" });
    expect(graph.folder).toHaveBeenCalledWith("test-token", "group", "root", "10518461");
});
it("crear carpeta exige CSRF además de permiso", async () => {
    expect((await app.inject({ method: "POST", url: path + "/folder", headers: headers(false), payload: {} })).statusCode).toBe(403);
    expect(audit.record).not.toHaveBeenCalled();
});
it("denegación personal de escritura bloquea la creación", async () => {
    profile.permissions.push({ code: "formalizacion.orders.documents.write", effect: "deny", scope: null, source: "override" });
    expect((await app.inject({ method: "POST", url: path + "/folder", headers: headers(), payload: {} })).statusCode).toBe(403);
    expect(graph.createFolder).not.toHaveBeenCalled();
});
it("la creación explícita autorizada audita y conserva el ID NetSuite", async () => {
    graph.folder.mockResolvedValue(null);
    const result = await app.inject({ method: "POST", url: path + "/folder", headers: headers(), payload: {} });
    expect(result.statusCode).toBe(200);
    expect(result.json()).toMatchObject({ created: true, auditRecorded: true });
    expect(graph.createFolder).toHaveBeenCalledWith("test-token", "group", "root", "10518461");
});
