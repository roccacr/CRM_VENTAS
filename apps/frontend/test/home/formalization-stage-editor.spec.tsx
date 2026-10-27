import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { FormalizationStageEditor } from "../../src/modules/home/FormalizationStageEditor";
import { ApiClientError, apiRequest, type ApiRequestOptions } from "../../src/services/api/api-client";
import type { FollowUpItem } from "../../src/services/formalization/follow-up-service";
import { installBrowserApiDoubles } from "../support/browser";
vi.mock("../../src/services/api/api-client", async (original) => ({ ...(await original<{ ApiClientError: typeof ApiClientError; apiRequest: typeof apiRequest }>()), apiRequest: vi.fn() }));
const item: FollowUpItem = { id: "legacy:1", source: "legacy", number: "OV-1", nativeCode: null, client: null, project: null, unit: null, responsible: null, state: { code: "bank_management", label: "Gestión bancaria", since: null, days: null }, nextStep: "", completedThisYear: false, contractSigned: true, approvalsComplete: true, stateVersion: 3 };
const saved = vi.fn();
const refresh = vi.fn();
beforeEach(() => {
    installBrowserApiDoubles();
    vi.mocked(apiRequest).mockReset();
    saved.mockReset();
    refresh.mockReset();
});
afterEach(cleanup);
function show(value = item, allowed = true) {
    return render(<FormalizationStageEditor item={value} allowed={allowed} onSaved={saved} onRefresh={refresh} />);
}
async function confirm() {
    fireEvent.click(await screen.findByRole("button", { name: "Guardar" }));
    fireEvent.click(await screen.findByRole("button", { name: "Confirmar cambio" }));
}
it.each(["permission", "approvals", "version"])("disables editing without %s", (missing) => {
    const value = { ...item, ...(missing === "approvals" ? { approvalsComplete: false } : {}) };
    if (missing === "version") delete value.stateVersion;
    show(value, missing !== "permission");
    expect(screen.getByRole("combobox").hasAttribute("disabled")).toBe(true);
    expect(screen.getByRole("button", { name: "Guardar" }).hasAttribute("disabled")).toBe(true);
});
it("requires a reason backwards, confirms and sends canonical source identity", async () => {
    vi.mocked(apiRequest).mockResolvedValue({ source: "legacy", id: "1", state: "contract_pending_send", sequence: 4, replayed: false });
    show();
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "contract_pending_send" } });
    expect(screen.getByRole("button", { name: "Guardar" }).hasAttribute("disabled")).toBe(true);
    fireEvent.change(screen.getByLabelText("Motivo del retroceso"), { target: { value: "Corregir etapa" } });
    fireEvent.click(screen.getByRole("button", { name: "Guardar" }));
    expect(apiRequest).not.toHaveBeenCalled();
    fireEvent.click(await screen.findByRole("button", { name: "Confirmar cambio" }));
    await waitFor(() => {
        expect(saved).toHaveBeenCalledOnce();
    });
    expect(apiRequest).toHaveBeenCalledWith("/formalization/orders/stage", expect.objectContaining<ApiRequestOptions>({ method: "POST", body: { source: "legacy", id: "1", expectedSequence: 3, targetState: "contract_pending_send", reason: "Corregir etapa", operationId: (requestBody(0) as { operationId: string }).operationId } }));
});
it("reuses operation key after network failure and replaces it when input changes", async () => {
    vi.mocked(apiRequest).mockRejectedValue(new TypeError("network"));
    show();
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "closed" } });
    await confirm();
    await screen.findByRole("alert");
    await confirm();
    await waitFor(() => {
        expect(apiRequest).toHaveBeenCalledTimes(2);
    });
    expect(requestBody(0)).toEqual(requestBody(1));
    await waitFor(() => {
        expect(screen.getByRole("combobox").hasAttribute("disabled")).toBe(false);
    });
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "transfer_signed" } });
    await confirm();
    await waitFor(() => {
        expect(apiRequest).toHaveBeenCalledTimes(3);
    });
    expect(requestBody(2)).not.toEqual(requestBody(1));
});
it("blocks stale retries and offers explicit refresh on 409", async () => {
    vi.mocked(apiRequest).mockRejectedValue(new ApiClientError("conflict", 409, null));
    show();
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "closed" } });
    await confirm();
    await screen.findByText(/La orden cambió/);
    expect((await screen.findByRole("button", { name: "Guardar" })).hasAttribute("disabled")).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Actualizar orden" }));
    expect(refresh).toHaveBeenCalledOnce();
    expect(apiRequest).toHaveBeenCalledOnce();
    expect(saved).not.toHaveBeenCalled();
});

function requestBody(index: number): unknown {
    return vi.mocked(apiRequest).mock.calls[index]?.[1]?.body;
}

it("allows the initial pending-send stage with three approvals and version zero", () => {
    show({ ...item, state: { ...item.state, code: "contract_pending_send", label: "Por enviar" }, stateVersion: 0 });
    expect(screen.getByRole("combobox").hasAttribute("disabled")).toBe(false);
    expect(screen.queryByText(/Se requieren las tres aprobaciones/)).toBeNull();
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "contract_pending_signature" } });
    expect(screen.getByRole("button", { name: "Guardar" }).hasAttribute("disabled")).toBe(false);
});
it("explains a permission restriction without implying missing approvals", () => {
    show(item, false);
    expect(screen.getByText("No tienes permiso para cambiar la etapa.")).toBeTruthy();
    expect(screen.queryByText(/Faltan aprobaciones/)).toBeNull();
});
it("distinguishes missing approval data from approvals actually pending and offers refresh", () => {
    const value = { ...item };
    delete value.approvalsComplete;
    show(value);
    expect(screen.getByText("Actualiza la orden para verificar sus aprobaciones.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Actualizar orden" }));
    expect(refresh).toHaveBeenCalledOnce();
});
it("reports genuinely incomplete approvals", () => {
    show({ ...item, approvalsComplete: false });
    expect(screen.getByText("Faltan aprobaciones para cambiar la etapa.")).toBeTruthy();
});
it("asks to refresh when the state version was not received instead of requiring prior history", () => {
    const value = { ...item };
    delete value.stateVersion;
    show(value);
    expect(screen.getByText("Actualiza la orden para cargar su estado actual.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Actualizar orden" }));
    expect(refresh).toHaveBeenCalledOnce();
});
it.each([
    ["contract_pending_send", "Marcar como enviado", "contract_pending_signature"],
    ["contract_pending_signature", "Marcar como firmado", "bank_management"],
])("offers one button for the current stage (%s) that confirms and saves the next one", async (code, label, next) => {
    vi.mocked(apiRequest).mockResolvedValue({ source: "legacy", id: "1", state: next, sequence: 4, replayed: false });
    show({ ...item, state: { ...item.state, code } });
    fireEvent.click(screen.getByRole("button", { name: label }));
    expect(apiRequest).not.toHaveBeenCalled();
    fireEvent.click(await screen.findByRole("button", { name: "Confirmar cambio" }));
    await waitFor(() => {
        expect(saved).toHaveBeenCalledOnce();
    });
    expect(requestBody(0)).toEqual(expect.objectContaining({ targetState: next }));
});
it("keeps the one-click button disabled without permission", () => {
    show({ ...item, state: { ...item.state, code: "contract_pending_send" } }, false);
    expect(screen.getByRole("button", { name: "Marcar como enviado" }).hasAttribute("disabled")).toBe(true);
});

it.each([false, undefined])("blocks banking and later destinations without confirmed signature %s", (contractSigned) => {
    show({ ...item, state: { ...item.state, code: "contract_pending_signature" }, contractSigned });
    expect(screen.getByRole("button", { name: "Marcar como firmado" }).hasAttribute("disabled")).toBe(true);
    expect(screen.getByText("Se requiere el contrato firmado para pasar a Gestión bancaria o etapas posteriores.")).toBeTruthy();
    for (const name of ["Gestión bancaria", "Pendiente de saldo", "Traspaso pendiente", "Traspaso firmado", "Formalización cerrada"]) {
        expect(screen.getByRole("option", { name }).hasAttribute("disabled")).toBe(true);
    }
    expect(apiRequest).not.toHaveBeenCalled();
});
it("cannot skip the send/signature stages even with a signed flag", () => {
    show({ ...item, state: { ...item.state, code: "contract_pending_send" } });
    expect(screen.getByRole("option", { name: "Gestión bancaria" }).hasAttribute("disabled")).toBe(true);
    expect(screen.getByRole("button", { name: "Marcar como enviado" }).hasAttribute("disabled")).toBe(false);
});

it("does not let a forged selection save a destination blocked by the signature gate", () => {
    show({ ...item, contractSigned: false });
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "closed" } });
    expect(screen.getByRole("button", { name: "Guardar" }).hasAttribute("disabled")).toBe(true);
    expect(apiRequest).not.toHaveBeenCalled();
});
it("shows the API signature conflict without claiming the order version changed", async () => {
    vi.mocked(apiRequest).mockRejectedValue(new ApiClientError("conflict", 409, { code: "CONTRACT_SIGNATURE_REQUIRED" }));
    show();
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "closed" } });
    await confirm();
    expect((await screen.findByRole("alert")).textContent).toBe("Se requiere el contrato firmado para pasar a Gestión bancaria o etapas posteriores.");
    expect(screen.queryByText(/La orden cambió/)).toBeNull();
    expect(saved).not.toHaveBeenCalled();
});
