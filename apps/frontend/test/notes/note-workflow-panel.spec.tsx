import "@testing-library/jest-dom/vitest";

import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { NotesInbox } from "../../src/modules/notes/NotesInbox";
import { NoteWorkflowPanel } from "../../src/modules/notes/NoteWorkflowPanel";
import { useNotesRealtime } from "../../src/modules/notes/useNotesRealtime";
import type { NoteThread } from "../../src/services/notes/note-collaboration-service";
import { getNoteInbox, getNoteInboxAuthors } from "../../src/services/notes/note-collaboration-service";
import { getNoteActivity, getNoteLocations, getNoteWorkflow, getNoteWorkflowOverview, saveNoteLocations, saveNoteReminder, saveNoteTask } from "../../src/services/notes/note-workflow-service";
vi.mock("../../src/modules/notes/useNotesRealtime", () => ({ useNotesRealtime: vi.fn() }));
vi.mock("../../src/services/notes/note-workflow-service", () => ({ getNoteActivity: vi.fn(), getNoteLocations: vi.fn(), getNoteWorkflow: vi.fn(), getNoteWorkflowOverview: vi.fn(), saveNoteLocations: vi.fn(), saveNoteReminder: vi.fn(), saveNoteTask: vi.fn() }));
vi.mock("../../src/services/notes/note-collaboration-service", () => ({ getNoteInbox: vi.fn(), getNoteInboxAuthors: vi.fn() }));
const id = "01ARZ3NDEKTSV4RRFFQ69G5FAV",
    guest = "01ARZ3NDEKTSV4RRFFQ69G5FAW";
const thread: NoteThread = {
    schemaVersion: 1,
    note: { id, moduleCode: "formalizacion", context: { kind: "personal" }, title: "Plan", content: { format: "plain_text", text: "Plan" }, color: "#FFFF88", priority: "normal", status: "open", version: 1, createdAt: "2026-10-28T12:00:00Z", updatedAt: "2026-10-28T12:00:00Z", author: { publicId: id, displayName: "Autor" }, myPlacements: [], capabilities: { canEdit: true, canComplete: true, canReopen: false, canArchive: true, canMove: true, canShare: true, canReply: true, canMention: true } },
    collaborationVersion: 1,
    participants: [{ userId: guest, displayName: "Participante", access: "read", status: "inactive" }],
    mentions: [],
    replies: [],
    replyPage: { number: 1, size: 25, total: 0 },
    following: true,
};
beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(getNoteInboxAuthors).mockResolvedValue([{ publicId: guest, displayName: "Autor de otra página" }]);
    vi.mocked(getNoteWorkflowOverview).mockResolvedValue({ counts: { assigned: 0, dueToday: 0, overdue: 0 }, truncated: false, timeZone: "UTC" });
    vi.mocked(getNoteInbox).mockResolvedValue({ schemaVersion: 1, items: [thread.note], page: { number: 1, size: 25, total: 1 } });
    vi.mocked(getNoteWorkflow).mockResolvedValue({ schemaVersion: 1, version: 3, assignee: null, dueAt: null, reminder: null, canManage: true });
    vi.mocked(getNoteLocations).mockResolvedValue({ schemaVersion: 1, version: 2, locations: [], availableLocations: [{ moduleCode: "formalizacion", code: "formalization-home" }], canManage: true });
    vi.mocked(getNoteActivity).mockResolvedValue({ items: [], page: { number: 1, size: 100, total: 0 } });
    vi.mocked(saveNoteTask).mockResolvedValue(undefined);
    vi.mocked(saveNoteReminder).mockResolvedValue(undefined);
    vi.mocked(saveNoteLocations).mockResolvedValue(undefined);
});
afterEach(cleanup);
async function panel() {
    render(<NoteWorkflowPanel thread={thread} open onChanged={() => {}} />);
    fireEvent.click(screen.getByText("Responsable y recordatorio"));
    await screen.findByRole("button", { name: "Guardar responsable y vencimiento" });
}
it("explains restricted management while allowing a reader to save a personal reminder", async () => {
    vi.mocked(getNoteWorkflow).mockResolvedValue({ schemaVersion: 1, version: 3, assignee: null, dueAt: null, reminder: null, canManage: false });
    vi.mocked(getNoteLocations).mockResolvedValue({ schemaVersion: 1, version: 2, locations: [], availableLocations: [], canManage: false });
    await panel();
    expect(screen.getByText(/Solo Autor, quien creó esta nota/)).toBeVisible();
    expect(screen.getByText(/Solo Autor, quien creó esta nota/)).toHaveAttribute("role", "alert");
    expect(screen.getByText(/Solo Autor puede cambiar dónde se muestra/)).toBeVisible();
    expect(screen.getByLabelText("Responsable")).toBeDisabled();
    expect(screen.getByLabelText("Vencimiento (hora local)")).toBeDisabled();
    expect(screen.getByRole("button", { name: "Guardar responsable y vencimiento" })).toBeDisabled();
    expect(screen.getByLabelText("Avisarme (hora local)")).toBeEnabled();
    fireEvent.click(screen.getByRole("button", { name: "En 1 hora" }));
    fireEvent.click(screen.getByRole("button", { name: "Crear recordatorio" }));
    await waitFor(() => {
        expect(saveNoteReminder).toHaveBeenCalledTimes(1);
    });
    expect(saveNoteTask).not.toHaveBeenCalled();
});
it.each(["completed", "archived"] as const)("hides assignment and due controls for a %s note", async (status) => {
    vi.mocked(getNoteWorkflow).mockResolvedValue({ schemaVersion: 1, version: 3, assignee: null, dueAt: null, reminder: null, canManage: false });
    render(<NoteWorkflowPanel thread={{ ...thread, note: { ...thread.note, status } }} open onChanged={() => {}} />);
    fireEvent.click(screen.getByText("Responsable y recordatorio"));
    await screen.findByLabelText("Avisarme (hora local)");
    expect(screen.queryByRole("group", { name: "Responsable y vencimiento" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Guardar responsable y vencimiento" })).not.toBeInTheDocument();
    expect(saveNoteTask).not.toHaveBeenCalled();
});
it("assigns an existing dormant participant with the displayed task version and UTC date", async () => {
    await panel();
    fireEvent.change(screen.getByLabelText("Responsable"), { target: { value: guest } });
    fireEvent.change(screen.getByLabelText("Vencimiento (hora local)"), { target: { value: "2026-11-01T09:30" } });
    fireEvent.click(screen.getByRole("button", { name: "Guardar responsable y vencimiento" }));
    await waitFor(() => {
        expect(saveNoteTask).toHaveBeenCalledWith(id, expect.objectContaining({ expectedVersion: 3, assigneeUserId: guest, dueAt: new Date("2026-11-01T09:30").toISOString() }));
    });
    expect(screen.queryByRole("option", { name: "Persona externa" })).not.toBeInTheDocument();
});
it("retains the same operation and draft after a lost task response", async () => {
    vi.mocked(saveNoteTask).mockRejectedValueOnce(new TypeError("Lost response"));
    await panel();
    fireEvent.change(screen.getByLabelText("Responsable"), { target: { value: guest } });
    fireEvent.click(screen.getByRole("button", { name: "Guardar responsable y vencimiento" }));
    fireEvent.click(await screen.findByRole("button", { name: "Reintentar el mismo seguimiento" }));
    await waitFor(() => {
        expect(saveNoteTask).toHaveBeenCalledTimes(2);
    });
    expect(vi.mocked(saveNoteTask).mock.calls[0]).toEqual(vi.mocked(saveNoteTask).mock.calls[1]);
});
it("personal reminders wait for confirmation and locations show only server-authorized Homes", async () => {
    let finish!: () => void;
    vi.mocked(saveNoteReminder).mockReturnValue(
        new Promise((resolve) => {
            finish = resolve;
        }),
    );
    await panel();
    expect(screen.queryByLabelText("Ventas")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Formalización")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Avisarme (hora local)"), { target: { value: "2026-11-01T09:30" } });
    fireEvent.click(screen.getByRole("button", { name: "Crear recordatorio" }));
    expect(await screen.findByText("Guardando seguimiento…")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Crear recordatorio" })).toBeDisabled();
    await act(async () => {
        finish();
        await Promise.resolve();
    });
    expect(saveNoteReminder).toHaveBeenCalledWith(id, expect.objectContaining({ remindAt: new Date("2026-11-01T09:30").toISOString() }));
});

it("keeps a reply-only server search match and passes module filters to the server", async () => {
    render(<NotesInbox kind="assigned" status="open" query="reply-only term" refreshVersion={0} onOpenNote={() => {}} />);
    expect((await screen.findAllByText("Plan")).length).toBeGreaterThan(0);
    expect(getNoteInbox).toHaveBeenCalledWith("assigned", "open", 1, expect.objectContaining({ search: "reply-only term" }));
    fireEvent.change(screen.getByLabelText(/Filtrar notas por m/), { target: { value: "formalizacion" } });
    await waitFor(() => {
        expect(getNoteInbox).toHaveBeenLastCalledWith("assigned", "open", 1, expect.objectContaining({ search: "reply-only term", moduleCode: "formalizacion" }));
    });
});
it("submits a fresh task with expectedVersion zero", async () => {
    vi.mocked(getNoteWorkflow).mockResolvedValue({ schemaVersion: 1, version: 0, assignee: null, dueAt: null, reminder: null, canManage: true });
    await panel();
    fireEvent.click(screen.getByRole("button", { name: "Guardar responsable y vencimiento" }));
    await waitFor(() => {
        expect(saveNoteTask).toHaveBeenCalledWith(id, expect.objectContaining({ expectedVersion: 0 }));
    });
});

it.each([
    ["2026-10-29T12:00:00", "2026-10-01T00:00", "2026-10-31T23:59"],
    ["2028-02-14T12:00:00", "2028-02-01T00:00", "2028-02-29T23:59"],
    ["2027-02-14T12:00:00", "2027-02-01T00:00", "2027-02-28T23:59"],
    ["2026-12-31T23:30:00", "2026-12-01T00:00", "2026-12-31T23:59"],
])("starts in the local current month at %s including its final minute", async (now, from, to) => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(now));
    try {
        render(<NotesInbox kind="all" status="all" query="" refreshVersion={0} onOpenNote={() => {}} />);
        await screen.findByLabelText("Filtrar notas por autor");
        fireEvent.click(screen.getByText("Fecha de creación"));
        expect(screen.getByLabelText("Creada desde (hora local)")).toHaveValue(from);
        expect(screen.getByLabelText("Creada hasta (hora local)")).toHaveValue(to);
        const end = new Date(to);
        end.setSeconds(59, 999);
        expect(getNoteInbox).toHaveBeenLastCalledWith("all", "all", 1, { search: "", createdFrom: new Date(from).toISOString(), createdTo: end.toISOString() });
    } finally {
        vi.useRealTimers();
    }
});
it("selects any authorized author independently of the inbox page", async () => {
    render(<NotesInbox kind="all" status="all" query="" refreshVersion={0} onOpenNote={() => {}} />);
    await screen.findByRole("option", { name: "Autor de otra página" });
    fireEvent.change(screen.getByLabelText("Filtrar notas por autor"), { target: { value: guest } });
    await waitFor(() => {
        expect(getNoteInbox).toHaveBeenLastCalledWith("all", "all", 1, expect.objectContaining({ search: "", authorUserId: guest }));
    });
});
it("queries all order sources without exposing storage filters and preserves UTC date bounds", async () => {
    render(<NotesInbox kind="all" status="all" query="" refreshVersion={0} onOpenNote={() => {}} />);
    await screen.findByLabelText("Filtrar notas por autor");
    expect(screen.queryByLabelText("Origen de orden")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Filtrar por ID de orden")).not.toBeInTheDocument();
    expect(getNoteInbox).toHaveBeenLastCalledWith("all", "all", 1, expect.objectContaining({ search: "" }));
    fireEvent.click(screen.getByText("Fecha de creación"));
    fireEvent.change(screen.getByLabelText("Creada desde (hora local)"), { target: { value: "2026-10-01T09:30" } });
    fireEvent.change(screen.getByLabelText("Creada hasta (hora local)"), { target: { value: "2026-10-28T10:00" } });
    fireEvent.click(screen.getByRole("button", { name: "Aplicar fechas" }));
    await waitFor(() => {
        expect(getNoteInbox).toHaveBeenLastCalledWith("all", "all", 1, { search: "", createdFrom: new Date("2026-10-01T09:30").toISOString(), createdTo: new Date("2026-10-28T10:00:59.999").toISOString() });
    });
    fireEvent.click(screen.getByRole("button", { name: "Limpiar fechas" }));
    await waitFor(() => {
        expect(getNoteInbox).toHaveBeenLastCalledWith("all", "all", 1, { search: "" });
    });
});

it("prepares tomorrow's personal reminder without sending a write until confirmation", async () => {
    await panel();
    fireEvent.click(screen.getByRole("button", { name: "Mañana a esta hora" }));
    const input = screen.getByLabelText<HTMLInputElement>("Avisarme (hora local)");
    expect(new Date(input.value).getTime()).toBeGreaterThan(Date.now() + 23 * 3600000);
    expect(saveNoteReminder).not.toHaveBeenCalled();
});

async function remoteSnapshot(noteId?: string) {
    const listener = [...vi.mocked(useNotesRealtime).mock.calls].reverse().find((call) => call[0] === "snapshot")?.[1];
    if (!listener) throw new Error("Missing workflow snapshot listener");
    await act(async () => {
        await listener(noteId ? { schemaVersion: 1, eventId: id, kind: "note.changed", occurredAt: "2026-10-28T12:00:00Z", noteId } : null);
    });
}
it("refreshes workflow, authorized locations after another session changes this note", async () => {
    await panel();
    vi.mocked(getNoteWorkflow).mockResolvedValue({ schemaVersion: 1, version: 4, assignee: { publicId: guest, displayName: "Participante" }, dueAt: null, reminder: null, canManage: true });
    const home = { moduleCode: "formalizacion" as const, code: "formalization-home" };
    vi.mocked(getNoteLocations).mockResolvedValue({ schemaVersion: 1, version: 3, locations: [home], availableLocations: [home], canManage: true });
    await remoteSnapshot(guest);
    expect(getNoteWorkflow).toHaveBeenCalledTimes(1);
    await remoteSnapshot(id);
    await waitFor(() => {
        expect(screen.getByLabelText("Responsable")).toHaveValue(guest);
    });
    expect(screen.getByLabelText("Formalización")).toBeChecked();
});
it("retains a dirty reminder draft across reconnect and reloads only after explicit discard", async () => {
    await panel();
    fireEvent.change(screen.getByLabelText("Avisarme (hora local)"), { target: { value: "2026-11-04T09:30" } });
    await remoteSnapshot();
    expect(getNoteWorkflow).toHaveBeenCalledTimes(1);
    expect(screen.getByLabelText("Avisarme (hora local)")).toHaveValue("2026-11-04T09:30");
    fireEvent.click(screen.getByRole("button", { name: "Recargar seguimiento y descartar cambios" }));
    await waitFor(() => {
        expect(screen.getByLabelText("Avisarme (hora local)")).toHaveValue("");
    });
    expect(getNoteWorkflow).toHaveBeenCalledTimes(2);
});
it("blocks remote discard during an uncertain save and retries the original operation", async () => {
    vi.mocked(saveNoteTask).mockRejectedValueOnce(new TypeError("Lost response"));
    await panel();
    fireEvent.change(screen.getByLabelText("Responsable"), { target: { value: guest } });
    fireEvent.click(screen.getByRole("button", { name: "Guardar responsable y vencimiento" }));
    await screen.findByRole("button", { name: "Reintentar el mismo seguimiento" });
    await remoteSnapshot();
    expect(screen.getByRole("button", { name: "Recargar seguimiento y descartar cambios" })).toBeDisabled();
    expect(getNoteWorkflow).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: "Reintentar el mismo seguimiento" }));
    await waitFor(() => {
        expect(saveNoteTask).toHaveBeenCalledTimes(2);
    });
    expect(vi.mocked(saveNoteTask).mock.calls[0]).toEqual(vi.mocked(saveNoteTask).mock.calls[1]);
});
