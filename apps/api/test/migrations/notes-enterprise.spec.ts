import { describe, expect, it } from "vitest";

import { loadNotesLocationsStatements, notesLocationsMigration } from "../../migrations/schema-only/202610280052_notes_locations.js";
import { loadNotesWorkflowStatements, notesWorkflowMigration } from "../../migrations/schema-only/202610280053_notes_workflow.js";
describe("native enterprise notes additive schemas", () => {
    it("keeps additional locations independent of canonical record links", async () => {
        const statements = await loadNotesLocationsStatements();
        expect(statements).toHaveLength(1);
        expect(statements[0]).toContain("FOREIGN KEY (note_id_note_location) REFERENCES crm_note(id_note)");
        expect(statements[0]).toContain("ck_note_location_home");
        expect(statements.join(" ")).not.toMatch(/INSERT INTO|UPDATE |crmdatabase-api|CREATE TRIGGER/i);
        expect(notesLocationsMigration.name).toBe("202610280052_notes_locations");
    });
    it("adds durable task schedules and notification reasons without copying business rows", async () => {
        const statements = await loadNotesWorkflowStatements();
        expect(statements).toHaveLength(3);
        expect(statements[0]).toContain("version_note_task");
        expect(statements[1]).toContain("attempts_note_workflow_event");
        expect(statements[2]).toContain("'assigned','reminder','due'");
        expect(statements.join(" ")).not.toMatch(/INSERT INTO|UPDATE |crmdatabase-api|CREATE TRIGGER/i);
        expect(notesWorkflowMigration.name).toBe("202610280053_notes_workflow");
    });
});
