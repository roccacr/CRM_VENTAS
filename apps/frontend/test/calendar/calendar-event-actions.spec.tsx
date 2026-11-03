import "@testing-library/jest-dom/vitest";

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";

import { CalendarEventActions } from "../../src/modules/calendar/CalendarEventActions";
import { type CalendarEvent, changeCalendarStatus } from "../../src/services/calendar/calendar-service";
vi.mock("../../src/services/calendar/calendar-service", () => ({ changeCalendarStatus: vi.fn() }));
const event = { id: "01ARZ3NDEKTSV4RRFFQ69G5FAV", source: "native", originModule: "formalizacion", title: "Mi evento", status: "scheduled", version: 2, canManageStatus: true } as CalendarEvent;
vi.stubGlobal(
    "ResizeObserver",
    class {
        observe() {}
        unobserve() {}
        disconnect() {}
    },
);
afterEach(() => {
    cleanup();
    vi.mocked(changeCalendarStatus).mockReset();
});
it("hides lifecycle controls from invited users", () => {
    render(<CalendarEventActions event={{ ...event, canManageStatus: false }} />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
});
it("requires a cancellation reason and preserves the operation identity across retries", async () => {
    vi.mocked(changeCalendarStatus)
        .mockRejectedValueOnce(new Error("timeout"))
        .mockResolvedValueOnce({ event: { ...event, status: "cancelled", version: 3 }, delivery: { status: "synced" } });
    const onChanged = vi.fn();
    render(<CalendarEventActions event={event} onChanged={onChanged} />);
    fireEvent.click(screen.getByRole("button", { name: "Cancelar evento" }));
    const buttons = screen.getAllByRole("button", { name: "Cancelar evento" });
    expect(buttons.at(-1)).toBeDisabled();
    fireEvent.change(screen.getByRole("textbox", { name: "Motivo de cancelación" }), { target: { value: "Cambio de agenda" } });
    const confirm = buttons.at(-1);
    if (!confirm) throw new Error("Missing cancellation confirmation");
    fireEvent.click(confirm);
    await screen.findByText(/No se confirmó la operación/);
    fireEvent.click(screen.getByRole("button", { name: /Reintentar/ }));
    await screen.findByText("Estado del evento actualizado");
    expect(changeCalendarStatus).toHaveBeenCalledTimes(2);
    expect(vi.mocked(changeCalendarStatus).mock.calls[0]).toEqual(vi.mocked(changeCalendarStatus).mock.calls[1]);
    expect(vi.mocked(changeCalendarStatus).mock.calls[0]?.[1]).toMatchObject({ action: "cancel", expectedStatus: "scheduled", expectedVersion: 2, reason: "Cambio de agenda" });
    fireEvent.click(screen.getByRole("button", { name: "Volver al calendario" }));
    await waitFor(() => {
        expect(onChanged).toHaveBeenCalledTimes(1);
    });
});
it.each(["completed", "cancelled"] as const)("offers reactivation for %s", (status) => {
    render(<CalendarEventActions event={{ ...event, status }} />);
    expect(screen.getByRole("button", { name: "Reactivar evento" })).toBeEnabled();
    expect(screen.queryByRole("button", { name: "Completar" })).not.toBeInTheDocument();
});
