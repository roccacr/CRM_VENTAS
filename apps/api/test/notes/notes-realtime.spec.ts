import { describe, expect, it, vi } from "vitest";

import { notesRealtimeActivitySchema } from "../../src/modules/crm/notes/notes-realtime.contract.js";
import { NotesRealtimeSignal } from "../../src/modules/crm/notes/notes-realtime.signal.js";
describe("notes realtime contract and wake", () => {
    it("rejects private text and unknown protocol versions", () => {
        const base = { schemaVersion: 1, eventId: "01K00000000000000000000001", kind: "note.changed", occurredAt: new Date().toISOString() };
        expect(notesRealtimeActivitySchema.safeParse(base).success).toBe(true);
        expect(notesRealtimeActivitySchema.safeParse({ ...base, text: "private" }).success).toBe(false);
        expect(notesRealtimeActivitySchema.safeParse({ ...base, schemaVersion: 2 }).success).toBe(false);
    });
    it("wakes each registered worker and unsubscribes cleanly", () => {
        const signal = new NotesRealtimeSignal();
        const a = vi.fn();
        const b = vi.fn();
        const remove = signal.subscribe(a);
        signal.subscribe(b);
        signal.notify();
        remove();
        signal.notify();
        expect(a).toHaveBeenCalledTimes(1);
        expect(b).toHaveBeenCalledTimes(2);
    });
});
