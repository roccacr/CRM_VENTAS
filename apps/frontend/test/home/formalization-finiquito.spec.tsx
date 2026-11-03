import "@testing-library/jest-dom/vitest";

import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { FormalizationFiniquito } from "../../src/modules/home/FormalizationFiniquito";
import { FormalizationStageEditor } from "../../src/modules/home/FormalizationStageEditor";
import { ApiClientError, apiRequest } from "../../src/services/api/api-client";
import type { FollowUpItem } from "../../src/services/formalization/follow-up-service";
import { installBrowserApiDoubles } from "../support/browser";
vi.mock("../../src/services/api/api-client", async (original) => ({ ...(await original()), apiRequest: vi.fn() }));
const item = { source: "legacy", id: "legacy:12", saleLost: true, contractSigned: true, state: { code: "bank_management", label: "Gestión bancaria" } } as FollowUpItem;
beforeEach(() => {
    installBrowserApiDoubles();
    vi.mocked(apiRequest).mockReset();
});
afterEach(cleanup);
it.each([
    [false, true],
    [true, false],
    [false, false],
    [undefined, true],
])("oculta el botón sin las dos condiciones %s/%s", (saleLost, contractSigned) => {
    render(<FormalizationFiniquito item={{ ...item, saleLost, contractSigned } as FollowUpItem} allowed />);
    expect(screen.queryByText("Venta caída · Finiquito")).toBeNull();
    expect(apiRequest).not.toHaveBeenCalled();
});
it("inicia la rama y conserva la etapa de origen", async () => {
    vi.mocked(apiRequest).mockResolvedValueOnce({ eligible: true, status: null, version: 0, originStage: null, canUpdate: true }).mockResolvedValueOnce({ eligible: true, status: "pending_send", version: 1, originStage: "bank_management", canUpdate: true });
    render(<FormalizationFiniquito item={item} allowed />);
    fireEvent.click(await screen.findByRole("button", { name: "Gestionar finiquito" }));
    await waitFor(() => expect(screen.getByRole("button", { name: /Registrar envío/ })).toBeVisible());
    expect(apiRequest).toHaveBeenLastCalledWith("/formalization/orders/finiquito", expect.objectContaining({ method: "POST", body: expect.objectContaining({ source: "legacy", id: "12", status: "pending_send", expectedVersion: 0 }) as unknown }));
    expect(screen.getByText(/Venta caída en:/)).toHaveTextContent("Gestión bancaria");
});
it("la lectura no concede escritura", async () => {
    vi.mocked(apiRequest).mockResolvedValue({ eligible: true, status: "sent", version: 2, originStage: "bank_management", canUpdate: false });
    render(<FormalizationFiniquito item={item} allowed={false} />);
    await waitFor(() => {
        expect(apiRequest).toHaveBeenCalledOnce();
    });
    expect(screen.getByText("Finiquito enviado")).toBeVisible();
    expect(screen.queryByRole("button", { name: "Registrar firma" })).toBeNull();
});
it("una firma registrada termina la rama", async () => {
    vi.mocked(apiRequest).mockResolvedValue({ eligible: true, status: "signed", version: 3, originStage: "bank_management", canUpdate: true });
    render(<FormalizationFiniquito item={item} allowed />);
    expect(await screen.findByText("Proceso de finiquito completado")).toBeVisible();
    expect(screen.getByText("Finiquito firmado").closest("li")).toHaveAttribute("aria-current", "step");
    expect(screen.queryByRole("button", { name: "Registrar firma" })).toBeNull();
});

it("confirma envío y firma secuenciales antes de registrar cada cambio", async () => {
    vi.mocked(apiRequest).mockResolvedValueOnce({ eligible: true, status: "pending_send", version: 1, originStage: "bank_management", canUpdate: true }).mockResolvedValueOnce({ eligible: true, status: "sent", version: 2, originStage: "bank_management", canUpdate: true }).mockResolvedValueOnce({ eligible: true, status: "signed", version: 3, originStage: "bank_management", canUpdate: true });
    render(<FormalizationFiniquito item={item} allowed />);
    fireEvent.click(await screen.findByRole("button", { name: /Registrar envío/ }));
    expect(apiRequest).toHaveBeenCalledOnce();
    fireEvent.click(await screen.findByRole("button", { name: "Confirmar registro" }));
    fireEvent.click(await screen.findByRole("button", { name: /Registrar firma/ }));
    const signatureDialog = await screen.findByRole("dialog", { name: "¿Confirmar finiquito firmado?" });
    fireEvent.click(within(signatureDialog).getByRole("button", { name: "Confirmar registro" }));
    expect(await screen.findByText("Proceso de finiquito completado")).toBeVisible();
    expect(
        vi
            .mocked(apiRequest)
            .mock.calls.slice(1)
            .map((call) => (call[1]?.body as { status: string }).status),
    ).toEqual(["sent", "signed"]);
});
it("reintenta una respuesta incierta con el mismo UUID y payload", async () => {
    vi.mocked(apiRequest).mockResolvedValueOnce({ eligible: true, status: null, version: 0, originStage: null, canUpdate: true }).mockRejectedValueOnce(new Error("lost response")).mockResolvedValueOnce({ eligible: true, status: "pending_send", version: 1, originStage: "bank_management", canUpdate: true });
    render(<FormalizationFiniquito item={item} allowed />);
    fireEvent.click(await screen.findByRole("button", { name: "Gestionar finiquito" }));
    fireEvent.click(await screen.findByRole("button", { name: "Reintentar registro" }));
    await screen.findByRole("button", { name: /Registrar envío/ });
    expect(vi.mocked(apiRequest).mock.calls[1]?.[1]?.body).toEqual(vi.mocked(apiRequest).mock.calls[2]?.[1]?.body);
});
it("un conflicto bloquea la escritura hasta actualizar", async () => {
    vi.mocked(apiRequest)
        .mockResolvedValueOnce({ eligible: true, status: null, version: 0, originStage: null, canUpdate: true })
        .mockRejectedValueOnce(new ApiClientError("changed", 409, {}));
    render(<FormalizationFiniquito item={item} allowed />);
    fireEvent.click(await screen.findByRole("button", { name: "Gestionar finiquito" }));
    expect(await screen.findByRole("button", { name: "Actualizar finiquito" })).toBeVisible();
    expect(screen.getByRole("button", { name: /Gestionar finiquito/ })).toBeDisabled();
    expect(screen.queryByRole("button", { name: "Reintentar registro" })).toBeNull();
});

it("una venta caída no permite avanzar por la etapa comercial", () => {
    const { container } = render(<FormalizationStageEditor item={item} allowed onSaved={vi.fn()} onRefresh={vi.fn()} />);
    expect(container).toBeEmptyDOMElement();
    expect(apiRequest).not.toHaveBeenCalled();
});
