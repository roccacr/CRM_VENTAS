import "@testing-library/jest-dom/vitest";
import "./marketing-select.helpers";

import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";

import { emptyMarketingFilters, type MarketingSampleRow, resolveMarketingView } from "../../src/modules/home/marketing-home-preview.model";
import { MarketingHomeDashboard } from "../../src/modules/home/MarketingHomePage";
import type { IdentityUser } from "../../src/services/auth/identity-contracts";
const today = new Date(2026, 9, 23);
const source: MarketingSampleRow[] = [
    ["A", "P1", 10],
    ["A", "P2", 20],
    ["B", "P2", 30],
    ["B", "P3", 40],
    ["C", "P4", 50],
].map(([seller, project, leads]) => ({ seller: String(seller), project: String(project), leads: Number(leads), daysAgo: 0, campaign: "", ad: "", withAppointment: 0, appointments: 0, attended: 0, missed: 0 }));
afterEach(cleanup);
it("unions selected sellers and intersects their selected projects without duplicating shared projects", () => {
    const base = emptyMarketingFilters(today);
    const filters = { ...base, sellers: ["A", "B"], projects: ["P1", "P2"] };
    expect(resolveMarketingView(filters, today, source).rows.reduce((sum, row) => sum + row.leads, 0)).toBe(60);
});
it("allows multiple projects and totals only the selected ones", () => {
    render(<MarketingHomeDashboard currentUser={{ publicId: "me", displayName: "Usuario", email: "test@example.test" } as IdentityUser} rows={source} today={today} />);
    // Sin filtro de vendedor: el alcance lo define la API y el usuario solo filtra por proyecto.
    expect(screen.queryByRole("combobox", { name: "Vendedor" })).not.toBeInTheDocument();
    const pick = (name: string) => {
        const control = screen.getByRole("combobox", { name: "Proyecto" });
        fireEvent.mouseDown(control);
        fireEvent.click(screen.getByRole("option", { name }));
        fireEvent.keyDown(control, { key: "Escape" });
    };
    expect(screen.getByLabelText("Leads: 150")).toBeInTheDocument();
    pick("P1");
    pick("P2");
    expect(screen.getByLabelText("Leads: 60")).toBeInTheDocument();
    expect(within(screen.getByRole("region", { name: "Leads por proyecto" })).getAllByRole("article")).toHaveLength(2);
});

it("keeps the seller ranking read-only and the global total unchanged", () => {
    render(<MarketingHomeDashboard currentUser={{ publicId: "me", displayName: "Usuario", email: "test@example.test" } as IdentityUser} rows={source} today={today} />);
    const ranking = within(screen.getByRole("region", { name: "Leads por vendedor" }));
    expect(ranking.queryAllByRole("button", { name: /^(A|B)/ })).toHaveLength(0);
    expect(screen.getByLabelText("Leads: 150")).toBeInTheDocument();
});
