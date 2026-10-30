import "reflect-metadata";

import cookie from "@fastify/cookie";
import { UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { APP_GUARD } from "@nestjs/core";
import { FastifyAdapter, type NestFastifyApplication } from "@nestjs/platform-fastify";
import { Test } from "@nestjs/testing";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { AuthGuard } from "../../src/common/security/auth.guard.js";
import { AuthenticatedReadRateLimit } from "../../src/common/security/authenticated-read-rate-limit.js";
import { CsrfGuard } from "../../src/common/security/csrf.guard.js";
import { createSignedCsrfToken } from "../../src/common/security/csrf-token.js";
import { CSRF_COOKIE_NAME, CSRF_HEADER_NAME_LOWERCASE, SESSION_COOKIE_NAME } from "../../src/common/security/http-security.constants.js";
import { IdentityService } from "../../src/modules/crm/identity/identity.service.js";
import { NoteCollaborationController } from "../../src/modules/crm/notes/note-collaboration.controller.js";
import { NoteCollaborationService } from "../../src/modules/crm/notes/note-collaboration.service.js";
import { NoteNotificationsController } from "../../src/modules/crm/notes/note-notifications.controller.js";
import { NoteNotificationsService } from "../../src/modules/crm/notes/note-notifications.service.js";
import { NoteWorkflowController } from "../../src/modules/crm/notes/note-workflow.controller.js";
import { NoteWorkflowService } from "../../src/modules/crm/notes/note-workflow.service.js";

const id = "01K00000000000000000000000";
const secret = "notes-http-review-secret";
const session = "notes-http-review-session";
const mutations = [
    { method: "PUT", path: `/note-workflow/notes/${id}/task`, call: "task" },
    { method: "PUT", path: `/note-workflow/notes/${id}/reminder`, call: "reminder" },
    { method: "PUT", path: `/note-collaboration/notes/${id}/locations`, call: "replaceLocations" },
    { method: "PUT", path: `/note-collaboration/notes/${id}/participants`, call: "participants" },
    { method: "PUT", path: `/note-collaboration/notes/${id}/mentions`, call: "mentions" },
    { method: "POST", path: `/note-collaboration/notes/${id}/replies`, call: "reply" },
    { method: "PATCH", path: `/note-collaboration/notes/${id}/replies/${id}`, call: "editReply" },
    { method: "POST", path: `/note-collaboration/notes/${id}/replies/${id}/withdraw`, call: "withdrawReply" },
    { method: "PUT", path: `/note-collaboration/notes/${id}/my-following`, call: "following" },
    { method: "PUT", path: "/notifications/read-all", call: "readAll" },
    { method: "PUT", path: `/notifications/${id}/read`, call: "read" },
] as const;
const reads = [
    { path: `/note-workflow/notes/${id}`, call: "read" },
    { path: "/note-workflow/overview", call: "overview" },
    { path: "/note-collaboration/inbox/authors", call: "inboxAuthors" },
    { path: `/note-collaboration/notes/${id}/activity`, call: "activity" },
    { path: `/note-collaboration/notes/${id}/locations`, call: "locations" },
    { path: "/note-collaboration/inbox", call: "inbox" },
    { path: "/note-collaboration/eligible-users", call: "eligibleDraftUsers" },
    { path: `/note-collaboration/notes/${id}`, call: "thread" },
    { path: `/note-collaboration/notes/${id}/eligible-users`, call: "eligibleUsers" },
    { path: "/notifications", call: "list" },
    { path: "/notifications/unread-count", call: "unreadCount" },
] as const;
const methods = [...mutations, ...reads].map((route) => route.call);
const handlers = Object.fromEntries(methods.map((name) => [name, vi.fn().mockResolvedValue({ ok: true })]));

describe("stage4 HTTP authentication and session-bound CSRF", () => {
    let app: NestFastifyApplication;
    beforeAll(async () => {
        const module = await Test.createTestingModule({
            controllers: [NoteCollaborationController, NoteNotificationsController, NoteWorkflowController],
            providers: [
                { provide: NoteCollaborationService, useValue: handlers },
                { provide: NoteWorkflowService, useValue: handlers },
                { provide: NoteNotificationsService, useValue: handlers },
                {
                    provide: IdentityService,
                    useValue: {
                        getCurrentUser: (token?: string) => {
                            if (token !== session) throw new UnauthorizedException();
                            return Promise.resolve({ user: { publicId: id } });
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
        await app.init();
        await app.getHttpAdapter().getInstance().ready();
    });
    beforeEach(() => vi.clearAllMocks());
    afterAll(async () => app.close());
    function noCalls() {
        for (const handler of Object.values(handlers)) expect(handler).not.toHaveBeenCalled();
    }
    it.each(reads)("rejects anonymous GET $path before returning private metadata", async (route) => {
        const response = await app.inject({ method: "GET", url: route.path });
        expect(response.statusCode).toBe(401);
        noCalls();
    });
    describe.each(mutations)("$method $path", (route) => {
        it.each(["missing", "mismatched", "different-session"])("rejects %s CSRF before service execution", async (mode) => {
            const token = createSignedCsrfToken(secret, mode === "different-session" ? "other-session" : session);
            const response = await app.inject({
                method: route.method,
                url: route.path,
                payload: {},
                headers: {
                    cookie: `${SESSION_COOKIE_NAME}=${session}; ${CSRF_COOKIE_NAME}=${token}`,
                    ...(mode === "missing" ? {} : { [CSRF_HEADER_NAME_LOWERCASE]: mode === "mismatched" ? "invalid" : token }),
                },
            });
            expect(response.statusCode).toBe(403);
            noCalls();
        });
        it("rejects an expired session even when its CSRF signature still matches", async () => {
            const expiredSession = "expired-notes-session";
            const token = createSignedCsrfToken(secret, expiredSession);
            const response = await app.inject({ method: route.method, url: route.path, payload: {}, headers: { cookie: `${SESSION_COOKIE_NAME}=${expiredSession}; ${CSRF_COOKIE_NAME}=${token}`, [CSRF_HEADER_NAME_LOWERCASE]: token } });
            expect(response.statusCode).toBe(401);
            noCalls();
        });
        it("passes only the authenticated session with valid CSRF and disables caching", async () => {
            const token = createSignedCsrfToken(secret, session);
            const response = await app.inject({
                method: route.method,
                url: route.path,
                payload: {},
                headers: {
                    cookie: `${SESSION_COOKIE_NAME}=${session}; ${CSRF_COOKIE_NAME}=${token}`,
                    [CSRF_HEADER_NAME_LOWERCASE]: token,
                },
            });
            expect(response.statusCode).toBe(200);
            expect(response.headers["cache-control"]).toBe("no-store");
            expect(handlers[route.call]?.mock.calls[0]?.[0]).toBe(session);
        });
    });
    it.each(reads)("passes session and disables caching for GET $path", async (route) => {
        const response = await app.inject({ method: "GET", url: route.path, headers: { cookie: `${SESSION_COOKIE_NAME}=${session}` } });
        expect(response.statusCode).toBe(200);
        expect(response.headers["cache-control"]).toBe("no-store");
        expect(handlers[route.call]?.mock.calls[0]?.[0]).toBe(session);
    });
});
