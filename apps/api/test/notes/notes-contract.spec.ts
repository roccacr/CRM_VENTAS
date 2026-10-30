import { describe, expect, it } from "vitest";

import { createNoteSchema, editNoteSchema, listNotesSchema, placementSchema } from "../../src/modules/crm/notes/notes.contract.js";
import { canUseNotes, notesReadOwnOnly } from "../../src/modules/crm/notes/notes.permissions.js";

const base = { moduleCode: "mercadeo", operationId: "operation_00000001", text: "Llamar al cliente" };
describe("notes stage2 contracts and module boundary", () => {
    it("allows personal Home without a business ID or client-supplied author", () => {
        expect(createNoteSchema.parse(base).context).toEqual({ kind: "view" });
        expect(createNoteSchema.safeParse({ ...base, authorUserId: "someone-else" }).success).toBe(false);
        expect(createNoteSchema.safeParse({ ...base, participants: ["other"] }).success).toBe(false);
    });
    it.each(["", " ", "a".repeat(10001), "secret\u0000body"])("rejects invalid content", (text) => {
        expect(createNoteSchema.safeParse({ ...base, text }).success).toBe(false);
    });
    it("rejects raw HTML formats, arbitrary entities and old provider identities", () => {
        expect(createNoteSchema.safeParse({ ...base, content: { html: "<script>" } }).success).toBe(false);
        expect(createNoteSchema.safeParse({ ...base, context: { kind: "lead", id: "1" } }).success).toBe(false);
        expect(createNoteSchema.safeParse({ ...base, context: { kind: "sales_order", source: "legacy", id: "208" } }).success).toBe(true);
    });
    it("bounds pagination and requires explicit versions for all changes", () => {
        expect(listNotesSchema.parse({ moduleCode: "mercadeo" }).pageSize).toBe(25);
        expect(listNotesSchema.safeParse({ moduleCode: "mercadeo", pageSize: "101" }).success).toBe(false);
        expect(editNoteSchema.safeParse(base).success).toBe(false);
        expect(placementSchema.safeParse({ moduleCode: "mercadeo", operationId: base.operationId, expectedLayoutVersion: 0, x: -1, y: 0, width: 280, height: 200 }).success).toBe(false);
    });
    it("denies mismatched modules, explicit denies and unknown scopes without Owner bypass", () => {
        const allow = { code: "mercadeo.notes.read", effect: "allow" as const, scope: "assigned", source: "role" as const };
        expect(canUseNotes({ permissions: [allow] }, "mercadeo", "read")).toBe(true);
        expect(canUseNotes({ permissions: [allow] }, "ventas", "read")).toBe(false);
        expect(canUseNotes({ permissions: [allow, { ...allow, effect: "deny", scope: null }] }, "mercadeo", "read")).toBe(false);
        expect(canUseNotes({ permissions: [{ ...allow, scope: "invented" }] }, "mercadeo", "read")).toBe(false);
        expect(notesReadOwnOnly({ permissions: [{ ...allow, scope: "self" }] }, "mercadeo")).toBe(true);
    });
});

describe("optional registered note contexts", () => {
    it("accepts personal notes, registered-view syntax and source-specific orders", () => {
        expect(createNoteSchema.parse({ ...base, context: { kind: "personal" } }).context).toEqual({ kind: "personal" });
        expect(createNoteSchema.parse({ ...base, context: { kind: "view", code: "marketing-leads" } }).context).toEqual({ kind: "view", code: "marketing-leads" });
        expect(listNotesSchema.safeParse({ moduleCode: "formalizacion", contextType: "sales_order", recordSource: "legacy", recordId: "208" }).success).toBe(true);
    });
    it.each(["0", "-1", "208x", "01", "2147483648", "01K00000000000000000000000"])("rejects invalid legacy identity %s", (id) => {
        expect(createNoteSchema.safeParse({ ...base, context: { kind: "sales_order", source: "legacy", id } }).success).toBe(false);
    });
    it("rejects irrelevant context selectors and URL-like view codes", () => {
        expect(listNotesSchema.safeParse({ moduleCode: "mercadeo", contextType: "personal", viewCode: "marketing-home" }).success).toBe(false);
        expect(createNoteSchema.safeParse({ ...base, context: { kind: "view", code: "/home/marketing?x=1" } }).success).toBe(false);
    });
});
