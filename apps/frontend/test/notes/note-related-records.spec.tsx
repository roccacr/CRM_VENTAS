import "@testing-library/jest-dom/vitest";

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { NoteRelatedRecordsPicker, NoteRelatedRecordsSection, NoteRelatedRecordsSummary } from "../../src/modules/notes/NoteRelatedRecords";
import type * as RelatedApi from "../../src/services/notes/note-related-records-service";
import { getNoteRelatedRecords, getRelatedRecordOptions, type NoteRelatedRecord, saveNoteRelatedRecords } from "../../src/services/notes/note-related-records-service";
vi.mock("../../src/services/notes/useNotesRealtime", () => ({ useNotesRealtime: vi.fn() }));
vi.mock("../../src/services/notes/note-related-records-service", async (original) => ({ ...(await original<typeof RelatedApi>()), getNoteRelatedRecords: vi.fn(), getRelatedRecordOptions: vi.fn(), saveNoteRelatedRecords: vi.fn() }));
const id = "01ARZ3NDEKTSV4RRFFQ69G5FAV";
const lead: NoteRelatedRecord = { kind: "lead", reference: { kind: "lead", source: "legacy", id: "18" }, label: "Ana Pérez", description: "Proyecto Norte", url: null, restricted: false };
const order: NoteRelatedRecord = { kind: "sales_order", reference: { kind: "sales_order", source: "native", id }, label: "OV-123", description: "Proyecto Norte", url: "/home/formalization?orderSource=native&orderId=" + id, restricted: false };
beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal(
        "ResizeObserver",
        class {
            observe = vi.fn();
            unobserve = vi.fn();
            disconnect = vi.fn();
        },
    );
    Object.defineProperty(window, "matchMedia", { configurable: true, value: vi.fn().mockReturnValue({ matches: false, addListener: vi.fn(), removeListener: vi.fn(), addEventListener: vi.fn(), removeEventListener: vi.fn() }) });
    vi.mocked(getRelatedRecordOptions).mockImplementation((_module, kind) => Promise.resolve({ items: [kind === "lead" ? lead : order], page: { number: 1, size: 25 }, hasMore: false, partial: false }));
    vi.mocked(getNoteRelatedRecords).mockResolvedValue({ version: 2, items: [lead], canManage: true });
    vi.mocked(saveNoteRelatedRecords).mockResolvedValue({ noteId: id, version: 1, collaborationVersion: 3, replayed: false });
});
afterEach(cleanup);
it("selects a commercial label without exposing the source or internal ID", async () => {
    const onChange = vi.fn();
    render(<NoteRelatedRecordsPicker moduleCode="formalizacion" selected={[]} onChange={onChange} disabled={false} />);
    const combo = screen.getByRole("combobox", { name: "Buscar cliente/lead" });
    fireEvent.mouseDown(combo);
    fireEvent.click(await screen.findByText("Ana Pérez"));
    expect(onChange).toHaveBeenCalledWith([lead]);
    expect(screen.queryByText(/legacy|native|Nativa|Legacy/)).not.toBeInTheDocument();
});
it("searches remotely inside the dropdown and keeps pagination inside that dropdown", async () => {
    vi.mocked(getRelatedRecordOptions).mockImplementation((_module, kind, _query, page = 1) => Promise.resolve({ items: [kind === "lead" ? lead : order], page: { number: page, size: 25 }, hasMore: page === 1, partial: false }));
    render(<NoteRelatedRecordsPicker moduleCode="formalizacion" selected={[]} onChange={() => {}} disabled={false} />);
    const combo = screen.getByRole("combobox", { name: "Buscar cliente/lead" });
    expect(screen.queryByRole("button", { name: "Cargar más clientes" })).not.toBeInTheDocument();
    fireEvent.mouseDown(combo);
    fireEvent.change(combo, { target: { value: "Ana" } });
    await waitFor(() => {
        expect(getRelatedRecordOptions).toHaveBeenCalledWith("formalizacion", "lead", "Ana", 1);
    });
    const more = await screen.findByRole("button", { name: "Cargar más clientes" });
    expect(more.closest(".ant-select-dropdown")).not.toBeNull();
    fireEvent.click(more);
    await waitFor(() => {
        expect(getRelatedRecordOptions).toHaveBeenCalledWith("formalizacion", "lead", "Ana", 2);
    });
});
it("redacts restricted records and opens only server-authorized links", () => {
    render(<NoteRelatedRecordsSummary records={[order, { kind: "lead", restricted: true, label: null, description: null, url: null }]} />);
    expect(screen.getByText("Cliente vinculado sin acceso")).toBeVisible();
    expect(screen.getByRole("link", { name: "Orden: OV-123" })).toHaveAttribute("href", order.url);
});
it("waits for confirmation and retries the same relation mutation after an uncertain outcome", async () => {
    vi.mocked(saveNoteRelatedRecords).mockRejectedValueOnce(new TypeError("Lost response"));
    render(<NoteRelatedRecordsSection noteId={id} moduleCode="formalizacion" records={[lead]} canEdit onChanged={() => {}} />);
    fireEvent.click(screen.getByText("Gestionar registros relacionados"));
    fireEvent.click(await screen.findByRole("button", { name: "Guardar registros relacionados" }));
    await screen.findByText(/No se confirmó el guardado/);
    const first = vi.mocked(saveNoteRelatedRecords).mock.calls[0];
    fireEvent.click(screen.getByRole("button", { name: "Reintentar el mismo guardado" }));
    await waitFor(() => {
        expect(saveNoteRelatedRecords).toHaveBeenCalledTimes(2);
    });
    expect(vi.mocked(saveNoteRelatedRecords).mock.calls[1]).toEqual(first);
});
it("does not offer a relation editor to invited readers", () => {
    render(<NoteRelatedRecordsSection noteId={id} moduleCode="formalizacion" records={[lead]} canEdit={false} onChanged={() => {}} />);
    expect(screen.queryByText("Gestionar registros relacionados")).not.toBeInTheDocument();
    expect(getNoteRelatedRecords).not.toHaveBeenCalled();
    expect(screen.getByText("Cliente: Ana Pérez")).toBeVisible();
});

it("offers the order's confirmed client without linking it automatically", () => {
    const onChange = vi.fn();
    const selected = [{ ...order, primary: true, relatedLead: { reference: { kind: "lead" as const, source: "legacy" as const, id: "18" }, label: "Ana Pérez", description: "Proyecto Norte" } }];
    render(<NoteRelatedRecordsPicker moduleCode="formalizacion" selected={selected} onChange={onChange} disabled={false} />);
    expect(screen.queryByRole("button", { name: "Quitar OV-123" })).not.toBeInTheDocument();
    expect(screen.getByText("Vínculo original")).toBeVisible();
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Vincular también al cliente Ana Pérez" }));
    expect(onChange).toHaveBeenCalledWith([...selected, lead]);
});

it("keeps Enter inside record search from submitting the surrounding note form", () => {
    render(
        <form>
            <NoteRelatedRecordsPicker moduleCode="formalizacion" selected={[]} onChange={() => {}} disabled={false} />
        </form>,
    );
    expect(fireEvent.keyDown(screen.getByLabelText("Buscar cliente/lead"), { key: "Enter", code: "Enter" })).toBe(false);
});
it("selects an option with the keyboard without submitting the note", async () => {
    const onChange = vi.fn();
    const onSubmit = vi.fn((event: React.SyntheticEvent<HTMLFormElement>) => {
        event.preventDefault();
    });
    const user = userEvent.setup();
    render(
        <form onSubmit={onSubmit}>
            <NoteRelatedRecordsPicker moduleCode="formalizacion" selected={[]} onChange={onChange} disabled={false} />
            <button type="submit">Guardar</button>
        </form>,
    );
    await user.click(screen.getByRole("combobox", { name: "Buscar cliente/lead" }));
    await screen.findByRole("option", { name: /Ana Pérez/ });
    const combo = screen.getByRole("combobox", { name: "Buscar cliente/lead" });
    // rc-select reads KeyboardEvent.which, which user-event's jsdom keyboard leaves at zero.
    fireEvent.keyDown(combo, { key: "ArrowDown", code: "ArrowDown", keyCode: 40, which: 40 });
    expect(fireEvent.keyDown(combo, { key: "Enter", code: "Enter", keyCode: 13, which: 13 })).toBe(false);
    expect(onChange).toHaveBeenCalledWith([lead]);
    expect(onSubmit).not.toHaveBeenCalled();
});

it("explains a management capability revoked while the editor was opening", async () => {
    vi.mocked(getNoteRelatedRecords).mockResolvedValue({ version: 2, items: [lead], canManage: false });
    render(<NoteRelatedRecordsSection noteId={id} moduleCode="formalizacion" records={[lead]} canEdit onChanged={() => {}} />);
    fireEvent.click(screen.getByText("Gestionar registros relacionados"));
    expect(await screen.findByText(/Solo el autor con permiso de edición/)).toBeVisible();
    expect(screen.getByRole("button", { name: "Guardar registros relacionados" })).toBeDisabled();
});
