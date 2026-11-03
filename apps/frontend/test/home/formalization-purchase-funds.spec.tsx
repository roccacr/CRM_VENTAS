import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { FormalizationPurchaseFunds } from "../../src/modules/home/FormalizationPurchaseFunds";
import { ApiClientError, apiRequest } from "../../src/services/api/api-client";
import type { FollowUpItem } from "../../src/services/formalization/follow-up-service";
import { installBrowserApiDoubles } from "../support/browser";

vi.mock("../../src/services/api/api-client", async (original) => ({ ...(await original()), apiRequest: vi.fn() }));
const item = { source: "legacy", id: "legacy:1", purchaseFundsOrigin: null, stateVersion: 0 } as FollowUpItem;
beforeEach(() => {
    installBrowserApiDoubles();
    vi.mocked(apiRequest).mockReset();
});
afterEach(cleanup);
it("shows undefined funds without presenting them as bank financing or exposing editing", () => {
    render(<FormalizationPurchaseFunds item={item} allowed={false} onSaved={vi.fn()} onRefresh={vi.fn()} />);
    expect(screen.getByText("Sin definir").classList.contains("ant-tag-red")).toBe(true);
    expect(screen.queryByRole("button", { name: "Editar fondos de compra" })).toBeNull();
    expect(apiRequest).not.toHaveBeenCalled();
});
it("saves the selected funds and concurrency token without a target stage", async () => {
    const saved = vi.fn();
    vi.mocked(apiRequest).mockResolvedValueOnce({ source: "legacy", id: "1", purchaseFundsOrigin: null, sequence: 0, auditSequence: 3 }).mockResolvedValueOnce({ purchaseFundsOrigin: "own_funds", sequence: 0, replayed: false });
    render(<FormalizationPurchaseFunds item={item} allowed onSaved={saved} onRefresh={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Editar fondos de compra" }));
    fireEvent.change(await screen.findByLabelText("Origen de los fondos"), { target: { value: "own_funds" } });
    expect(screen.getByText("Sin definir").classList.contains("ant-tag-red")).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: /Guardar fondos/ }));
    await waitFor(() => {
        expect(saved).toHaveBeenCalledOnce();
    });
    expect(apiRequest).toHaveBeenLastCalledWith("/formalization/orders/purchase-funds", expect.objectContaining({ body: { source: "legacy", id: "1", expectedSequence: 0, expectedAuditSequence: 3, expectedPurchaseFundsOrigin: null, purchaseFundsOrigin: "own_funds", operationId: expect.any(String) as unknown } }));
    expect(screen.getByText("Fondos propios").classList.contains("ant-tag-green")).toBe(true);
});

it("locks uncertain payload and retries using the original operation", async () => {
    vi.mocked(apiRequest).mockResolvedValueOnce({ purchaseFundsOrigin: null, sequence: 0, auditSequence: 2 }).mockRejectedValueOnce(new Error("lost response")).mockResolvedValueOnce({ purchaseFundsOrigin: "bank_financing", sequence: 0, replayed: true });
    const saved = vi.fn();
    render(<FormalizationPurchaseFunds item={item} allowed onSaved={saved} onRefresh={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Editar fondos de compra" }));
    fireEvent.change(await screen.findByLabelText("Origen de los fondos"), { target: { value: "bank_financing" } });
    fireEvent.click(screen.getByRole("button", { name: /Guardar fondos/ }));
    fireEvent.click(await screen.findByRole("button", { name: /Reintentar guardado/ }));
    await waitFor(() => {
        expect(saved).toHaveBeenCalledOnce();
    });
    expect(vi.mocked(apiRequest).mock.calls[2]?.[1]?.body).toEqual(vi.mocked(apiRequest).mock.calls[1]?.[1]?.body);
});
it("requires refresh after a conflict and never overwrites the changed order", async () => {
    vi.mocked(apiRequest)
        .mockResolvedValueOnce({ purchaseFundsOrigin: null, sequence: 0, auditSequence: 0 })
        .mockRejectedValueOnce(new ApiClientError("Conflict", 409, {}));
    const refresh = vi.fn();
    render(<FormalizationPurchaseFunds item={item} allowed onSaved={vi.fn()} onRefresh={refresh} />);
    fireEvent.click(screen.getByRole("button", { name: "Editar fondos de compra" }));
    fireEvent.change(await screen.findByLabelText("Origen de los fondos"), { target: { value: "own_funds" } });
    fireEvent.click(screen.getByRole("button", { name: /Guardar fondos/ }));
    expect(await screen.findByRole("alert")).toBeTruthy();
    expect(screen.getByRole("button", { name: /Guardar fondos/ }).hasAttribute("disabled")).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Actualizar orden" }));
    expect(refresh).toHaveBeenCalledOnce();
    expect(apiRequest).toHaveBeenCalledTimes(2);
});
it("keeps confirmed success when the parent refresh fails", async () => {
    vi.mocked(apiRequest).mockResolvedValueOnce({ purchaseFundsOrigin: null, sequence: 0, auditSequence: 0 }).mockResolvedValueOnce({ purchaseFundsOrigin: "own_funds", sequence: 0, replayed: false });
    render(<FormalizationPurchaseFunds item={item} allowed onSaved={() => Promise.reject(new Error("refresh"))} onRefresh={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Editar fondos de compra" }));
    fireEvent.change(await screen.findByLabelText("Origen de los fondos"), { target: { value: "own_funds" } });
    fireEvent.click(screen.getByRole("button", { name: /Guardar fondos/ }));
    expect(await screen.findByText("Fondos guardados. Actualiza la orden para ver el dato actualizado.")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Guardar fondos/ })).toBeNull();
    expect(screen.getByText("Fondos propios")).toBeTruthy();
});

it.each([
    ["own_funds", "Fondos propios"],
    ["bank_financing", "Financiamiento bancario"],
] as const)("shows a green tag for saved %s", (origin, label) => {
    render(<FormalizationPurchaseFunds item={{ ...item, purchaseFundsOrigin: origin }} allowed={false} onSaved={vi.fn()} onRefresh={vi.fn()} />);
    expect(screen.getByText(label).classList.contains("ant-tag-green")).toBe(true);
});
