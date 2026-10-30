import { describe, expect, it, vi } from "vitest";

import type { IdentityService } from "../../src/modules/crm/identity/identity.service.js";
import type { NoteCollaborationService } from "../../src/modules/crm/notes/note-collaboration.service.js";
import type { NoteNotification } from "../../src/modules/crm/notes/note-notifications.contract.js";
import type { NoteNotificationsRepository } from "../../src/modules/crm/notes/note-notifications.repository.js";
import { NoteNotificationsService } from "../../src/modules/crm/notes/note-notifications.service.js";
import { NoteNotificationsWorker } from "../../src/modules/crm/notes/note-notifications.worker.js";
import { NotesRealtimeSignal } from "../../src/modules/crm/notes/notes-realtime.signal.js";
const id = "01M4VECV87Y3Q3TGBBK8X2MHYX";
function fixture() {
    const identity = { getCurrentUser: vi.fn().mockResolvedValue({ user: { publicId: "self" } }) };
    const repository = {
        candidates: vi.fn<() => Promise<NoteNotification[]>>().mockResolvedValue([
            { id, kind: "mention", actor: { publicId: "actor", displayName: "Actor" }, noteId: "revoked", note: { title: null, excerpt: "" }, replyExcerpt: null, moduleCode: "ventas", createdAt: "2026-10-27T10:00:00.000Z", readAt: null },
            { id: "01M4VECV87Y3Q3TGBBK8X2MHYZ", kind: "shared", actor: { publicId: "actor", displayName: "Actor" }, noteId: "allowed", note: { title: "Nota", excerpt: "" }, replyExcerpt: null, moduleCode: "ventas", createdAt: "2026-10-27T10:00:00.000Z", readAt: null },
        ]),
        markRead: vi.fn().mockResolvedValue(undefined),
        schemaReady: vi.fn().mockResolvedValue(false),
        claim: vi.fn().mockResolvedValue(null),
        deliver: vi.fn(),
        retry: vi.fn(),
    };
    const collaboration = {
        authorizeUserRead: vi.fn().mockImplementation((_user: string, note: string) => Promise.resolve(note === "allowed" ? {} : null)),
        authorizeProfileRead: vi.fn().mockImplementation((_profile: unknown, note: string) => Promise.resolve(note === "allowed" ? {} : null)),
    };
    const service = new NoteNotificationsService(identity as unknown as IdentityService, repository as unknown as NoteNotificationsRepository, collaboration as unknown as NoteCollaborationService, new NotesRealtimeSignal());
    return { identity, repository, collaboration, service };
}
describe("self-bound notification API", () => {
    it("reuses the request profile and authorizes each unique note only once", async () => {
        const f = fixture();
        const rows = await f.repository.candidates();
        f.repository.candidates.mockResolvedValue([...rows, ...rows]);
        await f.service.unreadCount("session");
        expect(f.identity.getCurrentUser).toHaveBeenCalledOnce();
        expect(f.collaboration.authorizeUserRead).not.toHaveBeenCalled();
        expect(f.collaboration.authorizeProfileRead).toHaveBeenCalledTimes(2);
        expect(f.collaboration.authorizeProfileRead).toHaveBeenCalledWith({ user: { publicId: "self" } }, "allowed");
    });
    it("filters revoked notes from both list and badge before pagination", async () => {
        const f = fixture();
        const result = await f.service.list("session", {});
        expect(result.items).toHaveLength(1);
        expect(result.page.total).toBe(1);
        expect(result.unreadCount).toBe(1);
        expect(f.repository.candidates).toHaveBeenCalledWith("self", expect.any(String));
        expect(await f.service.unreadCount("session")).toEqual({ count: 1 });
    });
    it("never marks another or revoked notification and rejects future cutoffs", async () => {
        const f = fixture();
        await expect(f.service.read("session", id)).rejects.toThrow();
        expect(f.repository.markRead).not.toHaveBeenCalled();
        await expect(f.service.readAll("session", { through: "2999-01-01T00:00:00.000Z" })).rejects.toThrow();
    });
    it("only marks authorized existing metadata through the observed instant", async () => {
        const f = fixture();
        await f.service.readAll("session", { through: "2026-10-27T11:00:00.000Z" });
        expect(f.repository.markRead).toHaveBeenCalledWith("self", ["01M4VECV87Y3Q3TGBBK8X2MHYZ"], "2026-10-27T11:00:00.000Z");
    });
});
describe("internal delivery worker", () => {
    it("does not claim while migration gate is absent", async () => {
        const f = fixture();
        const worker = new NoteNotificationsWorker(f.repository as unknown as NoteNotificationsRepository, f.collaboration as unknown as NoteCollaborationService, new NotesRealtimeSignal());
        await worker.tick();
        expect(f.repository.claim).not.toHaveBeenCalled();
        worker.onModuleDestroy();
    });
    it("fences failed deliveries for bounded retry", async () => {
        const f = fixture();
        const event = { id: 1, attempt: 1, noteId: id, payload: {} };
        f.repository.schemaReady.mockResolvedValue(true);
        f.repository.claim.mockResolvedValueOnce(event);
        f.repository.deliver.mockRejectedValueOnce(new Error("private failure"));
        const worker = new NoteNotificationsWorker(f.repository as unknown as NoteNotificationsRepository, f.collaboration as unknown as NoteCollaborationService, new NotesRealtimeSignal());
        await worker.tick();
        expect(f.repository.retry).toHaveBeenCalledWith(event);
        worker.onModuleDestroy();
    });
});
