import "@testing-library/jest-dom/vitest";

import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { NoteCollaborationDrawer } from "../../src/modules/notes/NoteCollaborationDrawer";
import { NoteNotificationsButton } from "../../src/modules/notes/NoteNotifications";
import { NotesRealtimeContext } from "../../src/modules/notes/useNotesRealtime";
import { ApiClientError } from "../../src/services/api/api-client";
import { addNoteReply, getEligibleNoteUsers, getNoteThread, replaceNoteParticipants, setNoteFollowing, withdrawNoteReply } from "../../src/services/notes/note-collaboration-service";
import { getNoteNotifications, getNoteUnreadCount, markAllNoteNotificationsRead, markNoteNotificationRead } from "../../src/services/notes/note-notifications-service";
import { createNotesRealtime } from "../../src/services/notes/notes-realtime";
import type * as NotesService from "../../src/services/notes/notes-service";
import { editNote, setNoteState } from "../../src/services/notes/notes-service";
vi.mock("../../src/services/notes/notes-service", async (importOriginal) => ({ ...(await importOriginal<typeof NotesService>()), editNote: vi.fn(), setNoteState: vi.fn() }));
vi.mock("../../src/services/notes/note-collaboration-service", () => ({ getNoteThread: vi.fn(), getEligibleNoteUsers: vi.fn(), replaceNoteParticipants: vi.fn(), replaceNoteMentions: vi.fn(), addNoteReply: vi.fn(), editNoteReply: vi.fn(), withdrawNoteReply: vi.fn(), setNoteFollowing: vi.fn() }));
vi.mock("../../src/services/notes/note-notifications-service", () => ({ getNoteNotifications: vi.fn(), getNoteUnreadCount: vi.fn(), markNoteNotificationRead: vi.fn(), markAllNoteNotificationsRead: vi.fn() }));
const id = "01K00000000000000000000000",
    owner = "01K00000000000000000000001",
    guest = "01K00000000000000000000002";
const thread = {
    schemaVersion: 1 as const,
    note: {
        id,
        moduleCode: "formalizacion" as const,
        context: { kind: "personal" as const },
        title: "Documentos pendientes",
        content: { format: "plain_text" as const, text: "Revisar documentos" },
        color: "#FFFF88",
        priority: "normal" as const,
        status: "open" as const,
        visibility: "shared",
        version: 1,
        createdAt: "2026-10-27T12:00:00Z",
        updatedAt: "2026-10-27T12:00:00Z",
        author: { publicId: owner, displayName: "Roberto" },
        myPlacements: [],
        capabilities: { canEdit: true, canComplete: true, canReopen: false, canArchive: true, canMove: true, canShare: true, canReply: true, canMention: true },
    },
    collaborationVersion: 1,
    participants: [{ userId: guest, displayName: "Ana", access: "reply" as const }],
    mentions: [],
    replies: [{ id: "01K00000000000000000000003", author: { publicId: guest, displayName: "Ana" }, text: "Lo reviso hoy", version: 1, createdAt: "2026-10-27T13:00:00Z", updatedAt: "2026-10-27T13:00:00Z", withdrawn: false, mentionUserIds: [], canEdit: false, canWithdraw: false }],
    replyPage: { number: 1, size: 30, total: 1 },
    following: true,
};
afterEach(cleanup);
beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(window, "matchMedia", { configurable: true, value: vi.fn().mockReturnValue({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }) });
    vi.mocked(getNoteThread).mockResolvedValue(structuredClone(thread));
    vi.mocked(getEligibleNoteUsers).mockResolvedValue({ items: [{ publicId: guest, displayName: "Ana" }] });
    vi.mocked(replaceNoteParticipants).mockResolvedValue({ noteId: id, version: 1, collaborationVersion: 2, replayed: false });
    vi.mocked(addNoteReply).mockResolvedValue({ noteId: id, version: 1, collaborationVersion: 2, replayed: false, replyId: "01K00000000000000000000004", replyVersion: 1 });
    vi.mocked(getNoteUnreadCount).mockResolvedValue({ count: 1, countIsLowerBound: false });
    vi.mocked(getNoteNotifications).mockResolvedValue({ schemaVersion: 1, items: [{ id: "01K00000000000000000000005", kind: "shared", actor: { publicId: owner, displayName: "Roberto" }, noteId: id, note: { title: "Plan de seguimiento", excerpt: "" }, replyExcerpt: null, moduleCode: "formalizacion", createdAt: "2026-10-27T12:00:00Z", readAt: null }], page: { number: 1, size: 25, total: 1 }, unreadCount: 1, observedAt: "2026-10-27T14:00:00Z" });
    vi.mocked(markNoteNotificationRead).mockResolvedValue(undefined);
});
function drawer() {
    return render(<NoteCollaborationDrawer noteId={id} open onClose={() => {}} onChanged={() => {}} />);
}
it("hides a read notice immediately and keeps filters usable while its request is pending", async () => {
    let finish!: () => void;
    vi.mocked(markNoteNotificationRead).mockReturnValueOnce(
        new Promise((resolve) => {
            finish = resolve;
        }),
    );
    render(<NoteNotificationsButton onOpenNote={() => {}} />);
    await waitFor(() => {
        expect(screen.getByRole("button", { name: "Notificaciones" })).toHaveAttribute("title", "Notificaciones · 1 sin leer");
    });
    fireEvent.click(screen.getByRole("button", { name: "Notificaciones" }));
    fireEvent.click(await screen.findByRole("button", { name: "Marcar como leído" }));
    expect(screen.queryByRole("button", { name: "Marcar como leído" })).not.toBeInTheDocument();
    expect(screen.getByLabelText("Filtrar notificaciones")).toBeEnabled();
    expect(screen.getByRole("button", { name: "Notificaciones" })).toHaveAttribute("title", "Notificaciones · 0 sin leer");
    vi.mocked(getNoteNotifications).mockResolvedValue({ schemaVersion: 1, items: [], page: { number: 1, size: 25, total: 0 }, unreadCount: 0, observedAt: "2026-10-27T14:00:01Z" });
    await act(async () => {
        finish();
        await Promise.resolve();
    });
});
it("restores an optimistically read notice when its request fails", async () => {
    let fail!: (error: Error) => void;
    vi.mocked(markNoteNotificationRead).mockReturnValueOnce(
        new Promise((_, reject) => {
            fail = reject;
        }),
    );
    render(<NoteNotificationsButton onOpenNote={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: "Notificaciones" }));
    fireEvent.click(await screen.findByRole("button", { name: "Marcar como leído" }));
    expect(screen.queryByRole("button", { name: "Marcar como leído" })).not.toBeInTheDocument();
    await act(async () => {
        fail(new ApiClientError("Unavailable", 503, null));
        await Promise.resolve();
    });
    expect(await screen.findByRole("button", { name: "Marcar como leído" })).toBeEnabled();
    expect(screen.getByRole("alert")).toHaveTextContent(/confirmar|marcar/);
});
it("marks all notices optimistically using the observed cutoff without locking navigation", async () => {
    let finish!: () => void;
    vi.mocked(markAllNoteNotificationsRead).mockReturnValueOnce(
        new Promise((resolve) => {
            finish = resolve;
        }),
    );
    render(<NoteNotificationsButton onOpenNote={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: "Notificaciones" }));
    await screen.findByRole("button", { name: "Marcar como leído" });
    fireEvent.click(screen.getByRole("button", { name: "Marcar todas como leídas" }));
    expect(screen.queryByRole("button", { name: "Marcar como leído" })).not.toBeInTheDocument();
    expect(screen.getByLabelText("Filtrar notificaciones")).toBeEnabled();
    expect(markAllNoteNotificationsRead).toHaveBeenCalledWith("2026-10-27T14:00:00Z");
    vi.mocked(getNoteNotifications).mockResolvedValue({ schemaVersion: 1, items: [], page: { number: 1, size: 25, total: 0 }, unreadCount: 0, observedAt: "2026-10-27T14:00:01Z" });
    await act(async () => {
        finish();
        await Promise.resolve();
    });
});
it("shows the conversation without granting the note owner editing of other comments", async () => {
    drawer();
    expect(await screen.findByText("Lo reviso hoy")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Editar comentario de Ana/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Retirar comentario de Ana/ })).not.toBeInTheDocument();
});
it("leaves notifications arriving after a pending read-all cutoff unread", async () => {
    let finish!: () => void;
    vi.mocked(markAllNoteNotificationsRead).mockReturnValueOnce(
        new Promise((resolve) => {
            finish = resolve;
        }),
    );
    render(<NoteNotificationsButton onOpenNote={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: "Notificaciones" }));
    await screen.findByRole("button", { name: "Marcar como leído" });
    const initialRequest = vi.mocked(getNoteNotifications).getMockImplementation();
    if (!initialRequest) throw new Error("Missing initial notification request");
    const snapshot = await initialRequest();
    const initial = snapshot.items[0];
    if (!initial) throw new Error("Missing initial notification snapshot");
    fireEvent.click(screen.getByRole("button", { name: "Marcar todas como leídas" }));
    const later = { ...initial, id: "01K00000000000000000000006", note: { title: "Aviso posterior", excerpt: "" }, createdAt: "2026-10-27T14:00:01Z" };
    vi.mocked(getNoteNotifications).mockResolvedValue({ ...snapshot, items: [initial, later], unreadCount: 2, page: { ...snapshot.page, total: 2 }, observedAt: "2026-10-27T14:00:02Z" });
    fireEvent.change(screen.getByLabelText("Filtrar notificaciones"), { target: { value: "all" } });
    await screen.findByText("«Aviso posterior»");
    expect(screen.getAllByRole("button", { name: "Marcar como leído" })).toHaveLength(1);
    vi.mocked(getNoteNotifications).mockResolvedValue({ ...snapshot, items: [{ ...initial, readAt: "2026-10-27T14:00:02Z" }, later], unreadCount: 1, page: { ...snapshot.page, total: 2 }, observedAt: "2026-10-27T14:00:03Z" });
    await act(async () => {
        finish();
        await Promise.resolve();
    });
});
it("silences a conversation immediately without locking its composer", async () => {
    let finish!: (result: Awaited<ReturnType<typeof setNoteFollowing>>) => void;
    vi.mocked(setNoteFollowing).mockReturnValueOnce(
        new Promise((resolve) => {
            finish = resolve;
        }),
    );
    drawer();
    fireEvent.click(await screen.findByRole("button", { name: "Silenciar respuestas" }));
    expect(screen.getByRole("button", { name: "Seguir respuestas" })).toBeInTheDocument();
    expect(screen.getByLabelText("Texto del comentario")).toBeEnabled();
    expect(screen.queryByText("Guardando…")).not.toBeInTheDocument();
    vi.mocked(getNoteThread).mockResolvedValue({ ...structuredClone(thread), following: false });
    await act(async () => {
        finish({ noteId: id, version: 1, collaborationVersion: 2, replayed: false });
        await Promise.resolve();
    });
});
it("completes a note optimistically while leaving unrelated thread actions available", async () => {
    let finish!: (result: NotesService.NoteCommandResult) => void;
    vi.mocked(setNoteState).mockReturnValueOnce(
        new Promise((resolve) => {
            finish = resolve;
        }),
    );
    drawer();
    fireEvent.click(await screen.findByRole("button", { name: "Completar nota" }));
    expect(screen.getByRole("button", { name: "Reabrir nota" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Silenciar respuestas" })).toBeEnabled();
    expect(screen.queryByText("Guardando…")).not.toBeInTheDocument();
    vi.mocked(getNoteThread).mockResolvedValue({ ...structuredClone(thread), note: { ...thread.note, status: "completed", version: 2, capabilities: { ...thread.note.capabilities, canComplete: false, canReopen: true, canReply: false, canEdit: false } } });
    await act(async () => {
        finish({ noteId: id, version: 2, replayed: false });
        await Promise.resolve();
    });
});
it("rolls a failed background toggle back and retries the same operation without locking the composer", async () => {
    vi.mocked(setNoteFollowing)
        .mockRejectedValueOnce(new ApiClientError("Unavailable", 503, null))
        .mockResolvedValueOnce({ noteId: id, version: 1, collaborationVersion: 2, replayed: true });
    drawer();
    fireEvent.click(await screen.findByRole("button", { name: "Silenciar respuestas" }));
    const retry = await screen.findByRole("button", { name: "Reintentar: Silenciar respuestas" });
    expect(screen.getByRole("button", { name: "Silenciar respuestas" })).toBeInTheDocument();
    expect(screen.getByLabelText("Texto del comentario")).toBeEnabled();
    vi.mocked(getNoteThread).mockResolvedValue({ ...structuredClone(thread), following: false });
    fireEvent.click(retry);
    await waitFor(() => {
        expect(setNoteFollowing).toHaveBeenCalledTimes(2);
    });
    expect(vi.mocked(setNoteFollowing).mock.calls[1]).toEqual(vi.mocked(setNoteFollowing).mock.calls[0]);
});
it("withdraws the visible text immediately while the request runs in the background", async () => {
    let finish!: (result: Awaited<ReturnType<typeof withdrawNoteReply>>) => void;
    const own = { ...thread.replies[0], id: "01K00000000000000000000003", author: { publicId: owner, displayName: "Roberto" }, text: "Comentario propio", version: 1, createdAt: "2026-10-27T13:00:00Z", updatedAt: "2026-10-27T13:00:00Z", withdrawn: false, mentionUserIds: [], canEdit: true, canWithdraw: true };
    vi.mocked(getNoteThread).mockResolvedValue({ ...structuredClone(thread), replies: [own] });
    vi.mocked(withdrawNoteReply).mockReturnValueOnce(
        new Promise((resolve) => {
            finish = resolve;
        }),
    );
    drawer();
    fireEvent.click(await screen.findByRole("button", { name: "Retirar comentario de Roberto" }));
    expect(screen.queryByText("Comentario propio")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Texto del comentario")).toBeEnabled();
    vi.mocked(getNoteThread).mockResolvedValue({ ...structuredClone(thread), replies: [{ ...own, text: null, withdrawn: true }] });
    await act(async () => {
        finish({ noteId: id, version: 1, collaborationVersion: 2, replyVersion: 2, replayed: false });
        await Promise.resolve();
    });
});
it("still waits for confirmation when creating a comment", async () => {
    let finish!: (result: Awaited<ReturnType<typeof addNoteReply>>) => void;
    vi.mocked(addNoteReply).mockReturnValueOnce(
        new Promise((resolve) => {
            finish = resolve;
        }),
    );
    drawer();
    fireEvent.change(await screen.findByLabelText("Texto del comentario"), { target: { value: "Crear comentario" } });
    fireEvent.click(screen.getByRole("button", { name: "Enviar comentario" }));
    expect(screen.getByLabelText("Texto del comentario")).toBeDisabled();
    expect(screen.getByText("Guardando…")).toBeInTheDocument();
    await act(async () => {
        finish({ noteId: id, version: 1, collaborationVersion: 2, replayed: false });
        await Promise.resolve();
    });
});
it("posts a reply with a stable operation ID and selected user IDs", async () => {
    drawer();
    fireEvent.change(await screen.findByLabelText("Texto del comentario"), { target: { value: "Gracias, revisar hoy" } });
    fireEvent.click(screen.getByRole("button", { name: "Enviar comentario" }));
    await waitFor(() => {
        expect(vi.mocked(addNoteReply).mock.calls[0]?.[0]).toBe(id);
        expect(vi.mocked(addNoteReply).mock.calls[0]?.[1].text).toBe("Gracias, revisar hoy");
        expect(vi.mocked(addNoteReply).mock.calls[0]?.[1].mentionUserIds).toEqual([]);
        expect(vi.mocked(addNoteReply).mock.calls[0]?.[1].operationId).toEqual(expect.any(String));
    });
});
it("retries an uncertain comment without duplicating the operation", async () => {
    vi.mocked(addNoteReply).mockRejectedValueOnce(new ApiClientError("Lost", 503, null));
    drawer();
    fireEvent.change(await screen.findByLabelText("Texto del comentario"), { target: { value: "Comentario único" } });
    fireEvent.click(screen.getByRole("button", { name: "Enviar comentario" }));
    fireEvent.click(await screen.findByRole("button", { name: "Reintentar el mismo guardado" }));
    await waitFor(() => {
        expect(addNoteReply).toHaveBeenCalledTimes(2);
    });
    expect(vi.mocked(addNoteReply).mock.calls[0]).toEqual(vi.mocked(addNoteReply).mock.calls[1]);
});
it("does not expose collaboration controls to a read-only invited participant", async () => {
    vi.mocked(getNoteThread).mockResolvedValue({ ...structuredClone(thread), note: { ...thread.note, capabilities: { ...thread.note.capabilities, canEdit: false, canShare: false, canReply: false, canMention: false, canComplete: false, canArchive: false } } });
    drawer();
    await screen.findByText("Lo reviso hoy");
    expect(screen.queryByLabelText("Texto del comentario")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Guardar participantes" })).not.toBeInTheDocument();
});
it("clears private content after access is revoked", async () => {
    const rendered = drawer();
    await screen.findByText("Lo reviso hoy");
    vi.mocked(getNoteThread).mockRejectedValue(new ApiClientError("Revoked", 404, null));
    rendered.rerender(<NoteCollaborationDrawer noteId={id} open={false} onClose={() => {}} onChanged={() => {}} />);
    rendered.rerender(<NoteCollaborationDrawer noteId={id} open onClose={() => {}} onChanged={() => {}} />);
    await waitFor(() => {
        expect(screen.queryByText("Revisar documentos")).not.toBeInTheDocument();
    });
});
it("opens the bell without marking all notices read and opens the exact note", async () => {
    const onOpen = vi.fn();
    render(<NoteNotificationsButton onOpenNote={onOpen} />);
    fireEvent.click(screen.getByRole("button", { name: "Notificaciones" }));
    await screen.findByText(/Roberto/);
    expect(markNoteNotificationRead).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: /Abrir nota/ }));
    expect(onOpen).toHaveBeenCalledWith(id);
    await waitFor(() => {
        expect(markNoteNotificationRead).toHaveBeenCalledWith("01K00000000000000000000005");
    });
});

it("allows editing an own existing reply without permission to add a new reply", async () => {
    const data = structuredClone(thread);
    data.note.capabilities.canReply = false;
    const first = data.replies[0];
    if (!first) throw new Error("fixture reply missing");
    first.canEdit = true;
    vi.mocked(getNoteThread).mockResolvedValue(data);
    drawer();
    fireEvent.click(await screen.findByRole("button", { name: "Editar comentario de Ana" }));
    expect(screen.getByLabelText("Texto del comentario")).toHaveValue("Lo reviso hoy");
    expect(screen.getByRole("button", { name: "Guardar comentario" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Enviar comentario" })).not.toBeInTheDocument();
});
it("mentions people with @ inside the comment and sends only the mentions still written in the text", async () => {
    drawer();
    const box = await screen.findByLabelText("Texto del comentario");
    fireEvent.change(box, { target: { value: "Hola @An" } });
    fireEvent.mouseDown(await screen.findByRole("option", { name: "Ana" }));
    expect(box).toHaveValue("Hola @Ana ");
    fireEvent.click(screen.getByRole("button", { name: "Enviar comentario" }));
    await waitFor(() => {
        expect(vi.mocked(addNoteReply).mock.calls[0]?.[1].mentionUserIds).toEqual([guest]);
    });
});
it("takes the mention back when its @Name is deleted from the text", async () => {
    drawer();
    const box = await screen.findByLabelText("Texto del comentario");
    fireEvent.change(box, { target: { value: "@An" } });
    fireEvent.mouseDown(await screen.findByRole("option", { name: "Ana" }));
    fireEvent.change(box, { target: { value: "Sin mención" } });
    fireEvent.click(screen.getByRole("button", { name: "Enviar comentario" }));
    await waitFor(() => {
        expect(vi.mocked(addNoteReply).mock.calls[0]?.[1].mentionUserIds).toEqual([]);
    });
});

it("refreshes remote replies without losing the draft and clears private data immediately on revocation", async () => {
    const handlers = new Map<string, (...args: unknown[]) => void>();
    const socket = { connected: true, on: vi.fn((name: string, fn: (...args: unknown[]) => void) => handlers.set(name, fn)), off: vi.fn(), emit: vi.fn(), disconnect: vi.fn() };
    const realtime = createNotesRealtime(socket);
    const rendered = render(
        <NotesRealtimeContext.Provider value={realtime}>
            <NoteCollaborationDrawer noteId={id} open onClose={() => {}} onChanged={() => {}} />
        </NotesRealtimeContext.Provider>,
    );
    const input = await screen.findByLabelText("Texto del comentario");
    fireEvent.change(input, { target: { value: "Mi borrador sin enviar" } });
    await act(async () => {
        realtime.reconcile();
        await new Promise((resolve) => setTimeout(resolve, 160));
    });
    expect(getNoteThread).toHaveBeenCalledTimes(2);
    expect(screen.getByLabelText("Texto del comentario")).toHaveValue("Mi borrador sin enviar");
    await act(async () => {
        handlers.get("activity")?.({ schemaVersion: 1, eventId: "01K00000000000000000000008", kind: "note.access_revoked", noteId: id, occurredAt: "2026-10-28T10:00:00Z" });
        await Promise.resolve();
    });
    expect(screen.queryByText("Revisar documentos")).not.toBeInTheDocument();
    expect(socket.emit).toHaveBeenCalledWith("unsubscribe", { noteId: id });
    rendered.unmount();
    realtime.dispose();
});
it("shows a restricted link label without a record link when the invited note context is redacted", async () => {
    vi.mocked(getNoteThread).mockResolvedValue({ ...thread, note: { ...thread.note, context: null } });
    drawer();
    await screen.findByText("Vínculo restringido · Sin acceso al registro");
    expect(screen.queryByRole("link", { name: "Abrir orden de venta vinculada" })).not.toBeInTheDocument();
    expect(screen.getByText("Revisar documentos")).toBeInTheDocument();
});

it("preserves participant selections and their base version across a remote membership snapshot", async () => {
    const socket = { connected: false, on: vi.fn(), off: vi.fn(), emit: vi.fn(), disconnect: vi.fn() };
    const realtime = createNotesRealtime(socket);
    render(
        <NotesRealtimeContext.Provider value={realtime}>
            <NoteCollaborationDrawer noteId={id} open onClose={() => {}} onChanged={() => {}} />
        </NotesRealtimeContext.Provider>,
    );
    fireEvent.click(await screen.findByRole("button", { name: "Compartir con personas" }));
    const permission = await screen.findByLabelText("Permiso de Ana");
    await waitFor(() => expect(permission).not.toBeDisabled());
    fireEvent.change(permission, { target: { value: "read" } });
    vi.mocked(getNoteThread).mockResolvedValue({ ...thread, collaborationVersion: 2, participants: [] });
    await act(async () => {
        realtime.reconcile();
        await new Promise((resolve) => setTimeout(resolve, 160));
    });
    expect(screen.getByLabelText("Permiso de Ana")).toHaveValue("read");
    fireEvent.click(screen.getByRole("button", { name: "Guardar participantes" }));
    await waitFor(() => {
        expect(replaceNoteParticipants).toHaveBeenCalledWith(id, expect.objectContaining({ expectedCollaborationVersion: 1, participants: [{ userId: guest, access: "read" }] }));
    });
    realtime.dispose();
});

it("keeps the original content draft version after a remote note update", async () => {
    const realtime = createNotesRealtime({ connected: false, on: vi.fn(), off: vi.fn(), emit: vi.fn(), disconnect: vi.fn() });
    render(
        <NotesRealtimeContext.Provider value={realtime}>
            <NoteCollaborationDrawer noteId={id} open onClose={() => {}} onChanged={() => {}} />
        </NotesRealtimeContext.Provider>,
    );
    fireEvent.click(await screen.findByRole("button", { name: "Editar nota" }));
    fireEvent.change(screen.getByLabelText("Contenido de la nota"), { target: { value: "Mi cambio sin enviar" } });
    vi.mocked(getNoteThread).mockResolvedValue({ ...thread, note: { ...thread.note, version: 2, content: { format: "plain_text", text: "Cambio remoto" } } });
    await act(async () => {
        realtime.reconcile();
        await new Promise((resolve) => setTimeout(resolve, 160));
    });
    vi.mocked(editNote).mockRejectedValue(new ApiClientError("Conflict", 409, null));
    fireEvent.click(screen.getByRole("button", { name: "Guardar contenido" }));
    await waitFor(() => {
        expect(editNote).toHaveBeenCalledWith("formalizacion", id, expect.objectContaining({ text: "Mi cambio sin enviar" }), 1, expect.any(String));
    });
    expect(await screen.findByText(/Otra persona actualizó la nota/)).toBeInTheDocument();
    realtime.dispose();
});
it.each([true, false])("new replies follow only an already-bottom conversation: %s", async (atBottom) => {
    const realtime = createNotesRealtime({ connected: false, on: vi.fn(), off: vi.fn(), emit: vi.fn(), disconnect: vi.fn() });
    const view = render(
        <NotesRealtimeContext.Provider value={realtime}>
            <NoteCollaborationDrawer noteId={id} open onClose={() => {}} onChanged={() => {}} />
        </NotesRealtimeContext.Provider>,
    );
    const input = await screen.findByLabelText("Texto del comentario");
    const body = input.closest<HTMLElement>(".ant-drawer-body");
    if (!body) throw new Error("Missing drawer scroll container");
    let height = 1000;
    Object.defineProperties(body, { scrollHeight: { configurable: true, get: () => height }, clientHeight: { configurable: true, value: 300 } });
    body.scrollTop = atBottom ? 700 : 100;
    fireEvent.scroll(body);
    fireEvent.change(input, { target: { value: "Borrador intacto" } });
    input.focus();
    height = 1200;
    vi.mocked(getNoteThread).mockResolvedValue({
        ...thread,
        collaborationVersion: 2,
        replies: [
            ...thread.replies,
            {
                ...(thread.replies[0] ??
                    (() => {
                        throw new Error("Missing reply fixture");
                    })()),
                id: "01K00000000000000000000009",
                text: "Nueva respuesta remota",
            },
        ],
    });
    await act(async () => {
        realtime.reconcile();
        await new Promise((resolve) => setTimeout(resolve, 160));
    });
    expect(screen.getByLabelText("Texto del comentario")).toHaveValue("Borrador intacto");
    expect(input).toHaveFocus();
    if (atBottom) {
        expect(body.scrollTop).toBe(1200);
        expect(screen.queryByRole("button", { name: "Nuevas respuestas" })).not.toBeInTheDocument();
    } else {
        expect(body.scrollTop).toBe(100);
        const jump = screen.getByRole("button", { name: "Nuevas respuestas" });
        jump.focus();
        expect(jump).toHaveAttribute("type", "button");
        await userEvent.keyboard("{Enter}");
        expect(body.scrollTop).toBe(1200);
    }
    view.unmount();
    realtime.dispose();
});
it("groups repeated note notices and marks only visible unread IDs while the requests remain pending", async () => {
    const first = { id: "01K00000000000000000000005", kind: "shared" as const, actor: { publicId: owner, displayName: "Roberto" }, noteId: id, note: { title: "Plan agrupado", excerpt: "" }, replyExcerpt: null, moduleCode: "formalizacion" as const, createdAt: "2026-10-27T12:00:00Z", readAt: null };
    vi.mocked(getNoteNotifications).mockResolvedValue({ schemaVersion: 1, items: [first, { ...first, id: "01K00000000000000000000006", kind: "reply" }], page: { number: 1, size: 25, total: 2 }, unreadCount: 2, observedAt: "2026-10-27T14:00:00Z" });
    vi.mocked(markNoteNotificationRead).mockReturnValue(new Promise(() => {}));
    render(<NoteNotificationsButton onOpenNote={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: "Notificaciones" }));
    fireEvent.click(await screen.findByText(/Plan agrupado.*2 avisos/));
    expect(screen.getByLabelText("Agrupar avisos de la misma nota")).toBeEnabled();
    fireEvent.click(screen.getByRole("button", { name: "Marcar grupo visible como leído" }));
    expect(markNoteNotificationRead).toHaveBeenCalledTimes(2);
    expect(markNoteNotificationRead).toHaveBeenCalledWith(first.id);
    expect(markNoteNotificationRead).toHaveBeenCalledWith("01K00000000000000000000006");
    expect(markAllNoteNotificationsRead).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Filtrar notificaciones")).toBeEnabled();
});
