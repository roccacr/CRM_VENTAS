import { describe, expect, it } from "vitest";

import { loadNotesCollaborationStatements } from "../../migrations/schema-only/202610270044_notes_collaboration.js";
import { deduplicateNoteRecipients, notificationReadAllSchema, notificationsListSchema } from "../../src/modules/crm/notes/note-notifications.contract.js";
describe("collaboration notifications contract", () => {
    it("deduplicates strongest reason and never notifies actor", () => {
        expect(
            deduplicateNoteRecipients("actor", [
                { publicId: "a", kind: "reply" },
                { publicId: "a", kind: "shared" },
                { publicId: "a", kind: "mention" },
                { publicId: "actor", kind: "mention" },
            ]),
        ).toEqual([{ publicId: "a", kind: "mention" }]);
    });
    it("rejects forged recipient and invalid cutoff while bounding pages", () => {
        expect(notificationsListSchema.safeParse({ recipient: "victim" }).success).toBe(false);
        expect(notificationsListSchema.safeParse({ pageSize: "51" }).success).toBe(false);
        expect(notificationReadAllSchema.safeParse({ through: "yesterday" }).success).toBe(false);
    });
    it("contains only metadata schema and commented fields", async () => {
        const statements = await loadNotesCollaborationStatements();
        expect(statements).toHaveLength(2);
        expect(statements.join(" ")).toContain("UNIQUE KEY uq_notification_event_recipient");
        expect(statements.join(" ")).not.toMatch(/plain_text|CREATE TRIGGER|sec_role_permission/);
    });
});
