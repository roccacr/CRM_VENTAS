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
it("allows multiple sellers and projects and removes projects belonging only to a deselected seller", () => {
    render(<MarketingHomeDashboard currentUser={{ publicId: "me", displayName: "Usuario", email: "test@example.test" } as IdentityUser} rows={source} today={today} />);
    const pick = (label: string, name: string) => {
        const control = screen.getByRole("combobox", { name: label });
        fireEvent.mouseDown(control);
        fireEvent.click(screen.getByRole("option", { name }));
        fireEvent.keyDown(control, { key: "Escape" });
    };
    pick("Vendedor", "A");
    pick("Vendedor", "B");
    expect(screen.getByLabelText("Leads: 100")).toBeInTheDocument();
    fireEvent.mouseDown(screen.getByRole("combobox", { name: "Proyecto" }));
    expect(screen.queryByRole("option", { name: "P4" })).not.toBeInTheDocument();
    fireEvent.keyDown(screen.getByRole("combobox", { name: "Proyecto" }), { key: "Escape" });
    pick("Proyecto", "P1");
    pick("Proyecto", "P2");
    expect(screen.getByLabelText("Leads: 60")).toBeInTheDocument();
    expect(within(screen.getByRole("region", { name: "Leads por proyecto" })).getAllByRole("article")).toHaveLength(2);
    const sellerControl = screen.getByRole("combobox", { name: "Vendedor" }).closest(".ant-select") as HTMLElement;
    const tag = Array.from(sellerControl.querySelectorAll(".ant-select-selection-item")).find((node) => node.getAttribute("title") === "A");
    fireEvent.click(tag?.querySelector(".ant-select-selection-item-remove") as HTMLElement);
    expect(screen.getByLabelText("Leads: 30")).toBeInTheDocument();
    const projectControl = screen.getByRole("combobox", { name: "Proyecto" }).closest(".ant-select") as HTMLElement;
    expect(projectControl.querySelector('[title="P1"]')).toBeNull();
    expect(projectControl.querySelector('[title="P2"]')).not.toBeNull();
});

it("adds and removes sellers from the ranking and restores the global total when cleared", () => {
    render(<MarketingHomeDashboard currentUser={{ publicId: "me", displayName: "Usuario", email: "test@example.test" } as IdentityUser} rows={source} today={today} />);
    const ranking = within(screen.getByRole("region", { name: "Leads por vendedor" }));
    fireEvent.click(ranking.getByRole("button", { name: /^A/ }));
    fireEvent.click(ranking.getByRole("button", { name: /^B/ }));
    expect(screen.getByLabelText("Leads: 100")).toBeInTheDocument();
    expect(ranking.getByRole("button", { name: /^A/ })).toHaveAttribute("aria-pressed", "true");
    expect(ranking.getByRole("button", { name: /^B/ })).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(ranking.getByRole("button", { name: /^A/ }));
    expect(screen.getByLabelText("Leads: 70")).toBeInTheDocument();
    fireEvent.click(ranking.getByRole("button", { name: /^B/ }));
    expect(screen.getByLabelText("Leads: 150")).toBeInTheDocument();
});
