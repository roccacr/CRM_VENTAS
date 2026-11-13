import "reflect-metadata";

import cookie from "@fastify/cookie";
import { ConflictException, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { APP_GUARD } from "@nestjs/core";
import { FastifyAdapter, type NestFastifyApplication } from "@nestjs/platform-fastify";
import { Test } from "@nestjs/testing";
import fc from "fast-check";
import { afterAll, beforeAll, beforeEach, expect, it, vi } from "vitest";

import { SanitizedErrorFilter } from "../../src/common/filters/sanitized-error.filter.js";
import { AuthGuard } from "../../src/common/security/auth.guard.js";
import { AuthenticatedReadRateLimit } from "../../src/common/security/authenticated-read-rate-limit.js";
import { CsrfGuard } from "../../src/common/security/csrf.guard.js";
import { createSignedCsrfToken } from "../../src/common/security/csrf-token.js";
import { CSRF_COOKIE_NAME, CSRF_HEADER_NAME_LOWERCASE, SESSION_COOKIE_NAME } from "../../src/common/security/http-security.constants.js";
import { CALENDAR_LEGACY_READER } from "../../src/modules/crm/calendar/calendar.contract.js";
import { CalendarController } from "../../src/modules/crm/calendar/calendar.module.js";
import { CalendarRepository } from "../../src/modules/crm/calendar/calendar.repository.js";
import { CalendarService } from "../../src/modules/crm/calendar/calendar.service.js";
import { CalendarExternalService } from "../../src/modules/crm/calendar/calendar-external.service.js";
import { CalendarLookupService } from "../../src/modules/crm/calendar/calendar-lookup.service.js";
import { IdentityService } from "../../src/modules/crm/identity/identity.service.js";
import { SalesOrderAddendumController, SalesOrderAddendumService, SalesOrderAddendumSummaryController } from "../../src/modules/crm/sales/sales-orders/sales-order-addendum.js";
import { SalesOrderAddendumRepository } from "../../src/modules/crm/sales/sales-orders/sales-order-addendum.repository.js";

const id = "01ARZ3NDEKTSV4RRFFQ69G5FAV";
const session = "addendum-http-test-session";
const secret = "addendum-http-test-only-cookie-secret";
const permission = "formalizacion.orders.addendum.update";
const grant = (code: string, effect = "allow") => ({ code, effect, scope: "all_areas" });
const eventBody = {
    description: "Documento requerido",
    moduleCode: "formalizacion",
    typeId: id,
    title: "Adéndum",
    start: "2027-01-01T14:00:00Z",
    end: "2027-01-01T15:00:00Z",
    allDay: false,
    operationId: "550e8400-e29b-41d4-a716-446655440000",
    links: [
        { entityType: "sales_order", source: "native", id },
        { entityType: "lead", source: "native", id },
    ],
};
const markerBody = { source: "native", id, status: "completed", expectedVersion: 1, operationId: eventBody.operationId };
let permissions = [grant("formalizacion.orders.read"), grant("formalizacion.orders.addendum.read"), grant(permission), ...["read", "create", "update", "assign_lead"].map((action) => grant(`formalizacion.calendar.${action}`))];
let app: NestFastifyApplication;
const identity = {
    getCurrentUser: vi.fn((token: string | undefined) => {
        if (token !== session) throw new UnauthorizedException();
        return Promise.resolve({ user: { publicId: "actor" }, roles: [{ code: "formalizacion", status: "active" }], orgUnits: [{ code: "formalizacion", status: "active" }], permissions });
    }),
};
const writes = vi.fn();
const marker = { prepareEvent: vi.fn(), read: vi.fn(), change: vi.fn(), future: vi.fn(), markManually: vi.fn(), summary: vi.fn(), result: (value: object) => ({ schemaVersion: 1, ...value }) };
const calendar = {
    save: vi.fn<CalendarRepository["save"]>().mockImplementation(async (...args) => {
        await args[4]?.({ isTransaction: true } as never, null, "adendum");
        writes();
        throw new Error("An event must not persist during the duplicate scenario");
    }),
};
beforeAll(async () => {
    const module = await Test.createTestingModule({
        controllers: [CalendarController, SalesOrderAddendumController, SalesOrderAddendumSummaryController],
        providers: [
            CalendarService,
            SalesOrderAddendumService,
            { provide: CalendarRepository, useValue: calendar },
            { provide: CalendarLookupService, useValue: { validateLinks: vi.fn(), leadInvitationEmails: vi.fn().mockResolvedValue([]), canManageLinks: vi.fn().mockResolvedValue(true) } },
            { provide: CalendarExternalService, useValue: { publish: vi.fn() } },
            { provide: CALENDAR_LEGACY_READER, useValue: {} },
            { provide: SalesOrderAddendumRepository, useValue: marker },
            { provide: IdentityService, useValue: identity },
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
beforeEach(() => {
    vi.clearAllMocks();
    permissions = [grant("formalizacion.orders.read"), grant("formalizacion.orders.addendum.read"), grant(permission), ...["read", "create", "update", "assign_lead"].map((action) => grant(`formalizacion.calendar.${action}`))];
    marker.prepareEvent.mockRejectedValue(new ConflictException({ code: "EXISTING_FUTURE_ADDENDUM", message: "Ya existe un Adéndum futuro para esta orden.", existing: { id, start: "2027-01-01T14:00:00.000Z" } }));
    marker.read.mockResolvedValue({ source: "native", id, status: "pending", version: 1, changedAt: null });
    marker.change.mockResolvedValue({ schemaVersion: 1, source: "native", id, status: "completed", version: 2, changedAt: "2026-11-03T12:00:00.000Z", replayed: false });
    marker.future.mockResolvedValue({ schemaVersion: 1, source: "native", id, blocked: true, existing: null });
    marker.markManually.mockResolvedValue({ schemaVersion: 1, source: "native", id, status: "pending", version: 2, changedAt: null, note: null, replayed: false });
    marker.summary.mockResolvedValue({ total: 7 });
});
afterAll(async () => {
    await app.close();
});
function headers() {
    const token = createSignedCsrfToken(secret, session);
    return { cookie: `${SESSION_COOKIE_NAME}=${session}; ${CSRF_COOKIE_NAME}=${token}`, [CSRF_HEADER_NAME_LOWERCASE]: token };
}
it("preserves the structured future-conflict body through the actual HTTP filter and prevents event writes", async () => {
    const result = await app.inject({ method: "POST", url: "/calendar/events", payload: eventBody, headers: headers() });
    expect(result.statusCode).toBe(409);
    expect(result.json()).toEqual({ code: "EXISTING_FUTURE_ADDENDUM", message: "Ya existe un Adéndum futuro para esta orden.", existing: { id, start: "2027-01-01T14:00:00.000Z" } });
    expect(writes).not.toHaveBeenCalled();
});
it("requires the dedicated order permission, even with calendar editing access", async () => {
    permissions.push(grant(permission, "deny"));
    const result = await app.inject({ method: "POST", url: "/formalization/orders/addendum", payload: markerBody, headers: headers() });
    expect(result.statusCode).toBe(403);
    expect(marker.change).not.toHaveBeenCalled();
});
it("allows a versioned order-only completion without requiring calendar editing permission", async () => {
    permissions = [grant("formalizacion.orders.read"), grant("formalizacion.orders.addendum.read"), grant(permission)];
    const result = await app.inject({ method: "POST", url: "/formalization/orders/addendum", payload: markerBody, headers: headers() });
    expect(result.statusCode).toBe(200);
    expect(result.json()).toMatchObject({ status: "completed", canUpdate: true });
    expect(marker.change).toHaveBeenCalledWith({ ...markerBody, actorPublicId: "actor" });
});
it("exposes read-only order status separately from future calendar visibility", async () => {
    permissions = [grant("formalizacion.orders.read"), grant("formalizacion.orders.addendum.read")];
    const status = await app.inject({ method: "GET", url: `/formalization/orders/addendum?source=native&id=${id}`, headers: headers() });
    expect(status.statusCode).toBe(200);
    expect(status.json()).toMatchObject({ status: "pending", canUpdate: false });
    const future = await app.inject({ method: "GET", url: `/formalization/orders/addendum/future?source=native&id=${id}`, headers: headers() });
    expect(future.statusCode).toBe(403);
    expect(marker.future).not.toHaveBeenCalled();
});
it("rejects missing CSRF and forged actors without mutation", async () => {
    expect((await app.inject({ method: "POST", url: "/formalization/orders/addendum", payload: markerBody, headers: { cookie: `${SESSION_COOKIE_NAME}=${session}` } })).statusCode).toBe(403);
    expect((await app.inject({ method: "POST", url: "/formalization/orders/addendum", payload: { ...markerBody, actorPublicId: "forged" }, headers: headers() })).statusCode).toBe(400);
    expect(marker.change).not.toHaveBeenCalled();
});
it("marks pending manually only with its explicit grant and rejects an oversized note before persistence", async () => {
    const body = { source: "native", id, expectedVersion: 1, operationId: eventBody.operationId, note: "  Documento pendiente  " };
    expect((await app.inject({ method: "POST", url: "/formalization/orders/addendum/pending", payload: body, headers: headers() })).statusCode).toBe(403);
    expect(marker.markManually).not.toHaveBeenCalled();
    permissions.push(grant("formalizacion.orders.addendum.mark_pending"));
    const result = await app.inject({ method: "POST", url: "/formalization/orders/addendum/pending", payload: body, headers: headers() });
    expect(result.statusCode).toBe(200);
    expect(result.json()).toMatchObject({ status: "pending", canMarkPending: true });
    expect(marker.markManually).toHaveBeenCalledWith({ ...body, note: "Documento pendiente", actorPublicId: "actor" });
    expect(calendar.save).not.toHaveBeenCalled();
    expect((await app.inject({ method: "POST", url: "/formalization/orders/addendum/pending", payload: { ...body, note: "x".repeat(2001) }, headers: headers() })).statusCode).toBe(400);
    expect(marker.markManually).toHaveBeenCalledOnce();
});

it("bulk renewal retains strict inputs, CSRF and explicit grant/deny checks at its HTTP entry point", async () => {
    const body = { source: "native", id, expectedVersion: 1, operationId: eventBody.operationId, note: "Motivo común" };
    const url = "/formalization/orders/addendum/pending/bulk-item";
    expect((await app.inject({ method: "POST", url, payload: body, headers: headers() })).statusCode).toBe(403);
    permissions.push(grant("formalizacion.orders.addendum.mark_pending"));
    expect((await app.inject({ method: "POST", url, payload: body, headers: { cookie: `${SESSION_COOKIE_NAME}=${session}` } })).statusCode).toBe(403);
    expect((await app.inject({ method: "POST", url, payload: { ...body, actorPublicId: "forged" }, headers: headers() })).statusCode).toBe(400);
    expect(marker.markManually).not.toHaveBeenCalled();
    expect((await app.inject({ method: "POST", url, payload: body, headers: headers() })).statusCode).toBe(200);
    expect(marker.markManually).toHaveBeenCalledExactlyOnceWith({ ...body, actorPublicId: "actor" }, true);
    permissions.push(grant("formalizacion.orders.addendum.mark_pending", "deny"));
    expect((await app.inject({ method: "POST", url, payload: body, headers: headers() })).statusCode).toBe(403);
    expect(marker.markManually).toHaveBeenCalledOnce();
});

it("rejects generated malformed bulk inputs without invoking persistence", async () => {
    permissions.push(grant("formalizacion.orders.addendum.mark_pending"));
    const body = { source: "native", id, expectedVersion: 1, operationId: eventBody.operationId, note: "Motivo común" };
    await fc.assert(
        fc.asyncProperty(
            fc.oneof(
                fc.string({ maxLength: 2 }).map((note) => ({ ...body, note })),
                fc.integer({ max: -1 }).map((expectedVersion) => ({ ...body, expectedVersion })),
                fc.jsonValue().map((actorPublicId) => ({ ...body, actorPublicId })),
            ),
            async (payload) => {
                const result = await app.inject({ method: "POST", url: "/formalization/orders/addendum/pending/bulk-item", payload, headers: headers() });
                expect(result.statusCode).toBe(400);
                expect(marker.markManually).not.toHaveBeenCalled();
            },
        ),
        { seed: 20261113, numRuns: 30 },
    );
});

it("previews a bounded selection without writes and retains entry-point guards", async () => {
    const url = "/formalization/orders/addendum/pending/preview";
    const body = {
        orders: [
            { source: "native", id },
            { source: "legacy", id: "78" },
        ],
    };
    expect((await app.inject({ method: "POST", url, payload: body, headers: headers() })).statusCode).toBe(403);
    permissions.push(grant("formalizacion.orders.addendum.mark_pending"));
    expect((await app.inject({ method: "POST", url, payload: body, headers: { cookie: `${SESSION_COOKIE_NAME}=${session}` } })).statusCode).toBe(403);
    expect((await app.inject({ method: "POST", url, payload: { orders: Array.from({ length: 101 }, () => body.orders[0]) }, headers: headers() })).statusCode).toBe(400);
    marker.read.mockResolvedValueOnce({ source: "native", id, active: true, status: "pending", version: 1, changedAt: null }).mockRejectedValueOnce(new Error("unavailable"));
    const result = await app.inject({ method: "POST", url, payload: body, headers: headers() });
    expect(result.statusCode).toBe(200);
    expect(result.json()).toMatchObject({
        items: [
            { source: "native", id, order: { status: "pending", availableForPending: true } },
            { source: "legacy", id: "78", order: null },
        ],
    });
    expect(marker.markManually).not.toHaveBeenCalled();
    expect(marker.change).not.toHaveBeenCalled();
});
it("allows only the independent count when the user has a banner grant and no order grants", async () => {
    permissions = [grant("formalizacion.home.addendum.read")];
    const result = await app.inject({ method: "GET", url: "/formalization/addendum/summary", headers: headers() });
    expect(result.statusCode).toBe(200);
    expect(result.json()).toEqual({ total: 7 });
    expect((await app.inject({ method: "GET", url: `/formalization/orders/addendum?source=native&id=${id}`, headers: headers() })).statusCode).toBe(403);
    permissions.push(grant("formalizacion.home.addendum.read", "deny"));
    expect((await app.inject({ method: "GET", url: "/formalization/addendum/summary", headers: headers() })).statusCode).toBe(403);
    expect(marker.summary).toHaveBeenCalledOnce();
});
it("hides marker reads and writes without its read permission but retains calendar duplicate checks", async () => {
    permissions.push(grant("formalizacion.orders.addendum.read", "deny"), grant("formalizacion.orders.addendum.mark_pending"));
    expect((await app.inject({ method: "GET", url: `/formalization/orders/addendum?source=native&id=${id}`, headers: headers() })).statusCode).toBe(403);
    expect((await app.inject({ method: "POST", url: "/formalization/orders/addendum", payload: markerBody, headers: headers() })).statusCode).toBe(403);
    expect((await app.inject({ method: "POST", url: "/formalization/orders/addendum/pending", payload: { source: "native", id, expectedVersion: 1, operationId: eventBody.operationId }, headers: headers() })).statusCode).toBe(403);
    expect((await app.inject({ method: "GET", url: `/formalization/orders/addendum/future?source=native&id=${id}`, headers: headers() })).statusCode).toBe(200);
    expect(marker.read).not.toHaveBeenCalled();
    expect(marker.change).not.toHaveBeenCalled();
    expect(marker.markManually).not.toHaveBeenCalled();
});

it("lets a reader mark sent through dedicated CSRF-protected strict route without update grants", async () => {
    permissions = [grant("formalizacion.orders.read"), grant("formalizacion.orders.addendum.read")];
    const body = { source: "native", id, expectedVersion: 1, operationId: eventBody.operationId };
    expect((await app.inject({ method: "POST", url: "/formalization/orders/addendum/sent", payload: body, headers: headers() })).statusCode).toBe(200);
    expect(marker.change).toHaveBeenCalledWith({ ...body, status: "sent", actorPublicId: "actor" });
    expect((await app.inject({ method: "POST", url: "/formalization/orders/addendum/sent", payload: { ...body, note: "forged" }, headers: headers() })).statusCode).toBe(400);
    expect((await app.inject({ method: "POST", url: "/formalization/orders/addendum/sent", payload: body, headers: { cookie: `${SESSION_COOKIE_NAME}=${session}` } })).statusCode).toBe(403);
    permissions.push(grant("formalizacion.orders.addendum.read", "deny"));
    expect((await app.inject({ method: "POST", url: "/formalization/orders/addendum/sent", payload: body, headers: headers() })).statusCode).toBe(403);
});
