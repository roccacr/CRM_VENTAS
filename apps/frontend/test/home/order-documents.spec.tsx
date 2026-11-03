import "@testing-library/jest-dom/vitest";

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { FormalizationOrderDocuments } from "../../src/modules/home/FormalizationOrderDocuments";
import { FormalizationRecordSummary } from "../../src/modules/home/FormalizationRecordSummary";
import type { FollowUpItem } from "../../src/services/formalization/follow-up-service";
import { createOrderFolder, readOrderDocuments, uploadOrderDocument } from "../../src/services/formalization/order-documents-service";
import { installBrowserApiDoubles } from "../support/browser";
vi.mock("../../src/services/formalization/order-documents-service", () => ({ readOrderDocuments: vi.fn(), createOrderFolder: vi.fn(), uploadOrderDocument: vi.fn(), orderDocumentLink: vi.fn() }));
const item: FollowUpItem = { id: "legacy:78", source: "legacy", number: "LV208", nativeCode: null, client: "Cliente", project: null, unit: null, responsible: null, state: { code: "contract_pending_send", label: "Por enviar", since: null, days: null }, nextStep: "Registrar envío", completedThisYear: false };
const permissions = ["formalizacion.orders.documents.read", "formalizacion.orders.documents.write"].map((code) => ({ code, effect: "allow" }));
const loaded = { reference: "10518461", folder: { id: "folder", name: "10518461" }, files: [{ id: "file", name: "contrato.pdf", size: 100, modifiedAt: null }], canWrite: true };
beforeEach(() => {
    installBrowserApiDoubles();
    vi.resetAllMocks();
    vi.mocked(readOrderDocuments).mockResolvedValue(loaded);
    vi.mocked(createOrderFolder).mockResolvedValue({ created: true, auditRecorded: true });
    vi.mocked(uploadOrderDocument).mockResolvedValue({ auditRecorded: true });
});
afterEach(cleanup);
it("no consulta Graph al abrir la orden hasta seleccionar OneDrive", async () => {
    render(<FormalizationRecordSummary item={item} effectivePermissions={permissions} />);
    expect(readOrderDocuments).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("tab", { name: "OneDrive" }));
    expect(await screen.findByText("contrato.pdf")).toBeInTheDocument();
    expect(readOrderDocuments).toHaveBeenCalledWith(expect.objectContaining({ source: "legacy", id: "legacy:78" }), expect.any(AbortSignal));
});
it("sin permiso o con deny no muestra archivos ni hace consultas", () => {
    render(<FormalizationOrderDocuments item={item} permissions={[...permissions, { code: permissions[0]?.code ?? "", effect: "deny" }]} />);
    expect(screen.getByText(/No tienes permiso/)).toBeInTheDocument();
    expect(readOrderDocuments).not.toHaveBeenCalled();
});
it("un lector ve la lista pero no puede subir", async () => {
    render(<FormalizationOrderDocuments item={item} permissions={[{ code: "formalizacion.orders.documents.read", effect: "allow" }]} />);
    await screen.findByText("contrato.pdf");
    expect(screen.queryByRole("button", { name: "Seleccionar archivos" })).not.toBeInTheDocument();
});
it("una carpeta ausente no se crea hasta pulsar el botón", async () => {
    vi.mocked(readOrderDocuments).mockResolvedValueOnce({ ...loaded, folder: null, files: [] });
    render(<FormalizationOrderDocuments item={item} permissions={permissions} />);
    const create = await screen.findByRole("button", { name: "Crear carpeta de la orden" });
    expect(createOrderFolder).not.toHaveBeenCalled();
    fireEvent.click(create);
    await screen.findByText("contrato.pdf");
    expect(createOrderFolder).toHaveBeenCalledWith(item);
});
it("un duplicado pide elección y cancelar no sube", async () => {
    const view = render(<FormalizationOrderDocuments item={item} permissions={permissions} />);
    await screen.findByText("contrato.pdf");
    const input = view.container.querySelector('input[type="file"]');
    if (!input) throw new Error("Input ausente");
    fireEvent.change(input, { target: { files: [new File(["abc"], "contrato.pdf")] } });
    fireEvent.click(await screen.findByRole("button", { name: "Cancelar" }));
    await waitFor(() => {
        expect(screen.getByRole("button", { name: "Seleccionar archivos" })).toBeEnabled();
    });
    expect(uploadOrderDocument).not.toHaveBeenCalled();
});
it("renombrar un duplicado conserva esa elección y envía la identidad de la orden", async () => {
    const view = render(<FormalizationOrderDocuments item={item} permissions={permissions} />);
    await screen.findByText("contrato.pdf");
    const input = view.container.querySelector('input[type="file"]');
    if (!input) throw new Error("Input ausente");
    fireEvent.change(input, { target: { files: [new File(["abc"], "contrato.pdf")] } });
    fireEvent.click(await screen.findByRole("button", { name: "Renombrar copia" }));
    await waitFor(() => {
        expect(uploadOrderDocument).toHaveBeenCalled();
        const call = vi.mocked(uploadOrderDocument).mock.calls[0];
        expect(call?.[0]).toEqual(item);
        expect(call?.[2].conflict).toBe("rename");
        expect(call?.[2].signal).toBeInstanceOf(AbortSignal);
    });
});
it("cancelar la vista aborta la carga en curso", async () => {
    vi.mocked(uploadOrderDocument).mockReturnValue(new Promise(() => {}));
    const view = render(<FormalizationOrderDocuments item={item} permissions={permissions} />);
    await screen.findByText("contrato.pdf");
    const input = view.container.querySelector('input[type="file"]');
    if (!input) throw new Error("Input ausente");
    fireEvent.change(input, { target: { files: [new File(["abc"], "nuevo.pdf")] } });
    await waitFor(() => {
        expect(uploadOrderDocument).toHaveBeenCalled();
    });
    const signal = vi.mocked(uploadOrderDocument).mock.calls[0]?.[2].signal;
    view.unmount();
    expect(signal?.aborted).toBe(true);
});
