import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { NetsuiteSynchronizationActions } from "../../src/modules/home/FormalizationNetsuiteSync";
import { apiRequest } from "../../src/services/api/api-client";
import { installBrowserApiDoubles } from "../support/browser";
vi.mock("../../src/services/api/api-client", async (original) => ({ ...(await original()), apiRequest: vi.fn() }));
beforeEach(() => {
    installBrowserApiDoubles();
    vi.mocked(apiRequest).mockReset();
});
afterEach(cleanup);
it("requires confirmation showing the environment and refreshes only after a confirmed commit", async () => {
    vi.mocked(apiRequest).mockResolvedValueOnce({ environment: "production", canSynchronize: true }).mockResolvedValueOnce({ environment: "production", persisted: true, result: "applied", destination: "legacy", changes: 3 });
    const refresh = vi.fn();
    render(<NetsuiteSynchronizationActions identity={{ source: "legacy", id: "legacy:1" }} allowed onSynchronized={refresh} />);
    fireEvent.click(await screen.findByRole("button", { name: "Sincronizar con NetSuite" }));
    expect(within(screen.getByRole("dialog")).getByText(/NetSuite Producción/)).toBeTruthy();
    expect(apiRequest).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: "Confirmar sincronización" }));
    expect(await screen.findByText(/3 campos actualizados/)).toBeInTheDocument();
    expect(refresh).toHaveBeenCalledOnce();
    expect(apiRequest).toHaveBeenLastCalledWith("/formalization/orders/legacy/1/netsuite/sync", { method: "POST", body: {} });
});
it("does not expose a write action to a read-only user", async () => {
    vi.mocked(apiRequest).mockResolvedValueOnce({ environment: "sandbox", canSynchronize: true });
    render(<NetsuiteSynchronizationActions identity={{ source: "legacy", id: "1" }} allowed={false} />);
    expect(await screen.findByText(/Sandbox/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Sincronizar con NetSuite" })).toBeNull();
});
it("shows an error without claiming success or refreshing when synchronization fails", async () => {
    vi.mocked(apiRequest).mockResolvedValueOnce({ environment: "production", canSynchronize: true }).mockRejectedValueOnce(new Error("failed"));
    const refresh = vi.fn();
    render(<NetsuiteSynchronizationActions identity={{ source: "legacy", id: "1" }} allowed onSynchronized={refresh} />);
    fireEvent.click(await screen.findByRole("button", { name: "Sincronizar con NetSuite" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirmar sincronización" }));
    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(refresh).not.toHaveBeenCalled();
});

it("keeps sandbox synchronization disabled when the server blocks persistence", async () => {
    vi.mocked(apiRequest).mockResolvedValueOnce({ environment: "sandbox", canSynchronize: false });
    render(<NetsuiteSynchronizationActions identity={{ source: "legacy", id: "1" }} allowed />);
    expect(await screen.findByText("Sincronización deshabilitada para este ambiente.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sincronizar con NetSuite" }).hasAttribute("disabled")).toBe(true);
    expect(apiRequest).toHaveBeenCalledTimes(1);
});
