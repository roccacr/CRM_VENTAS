import "@testing-library/jest-dom/vitest";

import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import ConfigProvider from "antd/es/config-provider";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { FormalizationFiniquito } from "../../src/modules/home/FormalizationFiniquito";
import { FormalizationStageEditor } from "../../src/modules/home/FormalizationStageEditor";
import { ApiClientError, apiRequest } from "../../src/services/api/api-client";
import type { FiniquitoSnapshot } from "../../src/services/formalization/finiquito-service";
import type { FollowUpItem } from "../../src/services/formalization/follow-up-service";
import { installBrowserApiDoubles } from "../support/browser";

vi.mock("../../src/services/api/api-client", async (original) => ({ ...(await original()), apiRequest: vi.fn() }));
const item = { source: "legacy", id: "legacy:12", saleLost: true, contractSigned: true, state: { code: "bank_management", label: "Gestión bancaria" } } as FollowUpItem;
function snapshot(status: FiniquitoSnapshot["status"], version: number, overrides: Partial<FiniquitoSnapshot> = {}): FiniquitoSnapshot {
    return { eligible: true, status, version, originStage: "bank_management", canUpdate: true, balanceValidated: status !== null, sent: status === "sent" || status === "signed", received: status === "signed", saleLost: true, contractSigned: true, ...overrides };
}
function mount(allowed = true, order = item) {
    return render(
        <ConfigProvider theme={{ token: { motion: false } }}>
            <FormalizationFiniquito item={order} allowed={allowed} />
        </ConfigProvider>,
    );
}
async function confirm(label: string, title: string) {
    const action = await screen.findByRole("button", { name: label });
    await waitFor(() => expect(action).not.toHaveClass("ant-btn-loading"));
    fireEvent.click(action);
    const dialog = await screen.findByRole("dialog", { name: title });
    await act(async () => {
        fireEvent.click(within(dialog).getByRole("button", { name: "Confirmar registro" }));
        await Promise.resolve();
    });
}
beforeEach(() => {
    installBrowserApiDoubles();
    vi.mocked(apiRequest).mockReset();
});
afterEach(cleanup);
it.each(["pending_send", "waiting_signature", "formalized"])("manually moves a historical order from validation to %s", async (targetStage) => {
    const result = { balanceValidated: true, sent: targetStage !== "pending_send", received: targetStage === "formalized" };
    vi.mocked(apiRequest)
        .mockResolvedValueOnce(snapshot(null, 0, { contractSigned: false }))
        .mockResolvedValueOnce(snapshot(targetStage === "formalized" ? "signed" : targetStage === "waiting_signature" ? "sent" : "pending_send", 1, { ...result, contractSigned: false }));
    mount();
    fireEvent.change(await screen.findByLabelText("Estado del finiquito"), { target: { value: targetStage } });
    expect(screen.getByRole("button", { name: "Guardar" })).toBeEnabled();
    fireEvent.change(screen.getByLabelText("Motivo del cambio de finiquito (opcional)"), { target: { value: "Regularización histórica" } });
    fireEvent.click(screen.getByRole("button", { name: "Guardar" }));
    const dialog = await screen.findByRole("dialog", { name: "Confirmar cambio de finiquito" });
    fireEvent.click(within(dialog).getByRole("button", { name: "Confirmar cambio" }));
    await waitFor(() => {
        expect(apiRequest).toHaveBeenCalledTimes(2);
    });
    const body: unknown = expect.objectContaining({ status: "set_stage", targetStage, reason: "Regularización histórica", expectedVersion: 0 });
    expect(apiRequest).toHaveBeenLastCalledWith("/formalization/orders/finiquito", expect.objectContaining({ method: "POST", body }));
});
it("finishes directly through the explicit finish action and confirmation", async () => {
    vi.mocked(apiRequest).mockResolvedValueOnce(snapshot(null, 0)).mockResolvedValueOnce(snapshot("signed", 1));
    mount();
    fireEvent.change(await screen.findByLabelText("Motivo del cambio de finiquito (opcional)"), { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: "Terminar finiquito" }));
    expect(apiRequest).toHaveBeenCalledOnce();
    const dialog = await screen.findByRole("dialog", { name: "Confirmar cambio de finiquito" });
    fireEvent.click(within(dialog).getByRole("button", { name: "Confirmar cambio" }));
    expect(await screen.findByText("Proceso de finiquito completado")).toBeVisible();
});

it.each([false, undefined])("no abre una rama para una orden sin caída ni historia: %s", (saleLost) => {
    mount(true, { ...item, saleLost } as FollowUpItem);
    expect(screen.queryByText("Gestión de finiquito")).toBeNull();
    expect(apiRequest).not.toHaveBeenCalled();
});
it("valida saldo como check propio con confirmación y conserva la etapa de origen", async () => {
    vi.mocked(apiRequest).mockResolvedValueOnce(snapshot(null, 0)).mockResolvedValueOnce(snapshot("pending_send", 1));
    mount();
    await screen.findByRole("button", { name: "Marcar saldo validado" });
    expect(screen.queryByText(/Venta caída en:/)).toBeNull();
    await confirm("Marcar saldo validado", "¿Confirmar saldo validado?");
    expect(await screen.findByRole("button", { name: "Marcar finiquito enviado" })).toBeVisible();
    expect(apiRequest).toHaveBeenLastCalledWith("/formalization/orders/finiquito", expect.objectContaining({ method: "POST", body: expect.objectContaining({ source: "legacy", id: "12", status: "balance_validated", expectedVersion: 0 }) as unknown }));
    expect(screen.getByText(/Venta caída en:/)).toHaveTextContent("Gestión bancaria");
});
it("sin contrato firmado puede validar saldo, pero no enviar", async () => {
    vi.mocked(apiRequest)
        .mockResolvedValueOnce(snapshot(null, 0, { contractSigned: false }))
        .mockResolvedValueOnce(snapshot("pending_send", 1, { contractSigned: false }));
    mount(true, { ...item, contractSigned: false });
    await confirm("Marcar saldo validado", "¿Confirmar saldo validado?");
    expect(await screen.findByText(/Falta confirmar Contrato firmado/)).toBeVisible();
    expect(screen.queryByRole("button", { name: "Marcar finiquito enviado" })).toBeNull();
});
it("la lectura no concede escritura", async () => {
    vi.mocked(apiRequest).mockResolvedValue(snapshot("sent", 2, { canUpdate: false }));
    mount(false);
    expect(await screen.findByText("Finiquito firmado")).toBeVisible();
    expect(screen.queryByRole("button", { name: /Marcar/ })).toBeNull();
});
it("el finiquito recibido termina en Formalizada", async () => {
    vi.mocked(apiRequest).mockResolvedValue(snapshot("signed", 3));
    mount();
    expect(await screen.findByText("Proceso de finiquito completado")).toBeVisible();
    expect(within(screen.getByRole("list", { name: "Rama de finiquito" })).getByText("Formalizada").closest("li")).toHaveAttribute("aria-current", "step");
    expect(screen.queryByRole("button", { name: /Marcar/ })).toBeNull();
});
it("exige confirmar saldo, envío y recepción en ese orden", async () => {
    vi.mocked(apiRequest).mockResolvedValueOnce(snapshot(null, 0)).mockResolvedValueOnce(snapshot("pending_send", 1)).mockResolvedValueOnce(snapshot("sent", 2)).mockResolvedValueOnce(snapshot("signed", 3));
    mount();
    await confirm("Marcar saldo validado", "¿Confirmar saldo validado?");
    await confirm("Marcar finiquito enviado", "¿Confirmar finiquito enviado?");
    await confirm("Marcar finiquito recibido", "¿Confirmar finiquito recibido?");
    expect(await screen.findByText("Proceso de finiquito completado")).toBeVisible();
    expect(
        vi
            .mocked(apiRequest)
            .mock.calls.slice(1)
            .map((call) => (call[1]?.body as { status: string }).status),
    ).toEqual(["balance_validated", "sent", "signed"]);
});
it("reintenta una respuesta incierta con el mismo UUID y payload", async () => {
    vi.mocked(apiRequest).mockResolvedValueOnce(snapshot(null, 0)).mockRejectedValueOnce(new Error("lost response")).mockResolvedValueOnce(snapshot("pending_send", 1));
    mount();
    await confirm("Marcar saldo validado", "¿Confirmar saldo validado?");
    fireEvent.click(await screen.findByRole("button", { name: "Reintentar registro" }));
    await screen.findByRole("button", { name: "Marcar finiquito enviado" });
    expect(vi.mocked(apiRequest).mock.calls[1]?.[1]?.body).toEqual(vi.mocked(apiRequest).mock.calls[2]?.[1]?.body);
});
it("un conflicto bloquea nuevas escrituras hasta actualizar", async () => {
    vi.mocked(apiRequest)
        .mockResolvedValueOnce(snapshot(null, 0))
        .mockRejectedValueOnce(new ApiClientError("changed", 409, {}));
    mount();
    await confirm("Marcar saldo validado", "¿Confirmar saldo validado?");
    expect(await screen.findByRole("button", { name: "Actualizar finiquito" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Marcar saldo validado" })).toBeDisabled();
    expect(screen.queryByRole("button", { name: "Reintentar registro" })).toBeNull();
});
it("no infiere saldo validado de una firma histórica", async () => {
    vi.mocked(apiRequest)
        .mockResolvedValueOnce(snapshot("signed", 3, { balanceValidated: false }))
        .mockResolvedValueOnce(snapshot("signed", 4));
    mount();
    expect(await screen.findByRole("button", { name: "Marcar saldo validado" })).toBeVisible();
    expect(screen.queryByText("Proceso de finiquito completado")).toBeNull();
    await confirm("Marcar saldo validado", "¿Confirmar saldo validado?");
    expect(await screen.findByText("Proceso de finiquito completado")).toBeVisible();
});
it("conserva la rama si NetSuite desmarca la caída y bloquea el siguiente paso", async () => {
    vi.mocked(apiRequest).mockResolvedValue(snapshot("sent", 2, { eligible: false, saleLost: false }));
    mount(true, { ...item, saleLost: false, finiquitoInFlow: true });
    expect(await screen.findByText(/ya no cumple las condiciones/)).toBeVisible();
    expect(screen.queryByRole("button", { name: /Marcar/ })).toBeNull();
});
it("una respuesta anterior sin saldo propio se rechaza de forma controlada", async () => {
    vi.mocked(apiRequest).mockResolvedValue({ eligible: true, status: "pending_send", version: 1, originStage: null, canUpdate: true });
    mount();
    expect(await screen.findByRole("alert")).toHaveTextContent("No fue posible consultar el finiquito");
});
it.each([true, false])("la rama activa no permite la etapa comercial aunque caída sea %s", (saleLost) => {
    const { container } = render(<FormalizationStageEditor item={{ ...item, saleLost, finiquitoInFlow: true }} allowed onSaved={vi.fn()} onRefresh={vi.fn()} />);
    expect(container).toBeEmptyDOMElement();
    expect(apiRequest).not.toHaveBeenCalled();
});
