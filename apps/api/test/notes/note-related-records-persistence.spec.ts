import { describe, expect, it } from "vitest";

import { noteRelatedRecordKey } from "../../src/modules/crm/notes/note-related-records.repository.js";

describe("related record identities", () => {
    it("keeps the same source-qualified resource stable independently of a note module", () => {
        const reference = { kind: "lead", source: "legacy", id: "208" } as const;
        expect(noteRelatedRecordKey(reference)).toMatch(/^[a-f0-9]{64}$/);
        expect(noteRelatedRecordKey({ ...reference })).toBe(noteRelatedRecordKey(reference));
    });
    it("does not merge a customer and order sharing a legacy number", () => {
        expect(noteRelatedRecordKey({ kind: "lead", source: "legacy", id: "208" })).not.toBe(noteRelatedRecordKey({ kind: "sales_order", source: "legacy", id: "208" }));
    });
    it("does not merge records from different sources", () => {
        const id = "01ARZ3NDEKTSV4RRFFQ69G5FAV";
        expect(noteRelatedRecordKey({ kind: "lead", source: "native", id })).not.toBe(noteRelatedRecordKey({ kind: "lead", source: "legacy", id: "208" }));
    });
});
