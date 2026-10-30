import { beforeEach, expect, it, vi } from "vitest";

import { apiRequest } from "../../src/services/api/api-client";
import { createNote, editNote, getNotes, normalizeNoteContext, type NoteContext, saveNotePlacement, setNoteState } from "../../src/services/notes/notes-service";
vi.mock("../../src/services/api/api-client", () => ({ apiRequest: vi.fn() }));
const id = "01ARZ3NDEKTSV4RRFFQ69G5FAV";
const fields = { title: null, text: "<script>plain text</script>", color: "#FFFF88", priority: "normal" as const };
const placement = { viewportClass: "desktop" as const, anchorMode: "context" as const, x: 12, y: 10, width: 240, height: 160, collapsed: false, hidden: false, layoutVersion: 2 };
const note = { id, title: null, content: { format: "plain_text", text: fields.text }, color: fields.color, priority: fields.priority, status: "open", version: 1, createdAt: "2026-10-27T10:00:00.000Z", updatedAt: "2026-10-27T10:00:00.000Z", author: { publicId: id, displayName: "Roberto" }, capabilities: { canEdit: true, canComplete: true, canReopen: false, canArchive: true, canMove: true }, myPlacements: [placement] };
beforeEach(() => vi.mocked(apiRequest).mockReset());
it.each<{ context: NoteContext; query: string }>([
    { context: { kind: "personal" }, query: "contextType=personal" },
    { context: { kind: "view" }, query: "contextType=view" },
    { context: { kind: "view", code: "ventas.orders" }, query: "contextType=view&viewCode=ventas.orders" },
    { context: { kind: "sales_order", source: "legacy", id: "208" }, query: "contextType=sales_order&recordId=208&recordSource=legacy" },
    { context: { kind: "sales_order", source: "native", id }, query: `contextType=sales_order&recordId=${id}` },
])("reads the exact explicit context query and creates with the same context: $query", async ({ context, query }) => {
    vi.mocked(apiRequest).mockResolvedValueOnce({ schemaVersion: 1, page: { number: 1, size: 100, total: 0 }, items: [] });
    await expect(getNotes("ventas", context)).resolves.toEqual({ items: [], total: 0 });
    expect(apiRequest).toHaveBeenLastCalledWith(`/notes?moduleCode=ventas&${query}&status=open&page=1&pageSize=100`);
    const result = { noteId: id, version: 1, replayed: false };
    vi.mocked(apiRequest).mockResolvedValueOnce(result);
    await expect(createNote("ventas", context, fields, "operation_12345678")).resolves.toEqual(result);
    expect(apiRequest).toHaveBeenLastCalledWith("/notes", { method: "POST", body: { moduleCode: "ventas", context, ...fields, operationId: "operation_12345678" }, retryOnUnauthorized: false });
});
it("reads a bounded native order context and strips unknown response fields", async () => {
    vi.mocked(apiRequest).mockResolvedValue({ schemaVersion: 1, page: { number: 2, size: 100, total: 123 }, items: [{ ...note, internalId: 99 }] });
    expect(await getNotes("formalizacion", { kind: "sales_order", source: "native", id }, "open", 2)).toEqual({ items: [note], total: 123 });
    expect(apiRequest).toHaveBeenCalledWith(`/notes?moduleCode=formalizacion&contextType=sales_order&recordId=${id}&status=open&page=2&pageSize=100`);
});
it.each([
    { ...note, content: { format: "html", text: "unsafe" } },
    { ...note, capabilities: { ...note.capabilities, canEdit: "true" } },
    { ...note, version: -1 },
    { ...note, color: "url(javascript:alert(1))" },
    { ...note, myPlacements: [{ ...placement, x: Infinity }] },
    { ...note, author: null },
])("rejects malformed note content without fixtures or permissive defaults", async (item) => {
    vi.mocked(apiRequest).mockResolvedValue({ schemaVersion: 1, page: { number: 1, size: 100, total: 1 }, items: [item] });
    await expect(getNotes("ventas", { kind: "view" })).rejects.toThrow("Invalid notes response");
});
it("sends optimistic commands and preserves idempotency without automatic retry", async () => {
    const result = { noteId: id, version: 2, replayed: false };
    vi.mocked(apiRequest).mockResolvedValue(result);
    await expect(createNote("ventas", { kind: "view" }, fields, "operation_12345678")).resolves.toEqual(result);
    expect(apiRequest).toHaveBeenLastCalledWith("/notes", { method: "POST", body: { moduleCode: "ventas", context: { kind: "view" }, ...fields, operationId: "operation_12345678" }, retryOnUnauthorized: false });
    await editNote("ventas", id, fields, 1, "operation_12345678");
    expect(apiRequest).toHaveBeenLastCalledWith(`/notes/${id}`, { method: "PATCH", body: { moduleCode: "ventas", ...fields, expectedVersion: 1, operationId: "operation_12345678" }, retryOnUnauthorized: false });
    for (const action of ["complete", "reopen", "archive"] as const) {
        await setNoteState("ventas", id, action, 1, "operation_12345678");
        expect(apiRequest).toHaveBeenLastCalledWith(`/notes/${id}/${action}`, { method: "POST", body: { moduleCode: "ventas", expectedVersion: 1, operationId: "operation_12345678" }, retryOnUnauthorized: false });
    }
});
it("saves personal placement using its layout version only", async () => {
    vi.mocked(apiRequest).mockResolvedValue({ noteId: id, version: 1, layoutVersion: 3, replayed: true });
    await expect(saveNotePlacement("ventas", id, placement, "operation_12345678")).resolves.toEqual({ noteId: id, version: 1, layoutVersion: 3, replayed: true });
    const { layoutVersion, ...coordinates } = placement;
    expect(apiRequest).toHaveBeenCalledWith(`/notes/${id}/my-placement`, { method: "PUT", body: { moduleCode: "ventas", ...coordinates, expectedLayoutVersion: layoutVersion, operationId: "operation_12345678" }, retryOnUnauthorized: false });
});
it("propagates conflicts and rejects malformed command receipts", async () => {
    const conflict = new Error("conflict");
    vi.mocked(apiRequest).mockRejectedValueOnce(conflict);
    await expect(setNoteState("ventas", id, "complete", 1, "operation_12345678")).rejects.toBe(conflict);
    expect(apiRequest).toHaveBeenCalledTimes(1);
    vi.mocked(apiRequest).mockResolvedValue({ noteId: id, version: 0, replayed: false });
    await expect(createNote("ventas", { kind: "view" }, fields, "operation_12345678")).rejects.toThrow("Invalid notes response");
});
it.each([null, { schemaVersion: 2, page: { number: 1, size: 100, total: 0 }, items: [] }, { schemaVersion: 1, page: { number: 1, size: 100, total: -1 }, items: [] }, { schemaVersion: 1, page: { number: 2, size: 100, total: 0 }, items: [] }, { schemaVersion: 1, page: { number: 1, size: 100, total: 101 }, items: Array.from({ length: 101 }, () => note) }])("rejects malformed or unbounded list envelopes", async (response) => {
    vi.mocked(apiRequest).mockResolvedValue(response);
    await expect(getNotes("ventas", { kind: "view" })).rejects.toThrow("Invalid notes response");
});
it.each([
    { noteId: id, version: 1, replayed: "false" },
    { noteId: "bad-id", version: 1, replayed: false },
    { noteId: id, version: 1, replayed: false, layoutVersion: -1 },
])("rejects malformed command receipts", async (response) => {
    vi.mocked(apiRequest).mockResolvedValue(response);
    await expect(saveNotePlacement("ventas", id, placement, "operation_12345678")).rejects.toThrow("Invalid notes response");
});

it("normalizes the real legacy list identifier for note reads and creates", async () => {
    const context: NoteContext = { kind: "sales_order", source: "legacy", id: "legacy:208" };
    vi.mocked(apiRequest).mockResolvedValueOnce({ schemaVersion: 1, page: { number: 1, size: 100, total: 0 }, items: [] });
    await getNotes("formalizacion", context);
    expect(apiRequest).toHaveBeenLastCalledWith("/notes?moduleCode=formalizacion&contextType=sales_order&recordId=208&recordSource=legacy&status=open&page=1&pageSize=100");
    vi.mocked(apiRequest).mockResolvedValueOnce({ noteId: id, version: 1, replayed: false });
    await createNote("formalizacion", context, fields, "operation_12345678");
    expect(apiRequest).toHaveBeenLastCalledWith("/notes", { method: "POST", body: { moduleCode: "formalizacion", context: { kind: "sales_order", source: "legacy", id: "208" }, ...fields, operationId: "operation_12345678" }, retryOnUnauthorized: false });
    expect(context.id).toBe("legacy:208");
});
it.each<[NoteContext, NoteContext]>([
    [
        { kind: "sales_order", source: "legacy", id: "legacy:208" },
        { kind: "sales_order", source: "legacy", id: "208" },
    ],
    [
        { kind: "sales_order", source: "legacy", id: "208" },
        { kind: "sales_order", source: "legacy", id: "208" },
    ],
    [
        { kind: "sales_order", source: "native", id },
        { kind: "sales_order", source: "native", id },
    ],
    [
        { kind: "sales_order", source: "native", id: "legacy:208" },
        { kind: "sales_order", source: "native", id: "legacy:208" },
    ],
    [
        { kind: "sales_order", source: "legacy", id: "legacy:legacy:208" },
        { kind: "sales_order", source: "legacy", id: "legacy:legacy:208" },
    ],
    [
        { kind: "sales_order", source: "legacy", id: "legacy:208-extra" },
        { kind: "sales_order", source: "legacy", id: "legacy:208-extra" },
    ],
    [
        { kind: "view", code: "marketing-leads" },
        { kind: "view", code: "marketing-leads" },
    ],
    [
        { kind: "sales_order", source: "legacy", id: "legacy:2147483647" },
        { kind: "sales_order", source: "legacy", id: "2147483647" },
    ],
    [
        { kind: "sales_order", source: "legacy", id: "legacy:2147483648" },
        { kind: "sales_order", source: "legacy", id: "legacy:2147483648" },
    ],
    [
        { kind: "sales_order", source: "legacy", id: "legacy:0" },
        { kind: "sales_order", source: "legacy", id: "legacy:0" },
    ],
    [
        { kind: "sales_order", source: "legacy", id: "legacy:0208" },
        { kind: "sales_order", source: "legacy", id: "legacy:0208" },
    ],
    [
        { kind: "sales_order", source: "legacy", id: "legacy:208\n" },
        { kind: "sales_order", source: "legacy", id: "legacy:208\n" },
    ],
    [{ kind: "personal" }, { kind: "personal" }],
])("normalizes only a valid legacy presentation alias: %j", (input, expected) => {
    expect(normalizeNoteContext(input)).toEqual(expected);
    expect(normalizeNoteContext(normalizeNoteContext(input))).toEqual(expected);
});

it("creates a note and its selected client/order references in one request", async () => {
    const relatedRecords = [
        { kind: "lead" as const, source: "legacy" as const, id: "18" },
        { kind: "sales_order" as const, source: "native" as const, id },
    ];
    vi.mocked(apiRequest).mockResolvedValue({ noteId: id, version: 1, replayed: false });
    await createNote("formalizacion", { kind: "personal" }, fields, "operation_12345678", relatedRecords);
    expect(apiRequest).toHaveBeenLastCalledWith("/notes", { method: "POST", body: { moduleCode: "formalizacion", context: { kind: "personal" }, ...fields, operationId: "operation_12345678", relatedRecords }, retryOnUnauthorized: false });
});
