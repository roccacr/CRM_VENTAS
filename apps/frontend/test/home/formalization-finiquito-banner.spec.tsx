import "@testing-library/jest-dom/vitest";

import { act, cleanup, fireEvent, render, renderHook, screen, waitFor } from "@testing-library/react";
import ConfigProvider from "antd/es/config-provider";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { FiniquitoOrdersModal } from "../../src/modules/home/FormalizationFiniquitoBanner";
import { useFiniquitoBanner } from "../../src/modules/home/useFiniquitoBanner";
import { apiRequest } from "../../src/services/api/api-client";
import { getFiniquitoOverview, nextFiniquitoAction, parseFiniquitoSnapshot } from "../../src/services/formalization/finiquito-service";
import { installBrowserApiDoubles } from "../support/browser";

vi.mock("../../src/services/api/api-client", () => ({ apiRequest: vi.fn() }));
const overview = {
    counts: { validation: 8, pending_send: 4, waiting_signature: 2, formalized: 1, waiting_checks: 3 },
    total: 18,
    page: 1,
    pageSize: 25,
    canUpdate: false,
    items: [{ id: "42", source: "legacy", number: "OV42", section: "validation", balanceValidated: false, sent: false, received: false, saleLost: true, contractSigned: false, reservationApplied: true, version: 0 }],
};
beforeEach(() => {
    installBrowserApiDoubles();
    vi.mocked(apiRequest).mockReset();
});
afterEach(cleanup);

it("lee conteos agregados de ambas fuentes, no solamente las filas de la página", async () => {
    vi.mocked(apiRequest).mockResolvedValue(overview);
    expect(await getFiniquitoOverview("validation", 2)).toEqual(overview);
    expect(apiRequest).toHaveBeenCalledWith("/formalization/orders/finiquito/overview?section=validation&page=2");
});
it.each([undefined, -1, "8", null])("rechaza contador incompleto o inválido sin inventar cero: %s", async (validation) => {
    vi.mocked(apiRequest).mockResolvedValue({ ...overview, counts: { ...overview.counts, validation } });
    await expect(getFiniquitoOverview()).rejects.toThrow();
});
it("no consulta sin acceso y sí consulta al habilitarlo", async () => {
    vi.mocked(apiRequest).mockResolvedValue(overview);
    const { result, rerender } = renderHook(({ enabled }) => useFiniquitoBanner(enabled, 0), { initialProps: { enabled: false } });
    expect(apiRequest).not.toHaveBeenCalled();
    rerender({ enabled: true });
    await waitFor(() => { expect(result.current.data?.counts.validation).toBe(8); });
    expect(result.current.busy).toBe(false);
});
it("un error queda visible, permite reintentar y nunca representa cuatro ceros", async () => {
    vi.mocked(apiRequest).mockRejectedValueOnce(new Error("sin conexión")).mockResolvedValueOnce(overview);
    const { result } = renderHook(() => useFiniquitoBanner(true, 0));
    await waitFor(() => { expect(result.current.failed).toBe(true); });
    expect(result.current.data).toBeNull();
    act(() => {
        result.current.retry();
    });
    await waitFor(() => { expect(result.current.data?.total).toBe(18); });
});
it("abre la sección, conserva página independiente y navega a la ficha existente", async () => {
    vi.mocked(apiRequest).mockResolvedValue(overview);
    const onNavigate = vi.fn();
    function Harness() {
        const model = useFiniquitoBanner(true, 0);
        return (
            <ConfigProvider theme={{ token: { motion: false } }}>
                <button
                    onClick={() => {
                        model.select("validation");
                    }}
                >
                    Validación de saldo
                </button>
                <FiniquitoOrdersModal model={model} onNavigate={onNavigate} />
            </ConfigProvider>
        );
    }
    render(<Harness />);
    fireEvent.click(screen.getByRole("button", { name: "Validación de saldo" }));
    await screen.findByText("OV42");
    fireEvent.click(screen.getByRole("button", { name: "Gestionar orden" }));
    expect(onNavigate).toHaveBeenCalledWith("/home/formalization?orderSource=legacy&orderId=42");
});
it("no acepta la respuesta antigua que no incluye saldo validado propio", () => {
    expect(() => parseFiniquitoSnapshot({ eligible: true, status: "signed", version: 2, originStage: null, canUpdate: true })).toThrow();
    expect(nextFiniquitoAction({ balanceValidated: false, sent: true, received: true })).toBe("balance_validated");
    expect(nextFiniquitoAction({ balanceValidated: true, sent: false, received: false })).toBe("sent");
    expect(nextFiniquitoAction({ balanceValidated: true, sent: true, received: false })).toBe("signed");
    expect(nextFiniquitoAction({ balanceValidated: true, sent: true, received: true })).toBeNull();
});
