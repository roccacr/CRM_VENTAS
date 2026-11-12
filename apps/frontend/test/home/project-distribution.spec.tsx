import "@testing-library/jest-dom/vitest";

import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import ConfigProvider from "antd/es/config-provider";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { FormalizationHomePage } from "../../src/modules/home/FormalizationHomePage";
import { FormalizationProjectDistribution } from "../../src/modules/home/FormalizationProjectDistribution";
import { getProjectDistribution } from "../../src/services/formalization/project-distribution-service";
import { installBrowserApiDoubles } from "../support/browser";
vi.mock("../../src/services/formalization/project-distribution-service", () => ({ getProjectDistribution: vi.fn() }));
vi.mock("../../src/modules/home/FormalizationFollowUpPreview", () => ({ FormalizationFollowUpPreview: () => null }));
vi.mock("../../src/services/formalization/home-summary-service", () => ({ getHomeSummary: () => new Promise(() => {}), getOverdueSummary: () => new Promise(() => {}) }));
vi.mock("../../src/services/formalization/approval-summary-service", () => ({ getApprovalCount: () => Promise.resolve(1) }));
const data = { schemaVersion: 1 as const, observedAt: "2026-11-03T18:00:00.000Z", totalOrders: 4, series: ["approvals", "send", "addendum"] as const, projects: [{ id: "legacy-project:1", name: "Amara", total: 4, counts: { approvals: 1, send: 3, addendum: 2 } }] };
beforeEach(() => {
    installBrowserApiDoubles();
    vi.mocked(getProjectDistribution).mockResolvedValue(data);
});
afterEach(() => {
    cleanup();
    vi.resetAllMocks();
});
it("opens complete project bars with state counts and independent addendum, without navigation", async () => {
    const url = window.location.href;
    render(<FormalizationProjectDistribution enabled />);
    expect(getProjectDistribution).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Ver distribución por proyecto" }));
    expect(await screen.findByRole("dialog", { name: "Distribución por proyecto" })).toBeInTheDocument();
    expect(await screen.findByRole("heading", { name: "Amara" })).toBeInTheDocument();
    expect(screen.getByLabelText("Amara · Pendientes de aprobación: 1 orden")).toBeInTheDocument();
    expect(screen.getByLabelText("Amara · Por enviar: 3 órdenes")).toBeInTheDocument();
    expect(screen.getByLabelText("Amara · Adéndum pendiente: 2 órdenes")).toBeInTheDocument();
    expect(screen.getByText("4 órdenes comerciales en 1 proyecto")).toBeInTheDocument();
    expect(window.location.href).toBe(url);
});
it("does not fetch or show the action without authorized list access", () => {
    render(<FormalizationProjectDistribution enabled={false} />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(getProjectDistribution).not.toHaveBeenCalled();
});
it("shows failure with retry instead of an invented zero", async () => {
    vi.mocked(getProjectDistribution).mockRejectedValueOnce(new Error("offline"));
    render(<FormalizationProjectDistribution enabled />);
    fireEvent.click(screen.getByRole("button", { name: "Ver distribución por proyecto" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("No fue posible cargar");
    fireEvent.click(screen.getByRole("button", { name: "Reintentar distribución" }));
    expect(await screen.findByRole("heading", { name: "Amara" })).toBeInTheDocument();
});
it("drops visible data immediately after permission revocation", async () => {
    const view = render(<FormalizationProjectDistribution enabled />);
    fireEvent.click(screen.getByRole("button", { name: "Ver distribución por proyecto" }));
    await screen.findByRole("heading", { name: "Amara" });
    view.rerender(<FormalizationProjectDistribution enabled={false} />);
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
});

it("closes the parent's modal on partial permission revocation while retaining other authorized banners", async () => {
    const roles = [{ code: "formalizacion", name: "Formalización", status: "active" as const }];
    const approval = { code: "formalizacion.home.approvals.read", effect: "allow" as const };
    const contracts = { code: "formalizacion.home.contracts.read", effect: "allow" as const };
    const view = render(<FormalizationHomePage roles={roles} effectivePermissions={[approval, contracts]} />);
    fireEvent.click(screen.getByRole("button", { name: "Ver distribución por proyecto" }));
    await screen.findByRole("heading", { name: "Amara" });
    view.rerender(<FormalizationHomePage roles={roles} effectivePermissions={[approval]} />);
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(screen.getByRole("button", { name: "Ver distribución por proyecto" })).toBeInTheDocument();
    expect(screen.queryByLabelText("Amara · Por enviar: 3 órdenes")).not.toBeInTheDocument();
});

it("shows the exact stage count on keyboard focus", async () => {
    render(<FormalizationProjectDistribution enabled />);
    fireEvent.click(screen.getByRole("button", { name: "Ver distribución por proyecto" }));
    const segment = await screen.findByLabelText("Amara · Pendientes de aprobación: 1 orden");
    fireEvent.focus(segment);
    expect(await screen.findByRole("tooltip")).toHaveTextContent("Amara · Pendientes de aprobación: 1 orden");
});

it("shows independent finiquito totals and opens the exact project and stage", async () => {
    const onSelect = vi.fn();
    vi.mocked(getProjectDistribution).mockResolvedValue({ ...data, series: [...data.series, "finiquito_validation", "finiquito_pending", "finiquito_signed", "finiquito_formalized"], projects: [{ id: "legacy-project:1", name: "Amara", total: 4, counts: { approvals: 1, send: 3, addendum: 2, finiquito_validation: 8, finiquito_pending: 2, finiquito_signed: 1, finiquito_formalized: 1 } }] });
    render(
        <ConfigProvider theme={{ token: { motion: false } }}>
            <FormalizationProjectDistribution enabled onSelect={onSelect} />
        </ConfigProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Ver distribución por proyecto" }));
    const segment = await screen.findByRole("button", { name: "Amara · Validación de saldo: 8 órdenes" });
    await waitFor(() => {
        expect(screen.getByText("4 órdenes comerciales en 1 proyecto")).toBeVisible();
        expect(screen.getByRole("group", { name: "Finiquito de Amara" })).toBeVisible();
        expect(screen.getByText(/^8,3\s?%$/)).toBeVisible();
    });
    fireEvent.click(segment);
    expect(onSelect).toHaveBeenCalledExactlyOnceWith("finiquito_validation", "legacy-project:1");
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
});
it("opens unassigned finiquitos without including all other projects", async () => {
    const onSelect = vi.fn();
    vi.mocked(getProjectDistribution).mockResolvedValue({ schemaVersion: 1, observedAt: data.observedAt, totalOrders: 0, series: ["finiquito_validation", "finiquito_pending", "finiquito_signed", "finiquito_formalized"], projects: [{ id: null, name: "Sin proyecto", total: 0, counts: { finiquito_validation: 3, finiquito_pending: 0, finiquito_signed: 0, finiquito_formalized: 0 } }] });
    render(<FormalizationProjectDistribution enabled onSelect={onSelect} />);
    fireEvent.click(screen.getByRole("button", { name: "Ver distribución por proyecto" }));
    fireEvent.click(await screen.findByRole("button", { name: "Sin proyecto · Validación de saldo: 3 órdenes" }));
    expect(onSelect).toHaveBeenCalledExactlyOnceWith("finiquito_validation", "unassigned");
});

it("shows project counts with both explicit percentage bases", async () => {
    vi.mocked(getProjectDistribution).mockResolvedValue({ schemaVersion: 1, observedAt: data.observedAt, totalOrders: 48, series: ["send", "finiquito_validation", "finiquito_pending", "finiquito_signed", "finiquito_formalized"], projects: [{ id: "legacy-project:1", name: "BC Lofts", total: 48, counts: { send: 48, finiquito_validation: 15, finiquito_pending: 0, finiquito_signed: 0, finiquito_formalized: 0 } }] });
    render(<FormalizationProjectDistribution enabled />);
    fireEvent.click(screen.getByRole("button", { name: "Ver distribución por proyecto" }));
    const row = (await screen.findByRole("heading", { name: "BC Lofts" })).closest("li");
    if (!row) throw new Error("Project row missing");
    expect(within(row).getByLabelText(/BC Lofts · Comerciales: 48; 76,2/)).toBeInTheDocument();
    expect(within(row).getByLabelText(/BC Lofts · En finiquito: 15; 23,8/)).toBeInTheDocument();
    expect(within(row).getByLabelText("BC Lofts · Finiquito frente a comerciales")).toHaveTextContent(/31,3/);
    expect(within(row).getByLabelText("BC Lofts · Finiquito frente a comerciales")).toHaveTextContent("15 / 48");
});
