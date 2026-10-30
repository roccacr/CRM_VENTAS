import "reflect-metadata";

import cookie from "@fastify/cookie";
import { ForbiddenException, ServiceUnavailableException, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { APP_GUARD } from "@nestjs/core";
import { FastifyAdapter, type NestFastifyApplication } from "@nestjs/platform-fastify";
import { Test } from "@nestjs/testing";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { SanitizedErrorFilter } from "../../src/common/filters/sanitized-error.filter.js";
import { AuthGuard } from "../../src/common/security/auth.guard.js";
import { AuthenticatedReadRateLimit } from "../../src/common/security/authenticated-read-rate-limit.js";
import { CsrfGuard } from "../../src/common/security/csrf.guard.js";
import { createSignedCsrfToken } from "../../src/common/security/csrf-token.js";
import { CSRF_COOKIE_NAME, CSRF_HEADER_NAME_LOWERCASE, SESSION_COOKIE_NAME } from "../../src/common/security/http-security.constants.js";
import { IdentityService } from "../../src/modules/crm/identity/identity.service.js";
import { FormalizationApprovalController, FormalizationApprovalService } from "../../src/modules/crm/sales/sales-orders/formalization-approval.js";
import { FormalizationApprovalRepository } from "../../src/modules/crm/sales/sales-orders/formalization-approval.repository.js";
const input = { source: "legacy", id: "208", expectedSequence: 0, operationId: "550e8400-e29b-41d4-a716-446655440000" };
function setup(permissions = [{ code: "formalizacion.orders.approve", effect: "allow", scope: "all_areas" }], roles = [{ code: "formalizacion", status: "active" }]) {
    const getCurrentUser = vi.fn().mockResolvedValue({ user: { publicId: "actor" }, roles, permissions });
    const repository = { approve: vi.fn().mockImplementation((command: { source: string; id: string }) => Promise.resolve({ source: command.source, id: command.id, approved: true, state: "contract_pending_send", sequence: 1, replayed: false })) };
    return { getCurrentUser, repository, service: new FormalizationApprovalService({ getCurrentUser } as unknown as IdentityService, repository as unknown as FormalizationApprovalRepository) };
}
describe("Formalization approval command authorization", () => {
    it.each([input, { ...input, source: "native", id: "01ARZ3NDEKTSV4RRFFQ69G5FAV" }])("delegates an authorized approval for either source", async (body) => {
        const fixture = setup();
        await expect(fixture.service.approve("session", body)).resolves.toMatchObject({ approved: true, source: body.source });
        expect(fixture.repository.approve).toHaveBeenCalledWith(expect.objectContaining({ source: body.source, actorPublicId: "actor", ownOnly: false }));
    });
    it("the banner permission never grants approval", async () => {
        await expect(setup([{ code: "formalizacion.home.approvals.read", effect: "allow", scope: "all_areas" }]).service.approve("session", input)).rejects.toMatchObject({ status: 403 });
    });
    it("individual deny wins even with Owner and allow", async () => {
        const f = setup(
            [
                { code: "formalizacion.orders.approve", effect: "allow", scope: "all_areas" },
                { code: "formalizacion.orders.approve", effect: "deny", scope: "all_areas" },
            ],
            [
                { code: "owner", status: "active" },
                { code: "formalizacion", status: "active" },
            ],
        );
        await expect(f.service.approve("session", input)).rejects.toMatchObject({ status: 403 });
    });
    it("requires live identity and does not replace session failures", async () => {
        const f = setup();
        f.getCurrentUser.mockRejectedValue(new ForbiddenException());
        await expect(f.service.approve(undefined, input)).rejects.toMatchObject({ status: 403 });
        expect(f.getCurrentUser).toHaveBeenCalledWith(undefined);
    });
    it("requires effective module membership", async () => {
        await expect(setup(undefined, []).service.approve("session", input)).rejects.toMatchObject({ status: 403 });
    });
    it.each([
        { ...input, actorId: "forged" },
        { ...input, netsuiteApproved: true },
        { ...input, id: "208 OR 1=1" },
        { ...input, source: "native" },
        { ...input, expectedSequence: -1 },
        { ...input, operationId: "invalid" },
        { ...input, targetState: "approved" },
    ])("rejects malformed or forged bodies %j", async (body) => {
        await expect(setup().service.approve("session", body)).rejects.toMatchObject({ status: 400 });
    });
});

/** Actual controller + service + global guards, with only identity substituted. */
describe("approval HTTP boundary without database or ERP", () => {
    let app: NestFastifyApplication;
    let permissions = [{ code: "formalizacion.orders.approve", effect: "allow", scope: "all_areas" }];
    const secret = "approval-test-csrf-secret";
    const session = "approval-test-session";
    beforeAll(async () => {
        const module = await Test.createTestingModule({
            controllers: [FormalizationApprovalController],
            providers: [
                FormalizationApprovalService,
                {
                    provide: FormalizationApprovalRepository,
                    useValue: {
                        approve: () => {
                            throw new ServiceUnavailableException("Integración no disponible en esta prueba.");
                        },
                    },
                },
                {
                    provide: IdentityService,
                    useValue: {
                        getCurrentUser: (token: string | undefined) => {
                            if (token !== session) throw new UnauthorizedException();
                            return Promise.resolve({ user: { publicId: "actor" }, roles: [{ code: "formalizacion", status: "active" }], permissions });
                        },
                    },
                },
                { provide: ConfigService, useValue: new ConfigService({ COOKIE_SECRET: secret }) },
                { provide: AuthenticatedReadRateLimit, useValue: { enforceAuthenticatedReadLimit: () => Promise.resolve(true) } },
                { provide: APP_GUARD, useClass: CsrfGuard },
                { provide: APP_GUARD, useClass: AuthGuard },
            ],
        }).compile();
        app = module.createNestApplication<NestFastifyApplication>(new FastifyAdapter(), { logger: false });
        await app.register(cookie);
        app.useGlobalFilters(new SanitizedErrorFilter(app.getHttpAdapter()));
        await app.init();
        await app.getHttpAdapter().getInstance().ready();
    });
    afterAll(async () => {
        await app.close();
    });
    beforeEach(() => {
        permissions = [{ code: "formalizacion.orders.approve", effect: "allow", scope: "all_areas" }];
    });
    const headers = () => {
        const csrf = createSignedCsrfToken(secret, session);
        return { cookie: `${SESSION_COOKIE_NAME}=${session}; ${CSRF_COOKIE_NAME}=${csrf}`, [CSRF_HEADER_NAME_LOWERCASE]: csrf };
    };
    it("rejects missing CSRF even for a permitted user", async () => {
        expect((await app.inject({ method: "POST", url: "/formalization/orders/approve", payload: input, headers: { cookie: `${SESSION_COOKIE_NAME}=${session}` } })).statusCode).toBe(403);
    });
    it("rejects a missing session", async () => {
        const csrf = createSignedCsrfToken(secret, undefined);
        const response = await app.inject({ method: "POST", url: "/formalization/orders/approve", payload: input, headers: { cookie: `${CSRF_COOKIE_NAME}=${csrf}`, [CSRF_HEADER_NAME_LOWERCASE]: csrf } });
        expect([401, 403]).toContain(response.statusCode);
    });
    it("does not accept the banner read grant as command authorization", async () => {
        permissions = [{ code: "formalizacion.home.approvals.read", effect: "allow", scope: "all_areas" }];
        expect((await app.inject({ method: "POST", url: "/formalization/orders/approve", payload: input, headers: headers() })).statusCode).toBe(403);
    });
    it("blocks a direct deny before entering the command", async () => {
        permissions.push({ code: "formalizacion.orders.approve", effect: "deny", scope: "all_areas" });
        expect((await app.inject({ method: "POST", url: "/formalization/orders/approve", payload: input, headers: headers() })).statusCode).toBe(403);
    });
    it("returns a sanitized 503, never success, with no persistence or ERP provider", async () => {
        const response = await app.inject({ method: "POST", url: "/formalization/orders/approve", payload: input, headers: headers() });
        expect(response.statusCode).toBe(503);
        expect(response.headers["cache-control"]).toBe("no-store");
        expect(response.json()).not.toHaveProperty("approved");
    });
    it("rejects client confirmation or actor injection", async () => {
        expect((await app.inject({ method: "POST", url: "/formalization/orders/approve", payload: { ...input, netsuiteApproved: true, actorId: "other" }, headers: headers() })).statusCode).toBe(400);
    });
});

it("executes an authorized approval instead of the integration-pending placeholder", async () => {
    await expect(setup().service.approve("session", input)).resolves.toMatchObject({ approved: true });
});

it.each(["formalizacion", "jefe_formalizaciones"].flatMap((role) => ["self", "assigned"].map((scope) => [role, scope])))("approval is module-wide for %s with %s, retaining individual deny", async (role, scope) => {
    const grant = { code: "formalizacion.orders.approve", effect: "allow", scope };
    const roles = [{ code: role, status: "active" }];
    const f = setup([grant], roles);
    await f.service.approve("session", input);
    expect(f.repository.approve).toHaveBeenCalledWith(expect.objectContaining({ ownOnly: false }));
    const denied = setup([grant, { ...grant, effect: "deny" }], roles);
    await expect(denied.service.approve("session", input)).rejects.toMatchObject({ status: 403 });
    expect(denied.repository.approve).not.toHaveBeenCalled();
});

it.each(["formalizacion", "jefe_formalizaciones"])("rejects inactive %s even with an approval grant", async (role) => {
    const f = setup(undefined, [{ code: role, status: "inactive" }]);
    await expect(f.service.approve("session", input)).rejects.toMatchObject({ status: 403 });
    expect(f.repository.approve).not.toHaveBeenCalled();
});

it("rejects an unknown approval scope before persistence", async () => {
    const f = setup([{ code: "formalizacion.orders.approve", effect: "allow", scope: "unknown" }]);
    await expect(f.service.approve("session", input)).rejects.toMatchObject({ status: 403 });
    expect(f.repository.approve).not.toHaveBeenCalled();
});
