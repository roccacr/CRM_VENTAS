import "@testing-library/jest-dom/vitest";

import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";

import { OnlineUsers } from "../../src/modules/home/OnlineUsers";
import { apiRequest } from "../../src/services/api/api-client";
import { installBrowserApiDoubles } from "../support/browser";

vi.mock("../../src/services/api/api-client", () => ({ apiRequest: vi.fn() }));
afterEach(() => {
    cleanup();
    vi.clearAllMocks();
    vi.restoreAllMocks();
    vi.useRealTimers();
});

it("hides the directory from non-Owners while allowing their presence signal", () => {
    vi.mocked(apiRequest).mockResolvedValue({ ok: true });
    render(<OnlineUsers roles={[{ code: "formalizacion", name: "Formalización", status: "active" }]} />);
    expect(screen.queryByRole("button", { name: "Personas en línea" })).not.toBeInTheDocument();
    expect(apiRequest).toHaveBeenCalledWith("/identity/presence/heartbeat", expect.objectContaining({ method: "POST" }));
    expect(vi.mocked(apiRequest).mock.calls.some(([path]) => path === "/identity/presence")).toBe(false);
});

it("stops reporting hidden or idle browsers and cancels pending work on unmount", async () => {
    vi.useFakeTimers();
    const visibility = vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible");
    vi.mocked(apiRequest).mockResolvedValue({ ok: true });
    const view = render(<OnlineUsers />);
    await act(() => Promise.resolve());
    visibility.mockReturnValue("hidden");
    await act(async () => {
        await vi.advanceTimersByTimeAsync(60000);
    });
    expect(apiRequest).toHaveBeenCalledTimes(1);
    visibility.mockReturnValue("visible");
    fireEvent(document, new Event("visibilitychange"));
    await act(() => Promise.resolve());
    await act(async () => {
        await vi.advanceTimersByTimeAsync(300000);
    });
    const count = vi.mocked(apiRequest).mock.calls.length;
    await act(async () => {
        await vi.advanceTimersByTimeAsync(90000);
    });
    expect(apiRequest).toHaveBeenCalledTimes(count);
    const signal = vi.mocked(apiRequest).mock.calls[0]?.[1]?.signal;
    view.unmount();
    expect(signal?.aborted).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
});

it("hides the button for inactive Owner and clears users when the server rejects access", async () => {
    installBrowserApiDoubles();
    vi.mocked(apiRequest).mockImplementation((path) => (path.endsWith("heartbeat") ? Promise.resolve({ ok: true }) : Promise.reject(new Error("Forbidden"))));
    const view = render(<OnlineUsers roles={[{ code: "owner", name: "Owner", status: "inactive" }]} />);
    expect(screen.queryByRole("button", { name: "Personas en línea" })).not.toBeInTheDocument();
    view.rerender(<OnlineUsers roles={[{ code: "owner", name: "Owner", status: "active" }]} />);
    fireEvent.click(screen.getByRole("button", { name: "Personas en línea" }));
    expect(await screen.findByText("No fue posible consultar las personas en línea. Reintentaremos automáticamente.")).toBeInTheDocument();
    expect(screen.queryByRole("list", { name: "Usuarios conectados" })).not.toBeInTheDocument();
});

it("lets an active Owner open the directory without exposing emails or sessions", async () => {
    installBrowserApiDoubles();
    vi.mocked(apiRequest).mockImplementation((path) => Promise.resolve(path.endsWith("heartbeat") ? { ok: true } : { users: [{ publicId: "u1", displayName: "Usuario prueba" }], observedAt: "2026-11-11T12:00:00Z" }));
    render(<OnlineUsers roles={[{ code: "owner", name: "Owner", status: "active" }]} />);
    expect(await screen.findByLabelText("1 persona en línea", { selector: "span" })).toHaveTextContent("1");
    fireEvent.click(screen.getByRole("button", { name: "Personas en línea" }));
    expect(await screen.findByText("Usuario prueba")).toBeInTheDocument();
    expect(screen.getByText("1 persona en línea")).toBeInTheDocument();
    expect(screen.getByRole("dialog").closest(".ant-drawer")).toHaveStyle({ zIndex: "1300" });
});

it("updates the icon count while the drawer stays closed", async () => {
    vi.useFakeTimers();
    vi.mocked(apiRequest).mockImplementation((path) => Promise.resolve(path.endsWith("heartbeat") ? { ok: true } : { users: [], observedAt: "2026-11-11T12:00:00Z" }));
    render(<OnlineUsers roles={[{ code: "owner", name: "Owner", status: "active" }]} />);
    await act(() => Promise.resolve());
    expect(screen.getByLabelText("0 personas en línea", { selector: "span" })).toHaveTextContent("0");
    vi.mocked(apiRequest).mockImplementation((path) => Promise.resolve(path.endsWith("heartbeat") ? { ok: true } : { users: [{ publicId: "u1", displayName: "Prueba" }], observedAt: "2026-11-11T12:00:15Z" }));
    await act(async () => {
        await vi.advanceTimersByTimeAsync(15000);
    });
    expect(screen.getByLabelText("1 persona en línea", { selector: "span" })).toHaveTextContent("1");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
});
