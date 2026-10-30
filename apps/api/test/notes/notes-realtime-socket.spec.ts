import "reflect-metadata";

import { createServer } from "node:http";

import { ConfigService } from "@nestjs/config";
import { Server } from "socket.io";
import { io, type Socket as ClientSocket } from "socket.io-client";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createSignedCsrfToken } from "../../src/common/security/csrf-token.js";
import type { IdentityService } from "../../src/modules/crm/identity/identity.service.js";
import type { NoteCollaborationService } from "../../src/modules/crm/notes/note-collaboration.service.js";
import { NotesRealtimeAuth } from "../../src/modules/crm/notes/notes-realtime.auth.js";
import { NotesRealtimeGateway } from "../../src/modules/crm/notes/notes-realtime.gateway.js";
import type { NotesRealtimeEventsRepository } from "../../src/modules/crm/notes/notes-realtime.repository.js";
const id = "01K00000000000000000000001";
const secret = "synthetic-test-cookie-secret";
const origin = "http://frontend.test";
const clients: ClientSocket[] = [];
const cleanup: (() => Promise<void>)[] = [];
afterEach(async () => {
    for (const c of clients.splice(0)) c.disconnect();
    for (const close of cleanup.splice(0)) await close();
});
async function fixture() {
    const config = new ConfigService({ FRONTEND_ORIGIN: origin, COOKIE_SECRET: secret, NOTES_REALTIME_ENABLED: true, NOTES_REALTIME_TOPOLOGY: "single" });
    let active = true;
    let allowed = true;
    let notificationActive = true;
    const getCurrentUser = vi.fn((token: string) => {
        if (!active || token !== "synthetic-session") throw new Error("Unauthorized");
        return Promise.resolve({ user: { publicId: id }, session: { expiresAt: new Date(Date.now() + 60000).toISOString() } });
    });
    const identity = { getCurrentUser } as unknown as IdentityService;
    const authorizeUserRead = vi.fn(() => Promise.resolve(allowed ? {} : null));
    const collaboration = { authorizeUserRead } as unknown as NoteCollaborationService;
    const server = createServer();
    const ioServer = new Server(server);
    const namespace = ioServer.of("/notes");
    const gateway = new NotesRealtimeGateway(new NotesRealtimeAuth(config, identity), collaboration, { schemaReady: () => Promise.resolve(true), notificationActive: () => Promise.resolve(notificationActive) } as unknown as NotesRealtimeEventsRepository, config);
    await gateway.afterInit(namespace);
    namespace.on("connection", (socket) => {
        gateway.handleConnection(socket);
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const addr = server.address();
    if (!addr || typeof addr === "string") throw new Error("port");
    cleanup.push(async () => {
        await gateway.onModuleDestroy();
        await new Promise<void>((resolve) => {
            void ioServer.close(() => {
                resolve();
            });
        });
    });
    const csrf = createSignedCsrfToken(secret, "synthetic-session");
    const connect = (options: { origin?: string; csrf?: string; session?: string } = {}) => {
        const client = io(`http://127.0.0.1:${String(addr.port)}/notes`, { transports: ["websocket"], reconnection: false, auth: { csrfToken: options.csrf ?? csrf }, extraHeaders: { Origin: options.origin ?? origin, Cookie: `crm_session=${options.session ?? "synthetic-session"}; crm_csrf=${csrf}` } });
        clients.push(client);
        return client;
    };
    return {
        connect,
        gateway,
        getCurrentUser,
        authorizeUserRead,
        revoke: () => {
            allowed = false;
        },
        reinvite: () => {
            allowed = true;
        },
        suppress: () => {
            notificationActive = false;
        },
        logout: () => {
            active = false;
        },
    };
}
function connected(socket: ClientSocket): Promise<void> {
    return new Promise((resolve, reject) => {
        socket.once("connect", () => {
            resolve();
        });
        socket.once("connect_error", reject);
    });
}
describe("real Socket.IO notes boundary", () => {
    it("reuses each live session and note authorization within one publication across tabs", async () => {
        const f = await fixture();
        const a = f.connect();
        const b = f.connect();
        await Promise.all([connected(a), connected(b)]);
        f.getCurrentUser.mockClear();
        f.authorizeUserRead.mockClear();
        const packets = Promise.all([new Promise((resolve) => a.once("activity", resolve)), new Promise((resolve) => b.once("activity", resolve))]);
        await f.gateway.publish(id, { schemaVersion: 1, eventId: id, kind: "note.changed", noteId: id, occurredAt: new Date().toISOString() });
        expect(await packets).toHaveLength(2);
        expect(f.getCurrentUser).toHaveBeenCalledOnce();
        expect(f.authorizeUserRead).toHaveBeenCalledOnce();
    });
    it("rejects forged Origin, bad CSRF and unknown sessions", async () => {
        const f = await fixture();
        for (const options of [{ origin: "http://evil.test" }, { csrf: "forged" }, { session: "foreign" }]) {
            const c = f.connect(options);
            await expect(connected(c)).rejects.toThrow();
            expect(c.connected).toBe(false);
        }
    });
    it("suppresses obsolete revoke after reinvite and suppressed notification packets", async () => {
        const f = await fixture();
        const c = f.connect();
        await connected(c);
        const packets: unknown[] = [];
        c.on("activity", (p) => packets.push(p));
        f.suppress();
        await f.gateway.publish(id, { schemaVersion: 1, eventId: id, kind: "notification.created", occurredAt: new Date().toISOString(), noteId: id, notificationId: id });
        await f.gateway.publish(id, { schemaVersion: 1, eventId: id, kind: "note.access_revoked", occurredAt: new Date().toISOString(), noteId: id });
        expect(packets).toEqual([]);
    });
    it("delivers only to authorized live sessions, refuses arbitrary room payloads and clears revoke", async () => {
        const f = await fixture();
        const a = f.connect();
        const b = f.connect();
        await Promise.all([connected(a), connected(b)]);
        const ack: unknown = await a.emitWithAck("subscribe", { noteId: id, room: "foreign" });
        expect(ack).toMatchObject({ ok: false });
        expect(await a.emitWithAck("subscribe", { noteId: id })).toEqual({ ok: true });
        const packet = new Promise((resolve) => b.once("activity", resolve));
        await f.gateway.publish(id, { schemaVersion: 1, eventId: id, kind: "notification.created", occurredAt: new Date().toISOString(), noteId: id, notificationId: id });
        expect(await packet).toMatchObject({ kind: "notification.created" });
        f.revoke();
        expect(await a.emitWithAck("subscribe", { noteId: id })).toMatchObject({ ok: false });
        const revoked = new Promise((resolve) => a.once("activity", resolve));
        await f.gateway.publish(id, { schemaVersion: 1, eventId: id, kind: "note.access_revoked", occurredAt: new Date().toISOString(), noteId: id });
        expect(await revoked).toMatchObject({ kind: "note.access_revoked" });
        f.logout();
        const disconnected = new Promise((resolve) => a.once("disconnect", resolve));
        await f.gateway.revalidate();
        await disconnected;
        expect(a.connected).toBe(false);
    });
});
