import "@testing-library/jest-dom/vitest";

import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { NotesButton, NotesTarget, PersonalNotesProvider } from "../../src/modules/notes/PersonalNotes";
import { ApiClientError } from "../../src/services/api/api-client";
import { getNoteInbox } from "../../src/services/notes/note-collaboration-service";
import type * as RelatedApi from "../../src/services/notes/note-related-records-service";
import { getRelatedRecordOptions } from "../../src/services/notes/note-related-records-service";
import type * as NotesApi from "../../src/services/notes/notes-service";
import { createNote, getNotes, saveNotePlacement, setNoteState } from "../../src/services/notes/notes-service";
vi.mock("../../src/services/notes/notes-service", async (importOriginal) => ({
    ...(await importOriginal<typeof NotesApi>()),
    getNotes: vi.fn(),
    createNote: vi.fn(),
    editNote: vi.fn(),
    setNoteState: vi.fn(),
    saveNotePlacement: vi.fn(),
}));
vi.mock("../../src/services/notes/note-collaboration-service", () => ({ getNoteInbox: vi.fn() }));
vi.mock("../../src/services/notes/note-related-records-service", async (original) => ({ ...(await original<typeof RelatedApi>()), getRelatedRecordOptions: vi.fn() }));
afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
});
const permissions = ["read", "create", "edit_own", "resolve_own", "archive_own"].map((action) => ({ code: `formalizacion.notes.${action}`, effect: "allow" as const }));
const note = { id: "01K00000000000000000000000", title: "Llamar al cliente", content: { format: "plain_text" as const, text: "Confirmar documentos" }, color: "#FFFF88", priority: "normal" as const, status: "open" as const, version: 1, createdAt: "2026-10-27T00:00:00Z", updatedAt: "2026-10-27T00:00:00Z", author: { publicId: "user", displayName: "Autor" }, capabilities: { canEdit: true, canComplete: true, canReopen: false, canArchive: true, canMove: true }, myPlacements: [] };
beforeEach(() => {
    vi.clearAllMocks();
    // Placement fixtures below use the tablet layout; never inherit a viewport from another test.
    vi.stubGlobal("innerWidth", 1024);
    vi.stubGlobal("innerHeight", 768);
    vi.stubGlobal("scrollY", 0);
    vi.stubGlobal(
        "ResizeObserver",
        class {
            observe = vi.fn();
            unobserve = vi.fn();
            disconnect = vi.fn();
        },
    );
    Object.defineProperty(window, "matchMedia", { configurable: true, value: vi.fn().mockReturnValue({ matches: false, addListener: vi.fn(), removeListener: vi.fn(), addEventListener: vi.fn(), removeEventListener: vi.fn() }) });
    vi.mocked(getNoteInbox).mockResolvedValue({ schemaVersion: 1, items: [], page: { number: 1, size: 25, total: 0 } });
    vi.mocked(getNotes).mockResolvedValue({ items: [], total: 0 });
    vi.mocked(createNote).mockResolvedValue({ noteId: note.id, version: 1, replayed: false });
    // A failed assertion must not leave a queued once-response for the next layout test.
    vi.mocked(saveNotePlacement).mockReset();
    vi.mocked(saveNotePlacement).mockResolvedValue({ noteId: note.id, version: 1, layoutVersion: 1, replayed: false });
});
function view(children?: React.ReactNode) {
    return render(
        <PersonalNotesProvider moduleCode="formalizacion" permissions={permissions} homeEnabled>
            <NotesButton />
            {children}
        </PersonalNotesProvider>,
    );
}
it("opens a lateral personal editor and creates using the Home context", async () => {
    view();
    fireEvent.click(screen.getByRole("button", { name: "Mis notas" }));
    fireEvent.click(await screen.findByRole("button", { name: "Nueva nota" }));
    fireEvent.change(screen.getByLabelText("Texto de la nota"), { target: { value: "Revisar documentos" } });
    fireEvent.click(screen.getByRole("button", { name: "Guardar nota" }));
    await waitFor(() => {
        expect(createNote).toHaveBeenCalledWith("formalizacion", { kind: "personal" }, expect.objectContaining({ text: "Revisar documentos" }), expect.any(String));
    });
});
it("uses the native order opened in the detail, never a global numeric identity", async () => {
    view(<NotesTarget source="native" id={note.id} label="Orden RDR673" />);
    await waitFor(() => {
        expect(getNotes).toHaveBeenLastCalledWith("formalizacion", { kind: "sales_order", source: "native", id: note.id }, "all", 1);
    });
});
it("shows saving rather than an uncertain-outcome warning while creation is still in flight", async () => {
    let confirm!: (result: NotesApi.NoteCommandResult) => void;
    vi.mocked(createNote).mockReturnValueOnce(
        new Promise((resolve) => {
            confirm = resolve;
        }),
    );
    view();
    fireEvent.click(screen.getByRole("button", { name: "Mis notas" }));
    fireEvent.click(await screen.findByRole("button", { name: "Nueva nota" }));
    fireEvent.change(screen.getByLabelText("Texto de la nota"), { target: { value: "Guardar sin falsa alarma" } });
    fireEvent.click(screen.getByRole("button", { name: "Guardar nota" }));
    expect(screen.getByText("Guardando…")).toBeInTheDocument();
    expect(screen.queryByText("El guardado sigue pendiente de confirmación. Reintenta la misma operación.")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Reintentar el mismo guardado" })).not.toBeInTheDocument();
    await act(async () => {
        confirm({ noteId: note.id, version: 1, replayed: false });
        await Promise.resolve();
    });
    expect(await screen.findByText("Guardado")).toBeInTheDocument();
    expect(createNote).toHaveBeenCalledTimes(1);
});
it("recognizes a legacy order and keeps personal notes available", async () => {
    view(<NotesTarget source="legacy" id="legacy:208" label="Orden de venta 208" />);
    await waitFor(() => {
        expect(screen.getByRole("button", { name: "Mis notas" })).toBeEnabled();
        expect(getNotes).toHaveBeenLastCalledWith("formalizacion", { kind: "sales_order", source: "legacy", id: "208" }, "all", 1);
    });
});

it("shows an existing note, pins it and saves layout without editing content", async () => {
    vi.mocked(getNotes).mockResolvedValue({ items: [note], total: 1 });
    view();
    const pin = await screen.findByRole("button", { name: "Fijar nota Llamar al cliente" });
    fireEvent.click(pin);
    await waitFor(() => {
        expect(saveNotePlacement).toHaveBeenCalledWith("formalizacion", note.id, expect.objectContaining({ anchorMode: "viewport", layoutVersion: 0 }), expect.any(String));
    });
});
it("does not expose the feature or fetch without an effective read permission", () => {
    render(
        <PersonalNotesProvider moduleCode="formalizacion" permissions={[]} homeEnabled>
            <NotesButton />
        </PersonalNotesProvider>,
    );
    expect(screen.queryByRole("button", { name: "Mis notas" })).not.toBeInTheDocument();
    expect(getNotes).not.toHaveBeenCalled();
});
it("retries an unknown create outcome with exactly the same operation and payload", async () => {
    vi.mocked(createNote).mockRejectedValueOnce(new ApiClientError("Unavailable", 503, null));
    view();
    fireEvent.click(screen.getByRole("button", { name: "Mis notas" }));
    fireEvent.click(await screen.findByRole("button", { name: "Nueva nota" }));
    fireEvent.change(screen.getByLabelText("Texto de la nota"), { target: { value: "No duplicar este recordatorio" } });
    fireEvent.click(screen.getByRole("button", { name: "Guardar nota" }));
    fireEvent.click(await screen.findByRole("button", { name: "Reintentar el mismo guardado" }));
    await waitFor(() => {
        expect(createNote).toHaveBeenCalledTimes(2);
    });
    expect(vi.mocked(createNote).mock.calls[0]).toEqual(vi.mocked(createNote).mock.calls[1]);
});
it("supports keyboard resizing and keeps content version separate", async () => {
    vi.mocked(getNotes).mockResolvedValue({ items: [note], total: 1 });
    view();
    fireEvent.keyDown(await screen.findByRole("button", { name: "Cambiar tamaño de nota Llamar al cliente" }), { key: "ArrowRight" });
    await waitFor(() => {
        expect(saveNotePlacement).toHaveBeenCalledWith("formalizacion", note.id, expect.objectContaining({ width: 310, layoutVersion: 0 }), expect.any(String));
    });
});
it("keeps movement interactive and saves only the latest queued position with the acknowledged version", async () => {
    let confirm!: (result: NotesApi.NoteCommandResult) => void;
    vi.mocked(saveNotePlacement)
        .mockReturnValueOnce(
            new Promise((resolve) => {
                confirm = resolve;
            }),
        )
        .mockResolvedValueOnce({ noteId: note.id, version: 1, layoutVersion: 2, replayed: false });
    const placement = { viewportClass: "tablet" as const, anchorMode: "context" as const, x: 40, y: 160, width: 300, height: 230, collapsed: false, hidden: false, layoutVersion: 0 };
    vi.mocked(getNotes).mockResolvedValue({ items: [{ ...note, myPlacements: [placement] }], total: 1 });
    view();
    const move = await screen.findByRole("button", { name: "Mover nota Llamar al cliente" });
    fireEvent.keyDown(move, { key: "ArrowRight" });
    expect(move).toBeEnabled();
    fireEvent.keyDown(move, { key: "ArrowRight" });
    fireEvent.keyDown(move, { key: "ArrowRight" });
    expect(screen.getByRole("article", { name: "Nota: Llamar al cliente" })).toHaveStyle({ left: "70px" });
    expect(saveNotePlacement).toHaveBeenCalledTimes(1);
    await act(async () => {
        confirm({ noteId: note.id, version: 1, layoutVersion: 1, replayed: false });
        await Promise.resolve();
    });
    await waitFor(() => {
        expect(saveNotePlacement).toHaveBeenCalledTimes(2);
    });
    expect(vi.mocked(saveNotePlacement).mock.calls[1]?.[2]).toMatchObject({ x: 70, layoutVersion: 1 });
    expect(screen.getByRole("article", { name: "Nota: Llamar al cliente" })).toHaveStyle({ left: "70px" });
});
it("keeps other notes movable and retries uncertain placement with its original operation", async () => {
    vi.mocked(saveNotePlacement).mockRejectedValueOnce(new ApiClientError("Unavailable", 503, null));
    const other = { ...note, id: "01K00000000000000000000001", title: "Segunda nota" };
    const placement = { viewportClass: "tablet" as const, anchorMode: "context" as const, x: 40, y: 160, width: 300, height: 230, collapsed: false, hidden: false, layoutVersion: 0 };
    vi.mocked(getNotes).mockResolvedValue({ items: [{ ...note, myPlacements: [placement] }, other], total: 2 });
    view();
    fireEvent.keyDown(await screen.findByRole("button", { name: "Mover nota Llamar al cliente" }), { key: "ArrowRight" });
    const retry = await screen.findByRole("button", { name: "Reintentar posición de nota Llamar al cliente" });
    expect(screen.getByRole("button", { name: "Mover nota Llamar al cliente" })).toBeEnabled();
    fireEvent.keyDown(screen.getByRole("button", { name: "Mover nota Llamar al cliente" }), { key: "ArrowRight" });
    expect(saveNotePlacement).toHaveBeenCalledTimes(1);
    const moveOther = screen.getByRole("button", { name: "Mover nota Segunda nota" });
    expect(moveOther).toBeEnabled();
    fireEvent.keyDown(moveOther, { key: "ArrowRight" });
    await waitFor(() => {
        expect(saveNotePlacement).toHaveBeenCalledTimes(2);
    });
    fireEvent.click(retry);
    await waitFor(() => {
        expect(saveNotePlacement).toHaveBeenCalledTimes(4);
    });
    expect(vi.mocked(saveNotePlacement).mock.calls[2]).toEqual(vi.mocked(saveNotePlacement).mock.calls[0]);
    const first = vi.mocked(saveNotePlacement).mock.calls[0];
    if (!first) throw new Error("Missing initial placement request");
    expect(vi.mocked(saveNotePlacement).mock.calls[3]?.[2]).toMatchObject({ x: first[2].x + 10, layoutVersion: 1 });
});
it("completes a sheet in the background without locking the personal note inbox", async () => {
    let finish!: (result: NotesApi.NoteCommandResult) => void;
    vi.mocked(getNotes).mockResolvedValue({ items: [note], total: 1 });
    vi.mocked(setNoteState).mockReturnValueOnce(
        new Promise((resolve) => {
            finish = resolve;
        }),
    );
    view();
    fireEvent.click(screen.getByRole("button", { name: "Mis notas" }));
    fireEvent.click(await screen.findByRole("button", { name: "En esta vista" }));
    fireEvent.click(await screen.findByRole("button", { name: "Completar" }));
    expect(screen.queryByRole("article", { name: "Nota: Llamar al cliente" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Nueva nota" })).toBeEnabled();
    vi.mocked(getNotes).mockResolvedValue({ items: [{ ...note, status: "completed", version: 2 }], total: 1 });
    await act(async () => {
        finish({ noteId: note.id, version: 2, replayed: false });
        await Promise.resolve();
    });
});
it("offers complete and archive directly in the all-notes inbox and names open notes Pendientes", async () => {
    const item = { ...note, moduleCode: "formalizacion" as const, context: { kind: "personal" as const }, capabilities: { ...note.capabilities, canShare: true, canReply: true, canMention: true } };
    vi.mocked(getNoteInbox).mockResolvedValue({ schemaVersion: 1, items: [item], page: { number: 1, size: 25, total: 1 } });
    let finish!: (result: NotesApi.NoteCommandResult) => void;
    vi.mocked(setNoteState).mockReturnValueOnce(
        new Promise((resolve) => {
            finish = resolve;
        }),
    );
    view();
    fireEvent.click(screen.getByRole("button", { name: "Mis notas" }));
    expect(await screen.findByRole("button", { name: "Completar" })).toBeEnabled();
    expect(screen.getByRole("option", { name: "Pendientes" })).toHaveValue("open");
    fireEvent.click(screen.getByRole("button", { name: "Archivar" }));
    expect(screen.getByText("Archivada")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Nueva nota" })).toBeEnabled();
    vi.mocked(getNoteInbox).mockResolvedValue({ schemaVersion: 1, items: [{ ...item, status: "archived", version: 2, capabilities: { ...item.capabilities, canArchive: false, canComplete: false } }], page: { number: 1, size: 25, total: 1 } });
    await act(async () => {
        finish({ noteId: note.id, version: 2, replayed: false });
        await Promise.resolve();
    });
});
it("does not render literal markup as active HTML or give another author an editor", async () => {
    vi.mocked(getNotes).mockResolvedValue({ items: [{ ...note, content: { format: "plain_text", text: "<img src=x onerror=alert(1)>" }, capabilities: { ...note.capabilities, canEdit: false, canComplete: false, canArchive: false } }], total: 1 });
    view();
    fireEvent.click(screen.getByRole("button", { name: "Mis notas" }));
    fireEvent.click(await screen.findByRole("button", { name: "En esta vista" }));
    fireEvent.click(await screen.findByRole("button", { name: /Llamar al cliente<img/ }));
    expect(screen.getByLabelText("Texto de la nota")).toBeDisabled();
    expect(screen.queryByRole("button", { name: "Guardar nota" })).not.toBeInTheDocument();
    expect(document.querySelector(".personal-note img")).toBeNull();
});
it("hides stale Home results when entering another native order", async () => {
    let resolve: ((value: { items: (typeof note)[]; total: number }) => void) | undefined;
    vi.mocked(getNotes).mockImplementationOnce(
        () =>
            new Promise((r) => {
                resolve = r;
            }),
    );
    const first = view();
    first.rerender(
        <PersonalNotesProvider moduleCode="formalizacion" permissions={permissions} homeEnabled>
            <NotesButton />
            <NotesTarget source="native" id={note.id} label="Orden nueva" />
        </PersonalNotesProvider>,
    );
    await waitFor(() => {
        expect(getNotes).toHaveBeenLastCalledWith("formalizacion", { kind: "sales_order", source: "native", id: note.id }, "all", 1);
    });
    resolve?.({ items: [note], total: 1 });
    await waitFor(() => expect(screen.queryByRole("article", { name: "Nota: Llamar al cliente" })).not.toBeInTheDocument());
});
it("keeps an uncertain write retry reachable after closing and reopening Home notes", async () => {
    vi.mocked(createNote).mockRejectedValueOnce(new ApiClientError("Unavailable", 503, null));
    view();
    fireEvent.click(screen.getByRole("button", { name: "Mis notas" }));
    fireEvent.click(await screen.findByRole("button", { name: "Nueva nota" }));
    fireEvent.change(screen.getByLabelText("Texto de la nota"), { target: { value: "Conservar intento pendiente" } });
    fireEvent.click(screen.getByRole("button", { name: "Guardar nota" }));
    await screen.findByRole("button", { name: "Reintentar el mismo guardado" });
    const close = document.querySelector<HTMLButtonElement>(".ant-drawer-close");
    expect(close).not.toBeNull();
    if (close) fireEvent.click(close);
    fireEvent.click(screen.getByRole("button", { name: "Mis notas" }));
    fireEvent.click(await screen.findByRole("button", { name: "Reintentar el mismo guardado" }));
    await waitFor(() => {
        expect(createNote).toHaveBeenCalledTimes(2);
    });
    expect(vi.mocked(createNote).mock.calls[0]).toEqual(vi.mocked(createNote).mock.calls[1]);
});

it("creates a linked legacy note only after explicit opt-in and shows its destination", async () => {
    view(<NotesTarget source="legacy" id="legacy:208" label="Orden de venta 208" />);
    fireEvent.click(screen.getByRole("button", { name: "Mis notas" }));
    fireEvent.click(await screen.findByRole("button", { name: "Nueva nota" }));
    fireEvent.change(screen.getByLabelText("Texto de la nota"), { target: { value: "Revisar esta orden" } });
    fireEvent.click(screen.getByRole("checkbox", { name: /Vincular esta nota a la vista actual/ }));
    expect(screen.getAllByText("Orden de venta 208").length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("button", { name: "Guardar nota" }));
    await waitFor(() => {
        expect(createNote).toHaveBeenCalledWith("formalizacion", { kind: "sales_order", source: "legacy", id: "208" }, expect.any(Object), expect.any(String));
    });
});
it("allows personal creation from a non-Home screen and offers its view as optional context", async () => {
    render(
        <PersonalNotesProvider moduleCode="formalizacion" permissions={permissions} homeEnabled={false} viewCode="formalization-contracts" viewLabel="Contratos">
            <NotesButton />
        </PersonalNotesProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Mis notas" }));
    fireEvent.click(await screen.findByRole("button", { name: "Nueva nota" }));
    fireEvent.change(screen.getByLabelText("Texto de la nota"), { target: { value: "Recordatorio personal" } });
    expect(screen.getByRole("checkbox", { name: /Vincular esta nota a la vista actual/ })).not.toBeChecked();
    fireEvent.click(screen.getByRole("button", { name: "Guardar nota" }));
    await waitFor(() => {
        expect(createNote).toHaveBeenCalledWith("formalizacion", { kind: "personal" }, expect.any(Object), expect.any(String));
    });
});
it("links to a registered view without persisting an arbitrary browser URL", async () => {
    render(
        <PersonalNotesProvider moduleCode="formalizacion" permissions={permissions} homeEnabled={false} viewCode="formalization-contracts" viewLabel="Contratos">
            <NotesButton />
        </PersonalNotesProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Mis notas" }));
    fireEvent.click(await screen.findByRole("button", { name: "Nueva nota" }));
    fireEvent.change(screen.getByLabelText("Texto de la nota"), { target: { value: "Revisar contratos" } });
    fireEvent.click(screen.getByRole("checkbox", { name: /Vincular esta nota a la vista actual/ }));
    fireEvent.click(screen.getByRole("button", { name: "Guardar nota" }));
    await waitFor(() => {
        expect(createNote).toHaveBeenCalledWith("formalizacion", { kind: "view", code: "formalization-contracts" }, expect.any(Object), expect.any(String));
    });
});
it("uses the legacy transaction in the current URL before its detail finishes loading", async () => {
    window.history.replaceState({}, "", "/home/formalization?orderSource=legacy&orderId=208");
    try {
        view();
        await waitFor(() => {
            expect(getNotes).toHaveBeenLastCalledWith("formalizacion", { kind: "sales_order", source: "legacy", id: "208" }, "all", 1);
        });
        fireEvent.click(screen.getByRole("button", { name: "Mis notas" }));
        fireEvent.click(await screen.findByRole("button", { name: "Nueva nota" }));
        expect(screen.getAllByText("Orden de venta 208").length).toBeGreaterThan(0);
    } finally {
        window.history.replaceState({}, "", "/");
    }
});
it("keeps personal notes available when the shell is showing all modules", async () => {
    render(
        <PersonalNotesProvider moduleCode={undefined} permissions={permissions} homeEnabled={false}>
            <NotesButton />
        </PersonalNotesProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Mis notas" }));
    fireEvent.click(await screen.findByRole("button", { name: "Nueva nota" }));
    expect(screen.queryByRole("checkbox", { name: /Vincular esta nota/ })).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Texto de la nota"), { target: { value: "Mi pendiente personal" } });
    fireEvent.click(screen.getByRole("button", { name: "Guardar nota" }));
    await waitFor(() => {
        expect(createNote).toHaveBeenCalledWith("formalizacion", { kind: "personal" }, expect.any(Object), expect.any(String));
    });
});
it("preserves a draft when URL legacy 208 is replaced by its real legacy:208 detail alias", async () => {
    window.history.replaceState({}, "", "/home/formalization?orderSource=legacy&orderId=208");
    try {
        const result = view();
        fireEvent.click(screen.getByRole("button", { name: "Mis notas" }));
        fireEvent.click(await screen.findByRole("button", { name: "Nueva nota" }));
        fireEvent.change(screen.getByLabelText("Texto de la nota"), { target: { value: "Conservar este borrador" } });
        result.rerender(
            <PersonalNotesProvider moduleCode="formalizacion" permissions={permissions} homeEnabled>
                <NotesButton />
                <NotesTarget source="legacy" id="legacy:208" label="Orden de venta RDR208" />
            </PersonalNotesProvider>,
        );
        await waitFor(() => {
            expect(screen.getByLabelText("Texto de la nota")).toHaveValue("Conservar este borrador");
        });
        fireEvent.click(screen.getByRole("checkbox", { name: /Vincular esta nota a la vista actual/ }));
        fireEvent.click(screen.getByRole("button", { name: "Guardar nota" }));
        await waitFor(() => {
            expect(createNote).toHaveBeenCalledWith("formalizacion", { kind: "sales_order", source: "legacy", id: "208" }, expect.objectContaining({ text: "Conservar este borrador" }), expect.any(String));
        });
    } finally {
        window.history.replaceState({}, "", "/");
    }
});

it("opens all authorized inbox notes in every status and shows each inbox option", async () => {
    view();
    fireEvent.click(screen.getByRole("button", { name: "Mis notas" }));
    const all = await screen.findByRole("button", { name: "Todas" });
    expect(all).toHaveAttribute("aria-current", "page");
    expect(screen.getByLabelText("Estado de las notas")).toHaveValue("all");
    for (const name of ["En esta vista", "Creadas por mí", "Compartidas conmigo", "Menciones"]) expect(screen.getByRole("button", { name })).toBeVisible();
    await waitFor(() => {
        expect(getNoteInbox).toHaveBeenCalledWith("all", "all", 1, expect.objectContaining({ search: "" }));
    });
    fireEvent.click(screen.getByRole("button", { name: "Compartidas conmigo" }));
    await waitFor(() => {
        expect(getNoteInbox).toHaveBeenLastCalledWith("shared", "all", 1, expect.objectContaining({ search: "" }));
    });
    expect(screen.queryByLabelText("Notas que quieres ver")).not.toBeInTheDocument();
});

it("recognizes the same source-qualified order from the marketing workspace", async () => {
    window.history.replaceState({}, "", "/home/marketing/orders?orderSource=legacy&orderId=208");
    render(
        <PersonalNotesProvider moduleCode="mercadeo" permissions={[{ code: "mercadeo.notes.read", effect: "allow" }]} homeEnabled={false}>
            <NotesButton />
        </PersonalNotesProvider>,
    );
    await waitFor(() => {
        expect(getNotes).toHaveBeenLastCalledWith("mercadeo", { kind: "sales_order", source: "legacy", id: "208" }, "all", 1);
    });
    window.history.replaceState({}, "", "/");
});

it("saves a shared order note placement using its origin instead of the current workspace", async () => {
    vi.mocked(getNotes).mockResolvedValue({ items: [{ ...note, moduleCode: "mercadeo" }], total: 1 });
    view(<NotesTarget source="legacy" id="208" label="Orden 208" />);
    fireEvent.keyDown(await screen.findByRole("button", { name: "Cambiar tamaño de nota Llamar al cliente" }), { key: "ArrowRight" });
    await waitFor(() => {
        expect(saveNotePlacement).toHaveBeenCalledWith("mercadeo", note.id, expect.objectContaining({ layoutVersion: 0 }), expect.any(String));
    });
});

it("creates a personal note with a client and order without choosing a database", async () => {
    const clientReference = { kind: "lead" as const, source: "legacy" as const, id: "18" };
    const orderReference = { kind: "sales_order" as const, source: "native" as const, id: note.id };
    vi.mocked(getRelatedRecordOptions).mockImplementation((_module, kind) => Promise.resolve({ items: [{ kind, reference: kind === "lead" ? clientReference : orderReference, label: kind === "lead" ? "Ana Pérez" : "OV-123", description: "Proyecto Norte", url: null, restricted: false }], page: { number: 1, size: 25 }, hasMore: false, partial: false }));
    view();
    fireEvent.click(screen.getByRole("button", { name: "Mis notas" }));
    await screen.findByRole("button", { name: "Nueva nota" });
    fireEvent.click(screen.getByRole("button", { name: "Nueva nota" }));
    fireEvent.change(screen.getByLabelText("Texto de la nota"), { target: { value: "Revisar documentos" } });
    fireEvent.click(screen.getByText("Relacionar con cliente u orden (opcional)"));
    fireEvent.mouseDown(await screen.findByRole("combobox", { name: "Buscar cliente/lead" }));
    fireEvent.click(await screen.findByText("Ana Pérez"));
    fireEvent.mouseDown(screen.getByRole("combobox", { name: "Buscar orden de venta" }));
    fireEvent.click(await screen.findByText("OV-123"));
    fireEvent.click(screen.getByRole("button", { name: "Guardar nota" }));
    await waitFor(() => {
        expect(createNote).toHaveBeenCalledWith("formalizacion", { kind: "personal" }, expect.objectContaining({ text: "Revisar documentos" }), expect.any(String), [clientReference, orderReference]);
    });
});
