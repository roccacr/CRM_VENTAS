import "@testing-library/jest-dom/vitest";

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import Drawer from "antd/es/drawer";
import { useState } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { NoteParticipantsPicker } from "../../src/modules/notes/NoteParticipantsPicker";
import { getEligibleNoteUsers, getEligibleUsersForNoteDraft, type NoteParticipant } from "../../src/services/notes/note-collaboration-service";
vi.mock("../../src/services/notes/note-collaboration-service", () => ({ getEligibleNoteUsers: vi.fn(), getEligibleUsersForNoteDraft: vi.fn() }));
const ana = "01K00000000000000000000001",
    luis = "01K00000000000000000000002";
afterEach(cleanup);
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
    vi.mocked(getEligibleNoteUsers).mockResolvedValue({
        items: [
            { publicId: ana, displayName: "Ana Vargas" },
            { publicId: luis, displayName: "Luis Mora" },
        ],
    });
    vi.mocked(getEligibleUsersForNoteDraft).mockResolvedValue({
        items: [
            { publicId: ana, displayName: "Ana Vargas" },
            { publicId: luis, displayName: "Luis Mora" },
        ],
    });
});
function Picker() {
    const [value, setValue] = useState<NoteParticipant[]>([]);
    return <NoteParticipantsPicker draft={{ moduleCode: "ventas", context: { kind: "personal" } }} value={value} onChange={setValue} disabled={false} />;
}
it("loads the directory without typing and allows choosing several named people", async () => {
    render(<Picker />);
    await waitFor(() => {
        expect(getEligibleUsersForNoteDraft).toHaveBeenCalledWith("ventas", { kind: "personal" }, "");
    });
    fireEvent.mouseDown(screen.getByRole("combobox", { name: "Personas para invitar" }));
    fireEvent.click(await screen.findByText("Ana Vargas"));
    fireEvent.click(await screen.findByText("Luis Mora"));
    expect(screen.getByLabelText("Permiso de Ana Vargas")).toHaveValue("reply");
    expect(screen.getByLabelText("Permiso de Luis Mora")).toHaveValue("reply");
    fireEvent.click(screen.getByRole("button", { name: "Quitar a Ana Vargas" }));
    expect(screen.queryByLabelText("Permiso de Ana Vargas")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Permiso de Luis Mora")).toBeInTheDocument();
});
it("shows directory failure with an explicit retry instead of an empty user list", async () => {
    vi.mocked(getEligibleUsersForNoteDraft).mockRejectedValueOnce(new Error("offline"));
    render(<Picker />);
    fireEvent.click(await screen.findByRole("button", { name: "Reintentar lista de personas" }));
    await waitFor(() => {
        expect(getEligibleUsersForNoteDraft).toHaveBeenCalledTimes(2);
    });
    await waitFor(() => {
        expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });
});
it("allows selecting inactive and pending accounts by name and explains their delayed access", async () => {
    vi.mocked(getEligibleUsersForNoteDraft).mockResolvedValue({
        items: [
            { publicId: ana, displayName: "Ana Vargas", status: "inactive" },
            { publicId: luis, displayName: "Luis Mora", status: "pending" },
        ],
    });
    render(<Picker />);
    await waitFor(() => {
        expect(screen.getByRole("combobox", { name: "Personas para invitar" })).toBeEnabled();
    });
    fireEvent.mouseDown(screen.getByRole("combobox", { name: "Personas para invitar" }));
    fireEvent.click(await screen.findByText("Ana Vargas · Inactivo"));
    fireEvent.click(await screen.findByText("Luis Mora · Pendiente de activación"));
    expect(screen.getByLabelText("Permiso de Ana Vargas")).toHaveValue("reply");
    expect(screen.getByLabelText("Permiso de Luis Mora")).toHaveValue("reply");
    expect(screen.getByText(/verán la nota y el aviso al activar su cuenta/)).toBeInTheDocument();
});

it.each(["draft", "existing"] as const)("renders the %s directory popup within its drawer rather than behind its mask", async (mode) => {
    render(
        <Drawer open zIndex={1300}>
            {mode === "draft" ? <Picker /> : <NoteParticipantsPicker noteId="01K00000000000000000000000" value={[]} onChange={() => {}} disabled={false} />}
        </Drawer>,
    );
    const combo = screen.getByRole("combobox", { name: "Personas para invitar" });
    await waitFor(() => {
        expect(combo).toBeEnabled();
    });
    fireEvent.mouseDown(combo);
    await screen.findByText("Ana Vargas");
    const popup = document.querySelector(".ant-select-dropdown");
    expect(popup).not.toBeNull();
    expect(popup?.closest(".ant-drawer-body")).not.toBeNull();
});
