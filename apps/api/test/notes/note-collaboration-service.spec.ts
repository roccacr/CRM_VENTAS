import { ForbiddenException, NotFoundException, ServiceUnavailableException } from "@nestjs/common";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { IdentityService } from "../../src/modules/crm/identity/identity.service.js";
import type { IdentityAuthorizationProfile } from "../../src/modules/crm/identity/identity.types.js";
import type { IdentityProfileRepository } from "../../src/modules/crm/identity/identity-profile.repository.js";
import type { CollaborationNote, NoteCollaborationRepository } from "../../src/modules/crm/notes/note-collaboration.repository.js";
import { NoteCollaborationService } from "../../src/modules/crm/notes/note-collaboration.service.js";
import type { OrderTimingService } from "../../src/modules/crm/sales/sales-orders/order-timing.service.js";
const id = "01K00000000000000000000000",
    owner = "01K00000000000000000000001",
    invited = "01K00000000000000000000002",
    third = "01K00000000000000000000003";
const permission = (module: string, action: string) => ({ code: `${module}.notes.${action}`, effect: "allow", scope: "self", source: "system" });
const makeProfile = (publicId = invited, module = "ventas") => ({ user: { publicId }, roles: [], orgUnits: [], permissions: ["read", "reply", "edit_reply_own", "withdraw_reply_own", "share_own", "create"].map((action) => permission(module, action)) });
const state: CollaborationNote = { note: { internalId: 7, publicId: id, authorId: 1, authorPublicId: owner, authorName: "Owner", moduleCode: "mercadeo", title: null, text: "private", color: "#FFFF88", priority: "normal", status: "open", visibility: "shared", version: 4, createdAt: "now", updatedAt: "now", completedAt: null, archivedAt: null }, context: { kind: "personal" }, collaborationVersion: 2, participants: [{ userId: invited, displayName: "Invited", access: "reply", following: true }] };
let current = structuredClone(state);
const identity = { getCurrentUser: vi.fn() };
const profiles = { findAuthorizationByUserPublicId: vi.fn() };
const repository = { load: vi.fn(), replies: vi.fn(), mentions: vi.fn(), command: vi.fn(), directory: vi.fn(), inboxPage: vi.fn(), placement: vi.fn(), recipientStatus: vi.fn(), activity: vi.fn() };
const realtime = { notify: vi.fn() };
const timing = { authorizeForProfile: vi.fn() };
const related = { summariesForNotes: vi.fn(), resourceAliases: vi.fn() };
let service: NoteCollaborationService;
beforeEach(() => {
    vi.clearAllMocks();
    related.summariesForNotes.mockResolvedValue(new Map());
    related.resourceAliases.mockRejectedValue(new NotFoundException());
    repository.inboxPage.mockResolvedValue({ items: [{ id }], total: 1 });
    repository.placement.mockResolvedValue([]);
    current = structuredClone(state);
    timing.authorizeForProfile.mockRejectedValue(new ForbiddenException());
    identity.getCurrentUser.mockResolvedValue(makeProfile());
    profiles.findAuthorizationByUserPublicId.mockResolvedValue(makeProfile());
    repository.load.mockImplementation(() => Promise.resolve(current));
    repository.replies.mockResolvedValue({ items: [], total: 0 });
    repository.mentions.mockResolvedValue([]);
    repository.directory.mockResolvedValue([{ publicId: third, displayName: "Third" }]);
    repository.recipientStatus.mockResolvedValue(null);
    repository.command.mockImplementation(async (_actor: string, _id: string, _input: unknown, authorize: (state: CollaborationNote, tx: object, phase: string) => Promise<void>) => {
        await authorize(current, {}, "write");
        return { noteId: id, version: 4, collaborationVersion: 3, replayed: false };
    });
    service = new NoteCollaborationService(identity as unknown as IdentityService, profiles as unknown as IdentityProfileRepository, repository as unknown as NoteCollaborationRepository, timing as unknown as OrderTimingService, realtime as never, related as never);
});
describe("collaboration live ACL orchestration", () => {
    it.each(["inactive", "pending"])("allows inviting a %s account without granting it present access", async (status) => {
        identity.getCurrentUser.mockResolvedValue(makeProfile(owner, "mercadeo"));
        profiles.findAuthorizationByUserPublicId.mockResolvedValue(null);
        repository.recipientStatus.mockResolvedValue(status);
        repository.directory.mockResolvedValue([{ publicId: third, displayName: "Future seller", status }]);
        expect((await service.eligibleUsers("session", id, {})).items).toEqual([{ publicId: third, displayName: "Future seller", status }]);
        await expect(service.participants("session", id, { operationId: "operation_00000001", expectedCollaborationVersion: 2, participants: [{ userId: third, access: "reply" }] })).resolves.toMatchObject({ noteId: id });
        expect(await service.authorizeUserRead(third, id)).toBeNull();
    });
    it("lets an ordinary self baseline invitee read and reply to cross-module personal notes", async () => {
        expect((await service.thread("session", id, {})).note.capabilities.canReply).toBe(true);
        await expect(service.reply("session", id, { operationId: "operation_00000001", text: "Hello" })).resolves.toMatchObject({ version: 4, collaborationVersion: 3 });
        expect(timing.authorizeForProfile).not.toHaveBeenCalled();
    });
    it("never lets a participant share or alter original mentions", async () => {
        await expect(service.participants("session", id, { operationId: "operation_00000001", expectedCollaborationVersion: 2, participants: [] })).rejects.toBeInstanceOf(ForbiddenException);
        await expect(service.mentions("session", id, { operationId: "operation_00000001", expectedCollaborationVersion: 2, userIds: [] })).rejects.toBeInstanceOf(ForbiddenException);
    });
    it("read-only participant cannot reply", async () => {
        current.participants = current.participants.map((p) => ({ ...p, access: "read" }));
        await expect(service.reply("session", id, { operationId: "operation_00000001", text: "Hello" })).rejects.toBeInstanceOf(ForbiddenException);
    });
    it.each(["completed", "archived"] as const)("%s notes reject new replies", async (status) => {
        current.note.status = status;
        await expect(service.reply("session", id, { operationId: "operation_00000001", text: "Hello" })).rejects.toThrow("abiertas");
    });
    it("mention cannot invite a third party", async () => {
        await expect(service.reply("session", id, { operationId: "operation_00000001", text: "Hello", mentionUserIds: [third] })).rejects.toBeInstanceOf(ForbiddenException);
    });
    it("mentions can target active participants and author only", async () => {
        await expect(service.reply("session", id, { operationId: "operation_00000001", text: "Hello", mentionUserIds: [owner] })).resolves.toMatchObject({ noteId: id });
    });
    it("invited linked notes allow cross-module read with redacted context", async () => {
        current.context = { kind: "view" };
        expect((await service.thread("session", id, {})).note.context).toBeNull();
        await expect(service.reply("session", id, { operationId: "operation_00000001", text: "Hello" })).resolves.toMatchObject({ noteId: id });
    });
    it("linked invitation does not grant or require target record access", async () => {
        identity.getCurrentUser.mockResolvedValue(makeProfile(owner, "mercadeo"));
        profiles.findAuthorizationByUserPublicId.mockResolvedValue(makeProfile(third, "mercadeo"));
        current.context = { kind: "sales_order", source: "native", id };
        current.note.moduleCode = "formalizacion";
        identity.getCurrentUser.mockResolvedValue(makeProfile(owner, "formalizacion"));
        profiles.findAuthorizationByUserPublicId.mockResolvedValue(makeProfile(third, "formalizacion"));
        timing.authorizeForProfile.mockImplementation((profile: IdentityAuthorizationProfile) => {
            if (profile.user.publicId === third) throw new ForbiddenException();
            return Promise.resolve({ order: { source: "native", id } });
        });
        await expect(service.participants("session", id, { operationId: "operation_00000001", expectedCollaborationVersion: 2, participants: [{ userId: third, access: "reply" }] })).resolves.toMatchObject({ noteId: id });
        expect(timing.authorizeForProfile).not.toHaveBeenCalled();
    });
    it("delivery facade hides revoked or inactive users and only returns references", async () => {
        profiles.findAuthorizationByUserPublicId.mockResolvedValue(null);
        expect(await service.authorizeUserRead(invited, id)).toBeNull();
        profiles.findAuthorizationByUserPublicId.mockResolvedValue(makeProfile());
        repository.load.mockRejectedValue(new NotFoundException());
        expect(await service.authorizeUserRead(invited, id)).toBeNull();
        repository.load.mockResolvedValue(current);
        expect(await service.authorizeUserRead(invited, id)).toEqual({ noteId: id, moduleCode: "mercadeo", context: { kind: "personal" } });
    });
    it("directory exposes names and public IDs only after owner sharing authorization", async () => {
        await expect(service.eligibleUsers("session", id, {})).rejects.toBeInstanceOf(ForbiddenException);
        expect(repository.directory).not.toHaveBeenCalled();
        identity.getCurrentUser.mockResolvedValue(makeProfile(owner, "mercadeo"));
        expect(await service.eligibleUsers("session", id, {})).toEqual({ items: [{ publicId: third, displayName: "Third" }], hasMore: false });
    });
    it("draft directory checks existing author create/share and context before target lookup", async () => {
        expect(await service.eligibleDraftUsers("session", { moduleCode: "ventas", contextType: "personal", search: "Third" })).toEqual({ items: [{ publicId: third, displayName: "Third" }], hasMore: false });
        await expect(service.eligibleDraftUsers("session", { moduleCode: "formalizacion", contextType: "personal" })).rejects.toBeInstanceOf(ForbiddenException);
    });
    it("rejects unknown body fields, duplicate mentions, malformed IDs and oversized pages", async () => {
        await expect(service.reply("session", id, { operationId: "operation_00000001", text: "Hello", authorId: owner })).rejects.toThrow();
        await expect(service.reply("session", id, { operationId: "operation_00000001", text: "Hello", mentionUserIds: [owner, owner] })).rejects.toThrow();
        await expect(service.thread("session", "1", {})).rejects.toThrow();
        await expect(service.thread("session", id, { replyPage: 1001 })).rejects.toThrow();
    });
});

it("includes actor-specific placements in populated inbox and thread contracts", async () => {
    const placement = { viewportClass: "desktop", anchorMode: "viewport", x: 20, y: 40, width: 300, height: 230, collapsed: false, hidden: false, layoutVersion: 2 };
    repository.placement.mockResolvedValue([placement]);
    const inbox = await service.inbox("session", { kind: "all", status: "all" });
    expect(inbox.items[0]).toHaveProperty("myPlacements", [placement]);
    expect(repository.placement).toHaveBeenCalledWith(invited, current.note);
    const thread = await service.thread("session", id, {});
    expect(thread.note).toHaveProperty("myPlacements", [placement]);
});
it("returns explicit empty placements when the actor has not positioned the note", async () => {
    const inbox = await service.inbox("session", { kind: "all", status: "all" });
    expect(inbox.items[0]).toHaveProperty("myPlacements", []);
});

it("directory pagination continues even if the first raw page has no eligible invitees", async () => {
    identity.getCurrentUser.mockResolvedValue(makeProfile(owner, "mercadeo"));
    repository.directory.mockResolvedValueOnce(Array.from({ length: 101 }, () => ({ publicId: third, displayName: "Third" })));
    profiles.findAuthorizationByUserPublicId.mockResolvedValue(null);
    await expect(service.eligibleUsers("session", id, {})).resolves.toEqual({ items: [], hasMore: true });
    profiles.findAuthorizationByUserPublicId.mockResolvedValue(makeProfile(third));
    repository.directory.mockResolvedValueOnce([{ publicId: third, displayName: "Third" }]);
    await expect(service.eligibleUsers("session", id, { page: "2" })).resolves.toEqual({ items: [{ publicId: third, displayName: "Third" }], hasMore: false });
    expect(repository.directory).toHaveBeenLastCalledWith("", 2);
    await expect(service.eligibleUsers("session", id, { page: "0" })).rejects.toThrow();
});

it("redacts linked order identity in delivery facade for invited recipients", async () => {
    current.context = { kind: "sales_order", source: "native", id };
    current.note.moduleCode = "formalizacion";
    expect(await service.authorizeUserRead(invited, id)).toEqual({ noteId: id, moduleCode: "formalizacion", context: null });
});
it("preserves origin explicit deny even with another module capability", async () => {
    const profile = makeProfile();
    profile.permissions.push({ ...permission("mercadeo", "read"), effect: "deny" });
    identity.getCurrentUser.mockResolvedValue(profile);
    await expect(service.thread("session", id, {})).rejects.toBeInstanceOf(ForbiddenException);
});

it("wakes delivery only after successful command commit and excludes following", async () => {
    repository.command.mockRejectedValueOnce(new Error("rollback"));
    await expect(service.reply("session", id, { operationId: "operation_00000001", text: "Hello" })).rejects.toThrow("rollback");
    expect(realtime.notify).not.toHaveBeenCalled();
    await service.following("session", id, { operationId: "operation_00000002", following: false });
    expect(realtime.notify).not.toHaveBeenCalled();
    await service.reply("session", id, { operationId: "operation_00000003", text: "Hello" });
    expect(realtime.notify).toHaveBeenCalledOnce();
});
it("linked directory includes candidates without resource permission", async () => {
    current.note.moduleCode = "formalizacion";
    current.context = { kind: "sales_order", source: "native", id };
    identity.getCurrentUser.mockResolvedValue(makeProfile(owner, "formalizacion"));
    profiles.findAuthorizationByUserPublicId.mockResolvedValue(makeProfile(third, "ventas"));
    timing.authorizeForProfile.mockResolvedValue({ order: { source: "native", id } });
    expect((await service.eligibleUsers("session", id, {})).items).toEqual([{ publicId: third, displayName: "Third" }]);
    expect(timing.authorizeForProfile).not.toHaveBeenCalled();
});

it("owner retains note after linked resource access is lost, with redacted context", async () => {
    current.note.moduleCode = "formalizacion";
    current.context = { kind: "sales_order", source: "native", id };
    identity.getCurrentUser.mockResolvedValue(makeProfile(owner, "formalizacion"));
    timing.authorizeForProfile.mockRejectedValue(new ForbiddenException());
    expect((await service.thread("session", id, {})).note.context).toBeNull();
    await expect(service.participants("session", id, { operationId: "operation_00000001", expectedCollaborationVersion: 2, participants: [] })).resolves.toMatchObject({ noteId: id });
});

it("owner with another module capability retains linked note read across inbox thread and realtime authorization", async () => {
    current.note.moduleCode = "formalizacion";
    current.context = { kind: "sales_order", source: "native", id };
    identity.getCurrentUser.mockResolvedValue(makeProfile(owner, "ventas"));
    profiles.findAuthorizationByUserPublicId.mockResolvedValue(makeProfile(owner, "ventas"));
    const thread = await service.thread("session", id, {});
    expect(thread.note.context).toBeNull();
    expect(thread.note.capabilities).toMatchObject({ canEdit: false, canShare: false, canReply: false });
    expect((await service.inbox("session", {})).items).toHaveLength(1);
    expect(await service.authorizeUserRead(owner, id)).toEqual({ noteId: id, moduleCode: "formalizacion", context: null });
});

it("keeps an invited order context visible across modules only when independent resource authorization succeeds", async () => {
    current.note.moduleCode = "formalizacion";
    current.context = { kind: "sales_order", source: "legacy", id: "208" };
    identity.getCurrentUser.mockResolvedValue(makeProfile(invited, "contabilidad"));
    timing.authorizeForProfile.mockResolvedValue({ order: { source: "legacy", id: "legacy:208" } });
    expect((await service.thread("session", id, {})).note.context).toEqual(current.context);
    timing.authorizeForProfile.mockRejectedValue(new ForbiddenException());
    const denied = await service.thread("session", id, {});
    expect(denied.note.context).toBeNull();
    expect(denied.note.content.text).toBe(current.note.text);
});

it("only the author can manage additional display locations", async () => {
    identity.getCurrentUser.mockResolvedValue(makeProfile(invited));
    await expect(service.replaceLocations("session", id, { operationId: "operation_12345678", expectedCollaborationVersion: 2, locations: [{ moduleCode: "ventas", code: "sales-home" }] })).rejects.toBeInstanceOf(ForbiddenException);
});
it("rejects unregistered display locations before persistence", async () => {
    identity.getCurrentUser.mockResolvedValue(makeProfile(owner, "mercadeo"));
    await expect(service.replaceLocations("session", id, { operationId: "operation_12345678", expectedCollaborationVersion: 2, locations: [{ moduleCode: "mercadeo", code: "https://evil" }] })).rejects.toThrow();
});

it("author can attach a note to an independently authorized Home", async () => {
    const profile = makeProfile(owner, "mercadeo");
    identity.getCurrentUser.mockResolvedValue({ ...profile, permissions: [...profile.permissions, permission("ventas", "read"), { code: "lead.read", effect: "allow", scope: "self" }] });
    await service.replaceLocations("session", id, { operationId: "operation_12345678", expectedCollaborationVersion: 2, locations: [{ moduleCode: "ventas", code: "sales-home" }] });
    expect(repository.command).toHaveBeenCalledWith(owner, id, expect.objectContaining({ kind: "locations" }), expect.any(Function));
});

it("labels note creation as creation instead of reopening when its initial status is open", async () => {
    repository.activity.mockResolvedValue({ page: { number: 1, size: 100, total: 1 }, items: [{ id, action: "create", command: null, status: "open", actor: { publicId: owner, name: "Owner" }, createdAt: "2026-10-28T00:00:00.000Z" }] });
    const result = await service.activity("session", id, {});
    expect(result.items[0]).toMatchObject({ action: "create", details: "Nota creada" });
});

it("does not turn transient note authorization unavailability into a permanent reminder denial", async () => {
    repository.load.mockRejectedValueOnce(new ServiceUnavailableException());
    await expect(service.authorizeProfileNoteAccess(makeProfile() as unknown as IdentityAuthorizationProfile, id)).rejects.toBeInstanceOf(ServiceUnavailableException);
});
