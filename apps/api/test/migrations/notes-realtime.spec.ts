import { describe, expect, it } from "vitest";

import { loadNotesRealtimeStatements, notesRealtimeMigration } from "../../migrations/schema-only/202610280046_notes_realtime.js";
import { schemaMigrations } from "../../scripts/run-schema-migrations.js";
describe("notes realtime additive schema", () => {
    it("registers exactly046 and adds only native metadata with comments and fencing", async () => {
        const statements = await loadNotesRealtimeStatements();
        expect(statements).toHaveLength(1);
        const statement = statements[0];
        expect(statement).toContain("CREATE TABLE crm_note_realtime_event (");
        expect(statement).toContain("FOREIGN KEY(recipient_user_id_note_realtime_event)");
        expect(statement).toContain("attempts_note_realtime_event<=5");
        expect(statement).not.toMatch(/INSERT|TRIGGER|crmdatabase-api|content_note|DROP TABLE/i);
        expect(schemaMigrations.filter((m) => m.name === notesRealtimeMigration.name)).toHaveLength(1);
    });
});
