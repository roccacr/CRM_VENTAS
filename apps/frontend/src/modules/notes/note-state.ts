import type { PersonalNote } from "../../services/notes/notes-service";

/** El ciclo de vida se proyecta solo con capacidades que el servidor ya concedió. Reabrir no inventa permiso de editar ni de responder. */
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
