import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import notification from "antd/es/notification";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { FormalizationStageEditor } from "../../src/modules/home/FormalizationStageEditor";
import { ApiClientError, apiRequest, type ApiRequestOptions } from "../../src/services/api/api-client";
import type { FollowUpItem } from "../../src/services/formalization/follow-up-service";
import { ORDER_STAGES } from "../../src/services/formalization/order-stage-service";
import { installBrowserApiDoubles } from "../support/browser";
vi.mock("antd/es/notification", () => ({ default: { success: vi.fn() } }));
vi.mock("../../src/services/api/api-client", async (original) => ({ ...(await original<{ ApiClientError: typeof ApiClientError; apiRequest: typeof apiRequest }>()), apiRequest: vi.fn() }));
const item: FollowUpItem = { id: "legacy:1", source: "legacy", number: "OV-1", nativeCode: null, client: null, project: null, unit: null, responsible: null, state: { code: "bank_management_in_progress", label: "Gestión bancaria", since: null, days: null }, nextStep: "", completedThisYear: false, contractSigned: true, installmentsFullyPaid: true, unitTransferred: false, keysDelivered: false, unitDelivered: false, approvalsComplete: true, stateVersion: 3 };
const saved = vi.fn();
const refresh = vi.fn();
beforeEach(() => {
    installBrowserApiDoubles();
    vi.mocked(apiRequest).mockReset();
    saved.mockReset();
    refresh.mockReset();
});
afterEach(cleanup);
it.each([false, null, undefined])("allows the next step from signed transfer without prior physical delivery (%s)", async (unitDelivered) => {
    vi.mocked(apiRequest).mockResolvedValue({ source: "legacy", id: "1", state: "closed", sequence: 4, replayed: false });
    const value = { ...item, state: { ...item.state, code: "transfer_signed", label: "Traspaso firmado" } };
    if (unitDelivered === undefined) delete value.unitDelivered;
    else value.unitDelivered = unitDelivered;
    render(<FormalizationStageEditor item={value} allowed permissions={[{ code: "formalizacion.orders.stage.closed", effect: "allow" }]} onSaved={saved} onRefresh={refresh} />);
    const button = screen.getByRole("button", { name: "Cerrar formalización" });
    expect(button).toBeEnabled();
    expect(apiRequest).not.toHaveBeenCalled();
    fireEvent.click(button);
    fireEvent.click(await screen.findByRole("button", { name: "Confirmar cambio" }));
    await waitFor(() => {
        expect(saved).toHaveBeenCalledOnce();
    });
    expect(apiRequest).toHaveBeenCalledOnce();
    expect(requestBody(0)).toMatchObject({ targetState: "closed", expectedSequence: 3 });
});
it.each([502, 409])("shows the reconciliation error and blocks another save after unit-transfer failure (%s)", async (status) => {
    vi.mocked(apiRequest).mockRejectedValue(new ApiClientError("workflow", status, { code: "UNIT_TRANSFER_RECONCILIATION_REQUIRED" }));
    show({ ...item, state: { ...item.state, code: "transfer_signed", label: "Traspaso firmado" }, unitDelivered: true });
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "closed" } });
    await confirm();
    expect(await screen.findByText("La etapa no fue guardada. El flujo de Unidad traspasada en NetSuite requiere conciliación antes de reintentar.")).toBeTruthy();
    expect(saved).not.toHaveBeenCalled();
    expect(apiRequest).toHaveBeenCalledOnce();
    expect(screen.getByRole("button", { name: "Guardar" }).hasAttribute("disabled")).toBe(true);
});
function show(value = item, allowed = true) {
    const view = render(<FormalizationStageEditor item={value} allowed={allowed} permissions={[...ORDER_STAGES.map((stage) => ({ code: `formalizacion.orders.stage.${stage.code}`, effect: "allow" })), { code: "formalizacion.orders.stage.skip", effect: "allow" }]} onSaved={saved} onRefresh={refresh} />);
    const move = screen.queryByRole("button", { name: "Mover a otro estado" });
    if (move) fireEvent.click(move);
    return view;
}
async function confirm() {
    const reason = screen.queryByLabelText<HTMLTextAreaElement>("Motivo del cambio excepcional");
    if (reason && !reason.value) fireEvent.change(reason, { target: { value: "Excepción autorizada" } });
    fireEvent.click(await screen.findByRole("button", { name: "Guardar" }));
    fireEvent.click(await screen.findByRole("button", { name: "Confirmar cambio" }));
}
it.each(["permission", "approvals", "version"])("disables editing without %s", (missing) => {
    const value = { ...item, ...(missing === "approvals" ? { approvalsComplete: false } : {}) };
    if (missing === "version") delete value.stateVersion;
    show(value, missing !== "permission");
    expect(screen.getByRole("button", { name: "Mover a otro estado" }).hasAttribute("disabled")).toBe(true);
    expect(screen.queryByRole("combobox")).toBeNull();
});
it("requires a reason backwards, confirms and sends canonical source identity", async () => {
    vi.mocked(apiRequest).mockResolvedValue({ source: "legacy", id: "1", state: "contract_pending_send", sequence: 4, replayed: false });
    show();
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "contract_pending_send" } });
    expect(screen.getByRole("button", { name: "Guardar" }).hasAttribute("disabled")).toBe(true);
    fireEvent.change(screen.getByLabelText("Motivo del cambio excepcional"), { target: { value: "Corregir etapa" } });
    fireEvent.click(screen.getByRole("button", { name: "Guardar" }));
    expect(apiRequest).not.toHaveBeenCalled();
    fireEvent.click(await screen.findByRole("button", { name: "Confirmar cambio" }));
    await waitFor(() => {
        expect(saved).toHaveBeenCalledOnce();
    });
    expect(apiRequest).toHaveBeenCalledWith("/formalization/orders/stage", expect.objectContaining<ApiRequestOptions>({ method: "POST", body: { source: "legacy", id: "1", expectedSequence: 3, targetState: "contract_pending_send", reason: "Corregir etapa", operationId: (requestBody(0) as { operationId: string }).operationId } }));
});
it("reuses the uncertain operation key and locks its payload until a read resolves it", async () => {
    vi.mocked(apiRequest).mockRejectedValue(new TypeError("network"));
    show({ ...item, unitDelivered: true });
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "closed" } });
    await confirm();
    await screen.findByRole("alert");
    expect(screen.getByRole("combobox").hasAttribute("disabled")).toBe(true);
    expect(screen.getByLabelText("Motivo del cambio excepcional").hasAttribute("disabled")).toBe(true);
    await confirm();
    await waitFor(() => {
        expect(apiRequest).toHaveBeenCalledTimes(2);
    });
    expect(requestBody(0)).toEqual(requestBody(1));
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(screen.getByRole("button", { name: /bancaria lista/ }).hasAttribute("disabled")).toBe(true);
});
it("blocks stale retries and offers explicit refresh on 409", async () => {
    vi.mocked(apiRequest).mockRejectedValue(new ApiClientError("conflict", 409, null));
    show({ ...item, unitDelivered: true });
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
    expect(screen.getByText("No tienes permiso para cambiar la etapa.")).toBeInTheDocument();
    expect(screen.queryByText(/Faltan aprobaciones/)).toBeNull();
});
it("distinguishes missing approval data from approvals actually pending and offers refresh", () => {
    const value = { ...item };
    delete value.approvalsComplete;
    show(value);
    expect(screen.getByText("Actualiza la orden para verificar sus aprobaciones.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Actualizar orden" }));
    expect(refresh).toHaveBeenCalledOnce();
});
it("reports genuinely incomplete approvals", () => {
    show({ ...item, approvalsComplete: false });
    expect(screen.getByText("Faltan aprobaciones para cambiar la etapa.")).toBeInTheDocument();
});
it("asks to refresh when the state version was not received instead of requiring prior history", () => {
    const value = { ...item };
    delete value.stateVersion;
    show(value);
    expect(screen.getByText("Actualiza la orden para cargar su estado actual.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Actualizar orden" }));
    expect(refresh).toHaveBeenCalledOnce();
});
it.each([["contract_pending_send", "Marcar como enviado", "contract_pending_signature"]])("offers one button for the current stage (%s) that confirms and saves the next one", async (code, label, next) => {
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
    expect(screen.getByRole("button", { name: "Registrar siguiente etapa" }).hasAttribute("disabled")).toBe(true);
    expect(screen.getByText("Se requiere el contrato firmado para pasar a Gestión bancaria o etapas posteriores.")).toBeInTheDocument();
    for (const name of ["Gestión bancaria", "Pendiente de saldo", "Traspaso pendiente", "Traspaso firmado", "Formalización cerrada"]) {
        expect(screen.getByRole("option", { name }).hasAttribute("disabled")).toBe(true);
    }
    expect(apiRequest).not.toHaveBeenCalled();
});
it("permits an exceptional destination with skip permission and an observed signature", () => {
    show({ ...item, state: { ...item.state, code: "contract_pending_send" } });
    expect(screen.getByRole("option", { name: "Gestión bancaria" }).hasAttribute("disabled")).toBe(false);
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
    show({ ...item, unitDelivered: true });
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "closed" } });
    await confirm();
    expect((await screen.findByRole("alert")).textContent).toBe("Se requiere el contrato firmado para pasar a Gestión bancaria o etapas posteriores.");
    expect(screen.queryByText(/La orden cambió/)).toBeNull();
    expect(saved).not.toHaveBeenCalled();
});

it("shows only the next action without the exceptional permission", () => {
    render(<FormalizationStageEditor item={item} allowed permissions={[{ code: "formalizacion.orders.stage.pending_balance", effect: "allow" }]} onSaved={saved} onRefresh={refresh} />);
    expect(screen.queryByRole("combobox")).toBeNull();
    expect(screen.getByRole("button", { name: "Marcar gestión bancaria lista" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Guardar" })).toBeNull();
});
it("never offers the next action when its specific permission is denied", () => {
    render(
        <FormalizationStageEditor
            item={item}
            allowed
            permissions={[
                { code: "formalizacion.orders.stage.pending_balance", effect: "allow" },
                { code: "formalizacion.orders.stage.pending_balance", effect: "deny" },
            ]}
            onSaved={saved}
            onRefresh={refresh}
        />,
    );
    expect(screen.queryByRole("button", { name: "Marcar gestión bancaria lista" })).toBeNull();
});

it("confirms the next step, saves once and shows the new next action after reloading the order", async () => {
    vi.mocked(apiRequest).mockResolvedValue({ source: "legacy", id: "1", state: "pending_balance", sequence: 4, replayed: false });
    const permissions = [
        { code: "formalizacion.orders.stage.pending_balance", effect: "allow" },
        { code: "formalizacion.orders.stage.pending_transfer", effect: "allow" },
    ];
    const view = render(<FormalizationStageEditor key="v3" item={item} allowed permissions={permissions} onSaved={saved} onRefresh={refresh} />);
    fireEvent.click(screen.getByRole("button", { name: "Marcar gestión bancaria lista" }));
    expect(apiRequest).not.toHaveBeenCalled();
    fireEvent.click(await screen.findByRole("button", { name: "Confirmar cambio" }));
    await waitFor(() => {
        expect(saved).toHaveBeenCalledOnce();
    });
    expect(requestBody(0)).toMatchObject({ targetState: "pending_balance", expectedSequence: 3 });
    view.rerender(<FormalizationStageEditor key="v4" item={{ ...item, stateVersion: 4, state: { ...item.state, code: "pending_balance", label: "Pendiente de saldo" } }} allowed permissions={permissions} onSaved={saved} onRefresh={refresh} />);
    expect(screen.getByRole("button", { name: "Registrar paso a Pendiente de traspaso" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Marcar gestión bancaria lista" })).toBeNull();
});
it("requires a reason to jump directly from pending send to transfer signed", () => {
    show({ ...item, unitTransferred: true, state: { ...item.state, code: "contract_pending_send", label: "Por enviar" } });
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "transfer_signed" } });
    expect(screen.getByRole("button", { name: "Guardar" }).hasAttribute("disabled")).toBe(true);
    fireEvent.change(screen.getByLabelText("Motivo del cambio excepcional"), { target: { value: "Trámite completado fuera de Habita" } });
    expect(screen.getByRole("button", { name: "Guardar" }).hasAttribute("disabled")).toBe(false);
    expect(apiRequest).not.toHaveBeenCalled();
});

it("places the centered confirmation above the shared page overlay", async () => {
    render(<FormalizationStageEditor item={item} allowed permissions={[{ code: "formalizacion.orders.stage.pending_balance", effect: "allow" }]} onSaved={saved} onRefresh={refresh} />);
    fireEvent.click(screen.getByRole("button", { name: "Marcar gestión bancaria lista" }));
    const dialog = await screen.findByRole("dialog");
    const wrapper = dialog.closest<HTMLElement>(".ant-modal-wrap");
    expect(wrapper?.classList.contains("ant-modal-centered")).toBe(true);
    expect(Number(wrapper?.style.zIndex)).toBeGreaterThan(1299);
});

it("keeps exceptional fields inside a centered dialog, above the order panel, opened by the permission-gated action", () => {
    const permissions = [
        { code: "formalizacion.orders.stage.skip", effect: "allow" },
        { code: "formalizacion.orders.stage.pending_balance", effect: "allow" },
    ];
    render(<FormalizationStageEditor item={item} allowed permissions={permissions} onSaved={saved} onRefresh={refresh} />);
    expect(screen.queryByRole("combobox")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Mover a otro estado" }));
    const wrapper = screen.getByRole("dialog").closest<HTMLElement>(".ant-modal-wrap");
    expect(wrapper?.classList.contains("ant-modal-centered")).toBe(true);
    expect(Number(wrapper?.style.zIndex)).toBeGreaterThan(1299);
    expect(screen.getByRole("combobox", { name: "Etapa de Formalización" })).toBeInTheDocument();
});
it("hides the move action when skip is explicitly denied", () => {
    render(
        <FormalizationStageEditor
            item={item}
            allowed
            permissions={[
                { code: "formalizacion.orders.stage.skip", effect: "allow" },
                { code: "formalizacion.orders.stage.skip", effect: "deny" },
            ]}
            onSaved={saved}
            onRefresh={refresh}
        />,
    );
    expect(screen.queryByRole("button", { name: "Mover a otro estado" })).toBeNull();
});
function showApproval(value: FollowUpItem = { ...item, state: { ...item.state, code: "pending_approval" }, approvalsComplete: false, contractSigned: false }) {
    return render(<FormalizationStageEditor item={value} allowed={false} permissions={[{ code: "formalizacion.orders.approve", effect: "allow" }]} onSaved={saved} onRefresh={refresh} />);
}
it("shows a visible error alert for a confirmed absent Sandbox order", async () => {
    vi.mocked(apiRequest).mockRejectedValue(new ApiClientError("missing", 404, { code: "NETSUITE_SALES_ORDER_NOT_FOUND" }));
    showApproval();
    await confirmApproval();
    const alert = await screen.findByRole("alert");
    expect(alert.classList.contains("ant-alert-error")).toBe(true);
    expect(alert.textContent).toContain("La orden de venta no existe en NetSuite en el entorno configurado.");
    expect(saved).not.toHaveBeenCalled();
});
it("reports that NetSuite was already approved after synchronizing the Habita", async () => {
    vi.mocked(apiRequest).mockResolvedValue({ source: "legacy", id: "1", approved: true, state: "contract_pending_send", sequence: 4, replayed: false, alreadyApproved: true });
    showApproval();
    await confirmApproval();
    await waitFor(() => {
        expect(saved).toHaveBeenCalledOnce();
    });
    expect(notification.success).toHaveBeenCalledWith(expect.objectContaining({ placement: "bottomLeft", title: "Aprobación completada", description: "NetSuite ya tenía marcada la aprobación de Formalización. El Habita quedó sincronizado." }));
    expect(screen.queryByRole("alert")).toBeNull();
});
async function confirmApproval() {
    fireEvent.click(screen.getByRole("button", { name: /Aprobar Formalizaci\u00f3n/ }));
    fireEvent.click(await screen.findByRole("button", { name: /Confirmar aprobación/ }));
}
it("approves independently of stage permission after centered confirmation and refreshes only onSaved", async () => {
    vi.mocked(apiRequest).mockResolvedValue({ source: "legacy", id: "1", approved: true, state: "contract_pending_send", sequence: 4, replayed: false });
    showApproval();
    fireEvent.click(screen.getByRole("button", { name: /Aprobar Formalizaci\u00f3n/ }));
    expect(apiRequest).not.toHaveBeenCalled();
    const wrapper = (await screen.findByRole("dialog")).closest<HTMLElement>(".ant-modal-wrap");
    expect(wrapper?.classList.contains("ant-modal-centered")).toBe(true);
    expect(Number(wrapper?.style.zIndex)).toBeGreaterThan(1299);
    fireEvent.click(screen.getByRole("button", { name: /Confirmar aprobaci\u00f3n/ }));
    await waitFor(() => {
        expect(saved).toHaveBeenCalledOnce();
    });
    expect(apiRequest).toHaveBeenCalledWith("/formalization/orders/approve", expect.objectContaining({ method: "POST", retryOnUnauthorized: false, body: { source: "legacy", id: "1", expectedSequence: 3, operationId: (requestBody(0) as { operationId: string }).operationId } }));
    expect((requestBody(0) as { operationId: string }).operationId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    expect(refresh).not.toHaveBeenCalled();
});
it("retains approval operationId after network failure and prevents duplicate confirmation", async () => {
    let rejectRequest: ((reason: unknown) => void) | undefined;
    vi.mocked(apiRequest).mockImplementation(
        () =>
            new Promise((_resolve, reject) => {
                rejectRequest = reject;
            }),
    );
    showApproval();
    await confirmApproval();
    fireEvent.click(screen.getByRole("button", { name: /Confirmar aprobaci\u00f3n/ }));
    expect(apiRequest).toHaveBeenCalledOnce();
    rejectRequest?.(new TypeError("network"));
    await screen.findByRole("alert");
    vi.mocked(apiRequest).mockResolvedValue({ source: "legacy", id: "1", approved: true, state: "contract_pending_send", sequence: 4, replayed: true });
    await confirmApproval();
    await waitFor(() => {
        expect(saved).toHaveBeenCalledOnce();
    });
    expect(requestBody(0)).toEqual(requestBody(1));
});
it("blocks stale approval retries and offers targeted refresh on 409", async () => {
    vi.mocked(apiRequest).mockRejectedValue(new ApiClientError("conflict", 409, null));
    showApproval();
    await confirmApproval();
    await screen.findByText(/La orden cambió/);
    expect(screen.getByRole("button", { name: /Aprobar Formalización/ }).hasAttribute("disabled")).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Actualizar orden" }));
    expect(refresh).toHaveBeenCalledOnce();
    expect(saved).not.toHaveBeenCalled();
});
it.each([
    ["APPROVAL_PREREQUISITES_REQUIRED", "NetSuite rechazó la aprobación: faltan las aprobaciones de Jefe de Ventas y/o Desarrolladora. Revisa la orden en el entorno configurado."],
    ["SALES_ORDER_CANCELLED", "NetSuite rechazó la aprobación porque la orden está marcada como venta caída."],
])("explains the provider rejection %s instead of suggesting a blind retry", async (code, message) => {
    vi.mocked(apiRequest).mockRejectedValue(new ApiClientError("conflict", 409, { code, message: "private provider details" }));
    showApproval();
    await confirmApproval();
    expect((await screen.findByRole("alert")).textContent).toBe(message);
    expect(screen.getByRole("button", { name: /Aprobar Formalización/ }).hasAttribute("disabled")).toBe(true);
    expect(screen.getByRole("button", { name: "Actualizar orden" })).toBeInTheDocument();
    expect(saved).not.toHaveBeenCalled();
});
it.each([401, 403])("shows denied approval without reporting success for %s", async (status) => {
    vi.mocked(apiRequest).mockRejectedValue(new ApiClientError("forbidden", status, null));
    showApproval();
    await confirmApproval();
    expect((await screen.findByRole("alert")).textContent).toMatch(/permiso/);
    expect(screen.getByRole("button", { name: /Aprobar Formalización/ }).hasAttribute("disabled")).toBe(true);
    expect(saved).not.toHaveBeenCalled();
});
it("requires an observed version before approval", () => {
    const value = { ...item, state: { ...item.state, code: "pending_approval" } };
    delete value.stateVersion;
    showApproval(value);
    expect(screen.getByRole("button", { name: /Aprobar Formalización/ }).hasAttribute("disabled")).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Actualizar orden" }));
    expect(refresh).toHaveBeenCalledOnce();
});
it.each([
    { permissions: [] },
    { permissions: [{ code: "formalizacion.orders.approve", effect: "deny" }] },
    {
        permissions: [
            { code: "formalizacion.orders.approve", effect: "allow" },
            { code: "formalizacion.orders.approve", effect: "deny" },
        ],
    },
])("hides approval without allow or with deny (%j)", ({ permissions }) => {
    render(<FormalizationStageEditor item={{ ...item, state: { ...item.state, code: "pending_approval" } }} allowed permissions={permissions} onSaved={saved} onRefresh={refresh} />);
    expect(screen.queryByRole("button", { name: /Aprobar Formalización/ })).toBeNull();
    expect(apiRequest).not.toHaveBeenCalled();
});
it("does not offer approval outside pending approval", () => {
    render(<FormalizationStageEditor item={item} allowed permissions={[{ code: "formalizacion.orders.approve", effect: "allow" }]} onSaved={saved} onRefresh={refresh} />);
    expect(screen.queryByRole("button", { name: /Aprobar Formalización/ })).toBeNull();
});

it("does not retry a successful approval when the targeted refresh fails", async () => {
    vi.mocked(apiRequest).mockResolvedValue({ source: "legacy", id: "1", approved: true, state: "contract_pending_send", sequence: 4, replayed: false });
    saved.mockRejectedValue(new Error("refresh"));
    showApproval();
    await confirmApproval();
    expect((await screen.findByRole("alert")).textContent).toMatch(/aprobada.*actualizar/i);
    expect(screen.getByRole("button", { name: /Aprobar Formalización/ }).hasAttribute("disabled")).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: /Aprobar Formalizaci\u00f3n/ }));
    expect(apiRequest).toHaveBeenCalledOnce();
});
it.each([
    { source: "legacy", id: "wrong", approved: true, state: "contract_pending_send", sequence: 4, replayed: false },
    { source: "legacy", id: "1", approved: false, state: "contract_pending_send", sequence: 4, replayed: false },
    { source: "legacy", id: "1", approved: true, state: "pending_approval", sequence: 4, replayed: false },
    { source: "legacy", id: "1", approved: true, state: "contract_pending_send", sequence: -1, replayed: false },
])("does not accept an invalid approval response %j", async (response) => {
    vi.mocked(apiRequest).mockResolvedValue(response);
    showApproval();
    await confirmApproval();
    await screen.findByRole("alert");
    expect(saved).not.toHaveBeenCalled();
});
it("sends native identity unchanged and permits observed version zero", async () => {
    vi.mocked(apiRequest).mockResolvedValue({ source: "native", id: "native-id", approved: true, state: "contract_pending_send", sequence: 1, replayed: false });
    showApproval({ ...item, source: "native", id: "native-id", stateVersion: 0, state: { ...item.state, code: "pending_approval" }, approvalsComplete: false, contractSigned: false });
    await confirmApproval();
    await waitFor(() => {
        expect(saved).toHaveBeenCalledOnce();
    });
    expect(requestBody(0)).toMatchObject({ source: "native", id: "native-id", expectedSequence: 0 });
});

it.each(ORDER_STAGES)("accepts approved replay at current known state $code without forcing it backwards", async ({ code }) => {
    vi.mocked(apiRequest).mockResolvedValue({ source: "legacy", id: "1", approved: true, state: code, sequence: 9, replayed: true });
    showApproval();
    await confirmApproval();
    await waitFor(() => {
        expect(saved).toHaveBeenCalledOnce();
    });
    expect(apiRequest).toHaveBeenCalledOnce();
    expect(requestBody(0)).not.toHaveProperty("targetState");
    expect(refresh).not.toHaveBeenCalled();
});

it("explains confirmed provider approval awaiting Habita reconciliation and retries the same UUID", async () => {
    vi.mocked(apiRequest).mockRejectedValue(new ApiClientError("unavailable", 503, { code: "FORMALIZATION_APPROVAL_RECONCILIATION_REQUIRED" }));
    showApproval();
    await confirmApproval();
    expect((await screen.findByRole("alert")).textContent).toBe("NetSuite confirmó la aprobación, pero falta sincronizar Habita. Reintenta la misma operación.");
    expect(saved).not.toHaveBeenCalled();
    expect(refresh).not.toHaveBeenCalled();
    expect(apiRequest).toHaveBeenCalledOnce();
    vi.mocked(apiRequest).mockResolvedValue({ source: "legacy", id: "1", approved: true, state: "contract_pending_send", sequence: 4, replayed: true });
    await confirmApproval();
    await waitFor(() => {
        expect(saved).toHaveBeenCalledOnce();
    });
    expect(requestBody(1)).toEqual(requestBody(0));
});
it.each([null, "unavailable", { code: "OTHER_ERROR" }])("keeps unknown provider outcomes uncertain for error body %j", async (body) => {
    vi.mocked(apiRequest).mockRejectedValue(new ApiClientError("provider", 502, body));
    showApproval();
    await confirmApproval();
    expect((await screen.findByRole("alert")).textContent).toBe("No se pudo confirmar la aprobación. Puedes reintentar la misma operación.");
    expect(saved).not.toHaveBeenCalled();
});

it("accepts authoritative native identity for an approved legacy alias", async () => {
    vi.mocked(apiRequest).mockResolvedValue({ source: "native", id: "01ARZ3NDEKTSV4RRFFQ69G5FAV", approved: true, state: "bank_management", sequence: 7, replayed: true });
    showApproval();
    await confirmApproval();
    await waitFor(() => {
        expect(saved).toHaveBeenCalledOnce();
    });
    expect(requestBody(0)).toMatchObject({ source: "legacy", id: "1" });
});
it.each([
    { source: "native", id: "not-a-ulid" },
    { source: "native", id: "81ARZ3NDEKTSV4RRFFQ69G5FAV" },
    { source: "native", id: "01ARZ3NDEKTSV4RRFFQ69G5FAI" },
    { source: "legacy", id: "2" },
])("rejects invalid authoritative identity for legacy approval %j", async (identity) => {
    vi.mocked(apiRequest).mockResolvedValue({ ...identity, approved: true, state: "contract_pending_send", sequence: 4, replayed: false });
    showApproval();
    await confirmApproval();
    await screen.findByRole("alert");
    expect(saved).not.toHaveBeenCalled();
});
it.each([
    { source: "legacy", id: "1" },
    { source: "native", id: "01ARZ3NDEKTSV4RRFFQ69G5FAW" },
])("rejects native approval response identity changes %j", async (identity) => {
    vi.mocked(apiRequest).mockResolvedValue({ ...identity, approved: true, state: "contract_pending_send", sequence: 4, replayed: false });
    showApproval({ ...item, source: "native", id: "01ARZ3NDEKTSV4RRFFQ69G5FAV", state: { ...item.state, code: "pending_approval" } });
    await confirmApproval();
    await screen.findByRole("alert");
    expect(saved).not.toHaveBeenCalled();
});

it.each([true, false])("notifies confirmed approval before targeted refresh only for validated success %s", async (approved) => {
    const calls: string[] = [];
    const onApproved = vi.fn(() => {
        calls.push("approved");
    });
    const onSaved = vi.fn(() => {
        calls.push("saved");
    });
    vi.mocked(apiRequest).mockResolvedValue({ source: "legacy", id: "1", approved, state: "contract_pending_send", sequence: 4, replayed: false });
    render(<FormalizationStageEditor item={{ ...item, state: { ...item.state, code: "pending_approval" } }} allowed={false} permissions={[{ code: "formalizacion.orders.approve", effect: "allow" }]} onApproved={onApproved} onSaved={onSaved} onRefresh={refresh} />);
    await confirmApproval();
    if (approved) {
        await waitFor(() => {
            expect(calls).toEqual(["approved", "saved"]);
        });
    } else {
        await screen.findByRole("alert");
        expect(onApproved).not.toHaveBeenCalled();
        expect(onSaved).not.toHaveBeenCalled();
    }
});

it.each([401, 403])("blocks stage commands after authorization rejection %s until refresh", async (status) => {
    vi.mocked(apiRequest).mockRejectedValue(new ApiClientError("denied", status, null));
    show({ ...item, unitDelivered: true });
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "closed" } });
    await confirm();
    await screen.findByRole("alert");
    expect(screen.getByRole("combobox").hasAttribute("disabled")).toBe(true);
    expect(screen.getByRole("button", { name: "Guardar" }).hasAttribute("disabled")).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Actualizar orden" }));
    expect(refresh).toHaveBeenCalledOnce();
    expect(apiRequest).toHaveBeenCalledOnce();
});
it("retains the same quick advance operation after an unknown outcome", async () => {
    vi.mocked(apiRequest).mockRejectedValue(new TypeError("network"));
    render(<FormalizationStageEditor item={item} allowed permissions={[{ code: "formalizacion.orders.stage.pending_balance", effect: "allow" }]} onSaved={saved} onRefresh={refresh} />);
    for (let attempt = 0; attempt < 2; attempt++) {
        fireEvent.click(screen.getByRole("button", { name: /bancaria lista/ }));
        fireEvent.click(await screen.findByRole("button", { name: "Confirmar cambio" }));
        await screen.findByRole("alert");
    }
    expect(apiRequest).toHaveBeenCalledTimes(2);
    expect(requestBody(0)).toEqual(requestBody(1));
});
it("prevents duplicate stage confirmation and retries an uncertain command with its original payload", async () => {
    let rejectRequest: ((reason: unknown) => void) | undefined;
    vi.mocked(apiRequest).mockImplementation(
        () =>
            new Promise((_resolve, reject) => {
                rejectRequest = reject;
            }),
    );
    render(<FormalizationStageEditor item={item} allowed permissions={[{ code: "formalizacion.orders.stage.pending_balance", effect: "allow" }]} onSaved={saved} onRefresh={refresh} />);
    fireEvent.click(screen.getByRole("button", { name: /bancaria lista/ }));
    const confirmation = await screen.findByRole("button", { name: "Confirmar cambio" });
    fireEvent.click(confirmation);
    fireEvent.click(confirmation);
    expect(apiRequest).toHaveBeenCalledOnce();
    expect(saved).not.toHaveBeenCalled();
    rejectRequest?.(new TypeError("network"));
    await screen.findByRole("alert");
    vi.mocked(apiRequest).mockResolvedValue({ source: "legacy", id: "1", state: "pending_balance", sequence: 4, replayed: true });
    fireEvent.click(screen.getByRole("button", { name: /bancaria lista/ }));
    fireEvent.click(await screen.findByRole("button", { name: "Confirmar cambio" }));
    await waitFor(() => {
        expect(saved).toHaveBeenCalledOnce();
    });
    expect(apiRequest).toHaveBeenCalledTimes(2);
    expect(requestBody(0)).toEqual(requestBody(1));
    const operationId = (requestBody(0) as { operationId: string }).operationId;
    expect(operationId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    expect(requestBody(0)).toEqual({ source: "legacy", id: "1", expectedSequence: 3, targetState: "pending_balance", operationId });
    expect(refresh).not.toHaveBeenCalled();
});

it.each([
    ["own_funds", "pending_balance", "Pendiente de saldo"],
    ["bank_financing", "bank_management", "Gestión bancaria"],
])("requires a funds choice and routes %s", async (origin, target, label) => {
    vi.mocked(apiRequest).mockResolvedValue({ source: "legacy", id: "1", state: target, sequence: 4, replayed: false });
    render(<FormalizationStageEditor item={{ ...item, state: { ...item.state, code: "contract_pending_signature", label: "Pendiente de firma" } }} allowed permissions={ORDER_STAGES.map((stage) => ({ code: `formalizacion.orders.stage.${stage.code}`, effect: "allow" }))} onSaved={saved} onRefresh={refresh} />);
    const selector = screen.getByLabelText("Origen de fondos de compra");
    expect((selector as HTMLSelectElement).value).toBe("");
    expect(screen.getByRole("button", { name: /Registrar siguiente etapa/ }).hasAttribute("disabled")).toBe(true);
    fireEvent.change(selector, { target: { value: origin } });
    fireEvent.click(screen.getByRole("button", { name: `Registrar paso a ${label}` }));
    fireEvent.click(await screen.findByRole("button", { name: "Confirmar cambio" }));
    await waitFor(() => {
        expect(saved).toHaveBeenCalledOnce();
    });
    expect(requestBody(0)).toMatchObject({ targetState: target, purchaseFundsOrigin: origin });
});

it.each([
    ["pending_balance", "own_funds", "contract_pending_signature", "Pendiente de firma"],
    ["pending_balance", "bank_financing", "bank_management_in_progress", "Gesti\u00f3n bancaria en proceso"],
    ["bank_management_in_progress", "bank_financing", "bank_management", "Gestión bancaria"],
    ["bank_management_in_progress", null, "bank_management", "Gesti\u00f3n bancaria"],
    ["contract_pending_signature", null, "contract_pending_send", "Por enviar"],
] as const)("offers a reason-gated previous destination from %s with %s", async (current, origin, previous, label) => {
    vi.mocked(apiRequest).mockResolvedValue({ source: "legacy", id: "1", state: previous, sequence: 4, replayed: false });
    render(<FormalizationStageEditor item={{ ...item, state: { ...item.state, code: current }, purchaseFundsOrigin: origin }} allowed permissions={[...ORDER_STAGES.map((stage) => ({ code: `formalizacion.orders.stage.${stage.code}`, effect: "allow" })), { code: "formalizacion.orders.stage.skip", effect: "allow" }]} onSaved={saved} onRefresh={refresh} />);
    fireEvent.click(screen.getByRole("button", { name: `Paso anterior: ${label}` }));
    expect(screen.getByLabelText<HTMLSelectElement>("Etapa de Formalizaci\u00f3n").value).toBe(previous);
    expect(screen.getByRole("button", { name: "Guardar" }).hasAttribute("disabled")).toBe(true);
    fireEvent.change(screen.getByLabelText("Motivo del cambio excepcional"), { target: { value: "Reversi\u00f3n autorizada" } });
    await confirm();
    await waitFor(() => {
        expect(saved).toHaveBeenCalledOnce();
    });
    expect(requestBody(0)).toMatchObject({ targetState: previous, reason: "Reversi\u00f3n autorizada" });
    expect(requestBody(0)).not.toHaveProperty("purchaseFundsOrigin");
});

it("advances the historical bank stage into the new in-progress stage", async () => {
    vi.mocked(apiRequest).mockResolvedValue({ source: "legacy", id: "1", state: "bank_management_in_progress", sequence: 4, replayed: false });
    render(<FormalizationStageEditor item={{ ...item, state: { ...item.state, code: "bank_management" } }} allowed permissions={[{ code: "formalizacion.orders.stage.bank_management_in_progress", effect: "allow" }]} onSaved={saved} onRefresh={refresh} />);
    fireEvent.click(screen.getByRole("button", { name: "Iniciar gesti\u00f3n bancaria" }));
    fireEvent.click(await screen.findByRole("button", { name: "Confirmar cambio" }));
    await waitFor(() => {
        expect(saved).toHaveBeenCalledOnce();
    });
    expect(requestBody(0)).toMatchObject({ targetState: "bank_management_in_progress" });
});

it.each([false, null, undefined])("blocks transfer exceptions when paid installments are %s", (installmentsFullyPaid) => {
    show({ ...item, installmentsFullyPaid, state: { ...item.state, code: "pending_balance" } });
    expect(screen.getByRole("button", { name: "Registrar paso a Pendiente de traspaso" }).hasAttribute("disabled")).toBe(true);
    for (const code of ["pending_transfer", "transfer_signed"]) {
        expect(screen.getByRole<HTMLOptionElement>("option", { name: ORDER_STAGES.find((stage) => stage.code === code)?.label ?? code }).disabled).toBe(true);
    }
    expect(screen.getAllByText(/Cuotas pagadas por completo/i).length).toBeGreaterThan(0);
    expect(apiRequest).not.toHaveBeenCalled();
});
it("allows balance to transfer only with paid installments confirmed", () => {
    show({ ...item, installmentsFullyPaid: true, state: { ...item.state, code: "pending_balance" } });
    expect(screen.getByRole("button", { name: "Registrar paso a Pendiente de traspaso" }).hasAttribute("disabled")).toBe(false);
});
it.each(["pending_transfer", "transfer_signed", "closed"])("never allows returning to balance from %s, even with exception permission", (code) => {
    show({ ...item, state: { ...item.state, code } });
    expect(screen.getByRole<HTMLOptionElement>("option", { name: "Pendiente de saldo" }).disabled).toBe(true);
    if (code === "pending_transfer") expect(screen.getByText("No se permite volver a Pendiente de saldo desde traspaso o etapas posteriores.")).toBeInTheDocument();
});
it("warns and allows manual signature registration before NetSuite confirms the transfer", async () => {
    vi.mocked(apiRequest).mockResolvedValue({ source: "legacy", id: "1", state: "transfer_signed", sequence: 4, replayed: false });
    render(<FormalizationStageEditor item={{ ...item, unitTransferred: false, state: { ...item.state, code: "pending_transfer" } }} allowed permissions={[{ code: "formalizacion.orders.stage.transfer_signed", effect: "allow" }]} onSaved={saved} onRefresh={refresh} />);
    const next = screen.getByRole("button", { name: "Registrar etapa Traspaso firmado" });
    expect(next).toBeEnabled();
    fireEvent.click(next);
    const dialog = await screen.findByRole("dialog");
    expect(dialog).toHaveTextContent("NetSuite aún no confirma");
    fireEvent.click(screen.getByRole("button", { name: "Confirmar cambio" }));
    await waitFor(() => {
        expect(saved).toHaveBeenCalledOnce();
    });
    expect(requestBody(0)).toMatchObject({ targetState: "transfer_signed" });
});

it("unmarking installments retains transfer and blocks forward movement", () => {
    const value = { ...item, state: { ...item.state, code: "pending_transfer", label: "Pendiente de traspaso" } };
    const view = show(value);
    view.rerender(<FormalizationStageEditor item={{ ...value, installmentsFullyPaid: false }} allowed permissions={ORDER_STAGES.map((stage) => ({ code: `formalizacion.orders.stage.${stage.code}`, effect: "allow" }))} onSaved={saved} onRefresh={refresh} />);
    expect(screen.getByText("Actual: Pendiente de traspaso")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Registrar etapa Traspaso firmado" }).hasAttribute("disabled")).toBe(true);
    expect(apiRequest).not.toHaveBeenCalled();
});

it.each([false, null, undefined])("blocks backward transfer destinations without paid evidence %s", (installmentsFullyPaid) => {
    show({ ...item, installmentsFullyPaid, state: { ...item.state, code: "closed" } });
    expect(screen.getByRole<HTMLOptionElement>("option", { name: "Traspaso firmado" }).disabled).toBe(true);
    expect(screen.getByRole<HTMLOptionElement>("option", { name: "Traspaso pendiente" }).disabled).toBe(true);
});

const evidence = [true, false, null, undefined] as const;
const completionCases = evidence.flatMap((installmentsFullyPaid) => evidence.flatMap((unitTransferred) => evidence.flatMap((keysDelivered) => evidence.map((unitDelivered) => ({ installmentsFullyPaid, unitTransferred, keysDelivered, unitDelivered })))));
it.each(completionCases)("enforces all final destination predicates for %j", (flags) => {
    show({ ...item, ...flags, state: { ...item.state, code: "pending_balance" } });
    const pending = flags.installmentsFullyPaid === true && flags.unitTransferred === false && flags.unitDelivered === false;
    const signed = flags.installmentsFullyPaid === true && flags.unitTransferred === true && flags.keysDelivered === false && flags.unitDelivered === false;
    for (const [label, allowed] of [
        ["Traspaso pendiente", pending],
        ["Traspaso firmado", signed],
        ["Formalización cerrada", flags.unitDelivered === true],
    ] as const) {
        expect(screen.getByRole<HTMLOptionElement>("option", { name: label }).disabled).toBe(!allowed);
    }
    expect(apiRequest).not.toHaveBeenCalled();
});

it.each(["pending_balance", "pending_transfer", "transfer_signed"])("closes delivered units from %s without exception permission or paid evidence", async (current) => {
    vi.mocked(apiRequest).mockResolvedValue({ source: "legacy", id: "1", state: "closed", sequence: 4, replayed: false });
    render(<FormalizationStageEditor item={{ ...item, installmentsFullyPaid: false, unitTransferred: null, keysDelivered: null, unitDelivered: true, state: { ...item.state, code: current } }} allowed permissions={[{ code: "formalizacion.orders.stage.closed", effect: "allow" }]} onSaved={saved} onRefresh={refresh} />);
    fireEvent.click(screen.getByRole("button", { name: "Cerrar formalización" }));
    fireEvent.click(await screen.findByRole("button", { name: "Confirmar cambio" }));
    await waitFor(() => {
        expect(saved).toHaveBeenCalledOnce();
    });
    expect(requestBody(0)).toMatchObject({ targetState: "closed" });
    expect(requestBody(0)).not.toHaveProperty("reason");
});

it("advances paid transferred units directly from balance to signed without skip", async () => {
    vi.mocked(apiRequest).mockResolvedValue({ source: "legacy", id: "1", state: "transfer_signed", sequence: 4, replayed: false });
    render(<FormalizationStageEditor item={{ ...item, unitTransferred: true, state: { ...item.state, code: "pending_balance" } }} allowed permissions={[{ code: "formalizacion.orders.stage.transfer_signed", effect: "allow" }]} onSaved={saved} onRefresh={refresh} />);
    fireEvent.click(screen.getByRole("button", { name: "Registrar etapa Traspaso firmado" }));
    fireEvent.click(await screen.findByRole("button", { name: "Confirmar cambio" }));
    await waitFor(() => {
        expect(saved).toHaveBeenCalledOnce();
    });
    expect(requestBody(0)).toMatchObject({ targetState: "transfer_signed" });
    expect(requestBody(0)).not.toHaveProperty("reason");
});
