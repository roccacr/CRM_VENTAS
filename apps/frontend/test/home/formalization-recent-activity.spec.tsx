import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { StrictMode } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { FormalizationHomeInsights } from "../../src/modules/home/FormalizationHomeInsights";
import { apiRequest } from "../../src/services/api/api-client";
import { getRecentOrderActivity } from "../../src/services/formalization/recent-activity-service";

vi.mock("../../src/services/api/api-client", () => ({ apiRequest: vi.fn() }));
const event = { id: "event-1", orderNumber: "BC552", action: "approval_change", at: "2026-10-28T20:00:00Z", fromState: "pending_approval", toState: "contract_pending_send", approval: "approved" };
const response = { schemaVersion: 1, observedAt: "2026-10-28T20:00:00Z", items: [event] };
beforeEach(() => {
    vi.mocked(apiRequest).mockReset().mockResolvedValue(response);
});
afterEach(cleanup);

it("shows real actions and shares only the current StrictMode request", async () => {
    render(
        <StrictMode>
            <FormalizationHomeInsights enabled />
        </StrictMode>,
    );
    expect(await screen.findByText(/BC552/)).toBeInTheDocument();
    expect(screen.getByText(/Pendientes de aprobación → Por enviar/)).toBeInTheDocument();
    expect(apiRequest).toHaveBeenCalledExactlyOnceWith("/formalization/home/recent-activity");
});
it("does not request movements without permission or while the Home is hidden", () => {
    render(<FormalizationHomeInsights enabled={false} />);
    expect(apiRequest).not.toHaveBeenCalled();
});
it("loads fresh data when returning Home and when the refresh version changes", async () => {
    const view = render(<FormalizationHomeInsights enabled visible={false} />);
    expect(apiRequest).not.toHaveBeenCalled();
    view.rerender(<FormalizationHomeInsights enabled visible />);
    await screen.findByText(/BC552/);
    view.rerender(<FormalizationHomeInsights enabled visible refreshVersion={1} />);
    await waitFor(() => {
        expect(apiRequest).toHaveBeenCalledTimes(2);
    });
});
it("reports an empty personal feed without invented movements", async () => {
    vi.mocked(apiRequest).mockResolvedValue({ ...response, items: [] });
    render(<FormalizationHomeInsights enabled />);
    expect(await screen.findByText("Aún no has registrado movimientos en órdenes de venta.")).toBeInTheDocument();
});
it("shows a retryable error instead of sample data", async () => {
    vi.mocked(apiRequest).mockRejectedValueOnce(new Error("private details"));
    render(<FormalizationHomeInsights enabled />);
    expect((await screen.findByRole("alert")).textContent).not.toContain("private details");
    fireEvent.click(screen.getByRole("button", { name: "Reintentar movimientos" }));
    expect(await screen.findByText(/BC552/)).toBeInTheDocument();
});
it("rejects more than six entries rather than accepting an unbounded response", async () => {
    vi.mocked(apiRequest).mockResolvedValue({ ...response, items: Array.from({ length: 7 }, () => event) });
    await expect(getRecentOrderActivity()).rejects.toThrow();
});
