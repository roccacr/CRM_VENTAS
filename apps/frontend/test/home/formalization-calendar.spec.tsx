import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";

import { newCalendarEvent, recordCalendarChange } from "../../src/modules/home/formalization-calendar.model";
import { FormalizationCalendarPage } from "../../src/modules/home/FormalizationCalendarPage";
import { getAppRoute } from "../../src/routes/app-routes";
import { installBrowserApiDoubles } from "../support/browser";

afterEach(() => {
    cleanup();
    vi.useRealTimers();
});

it("retains the previous and new calendar details when an event is reprogrammed", () => {
    const previous = { ...newCalendarEvent("2026-10-14"), title: "Seguimiento inicial", orderId: "DEMO-OV-103" };
    const updated = recordCalendarChange({ ...previous, title: "Revisión del banco", date: "2026-10-16", owner: "Gestor de ejemplo 2" }, previous, "14/10/2026");
    const entry = updated.history?.[0];
    if (!entry) throw new Error("Missing event history");
    expect(entry.detail).toContain("Antes: Seguimiento inicial");
    expect(entry.detail).toContain("Después: Revisión del banco");
    expect(entry.detail).toContain("2026-10-16");
    expect(entry.actor).toBe("Usuario de demostración");
});

function openCalendar() {
    installBrowserApiDoubles();
    vi.setSystemTime(new Date("2026-10-14T12:00:00"));
    render(<FormalizationCalendarPage />);
}

function submitEvent() {
    const form = screen.getByRole("dialog").querySelector("form");
    if (!form) throw new Error("Missing event form");
    fireEvent.submit(form);
}

it("registers the calendar as its own Formalization route", () => {
    expect(getAppRoute("/home/formalization/calendar")?.menuItemCode).toBe("formalization-calendar");
});

it("creates an order-linked meeting locally and presents it in the day agenda", () => {
    openCalendar();
    fireEvent.click(screen.getByRole("button", { name: "Nuevo evento" }));
    fireEvent.change(screen.getByLabelText("Título *"), { target: { value: "Revisar firma con cliente" } });
    fireEvent.change(screen.getByLabelText("Orden de venta *"), { target: { value: "DEMO-OV-102" } });
    submitEvent();
    const agenda = screen.getByRole("region", { name: "Agenda del día" });
    expect(within(agenda).getByRole("button", { name: /Revisar firma con cliente/ })).toBeTruthy();
    expect(within(agenda).getByRole("button", { name: /Revisar firma con cliente.*DEMO-OV-102/ })).toBeTruthy();
});

it("rejects an invalid time range and does not create the event", () => {
    openCalendar();
    fireEvent.click(screen.getByRole("button", { name: "Nuevo evento" }));
    fireEvent.change(screen.getByLabelText("Título *"), { target: { value: "Tarea de ejemplo" } });
    fireEvent.change(screen.getByLabelText("Orden de venta *"), { target: { value: "DEMO-OV-101" } });
    fireEvent.change(screen.getByLabelText("Inicio *"), { target: { value: "15:00" } });
    fireEvent.change(screen.getByLabelText("Fin *"), { target: { value: "14:00" } });
    submitEvent();
    expect(screen.getByRole("alert").textContent).toContain("posterior");
});

it("edits, completes and cancels sample events without persistence", () => {
    openCalendar();
    const agenda = screen.getByRole("region", { name: "Agenda del día" });
    fireEvent.click(within(agenda).getByRole("button", { name: /Seguimiento bancario/ }));
    fireEvent.change(screen.getByLabelText("Estado *"), { target: { value: "completed" } });
    submitEvent();
    expect(within(agenda).getByText("Completado")).toBeTruthy();
    fireEvent.click(within(agenda).getByRole("button", { name: /Seguimiento bancario/ }));
    fireEvent.change(screen.getByLabelText("Estado *"), { target: { value: "cancelled" } });
    submitEvent();
    expect(within(agenda).getByText("Cancelado")).toBeTruthy();
});

it("moves the visible month to a newly scheduled future event", async () => {
    openCalendar();
    fireEvent.click(screen.getByRole("button", { name: "Nuevo evento" }));
    fireEvent.change(screen.getByLabelText("Título *"), { target: { value: "Firma futura" } });
    fireEvent.change(screen.getByLabelText("Orden de venta *"), { target: { value: "DEMO-OV-102" } });
    fireEvent.change(screen.getByLabelText("Fecha *"), { target: { value: "2026-11-20" } });
    submitEvent();
    await waitFor(() => {
        expect(screen.getByRole("heading", { name: /noviembre/i })).toBeTruthy();
    });
    expect(screen.getByRole("region", { name: "Agenda del día" }).textContent).toContain("Firma futura");
});

it("filters events, presents an empty agenda, and opens the associated order", () => {
    openCalendar();
    fireEvent.change(screen.getByLabelText("Filtrar tipo de evento"), { target: { value: "task" } });
    const agenda = screen.getByRole("region", { name: "Agenda del día" });
    expect(within(agenda).queryByRole("button", { name: /Seguimiento bancario/ })).toBeNull();
    fireEvent.change(screen.getByLabelText("Filtrar orden de venta"), { target: { value: "DEMO-OV-103" } });
    expect(within(agenda).getByText("Sin eventos")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Filtrar orden de venta"), { target: { value: "all" } });
    fireEvent.click(within(agenda).getByRole("button", { name: /Revisar contrato firmado/ }));
    fireEvent.click(screen.getByRole("button", { name: "Ver orden de venta" }));
    expect(screen.getByRole("heading", { name: "Orden de venta DEMO-OV-102" })).toBeTruthy();
});
