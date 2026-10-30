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
import type { IdentityAuthorizationProfile } from "../../src/modules/crm/identity/identity.types.js";
import type { CollaborationNote, NoteCollaborationRepository } from "../../src/modules/crm/notes/note-collaboration.repository.js";
import { NoteRelatedRecordsController } from "../../src/modules/crm/notes/note-related-records.controller.js";
import type { NoteRelatedRecordsRepository } from "../../src/modules/crm/notes/note-related-records.repository.js";
import type { NoteRelatedRecordsResolver } from "../../src/modules/crm/notes/note-related-records.resolver.js";
import { NoteRelatedRecordsService } from "../../src/modules/crm/notes/note-related-records.service.js";
import type { NotesRealtimeSignal } from "../../src/modules/crm/notes/notes-realtime.signal.js";

const noteId = "01K00000000000000000000000";
const actorId = "01K00000000000000000000001";
const session = "related-records-http-session";
const secret = "related-records-http-csrf-secret";
const putPath = `/note-collaboration/notes/${noteId}/related-records`;
const reads = [
    { path: "/notes/related-record-options?moduleCode=ventas&kind=lead&search=Ana&page=1", handler: "options" },
    { path: putPath, handler: "read" },
] as const;

// These doubles prove transport barriers and routing; domain authorization has separate tests.
const handlers = {
    options: vi.fn().mockResolvedValue({ schemaVersion: 1, items: [], page: { number: 1, size: 25 }, hasMore: false, partial: false }),
    read: vi.fn().mockResolvedValue({ schemaVersion: 1, version: 1, items: [], canManage: false }),
    replace: vi.fn().mockResolvedValue({ noteId, version: 1, collaborationVersion: 2, replayed: false }),
};
const noCalls = () => {
    for (const handler of Object.values(handlers)) expect(handler).not.toHaveBeenCalled();
};

describe("related records HTTP session and CSRF boundaries", () => {
    let app: NestFastifyApplication;
    beforeAll(async () => {
        const module = await Test.createTestingModule({
            controllers: [NoteRelatedRecordsController],
            providers: [
                { provide: NoteRelatedRecordsService, useValue: handlers },
                {
                    provide: IdentityService,
                    useValue: {
                        getCurrentUser: (value?: string) => {
                            if (value !== session) throw new UnauthorizedException();
                            return Promise.resolve({ user: { publicId: actorId }, roles: [], orgUnits: [], permissions: [{ code: "ventas.notes.read", effect: "allow", scope: "self", source: "role" }] });
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

    it.each(reads)("rejects anonymous GET $path before resolving names", async ({ path }) => {
        expect((await app.inject({ method: "GET", url: path })).statusCode).toBe(401);
        noCalls();
    });
    it.each(reads)("rejects an expired session GET $path", async ({ path }) => {
        expect((await app.inject({ method: "GET", url: path, headers: { cookie: `${SESSION_COOKIE_NAME}=expired` } })).statusCode).toBe(401);
        noCalls();
    });
    it.each(reads)("routes authenticated GET $path to its dedicated handler and disables caching", async (route) => {
        const response = await app.inject({ method: "GET", url: route.path, headers: { cookie: `${SESSION_COOKIE_NAME}=${session}` } });
        expect(response.statusCode).toBe(200);
        expect(response.headers["cache-control"]).toBe("no-store");
        const handler = handlers[route.handler];
        expect(handler.mock.calls[0]?.[0]).toBe(session);
        expect(handler).toHaveBeenCalledTimes(1);
    });
    it.each(["missing", "mismatch", "different-session"])("rejects %s CSRF before modifying relations", async (mode) => {
        const token = createSignedCsrfToken(secret, mode === "different-session" ? "other-session" : session);
        const response = await app.inject({
            method: "PUT",
            url: putPath,
            payload: { operationId: "related-records-http-operation", expectedCollaborationVersion: 1, relatedRecords: [{ kind: "lead", source: "legacy", id: "208" }] },
            headers: { cookie: `${SESSION_COOKIE_NAME}=${session}; ${CSRF_COOKIE_NAME}=${token}`, ...(mode === "missing" ? {} : { [CSRF_HEADER_NAME_LOWERCASE]: mode === "mismatch" ? "invalid" : token }) },
        });
        expect(response.statusCode).toBe(403);
        noCalls();
    });
    it("rejects expired authentication even with a session-matching CSRF signature", async () => {
        const expired = "expired-related-record-session";
        const token = createSignedCsrfToken(secret, expired);
        const response = await app.inject({ method: "PUT", url: putPath, payload: {}, headers: { cookie: `${SESSION_COOKIE_NAME}=${expired}; ${CSRF_COOKIE_NAME}=${token}`, [CSRF_HEADER_NAME_LOWERCASE]: token } });
        expect(response.statusCode).toBe(401);
        noCalls();
    });
    it("passes a versioned payload with source-qualified IDs only after session and CSRF checks", async () => {
        const body = {
            operationId: "related-records-http-operation",
            expectedCollaborationVersion: 1,
            relatedRecords: [
                { kind: "lead", source: "legacy", id: "208" },
                { kind: "sales_order", source: "native", id: noteId },
            ],
        };
        const token = createSignedCsrfToken(secret, session);
        const response = await app.inject({ method: "PUT", url: putPath, payload: body, headers: { cookie: `${SESSION_COOKIE_NAME}=${session}; ${CSRF_COOKIE_NAME}=${token}`, [CSRF_HEADER_NAME_LOWERCASE]: token } });
        expect(response.statusCode).toBe(200);
        expect(response.headers["cache-control"]).toBe("no-store");
        expect(handlers.replace).toHaveBeenCalledWith(session, noteId, body);
    });
});

// Real application service: transport doubles above do not prove author/capability decisions.
describe("related-record service ownership and live revocation", () => {
    const owner = actorId;
    const invited = "01K00000000000000000000002";
    const body = { operationId: "qa_related_records_operation", expectedCollaborationVersion: 2, relatedRecords: [{ kind: "lead", source: "legacy", id: "208" }] };
    let profile: IdentityAuthorizationProfile;
    let state: CollaborationNote;
    let revokeBetweenPhases = false;
    const identity = { getCurrentUser: vi.fn() };
    const collaboration = { load: vi.fn(), command: vi.fn() };
    const repository = { referencesForNotes: vi.fn() };
    const resolver = { search: vi.fn(), resolveMany: vi.fn() };
    const realtime = { notify: vi.fn() };
    let service: NoteRelatedRecordsService;
    beforeEach(() => {
        vi.clearAllMocks();
        revokeBetweenPhases = false;
        profile = { user: { publicId: owner, displayName: "Synthetic owner", email: "owner@example.test", status: "active", permissionVersion: 1, profileImageUrl: null }, roles: [], orgUnits: [], permissions: ["read", "create", "edit_own"].map((action) => ({ code: `ventas.notes.${action}`, effect: "allow", scope: "self", source: "system" })) };
        state = {
            note: { internalId: 7, publicId: noteId, authorId: 1, authorPublicId: owner, authorName: "Synthetic owner", moduleCode: "ventas", title: null, text: "Synthetic note", color: "#FFFF88", priority: "normal", status: "open", visibility: "shared", version: 1, createdAt: "2026-10-29T00:00:00Z", updatedAt: "2026-10-29T00:00:00Z", completedAt: null, archivedAt: null },
            context: { kind: "personal" },
            collaborationVersion: 2,
            participants: [{ userId: invited, displayName: "Synthetic guest", access: "reply", following: true }],
        };
        identity.getCurrentUser.mockImplementation(() => Promise.resolve(profile));
        collaboration.load.mockImplementation(() => Promise.resolve(state));
        collaboration.command.mockImplementation(async (_actor: string, _id: string, _input: unknown, authorize: Parameters<NoteCollaborationRepository["command"]>[3]) => {
            await authorize(state, {} as never, "read");
            if (revokeBetweenPhases) profile.permissions.push({ code: "ventas.notes.edit_own", effect: "deny", scope: null, source: "override" });
            await authorize(state, {} as never, "write");
            return { noteId, version: 1, collaborationVersion: 3, replayed: false };
        });
        repository.referencesForNotes.mockResolvedValue(new Map());
        resolver.search.mockResolvedValue({ schemaVersion: 1, items: [], page: { number: 1, size: 25 }, hasMore: false, partial: false });
        resolver.resolveMany.mockImplementation((_profile: unknown, references: { kind: string; source: string; id: string }[]) => Promise.resolve(references.map((reference) => ({ kind: reference.kind, reference, label: "Authorized customer", description: null, url: null, restricted: false }))));
        service = new NoteRelatedRecordsService(identity as unknown as IdentityService, collaboration as unknown as NoteCollaborationRepository, repository as unknown as NoteRelatedRecordsRepository, resolver as unknown as NoteRelatedRecordsResolver, realtime as unknown as NotesRealtimeSignal);
    });
    it("does not allow a read-only notes grant to enumerate customer/order options", async () => {
        profile.permissions = profile.permissions.filter((permission) => permission.code === "ventas.notes.read");
        await expect(service.options(session, { moduleCode: "ventas", kind: "lead" })).rejects.toMatchObject({ status: 403 });
        expect(resolver.search).not.toHaveBeenCalled();
    });
    it("permits author lookup through the dedicated options contract", async () => {
        await service.options(session, { moduleCode: "ventas", kind: "lead", search: "Ana", page: "2" });
        expect(resolver.search).toHaveBeenCalledWith(profile, "ventas", "lead", "Ana", 2);
    });
    it("refuses a participant's changes even when that participant has edit_own grants", async () => {
        profile.user.publicId = invited;
        await expect(service.replace(session, noteId, body)).rejects.toMatchObject({ status: 403 });
        expect(resolver.resolveMany).not.toHaveBeenCalled();
        expect(realtime.notify).not.toHaveBeenCalled();
    });
    it("refuses original authors without an effective edit_own grant", async () => {
        profile.permissions.push({ code: "ventas.notes.edit_own", effect: "deny", scope: null, source: "override" });
        await expect(service.replace(session, noteId, body)).rejects.toMatchObject({ status: 403 });
        expect(realtime.notify).not.toHaveBeenCalled();
    });
    it.each(["completed", "archived"] as const)("does not attach new records to a %s note", async (status) => {
        state.note.status = status;
        await expect(service.replace(session, noteId, body)).rejects.toMatchObject({ status: 403 });
        expect(resolver.resolveMany).not.toHaveBeenCalled();
    });
    it("rechecks effective permissions after the command's read phase", async () => {
        revokeBetweenPhases = true;
        await expect(service.replace(session, noteId, body)).rejects.toMatchObject({ status: 403 });
        expect(resolver.resolveMany).not.toHaveBeenCalled();
        expect(realtime.notify).not.toHaveBeenCalled();
    });
    it("validates source-qualified IDs before starting a collaboration command", async () => {
        await expect(service.replace(session, noteId, { ...body, relatedRecords: [{ kind: "lead", source: "native", id: "208" }] })).rejects.toMatchObject({ status: 400 });
        expect(collaboration.command).not.toHaveBeenCalled();
    });
    it("rejects caller-supplied authorship rather than ignoring it", async () => {
        await expect(service.replace(session, noteId, { ...body, actorId: invited })).rejects.toMatchObject({ status: 400 });
        expect(collaboration.command).not.toHaveBeenCalled();
    });
    it("does not expose stored reference identifiers when a related resource becomes restricted", async () => {
        repository.referencesForNotes.mockResolvedValue(new Map([[7, [{ linkId: 42, primary: false, reference: body.relatedRecords[0] }]]]));
        resolver.resolveMany.mockResolvedValue([{ kind: "lead", label: null, description: null, url: null, restricted: true }]);
        const result = await service.read(session, noteId);
        expect(result.items).toEqual([{ kind: "lead", label: null, description: null, url: null, restricted: true, primary: false }]);
        expect(JSON.stringify(result.items)).not.toContain("208");
    });
    it("checks a live note deny before loading any related-resource summaries", async () => {
        profile.permissions.push({ code: "ventas.notes.read", effect: "deny", scope: null, source: "override" });
        await expect(service.read(session, noteId)).rejects.toMatchObject({ status: 403 });
        expect(repository.referencesForNotes).not.toHaveBeenCalled();
        expect(resolver.resolveMany).not.toHaveBeenCalled();
    });
    it("refuses an unavailable selected source without pretending the record was absent", async () => {
        resolver.resolveMany.mockResolvedValue([{ kind: "lead", label: null, description: null, url: null, restricted: true, unavailable: true }]);
        await expect(service.replace(session, noteId, body)).rejects.toMatchObject({ status: 503 });
        expect(realtime.notify).not.toHaveBeenCalled();
    });
    it("rejects selecting a native record and its confirmed legacy alias twice", async () => {
        const native = { kind: "lead", source: "native", id: actorId };
        resolver.resolveMany.mockResolvedValue([native, native].map((reference) => ({ kind: "lead", reference, label: "Authorized customer", description: null, url: null, restricted: false })));
        await expect(service.replace(session, noteId, { ...body, relatedRecords: [...body.relatedRecords, native] })).rejects.toMatchObject({ status: 400 });
        expect(realtime.notify).not.toHaveBeenCalled();
    });
    it("retains the client command but avoids persisting a canonical alias of the primary order twice", async () => {
        const legacy = { kind: "sales_order" as const, source: "legacy" as const, id: "208" };
        const native = { kind: "sales_order" as const, source: "native" as const, id: actorId };
        repository.referencesForNotes.mockResolvedValue(new Map([[7, [{ linkId: 42, primary: true, reference: legacy }]]]));
        resolver.resolveMany.mockResolvedValue([{ kind: "sales_order", reference: native, label: "Authorized order", description: null, url: null, restricted: false }]);
        await service.replace(session, noteId, { ...body, relatedRecords: [native] });
        expect(collaboration.command.mock.calls[0]?.[2]).toMatchObject({ relatedRecords: [native], persistedRelatedRecords: [] });
    });
    it("rejects forged server-derived persistence references", async () => {
        await expect(service.replace(session, noteId, { ...body, persistedRelatedRecords: [] })).rejects.toMatchObject({ status: 400 });
        expect(collaboration.command).not.toHaveBeenCalled();
    });
    it("preserves existing secondary links hidden by a resource permission change", async () => {
        repository.referencesForNotes.mockResolvedValue(new Map([[7, [{ linkId: 42, primary: false, reference: body.relatedRecords[0] }]]]));
        resolver.resolveMany.mockResolvedValue([{ kind: "lead", label: null, description: null, url: null, restricted: true }]);
        await service.replace(session, noteId, { ...body, relatedRecords: [] });
        expect(collaboration.command.mock.calls[0]?.[2]).toMatchObject({ preservedLinkIds: [42] });
    });
    it("revalidates selected references and emits a wake only after the command succeeds", async () => {
        await expect(service.replace(session, noteId, body)).resolves.toMatchObject({ noteId, collaborationVersion: 3 });
        expect(resolver.resolveMany).toHaveBeenCalledWith(profile, body.relatedRecords);
        expect(realtime.notify).toHaveBeenCalledTimes(1);
    });
});
