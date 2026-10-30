import "@testing-library/jest-dom/vitest";

import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { NotesButton, NotesNotificationsButton, PersonalNotesProvider } from "../../src/modules/notes/PersonalNotes";
import { ApiClientError } from "../../src/services/api/api-client";
import { getNoteInbox, replaceNoteParticipants } from "../../src/services/notes/note-collaboration-service";
import type * as NotesApi from "../../src/services/notes/notes-service";
import { createNote, getNotes } from "../../src/services/notes/notes-service";
const noteId = "01K00000000000000000000000";
vi.mock("../../src/services/notes/notes-service", async (importOriginal) => ({ ...(await importOriginal<typeof NotesApi>()), createNote: vi.fn(), getNotes: vi.fn() }));
vi.mock("../../src/services/notes/note-collaboration-service", () => ({ getNoteInbox: vi.fn(), replaceNoteParticipants: vi.fn() }));
vi.mock("../../src/modules/notes/NoteParticipantsPicker", () => ({
    NoteParticipantsPicker: ({ onChange }: { onChange: (value: object[]) => void }) => (
        <button
            type="button"
            onClick={() => {
                onChange([{ userId: "01K00000000000000000000001", displayName: "Invitada", access: "reply" }]);
            }}
        >
            Invitar candidata
        </button>
    ),
}));
vi.mock("../../src/modules/notes/NoteCollaborationDrawer", () => ({
    NoteCollaborationDrawer: ({ noteId, open, onClose }: { noteId: string | null; open: boolean; onClose: () => void }) => (
        <div data-testid="thread" data-note={noteId} data-open={String(open)}>
            <button type="button" onClick={onClose}>
                Cerrar conversación de prueba
            </button>
        </div>
    ),
}));
vi.mock("../../src/modules/notes/NoteNotifications", () => ({
    NoteNotificationsButton: ({ onOpenNote }: { onOpenNote: (id: string) => void }) => (
        <button
            type="button"
            onClick={() => {
                onOpenNote("01K00000000000000000000000");
            }}
        >
            Campana de prueba
        </button>
    ),
}));
afterEach(cleanup);
beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getNotes).mockResolvedValue({ items: [], total: 0 });
    vi.mocked(createNote).mockResolvedValue({ noteId, version: 1, replayed: false });
    vi.mocked(replaceNoteParticipants).mockResolvedValue({ noteId, version: 1, collaborationVersion: 2, replayed: false });
    vi.mocked(getNoteInbox).mockResolvedValue({ schemaVersion: 1, items: [], page: { number: 1, size: 25, total: 0 } });
});
function view() {
    return render(
        <PersonalNotesProvider moduleCode="ventas" permissions={["read", "create", "share_own"].map((action) => ({ code: `ventas.notes.${action}`, effect: "allow" as const }))} homeEnabled>
            <NotesButton />
            <NotesNotificationsButton />
        </PersonalNotesProvider>,
    );
}
async function createInvited() {
    view();
    fireEvent.click(screen.getByRole("button", { name: "Mis notas" }));
    fireEvent.click(await screen.findByRole("button", { name: "Nueva nota" }));
    fireEvent.change(screen.getByLabelText("Texto de la nota"), { target: { value: "Nota compartida" } });
    fireEvent.click(screen.getByText("Invitar personas (opcional)"));
    fireEvent.click(screen.getByRole("button", { name: "Invitar candidata" }));
    fireEvent.click(screen.getByRole("button", { name: "Guardar nota" }));
}
it("retries an uncertain share using the confirmed private note and identical share operation", async () => {
    vi.mocked(replaceNoteParticipants).mockRejectedValueOnce(new ApiClientError("Unavailable", 503, null));
    await createInvited();
    fireEvent.click(await screen.findByRole("button", { name: "Reintentar el mismo guardado" }));
    await waitFor(() => {
        expect(replaceNoteParticipants).toHaveBeenCalledTimes(2);
    });
    expect(createNote).toHaveBeenCalledTimes(1);
    expect(vi.mocked(replaceNoteParticipants).mock.calls[0]).toEqual(vi.mocked(replaceNoteParticipants).mock.calls[1]);
});
it("waits for slow invitations without claiming that their outcome is unknown", async () => {
    let confirm!: (result: Awaited<ReturnType<typeof replaceNoteParticipants>>) => void;
    vi.mocked(replaceNoteParticipants).mockReturnValueOnce(
        new Promise((resolve) => {
            confirm = resolve;
        }),
    );
    await createInvited();
    await waitFor(() => {
        expect(replaceNoteParticipants).toHaveBeenCalledTimes(1);
    });
    expect(screen.getByText("Guardando…")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Reintentar el mismo guardado" })).not.toBeInTheDocument();
    expect(screen.queryByText(/La invitación todavía no está confirmada/)).not.toBeInTheDocument();
    await act(async () => {
        confirm({ noteId, version: 1, collaborationVersion: 2, replayed: false });
        await Promise.resolve();
    });
    expect(await screen.findByText("Guardado")).toBeInTheDocument();
    expect(createNote).toHaveBeenCalledTimes(1);
});
it("retains confirmed note after a sharing conflict and opens its conversation without creating again", async () => {
    vi.mocked(replaceNoteParticipants).mockRejectedValueOnce(new ApiClientError("Conflict", 409, null));
    await createInvited();
    fireEvent.click(await screen.findByRole("button", { name: "Conservar nota y revisar conversación" }));
    expect(screen.getByTestId("thread")).toHaveAttribute("data-note", noteId);
    expect(createNote).toHaveBeenCalledTimes(1);
});
it("bell conversation remains mounted while closed and shared inbox uses authorized client", async () => {
    view();
    fireEvent.click(screen.getByRole("button", { name: "Campana de prueba" }));
    expect(screen.getByTestId("thread")).toHaveAttribute("data-open", "true");
    fireEvent.click(screen.getByRole("button", { name: "Cerrar conversación de prueba" }));
    expect(screen.getByTestId("thread")).toHaveAttribute("data-note", noteId);
    expect(screen.getByTestId("thread")).toHaveAttribute("data-open", "false");
    fireEvent.click(screen.getByRole("button", { name: "Mis notas" }));
    fireEvent.click(await screen.findByRole("button", { name: "Compartidas conmigo" }));
    await waitFor(() => {
        expect(getNoteInbox).toHaveBeenCalledWith("shared", "all", 1, expect.objectContaining({ search: "" }));
    });
});
