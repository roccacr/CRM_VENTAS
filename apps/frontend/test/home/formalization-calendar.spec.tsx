import "@testing-library/jest-dom/vitest";

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeAll, expect, it, vi } from "vitest";

import { FormalizationCalendarPage } from "../../src/modules/home/FormalizationCalendarPage";
import { getAppRoute, isKnownPath } from "../../src/routes/app-routes";
import { apiRequest } from "../../src/services/api/api-client";
import { installBrowserApiDoubles } from "../support/browser";

vi.mock("../../src/services/api/api-client", () => ({ apiRequest: vi.fn() }));
beforeAll(installBrowserApiDoubles);
afterEach(cleanup);
it("keeps the Formalization wrapper and real calendar views without sample data", async () => {
    vi.mocked(apiRequest).mockResolvedValue({ schemaVersion: 1, calendars: [] });
    render(<FormalizationCalendarPage effectivePermissions={[{ code: "formalizacion.calendar.read", effect: "allow" }]} />);
    expect(screen.getByRole("heading", { name: "Calendario", level: 1 })).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "Ruta" }).textContent).toBe("Formalización/Calendario");
    for (const view of ["Mes", "Semana", "Día", "Agenda"]) expect(screen.getByText(view, { selector: "button" })).toBeInTheDocument();
    fireEvent.click(screen.getByText("Agenda", { selector: "button" }));
    expect(await screen.findByText("No hay eventos para mostrar")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Nuevo evento" })).toBeNull();
});
it.each([
    ["formalization", "formalization"],
    ["marketing", "marketing"],
    ["sales", "sales"],
    ["accounting", "accounting"],
])("registers the %s calendar route", (path, workspace) => {
    expect(getAppRoute(`/home/${path}/calendar`)).toMatchObject({ workspaceCode: workspace, menuItemCode: `${workspace}-calendar` });
});
it("resolves origin-calendar navigation with its date and event query", () => {
    const path = "/home/sales/calendar?date=2026-10-28&event=event-1";
    expect(isKnownPath(path)).toBe(true);
    expect(getAppRoute(path)).toBe(getAppRoute("/home/sales/calendar"));
    expect(getAppRoute("/home/not-a-module/calendar?date=2026-10-28")).toBeUndefined();
});
