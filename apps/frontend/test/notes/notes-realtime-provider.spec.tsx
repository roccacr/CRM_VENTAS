import { act, cleanup, render, waitFor } from "@testing-library/react";
import { StrictMode } from "react";
import { afterEach, expect, it, vi } from "vitest";

import { NotesRealtimeProvider } from "../../src/modules/notes/NotesRealtimeProvider";
import { useNotesRealtime } from "../../src/modules/notes/useNotesRealtime";
const state = vi.hoisted(() => ({ sockets: [] as { disconnect: ReturnType<typeof vi.fn>; connect: ReturnType<typeof vi.fn>; off: ReturnType<typeof vi.fn> }[] }));
vi.mock("socket.io-client", () => ({
    io: vi.fn(() => {
        const socket = { connected: false, on: vi.fn(), off: vi.fn(), emit: vi.fn(), disconnect: vi.fn(), connect: vi.fn() };
        state.sockets.push(socket);
        return socket;
    }),
}));
vi.mock("../../src/services/api/api-client", () => ({ getAuthenticatedCsrfToken: vi.fn(() => Promise.resolve("proof")), subscribeToSessionRefresh: vi.fn(() => vi.fn()) }));
afterEach(() => {
    cleanup();
    state.sockets = [];
});
function Consumer() {
    useNotesRealtime("snapshot", () => {});
    return <span>Notas</span>;
}
it("cleans StrictMode abandoned sockets and disconnects the previous account before mounting another", async () => {
    const view = render(
        <StrictMode>
            <NotesRealtimeProvider key="one">
                <Consumer />
                <Consumer />
            </NotesRealtimeProvider>
        </StrictMode>,
    );
    await waitFor(() => {
        expect(state.sockets.length).toBe(2);
    });
    expect(state.sockets[0]?.disconnect).toHaveBeenCalledOnce();
    expect(state.sockets[0]?.connect).not.toHaveBeenCalled();
    expect(state.sockets[1]?.connect).toHaveBeenCalledOnce();
    expect(state.sockets[1]?.disconnect).not.toHaveBeenCalled();
    act(() => {
        view.rerender(
            <StrictMode>
                <NotesRealtimeProvider key="two">
                    <Consumer />
                </NotesRealtimeProvider>
            </StrictMode>,
        );
    });
    expect(state.sockets[1]?.disconnect).toHaveBeenCalledOnce();
    view.unmount();
    for (const socket of state.sockets) {
        expect(socket.disconnect).toHaveBeenCalledOnce();
        expect(socket.off).toHaveBeenCalledTimes(7);
    }
});
