import { beforeEach, expect, it, vi } from "vitest";

import { apiRequest } from "../../src/services/api/api-client";
import { getNoteRelatedRecords, getRelatedRecordOptions, parseRelatedRecords, saveNoteRelatedRecords } from "../../src/services/notes/note-related-records-service";

vi.mock("../../src/services/api/api-client", () => ({ apiRequest: vi.fn() }));
const id = "01ARZ3NDEKTSV4RRFFQ69G5FAV";
const reference = { kind: "sales_order" as const, source: "legacy" as const, id: "208" };
const item = { kind: "sales_order", reference, label: "RDR673", description: "Proyecto Centro", url: "/home/formalization?orderSource=legacy&orderId=208", restricted: false };
beforeEach(() => vi.resetAllMocks());

it("searches both sources through one endpoint without a source selector", async () => {
    vi.mocked(apiRequest).mockResolvedValue({ schemaVersion: 1, items: [item], page: { number: 1, size: 25 }, hasMore: false, partial: true });
    expect(await getRelatedRecordOptions("formalizacion", "sales_order", "RDR", 1)).toMatchObject({ items: [item], partial: true });
    expect(apiRequest).toHaveBeenLastCalledWith("/notes/related-record-options?moduleCode=formalizacion&kind=sales_order&search=RDR&page=1");
});
it("keeps restricted links without leaking references or labels", () => {
    expect(parseRelatedRecords([{ kind: "lead", label: null, description: null, url: null, restricted: true }])).toEqual([{ kind: "lead", label: null, description: null, url: null, restricted: true }]);
    expect(() => parseRelatedRecords([{ ...item, restricted: true }])).toThrow();
    expect(() => parseRelatedRecords([{ ...item, url: "https://untrusted.example/order" }])).toThrow();
});
it("reads a versioned author-only relation editor and saves an exact operation", async () => {
    vi.mocked(apiRequest)
        .mockResolvedValueOnce({ schemaVersion: 1, version: 3, items: [item], canManage: true })
        .mockResolvedValueOnce({ noteId: id, version: 1, collaborationVersion: 4, replayed: false });
    expect(await getNoteRelatedRecords(id)).toMatchObject({ version: 3, canManage: true });
    const command = { operationId: "operation-related-123", expectedCollaborationVersion: 3, relatedRecords: [reference] };
    await saveNoteRelatedRecords(id, command);
    expect(apiRequest).toHaveBeenLastCalledWith(`/note-collaboration/notes/${id}/related-records`, { method: "PUT", body: command, retryOnUnauthorized: false });
});
