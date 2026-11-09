import "@testing-library/jest-dom/vitest";

import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";

import { emptyMarketingFilters, type MarketingSampleRow, resolveMarketingView } from "../../src/modules/home/marketing-home-preview.model";
import { MarketingHomeDashboard } from "../../src/modules/home/MarketingHomePage";
import type { IdentityUser } from "../../src/services/auth/identity-contracts";
import { selectedMarketingValues, selectMarketing } from "./marketing-select.helpers";
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
it("allows multiple projects and recalculates totals when a project is removed", async () => {
    render(<MarketingHomeDashboard currentUser={{ publicId: "me", displayName: "Usuario", email: "test@example.test" } as IdentityUser} rows={source} today={today} />);
    expect(screen.queryByRole("combobox", { name: "Vendedor" })).not.toBeInTheDocument();
    await selectMarketing("Proyecto", "P1");
    await selectMarketing("Proyecto", "P2", true);
    expect(await screen.findByLabelText("Leads: 60")).toBeInTheDocument();
    expect(within(screen.getByRole("region", { name: "Leads por proyecto" })).getAllByRole("article")).toHaveLength(2);
    const projectControl = screen.getByRole("combobox", { name: "Proyecto" }).closest(".ant-select") as HTMLElement;
    const remove = projectControl.querySelector('[title="P1"] .ant-select-selection-item-remove');
    expect(remove).not.toBeNull();
    fireEvent.click(remove as HTMLElement);
    expect(await screen.findByLabelText("Leads: 50")).toBeInTheDocument();
    expect(selectedMarketingValues("Proyecto")).toEqual(["P2"]);
});

it("shows seller ranking as read-only and updates it with the project filter", async () => {
    render(<MarketingHomeDashboard currentUser={{ publicId: "me", displayName: "Usuario", email: "test@example.test" } as IdentityUser} rows={source} today={today} />);
    const ranking = within(screen.getByRole("region", { name: "Leads por vendedor" }));
    expect(ranking.getAllByRole("listitem")).toHaveLength(3);
    expect(ranking.queryByRole("button", { name: /^A/ })).not.toBeInTheDocument();
    await selectMarketing("Proyecto", "P2");
    expect(await screen.findByLabelText("Leads: 50")).toBeInTheDocument();
    expect(ranking.getAllByRole("listitem")).toHaveLength(2);
    expect(ranking.queryByText("C", { exact: true })).not.toBeInTheDocument();
    await selectMarketing("Proyecto", "");
    expect(await screen.findByLabelText("Leads: 150")).toBeInTheDocument();
});
