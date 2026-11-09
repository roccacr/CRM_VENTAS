import "@testing-library/jest-dom/vitest";
import "./marketing-select.helpers";

import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { MarketingHomeDashboard as MarketingHomePage } from "../../src/modules/home/MarketingHomePage";
import type { IdentityUser } from "../../src/services/auth/identity-contracts";

afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
});
const user = { displayName: "Usuario de sesión", email: "session@example.test" } as IdentityUser;

describe("Marketing home pending real data", () => {
    it("distinguishes unavailable data from an explicitly supplied empty result", () => {
        render(<MarketingHomePage currentUser={user} rows={[]} />);
        expect(screen.getByLabelText("Leads: 0")).toBeInTheDocument();
        expect(screen.queryByRole("status")).not.toBeInTheDocument();
    });
    it("keeps the design and session greeting without displaying demonstration entities or figures", () => {
        const request = vi.fn();
        vi.stubGlobal("fetch", request);
        render(<MarketingHomePage currentUser={user} />);
        expect(screen.getByText("Hola, Usuario")).toBeInTheDocument();
        for (const name of ["Leads", "Leads con cita", "Citas completadas", "Leads sin cita · 7 días"]) {
            const card = screen.getByRole("heading", { name }).closest("article") as HTMLElement;
            expect(within(card).getByLabelText(`${name}: —`)).toBeInTheDocument();
            expect(card).not.toHaveTextContent(/▲|▼|\d+\s*%|\d+ de \d+|\d+ pendientes/);
            expect(card.querySelector("svg.marketing-spark")).toBeNull();
        }
        expect(screen.queryByText(/Datos de demostración|ficticios/)).not.toBeInTheDocument();
        expect(screen.queryByText(/Proyecto Norte|Proyecto Parque|Proyecto Centro|Dayan|Marlon|Gabriel|Valeria/)).not.toBeInTheDocument();
        expect(screen.queryByRole("combobox", { name: "Vendedor" })).not.toBeInTheDocument();
        expect(screen.getByRole("combobox", { name: "Proyecto" })).toBeDisabled();
        expect(request).not.toHaveBeenCalled();
    });
    it("keeps every period usable while charts and breakdowns stay empty", () => {
        render(<MarketingHomePage currentUser={user} />);
        for (const period of ["Hoy", "Semana", "Mes", "Año"]) {
            fireEvent.click(screen.getByRole("button", { name: period }));
            expect(screen.getByRole("button", { name: period })).toHaveAttribute("aria-pressed", "true");
            expect(screen.queryByRole("table", { name: /Leads por/ })).not.toBeInTheDocument();
            expect(screen.queryByRole("group", { name: /Gráfico de leads/ })).not.toBeInTheDocument();
            expect(within(screen.getByRole("region", { name: "Leads por proyecto" })).queryAllByRole("article")).toHaveLength(0);
            expect(within(screen.getByRole("region", { name: "Leads por vendedor" })).queryAllByRole("button", { name: /^(?!Qué significa)/ })).toHaveLength(0);
            expect(screen.getByText("Información pendiente para mostrar el gráfico.")).toBeInTheDocument();
        }
    });
});
