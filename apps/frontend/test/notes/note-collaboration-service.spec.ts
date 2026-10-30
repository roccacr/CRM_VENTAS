import { beforeEach, expect, it, vi } from "vitest";

import { apiRequest } from "../../src/services/api/api-client";
import * as collaboration from "../../src/services/notes/note-collaboration-service";
import * as notifications from "../../src/services/notes/note-notifications-service";
vi.mock("../../src/services/api/api-client", () => ({ apiRequest: vi.fn() }));
const id = "01ARZ3NDEKTSV4RRFFQ69G5FAV";
const other = "01ARZ3NDEKTSV4RRFFQ69G5FAW";
const at = "2026-10-27T10:00:00.000Z";
const page = { number: 1, size: 25, total: 1 };
const author = { publicId: other, displayName: "María" };
const note = { id, title: null, content: { format: "plain_text", text: "<b>literal</b>" }, color: "#FFFF88", priority: "normal", status: "open", version: 1, createdAt: at, updatedAt: at, author, capabilities: { canEdit: false, canComplete: false, canReopen: false, canArchive: false, canMove: true, canShare: false, canReply: true, canMention: true }, myPlacements: [], moduleCode: "ventas", context: { kind: "personal" } };
const reply = { id: other, author, text: "<script>plain text</script>", version: 1, createdAt: at, updatedAt: at, withdrawn: false, mentionUserIds: [id], canEdit: false, canWithdraw: false };
const thread = { schemaVersion: 1, note, collaborationVersion: 2, participants: [{ userId: id, displayName: "Roberto", access: "reply" }], mentions: [id], replies: [reply], replyPage: page, following: true };
const notice = { id, kind: "mention", actor: author, noteId: other, note: { title: "Plan", excerpt: "" }, replyExcerpt: "Listo, lo reviso hoy", moduleCode: "ventas", createdAt: at, readAt: null };
beforeEach(() => {
    vi.mocked(apiRequest).mockReset();
});
it("reads the exact thread, preserves plain text and strips internal fields", async () => {
    vi.mocked(apiRequest).mockResolvedValue({ ...thread, secret: "drop" });
    await expect(collaboration.getNoteThread(id)).resolves.toEqual(thread);
    expect(apiRequest).toHaveBeenCalledWith(`/note-collaboration/notes/${id}?replyPage=1`);
});
it.each([
    { ...thread, schemaVersion: 2 },
    { ...thread, note: { ...note, moduleCode: "unknown" } },
    { ...thread, note: { ...note, context: { kind: "sales_order", id: "208" } } },
    { ...thread, note: { ...note, context: { kind: "sales_order", source: "native", id: "208" } } },
    { ...thread, replies: [{ ...reply, text: null }] },
    { ...thread, replies: [reply, reply] },
    { ...thread, participants: [thread.participants[0], thread.participants[0]] },
    { ...thread, replyPage: { ...page, number: 2 } },
    { ...thread, replyPage: { ...page, total: 0 } },
    { ...thread, mentions: [id, id] },
])("rejects malformed thread identities, source, duplicates and pagination", async (value) => {
    vi.mocked(apiRequest).mockResolvedValue(value);
    await expect(collaboration.getNoteThread(id)).rejects.toThrow();
});
it("reads inbox and eligible user queries with bounded pages and encoded search", async () => {
    vi.mocked(apiRequest).mockResolvedValueOnce({ schemaVersion: 1, items: [note], page });
    await expect(collaboration.getNoteInbox()).resolves.toEqual({ schemaVersion: 1, items: [note], page });
    expect(apiRequest).toHaveBeenLastCalledWith("/note-collaboration/inbox?kind=shared&status=open&page=1&pageSize=25");
    vi.mocked(apiRequest).mockResolvedValueOnce({ items: [author] });
    await expect(collaboration.getEligibleNoteUsers(id, "a&b")).resolves.toEqual({ items: [author] });
    expect(apiRequest).toHaveBeenLastCalledWith(`/note-collaboration/notes/${id}/eligible-users?search=a%26b`);
});
it("retains each operation and optimistic version without automatic mutable retry", async () => {
    const result = { noteId: id, version: 2, collaborationVersion: 3, replayed: false };
    const base = { operationId: "operation-12345678" };
    const cases = [
        { call: () => collaboration.replaceNoteParticipants(id, { ...base, expectedCollaborationVersion: 2, participants: [{ userId: other, access: "reply" }] }), suffix: "participants", method: "PUT", body: { ...base, expectedCollaborationVersion: 2, participants: [{ userId: other, access: "reply" }] } },
        { call: () => collaboration.replaceNoteMentions(id, { ...base, expectedCollaborationVersion: 2, userIds: [other] }), suffix: "mentions", method: "PUT", body: { ...base, expectedCollaborationVersion: 2, userIds: [other] } },
        { call: () => collaboration.addNoteReply(id, { ...base, text: "hola", mentionUserIds: [other], quotedReplyId: other }), suffix: "replies", method: "POST", body: { ...base, text: "hola", mentionUserIds: [other], quotedReplyId: other } },
        { call: () => collaboration.editNoteReply(id, other, { ...base, expectedVersion: 1, text: "hola", mentionUserIds: [] }), suffix: `replies/${other}`, method: "PATCH", body: { ...base, expectedVersion: 1, text: "hola", mentionUserIds: [] } },
        { call: () => collaboration.withdrawNoteReply(id, other, { ...base, expectedVersion: 1 }), suffix: `replies/${other}/withdraw`, method: "POST", body: { ...base, expectedVersion: 1 } },
        { call: () => collaboration.setNoteFollowing(id, { ...base, following: false }), suffix: "my-following", method: "PUT", body: { ...base, following: false } },
    ];
    for (const item of cases) {
        vi.mocked(apiRequest).mockResolvedValueOnce(result);
        await expect(item.call()).resolves.toEqual(result);
        expect(apiRequest).toHaveBeenLastCalledWith(`/note-collaboration/notes/${id}/${item.suffix}`, { method: item.method, body: item.body, retryOnUnauthorized: false });
    }
    vi.mocked(apiRequest).mockRejectedValueOnce(new Error("lost response"));
    const before = vi.mocked(apiRequest).mock.calls.length;
    const first = cases[0];
    if (!first) throw new Error("missing fixture");
    await expect(first.call()).rejects.toThrow("lost response");
    expect(vi.mocked(apiRequest).mock.calls.length).toBe(before + 1);
});
it("rejects malformed receipts, invalid resource IDs and unknown notification kinds", async () => {
    vi.mocked(apiRequest).mockResolvedValue({ noteId: id, version: 1, collaborationVersion: 0, replayed: false });
    await expect(collaboration.setNoteFollowing(id, { operationId: "operation-12345678", following: true })).rejects.toThrow();
    vi.mocked(apiRequest).mockClear();
    await expect(collaboration.getNoteThread("../208")).rejects.toThrow();
    expect(apiRequest).not.toHaveBeenCalled();
    vi.mocked(apiRequest).mockResolvedValue({ schemaVersion: 1, items: [{ ...notice, kind: "email" }], page, unreadCount: 1, observedAt: at });
    await expect(notifications.getNoteNotifications()).rejects.toThrow();
});
it("reads notification pages and preserves server read-all cutoff", async () => {
    const response = { schemaVersion: 1, items: [notice], page, unreadCount: 1, observedAt: at };
    vi.mocked(apiRequest).mockResolvedValueOnce(response);
    await expect(notifications.getNoteNotifications()).resolves.toEqual(response);
    expect(apiRequest).toHaveBeenLastCalledWith("/notifications?filter=all&page=1&pageSize=25");
    vi.mocked(apiRequest).mockResolvedValueOnce(undefined);
    await notifications.markNoteNotificationRead(id);
    expect(apiRequest).toHaveBeenLastCalledWith(`/notifications/${id}/read`, { method: "PUT", retryOnUnauthorized: false });
    vi.mocked(apiRequest).mockResolvedValueOnce(undefined);
    await notifications.markAllNoteNotificationsRead(at);
    expect(apiRequest).toHaveBeenLastCalledWith("/notifications/read-all", { method: "PUT", body: { through: at }, retryOnUnauthorized: false });
});
it.each([{ count: 2 }, { count: 100, countIsLowerBound: true }])("supports explicit bounded unread counts with a safe optional flag", async (response) => {
    vi.mocked(apiRequest).mockResolvedValue(response);
    await expect(notifications.getNoteUnreadCount()).resolves.toEqual({ ...response, countIsLowerBound: "countIsLowerBound" in response });
});
it.each([
    { schemaVersion: 1, items: [notice, notice], page: { ...page, total: 2 }, unreadCount: 1, observedAt: at },
    { schemaVersion: 1, items: [notice], page: { ...page, number: 2 }, unreadCount: 1, observedAt: at },
    { schemaVersion: 1, items: [notice], page, unreadCount: -1, observedAt: at },
    { schemaVersion: 1, items: [notice], page, unreadCount: 1, observedAt: "yesterday" },
])("rejects invalid notification envelopes without fallback", async (response) => {
    vi.mocked(apiRequest).mockResolvedValue(response);
    await expect(notifications.getNoteNotifications()).rejects.toThrow();
});
it("normalizes only legacy draft context aliases and keeps explicit source", async () => {
    vi.mocked(apiRequest).mockResolvedValue({ items: [author] });
    await collaboration.getEligibleUsersForNoteDraft("formalizacion", { kind: "sales_order", source: "legacy", id: "legacy:208" }, "a&b");
    expect(apiRequest).toHaveBeenLastCalledWith("/note-collaboration/eligible-users?moduleCode=formalizacion&contextType=sales_order&recordId=208&recordSource=legacy&search=a%26b");
    await collaboration.getEligibleUsersForNoteDraft("ventas", { kind: "sales_order", source: "native", id }, "");
    expect(apiRequest).toHaveBeenLastCalledWith(`/note-collaboration/eligible-users?moduleCode=ventas&contextType=sales_order&recordId=${id}&search=`);
});
it("rejects duplicated inbox and directory identities", async () => {
    vi.mocked(apiRequest).mockResolvedValueOnce({ schemaVersion: 1, items: [note, note], page: { ...page, total: 2 } });
    await expect(collaboration.getNoteInbox()).rejects.toThrow();
    vi.mocked(apiRequest).mockResolvedValueOnce({ items: [author, author] });
    await expect(collaboration.getEligibleNoteUsers(id, "")).rejects.toThrow();
});
it("accepts withdrawn replies and explicit legacy context without leaking unknown payload fields", async () => {
    const response = { ...thread, note: { ...note, context: { kind: "sales_order", source: "legacy", id: "208" } }, replies: [{ ...reply, text: null, withdrawn: true, internalText: "drop" }] };
    vi.mocked(apiRequest).mockResolvedValue(response);
    const result = await collaboration.getNoteThread(id);
    expect(result.note.context).toEqual(response.note.context);
    expect(result.replies[0]).toEqual({ ...reply, text: null, withdrawn: true });
});

it("requests a combined authorized inbox without merging or duplicating pages in the browser", async () => {
    vi.mocked(apiRequest).mockResolvedValue({ schemaVersion: 1, items: [], page: { number: 1, size: 25, total: 0 } });
    await collaboration.getNoteInbox("all", "all", 1);
    expect(apiRequest).toHaveBeenLastCalledWith("/note-collaboration/inbox?kind=all&status=all&page=1&pageSize=25");
});

it("loads all user-directory pages and deduplicates repeated identities across pages", async () => {
    vi.mocked(apiRequest)
        .mockResolvedValueOnce({ items: [{ publicId: id, displayName: "Ana" }], hasMore: true })
        .mockResolvedValueOnce({
            items: [
                { publicId: id, displayName: "Ana" },
                { publicId: other, displayName: "Luis" },
            ],
            hasMore: false,
        });
    await expect(collaboration.getEligibleNoteUsers(id, "")).resolves.toEqual({
        items: [
            { publicId: id, displayName: "Ana" },
            { publicId: other, displayName: "Luis" },
        ],
    });
    expect(apiRequest).toHaveBeenLastCalledWith(`/note-collaboration/notes/${id}/eligible-users?search=&page=2`);
});
it("does not present a partial directory when a later page fails", async () => {
    vi.mocked(apiRequest)
        .mockResolvedValueOnce({ items: [{ publicId: id, displayName: "Ana" }], hasMore: true })
        .mockRejectedValueOnce(new Error("offline"));
    await expect(collaboration.getEligibleUsersForNoteDraft("ventas", { kind: "personal" }, "")).rejects.toThrow("offline");
});

it("preserves a redacted resource as null without inventing a record link", async () => {
    vi.mocked(apiRequest).mockResolvedValue({ ...thread, note: { ...note, context: null } });
    const result = await collaboration.getNoteThread(id);
    expect(result.note.context).toBeNull();
});
