import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { CalendarEventDrawer } from "../../src/modules/calendar/CalendarEventDrawer";
import { installBrowserApiDoubles } from "../support/browser";
vi.mock("../../src/services/api/api-client", () => ({ apiRequest: vi.fn().mockResolvedValue({ items: [] }) }));
afterEach(cleanup);
it("requires a type before enabling fields and preserves the draft on type changes", () => {
 installBrowserApiDoubles();
 const calendar = { moduleCode: "formalizacion" as const, label: "Formalización", color: "#000000", canCreate: true, canUpdate: true, types: ["tarea", "reunion"].map(id => ({id,code:id,label:id,color:"#000000",formKey:"formalizacion.general.v1"})) };
 render(<CalendarEventDrawer event={null} date="2026-11-03" calendar={calendar} currentModule="formalizacion" onClose={vi.fn()} onSaved={vi.fn()} onRefresh={vi.fn()}/>);
 expect(screen.getByLabelText("Nombre del evento")).toBeDisabled();
 expect(screen.getByRole("button", {name:"Guardar evento"})).toBeDisabled();
 fireEvent.change(screen.getByRole("combobox", {name:"Tipo"}), {target:{value:"tarea"}});
 expect(screen.getByLabelText("Nombre del evento")).toBeEnabled();
 fireEvent.change(screen.getByLabelText("Nombre del evento"), {target:{value:"Firma"}});
 fireEvent.change(screen.getByRole("combobox", {name:"Tipo"}), {target:{value:"reunion"}});
 expect(screen.getByLabelText("Nombre del evento")).toHaveValue("Firma");
});
