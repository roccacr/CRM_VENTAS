import type { PersonalNote } from "../../services/notes/notes-service";

/** Project lifecycle only from capabilities already granted by the server; reopening never invents edit/reply access. */
export function projectNoteState<T extends PersonalNote>(note: T, status: PersonalNote["status"]): T {
    const resolve = note.capabilities.canComplete || note.capabilities.canReopen;
    const capabilities = { ...note.capabilities };
    if (status !== "open") {
        capabilities.canEdit = false;
        capabilities.canMove = false;
        capabilities.canReply = false;
        capabilities.canShare = false;
    }
    return { ...note, status, capabilities: { ...capabilities, canComplete: status === "open" && resolve, canReopen: status === "completed" && resolve, canArchive: status !== "archived" && note.capabilities.canArchive } };
}
