import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import ConfigProvider from "antd/es/config-provider";
import { StrictMode } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { ProcessViewer } from "../../src/components/processes/ProcessViewer";
import { FORMALIZATION_PROCESS } from "../../src/modules/home/formalization-processes";
import { FormalizationProcessButton } from "../../src/modules/home/FormalizationProcessButton";
import FormalizationProcessDialog from "../../src/modules/home/FormalizationProcessDialog";
import type { FollowUpItem } from "../../src/services/formalization/follow-up-service";
import { installBrowserApiDoubles } from "../support/browser";

const viewer = vi.hoisted(() => ({ importXML: vi.fn(), destroy: vi.fn(), addMarker: vi.fn(), removeMarker: vi.fn(), viewbox: vi.fn(), zoom: vi.fn(), on: vi.fn() }));
vi.mock("bpmn-js/lib/NavigatedViewer", () => ({
    default: class {
        importXML = viewer.importXML;
        destroy = viewer.destroy;
        on = viewer.on;
        get() {
            return { addMarker: viewer.addMarker, removeMarker: viewer.removeMarker, viewbox: viewer.viewbox, zoom: viewer.zoom };
        }
    },
}));
beforeEach(() => {
    vi.clearAllMocks();
    viewer.importXML.mockResolvedValue({ warnings: [] });
    viewer.zoom.mockReturnValue(1);
    viewer.viewbox.mockReturnValue({ x: 0, y: 0, width: 800, height: 400 });
    installBrowserApiDoubles();
});
afterEach(cleanup);

it("centra y marca la selección de la lista, conservando la etapa actual independiente", async () => {
    render(<ProcessViewer definition={FORMALIZATION_PROCESS} currentStep="pending_balance" />);
    await waitFor(() => {
        expect(viewer.addMarker).toHaveBeenCalledWith("pending_balance", "process-current");
    });
    await waitFor(() => {
        expect(viewer.addMarker).toHaveBeenCalledWith("pending_balance", "process-selected");
    });
    const steps = screen.getByRole("group", { name: "Pasos del proceso" });
    expect(within(steps).getByRole("button", { name: /Pendiente de saldo/ })).toHaveAttribute("aria-current", "step");
    fireEvent.click(within(steps).getByRole("button", { name: "¿Origen de fondos?" }));
    expect(viewer.removeMarker).toHaveBeenCalledWith("pending_balance", "process-selected");
    expect(viewer.removeMarker).not.toHaveBeenCalledWith("pending_balance", "process-current");
    expect(viewer.addMarker).toHaveBeenLastCalledWith("funds", "process-selected");
    expect(viewer.zoom).toHaveBeenCalledWith(1.1);
    expect(viewer.viewbox).toHaveBeenCalledWith({ x: 445, y: -87, width: 800, height: 400 });
    expect(screen.getByRole("complementary", { name: "Detalle de la actividad" })).toHaveTextContent("Fondos propios: Pendiente de saldo. Financiamiento: Gestión bancaria.");
    fireEvent.click(screen.getByRole("button", { name: "Acercar mapa" }));
    expect(viewer.zoom).toHaveBeenCalledWith(1.25);
});
it("selecciona también desde la figura o su etiqueta y retira la marca anterior", async () => {
    render(<ProcessViewer definition={FORMALIZATION_PROCESS} />);
    await waitFor(() => expect(screen.getByRole("button", { name: "Ajustar mapa" })).toBeEnabled());
    const listener = viewer.on.mock.calls.find(([event]) => event === "element.click")?.[1] as (event: { element: { id: string } }) => void;
    act(() => {
        listener({ element: { id: "contract_pending_send" } });
    });
    expect(viewer.addMarker).toHaveBeenLastCalledWith("contract_pending_send", "process-selected");
    act(() => {
        listener({ element: { id: "funds_label" } });
    });
    expect(viewer.removeMarker).toHaveBeenCalledWith("contract_pending_send", "process-selected");
    expect(viewer.addMarker).toHaveBeenLastCalledWith("funds", "process-selected");
    expect(screen.getByRole("complementary")).toHaveTextContent("¿Origen de fondos?");
    const calls = viewer.addMarker.mock.calls.length;
    act(() => {
        listener({ element: { id: "Lane_0" } });
    });
    expect(viewer.addMarker).toHaveBeenCalledTimes(calls);
});
it("permite volver al mapa completo y localizar otra vez el mismo paso", async () => {
    render(<ProcessViewer definition={FORMALIZATION_PROCESS} />);
    await waitFor(() => expect(screen.getByRole("button", { name: "Ajustar mapa" })).toBeEnabled());
    const button = screen.getByRole("button", { name: "Por enviar" });
    fireEvent.click(button);
    fireEvent.click(screen.getByRole("button", { name: "Ajustar mapa" }));
    expect(viewer.zoom).toHaveBeenLastCalledWith("fit-viewport");
    fireEvent.click(button);
    expect(viewer.viewbox.mock.calls.filter((call) => call.length === 1)).toHaveLength(2);
});
it("conserva la selección solicitada mientras se carga el diagrama", async () => {
    let resolve: (() => void) | undefined;
    viewer.importXML.mockReturnValueOnce(
        new Promise<void>((done) => {
            resolve = done;
        }),
    );
    render(<ProcessViewer definition={FORMALIZATION_PROCESS} />);
    fireEvent.click(screen.getByRole("button", { name: "Por enviar" }));
    expect(viewer.viewbox).not.toHaveBeenCalled();
    await act(async () => {
        resolve?.();
        await Promise.resolve();
    });
    expect(viewer.viewbox).toHaveBeenCalledWith({ x: 68, y: -86, width: 800, height: 400 });
    expect(viewer.addMarker).toHaveBeenLastCalledWith("contract_pending_send", "process-selected");
});
it("mantiene los pasos disponibles y permite recuperar un fallo de dibujo", async () => {
    viewer.importXML.mockRejectedValueOnce(new Error("import failed"));
    render(<ProcessViewer definition={FORMALIZATION_PROCESS} />);
    expect(await screen.findByRole("alert")).toHaveTextContent("Puedes consultar los pasos");
    fireEvent.click(screen.getByRole("button", { name: "Reintentar mapa" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Ajustar mapa" })).toBeEnabled());
    expect(viewer.destroy).toHaveBeenCalledTimes(1);
});
it("ignora una importación que termina después del desmontaje en StrictMode", async () => {
    let resolve: (() => void) | undefined;
    viewer.importXML.mockReturnValue(
        new Promise<void>((done) => {
            resolve = done;
        }),
    );
    const mounted = render(
        <StrictMode>
            <ProcessViewer definition={FORMALIZATION_PROCESS} />
        </StrictMode>,
    );
    mounted.unmount();
    await act(async () => {
        resolve?.();
        await Promise.resolve();
    });
    expect(viewer.addMarker).not.toHaveBeenCalled();
    expect(viewer.destroy).toHaveBeenCalledTimes(2);
});
it("abre y cierra el visor desde el acceso de la orden", async () => {
    render(
        <ConfigProvider theme={{ token: { motion: false } }}>
            <FormalizationProcessButton />
        </ConfigProvider>,
    );
    expect(viewer.importXML).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Ver proceso" }));
    const dialog = await screen.findByRole("dialog", { name: "Cómo funciona Formalización" });
    await waitFor(() => expect(within(dialog).getByRole("tab", { name: "Proceso principal" })).toBeVisible());
    fireEvent.click(within(dialog).getByRole("button", { name: "Cerrar proceso" }));
    await waitFor(() => {
        expect(screen.queryByRole("dialog")).toBeNull();
    });
});
it.each([
    { permissions: [] },
    {
        permissions: [
            { code: "formalizacion.orders.read", effect: "allow" },
            { code: "formalizacion.orders.addendum.read", effect: "allow" },
            { code: "formalizacion.orders.addendum.read", effect: "deny" },
        ],
    },
])("no muestra el estado de adéndum sin permiso efectivo: %j", async ({ permissions }) => {
    const item = { id: "example", number: "OV-TEST", state: { code: "bank_management" }, addendumStatus: "sent" } as FollowUpItem;
    render(<FormalizationProcessDialog item={item} permissions={permissions} onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole("tab", { name: "Adéndum · paralelo" }));
    await screen.findByText("Mapa general de adéndum · Sin posición de una orden");
    expect(document.querySelector('[aria-current="step"]')).toBeNull();
});
it("no inventa un paso de finiquito a partir de la venta caída o de la etapa comercial", async () => {
    const item = { id: "example", number: "OV-TEST", state: { code: "bank_management" }, saleLost: true } as FollowUpItem;
    render(<FormalizationProcessDialog item={item} onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole("tab", { name: "Venta caída y finiquito" }));
    await screen.findByText(/Consulta el estado real en el panel de finiquito/);
    expect(document.querySelector('[aria-current="step"]')).toBeNull();
});
