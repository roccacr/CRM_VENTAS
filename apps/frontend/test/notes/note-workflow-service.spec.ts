import { beforeEach, expect, it, vi } from "vitest";

import { apiRequest } from "../../src/services/api/api-client";
import { getNoteInbox, getNoteInboxAuthors } from "../../src/services/notes/note-collaboration-service";
import { getNoteActivity, getNoteLocations, getNoteWorkflow, getNoteWorkflowOverview, saveNoteReminder, saveNoteTask } from "../../src/services/notes/note-workflow-service";
vi.mock("../../src/services/api/api-client", () => ({ apiRequest: vi.fn() }));
const id = "01ARZ3NDEKTSV4RRFFQ69G5FAV";
const time = "2026-10-28T16:00:00.000Z";
const workflow = { schemaVersion: 1, version: 3, assignee: null, dueAt: time, reminder: { remindAt: time, status: "pending" }, canManage: true };
beforeEach(() => {
    vi.mocked(apiRequest).mockReset();
});
it.each(["pending", "delivered", "suppressed", "cancelled"])("accepts the declared reminder state %s without another user's fields", async (status) => {
    vi.mocked(apiRequest).mockResolvedValue({ ...workflow, reminder: { ...workflow.reminder, status }, otherReminder: "private" });
    expect(await getNoteWorkflow(id)).toEqual({ ...workflow, reminder: { ...workflow.reminder, status } });
});
it.each([
    { ...workflow, version: -1 },
    { ...workflow, schemaVersion: 2 },
    { ...workflow, canManage: 1 },
    { ...workflow, reminder: { remindAt: time, status: "unknown" } },
    { ...workflow, assignee: { publicId: "invalid", displayName: "Name" } },
])("rejects malformed workflow responses", async (value) => {
    vi.mocked(apiRequest).mockResolvedValue(value);
    await expect(getNoteWorkflow(id)).rejects.toThrow();
});
it("retains the caller's task and personal reminder operation identifiers without retry", async () => {
    const task = { operationId: "task-original", expectedVersion: 3, assigneeUserId: id, dueAt: time };
    await saveNoteTask(id, task);
    expect(apiRequest).toHaveBeenLastCalledWith(`/note-workflow/notes/${id}/task`, { method: "PUT", body: task, retryOnUnauthorized: false });
    const reminder = { operationId: "reminder-original", remindAt: null };
    await saveNoteReminder(id, reminder);
    expect(apiRequest).toHaveBeenLastCalledWith(`/note-workflow/notes/${id}/reminder`, { method: "PUT", body: reminder, retryOnUnauthorized: false });
});
it("loads authorized Home locations and a paged system event without historic content", async () => {
    const home = { moduleCode: "formalizacion", code: "formalization-home" };
    vi.mocked(apiRequest).mockResolvedValueOnce({ schemaVersion: 1, version: 2, locations: [home], availableLocations: [home], canManage: true });
    expect((await getNoteLocations(id)).availableLocations).toEqual([home]);
    vi.mocked(apiRequest).mockResolvedValueOnce({ schemaVersion: 1, items: [{ id, action: "task_updated", actor: null, createdAt: time, details: null, oldContent: "excluded" }], page: { number: 2, size: 100, total: 101 } });
    expect(await getNoteActivity(id, 2)).toEqual({ items: [{ id, action: "task_updated", actor: null, createdAt: time, details: null }], page: { number: 2, size: 100, total: 101 } });
});
it("encodes global server filters before pagination, including assigned notes", async () => {
    vi.mocked(apiRequest).mockResolvedValue({ schemaVersion: 1, items: [], page: { number: 2, size: 25, total: 0 } });
    await getNoteInbox("assigned", "open", 2, { search: "a&b", authorUserId: id, moduleCode: "formalizacion", recordSource: "legacy" });
    expect(apiRequest).toHaveBeenLastCalledWith(`/note-collaboration/inbox?kind=assigned&status=open&page=2&pageSize=25&search=a%26b&moduleCode=formalizacion&recordSource=legacy&authorUserId=${id}`);
});
it("keeps UTC counters explicit and rejects negative counts", async () => {
    vi.mocked(apiRequest).mockResolvedValue({ schemaVersion: 1, counts: { assigned: 3, dueToday: 1, overdue: 2 }, truncated: false, timeZone: "UTC" });
    expect((await getNoteWorkflowOverview("UTC")).counts.assigned).toBe(3);
    vi.mocked(apiRequest).mockResolvedValue({ schemaVersion: 1, counts: { assigned: -1, dueToday: 0, overdue: 0 }, truncated: false, timeZone: "UTC" });
    await expect(getNoteWorkflowOverview("UTC")).rejects.toThrow();
});

it("accepts a new task at version zero", async () => {
    vi.mocked(apiRequest).mockResolvedValue({ ...workflow, version: 0 });
    expect((await getNoteWorkflow(id)).version).toBe(0);
});

it("reads all authorized authors and encodes source-qualified records and UTC date filters", async () => {
    vi.mocked(apiRequest).mockResolvedValueOnce({ schemaVersion: 1, items: [{ publicId: id, displayName: "Author", secret: "excluded" }] });
    expect(await getNoteInboxAuthors()).toEqual([{ publicId: id, displayName: "Author" }]);
    vi.mocked(apiRequest).mockResolvedValueOnce({ schemaVersion: 1, items: [], page: { number: 1, size: 25, total: 0 } });
    await getNoteInbox("all", "all", 1, { recordSource: "legacy", recordId: "208", createdFrom: time, createdTo: time });
    expect(apiRequest).toHaveBeenLastCalledWith(`/note-collaboration/inbox?kind=all&status=all&page=1&pageSize=25&recordSource=legacy&recordId=208&createdFrom=${encodeURIComponent(time)}&createdTo=${encodeURIComponent(time)}`);
    await expect(getNoteInbox("all", "all", 1, { recordId: "208" })).rejects.toThrow();
});
