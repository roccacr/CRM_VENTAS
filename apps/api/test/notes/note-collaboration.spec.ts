import { describe, expect, it } from "vitest";

import { collaborationInboxSchema } from "../../src/modules/crm/notes/note-collaboration.contract.js";
import { canUseCollaboration } from "../../src/modules/crm/notes/notes.permissions.js";
describe("collaboration capability", () => {
    it("allows cross-module personal invitation without granting the origin module", () => {
        expect(canUseCollaboration({ permissions: [{ code: "ventas.notes.reply", effect: "allow", scope: "self", source: "system" }] }, "mercadeo", "reply", true)).toBe(true);
    });
    it("origin explicit deny wins over fallback", () => {
        expect(
            canUseCollaboration(
                {
                    permissions: [
                        { code: "ventas.notes.reply", effect: "allow", scope: "self", source: "system" },
                        { code: "mercadeo.notes.reply", effect: "deny", scope: null, source: "system" },
                    ],
                },
                "mercadeo",
                "reply",
                true,
            ),
        ).toBe(false);
    });
    it("linked context cannot borrow another module", () => {
        expect(canUseCollaboration({ permissions: [{ code: "ventas.notes.reply", effect: "allow", scope: "self", source: "system" }] }, "mercadeo", "reply", false)).toBe(false);
    });
});

it("keeps global record filters source-qualified and rejects reversed dates", () => {
    expect(collaborationInboxSchema.safeParse({ kind: "assigned", recordSource: "legacy", recordId: "208", createdFrom: "2026-10-01T00:00:00.000Z", createdTo: "2026-10-31T23:59:59.000Z" }).success).toBe(true);
    expect(collaborationInboxSchema.safeParse({ recordId: "208" }).success).toBe(false);
    expect(collaborationInboxSchema.safeParse({ recordSource: "native", recordId: "208" }).success).toBe(false);
    expect(collaborationInboxSchema.safeParse({ createdFrom: "2026-11-01T00:00:00.000Z", createdTo: "2026-10-01T00:00:00.000Z" }).success).toBe(false);
});
