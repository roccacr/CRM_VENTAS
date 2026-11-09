import "reflect-metadata";

import { ConfigService } from "@nestjs/config";
import { APP_GUARD } from "@nestjs/core";
import { FastifyAdapter, type NestFastifyApplication } from "@nestjs/platform-fastify";
import { Test } from "@nestjs/testing";
import { io, type Socket } from "socket.io-client";
import { afterEach, expect, it } from "vitest";

import { AuthGuard } from "../../src/common/security/auth.guard.js";
import { AuthenticatedReadRateLimit } from "../../src/common/security/authenticated-read-rate-limit.js";
import { CsrfGuard } from "../../src/common/security/csrf.guard.js";
import { createSignedCsrfToken } from "../../src/common/security/csrf-token.js";
import { IdentityService } from "../../src/modules/crm/identity/identity.service.js";
import { NoteCollaborationService } from "../../src/modules/crm/notes/note-collaboration.service.js";
import { NotesRealtimeAuth } from "../../src/modules/crm/notes/notes-realtime.auth.js";
import type { NotesRealtimeActivity } from "../../src/modules/crm/notes/notes-realtime.contract.js";
import { NotesRealtimeGateway } from "../../src/modules/crm/notes/notes-realtime.gateway.js";
import { NotesRealtimeEventsRepository } from "../../src/modules/crm/notes/notes-realtime.repository.js";
const owner = "01K00000000000000000000001",
    guest = "01K00000000000000000000002",
    noteId = "01K00000000000000000000003";
const origin = "http://notes-ui.test",
    secret = "synthetic-cookie-secret-that-never-leaves-this-test";
const sockets: Socket[] = [];
let app: NestFastifyApplication | undefined;
afterEach(async () => {
    for (const socket of sockets.splice(0)) socket.disconnect();
    await app?.close();
    app = undefined;
});
async function fixture() {
    let invited = true;
    const revokedSessions = new Set<string>();
    const sessions = new Map([
        ["session-owner", owner],
        ["session-guest", guest],
    ]);
    const moduleRef = await Test.createTestingModule({
        providers: [
            NotesRealtimeGateway,
            NotesRealtimeAuth,
            { provide: ConfigService, useValue: new ConfigService({ FRONTEND_ORIGIN: origin, COOKIE_SECRET: secret, NOTES_REALTIME_ENABLED: true, NOTES_REALTIME_TOPOLOGY: "single" }) },
            {
                provide: IdentityService,
                useValue: {
                    getCurrentUser: (session: string) => {
                        const publicId = sessions.get(session);
                        if (!publicId || revokedSessions.has(session)) throw Error("session unavailable");
                        return Promise.resolve({ user: { publicId }, session: { expiresAt: new Date(Date.now() + 60000).toISOString() } });
                    },
                },
            },
            { provide: NoteCollaborationService, useValue: { authorizeUserRead: (id: string, note: string) => Promise.resolve(note === noteId && (id === owner || invited) ? { noteId, moduleCode: "mercadeo", context: null } : null) } },
            { provide: NotesRealtimeEventsRepository, useValue: { schemaReady: () => Promise.resolve(true), notificationActive: () => Promise.resolve(true) } },
            { provide: AuthenticatedReadRateLimit, useValue: { enforceAuthenticatedReadLimit: () => true } },
            { provide: APP_GUARD, useClass: AuthGuard },
            { provide: APP_GUARD, useClass: CsrfGuard },
        ],
    }).compile();
    app = moduleRef.createNestApplication<NestFastifyApplication>(new FastifyAdapter(), { logger: false });
    await app.listen(0, "127.0.0.1");
    const base = await app.getUrl();
    const gateway = app.get(NotesRealtimeGateway);
    const connect = async (session: string, proof?: string) => {
        const csrf = createSignedCsrfToken(secret, session);
        const socket = io(`${base}/notes`, { autoConnect: false, transports: ["websocket"], reconnection: false, auth: { csrfToken: proof ?? csrf }, extraHeaders: { Origin: origin, Cookie: `crm_session=${session}; crm_csrf=${csrf}` } });
        sockets.push(socket);
        await new Promise<void>((resolve, reject) => {
            socket.once("connect", resolve);
            socket.once("connect_error", reject);
            socket.connect();
        });
        return socket;
    };
    return {
        connect,
        gateway,
        revoke: () => {
            invited = false;
        },
        logout: (session: string) => {
            revokedSessions.add(session);
        },
    };
}
function acknowledgement(socket: Socket, input: object): Promise<unknown> {
    return new Promise((resolve) => {
        socket.emit("subscribe", input, (reply: unknown) => {
            resolve(reply);
        });
    });
}
it("integrates the real Nest/Fastify gateway despite global HTTP guards and isolates two user sessions", async () => {
    const f = await fixture();
    const a = await f.connect("session-owner"),
        b = await f.connect("session-guest");
    expect(await acknowledgement(b, { noteId })).toEqual({ ok: true });
    expect(await acknowledgement(b, { noteId, userId: owner })).toEqual({ ok: false, code: "invalid_request" });
    const received: NotesRealtimeActivity[] = [];
    a.on("activity", (event: NotesRealtimeActivity) => {
        received.push(event);
    });
    const activity: NotesRealtimeActivity = { schemaVersion: 1, eventId: "01K00000000000000000000004", kind: "note.changed", noteId, occurredAt: new Date().toISOString() };
    const guestEvent = new Promise((resolve) => b.once("activity", resolve));
    await f.gateway.publish(guest, activity);
    expect(await guestEvent).toEqual(activity);
    expect(received).toEqual([]);
    const revoked = new Promise((resolve) => b.once("activity", resolve));
    f.revoke();
    await f.gateway.revalidate();
    expect(await revoked).toMatchObject({ kind: "note.access_revoked", noteId });
    const disconnected = new Promise((resolve) => b.once("disconnect", resolve));
    f.logout("session-guest");
    await f.gateway.revalidate();
    await disconnected;
    expect(b.connected).toBe(false);
});
it("rejects a CSRF token belonging to a different session at the actual Nest handshake", async () => {
    const f = await fixture();
    await expect(f.connect("session-guest", createSignedCsrfToken(secret, "session-owner"))).rejects.toThrow("Notes connection unavailable");
});
