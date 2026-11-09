import "@testing-library/jest-dom/vitest";

import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { FormalizationOrderDetails } from "../../src/modules/home/FormalizationOrderDetails";
import { FormalizationOrderDrawer } from "../../src/modules/home/FormalizationOrderDrawer";
import { type DatabaseOrderDetail, type DatabaseOrderResult, getDatabaseOrder } from "../../src/services/formalization/database-order-service";
import type { FollowUpItem } from "../../src/services/formalization/follow-up-service";
import { installBrowserApiDoubles } from "../support/browser";

vi.mock("../../src/services/formalization/database-order-service", () => ({ getDatabaseOrder: vi.fn() }));
const item: FollowUpItem = { id: "legacy:208", source: "legacy", number: "RDR673", nativeCode: null, client: "Resumen no usado", project: null, unit: null, responsible: null, state: { code: "contract_pending_send", label: "Por enviar", since: null, days: null }, nextStep: "Registrar envío", completedThisYear: false, changedBy: { name: "Autor verificado", id: "user" } };
const detail: DatabaseOrderDetail = {
    sections: [
        {
            title: "Montos",
            fields: [
                { code: "total", label: "Total", value: "9007199254740993.2500", kind: "money" },
                { code: "missing", label: "Monto sin dato", value: null, kind: "money" },
            ],
        },
        {
            title: "Fechas",
            fields: [
                { code: "date", label: "Fecha de contrato", value: "2026-11-02T00:00:00Z", kind: "date" },
                { code: "invalidDate", label: "Fecha de origen", value: "2026-02-30", kind: "date" },
            ],
        },
        {
            title: "Aprobaciones",
            fields: [
                { code: "approved", label: "Aprobada", value: "yes", kind: "boolean" },
                { code: "false", label: "Cancelada", value: "no", kind: "boolean" },
            ],
        },
        { title: "Documentos", fields: [{ code: "link", label: "Expediente", value: "https://rocca.box.com/s/example", kind: "link" }] },
        { title: "Registro", fields: [] },
    ],
    currency: null,
    client: { name: "Cliente real", identification: "123", phone: null, email: "real@example.com", advisor: null, identity: { source: "legacy", id: "99" } },
    warnings: [],
};
const snapshot = (value: DatabaseOrderDetail | null = detail): DatabaseOrderResult => ({ schemaVersion: 1, observedAt: "2026-11-02T00:00:00Z", source: "legacy", order: {}, lead: null, contact: null, unitFile: null, references: [], warnings: [], ...(value ? { detail: value } : {}) });
beforeEach(() => {
    installBrowserApiDoubles();
    vi.resetAllMocks();
    vi.mocked(getDatabaseOrder).mockResolvedValue(snapshot());
});
afterEach(cleanup);
it("shows loading then all sections, empty values, exact money, calendar dates and basic client", async () => {
    render(<FormalizationOrderDetails item={item} />);
    expect(screen.getByRole("status")).toHaveAttribute("aria-busy", "true");
    await screen.findByText("Cliente real");
    expect(screen.getByText("9 007 199 254 740 993,2500")).toBeInTheDocument();
    expect(screen.getByText("02/11/2026")).toBeInTheDocument();
    expect(screen.getByText("2026-02-30")).toBeInTheDocument();
    expect(screen.getByText("Sí")).toBeInTheDocument();
    expect(screen.getByText("No")).toBeInTheDocument();
    expect(screen.getByText("Monto sin dato")).toBeInTheDocument();
    expect(screen.getAllByText("—").length).toBeGreaterThanOrEqual(3);
    expect(screen.getByText("Autor verificado")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Ver expediente" })).toHaveAttribute("href", "https://rocca.box.com/s/example");
    expect(screen.queryByText("Resumen no usado")).toBeNull();
    expect(screen.queryByRole("link", { name: "Ver perfil del cliente" })).toBeNull();
});
it.each([true, false])("gates client profile by effective permission and deny: %s", async (allowed) => {
    render(<FormalizationOrderDetails item={item} permissions={[{ code: "lead.profile.read", effect: "allow" }, ...(allowed ? [] : [{ code: "lead.profile.read", effect: "deny" }])]} />);
    await screen.findByText("Cliente real");
    const link = screen.queryByRole("link", { name: "Ver perfil del cliente" });
    if (allowed) expect(link).toHaveAttribute("href", "/home/formalization/perfil?source=legacy&id=99");
    else expect(link).toBeNull();
});
it("does not fabricate a profile link without identity", async () => {
    vi.mocked(getDatabaseOrder).mockResolvedValue(snapshot({ ...detail, client: { ...detail.client, identity: null } }));
    render(<FormalizationOrderDetails item={item} permissions={[{ code: "lead.profile.read", effect: "allow" }]} />);
    await screen.findByText("Cliente real");
    expect(screen.queryByRole("link", { name: "Ver perfil del cliente" })).toBeNull();
});
it("offers retry after failure without exposing errors", async () => {
    vi.mocked(getDatabaseOrder).mockRejectedValueOnce(new Error("secret"));
    render(<FormalizationOrderDetails item={item} />);
    expect(await screen.findByRole("alert")).not.toHaveTextContent("secret");
    fireEvent.click(screen.getByRole("button", { name: "Reintentar" }));
    await screen.findByText("Cliente real");
    expect(getDatabaseOrder).toHaveBeenCalledTimes(2);
});
it("does not invent a detail when an older endpoint omits it", async () => {
    vi.mocked(getDatabaseOrder).mockResolvedValue(snapshot(null));
    render(<FormalizationOrderDetails item={item} />);
    await screen.findByText("El detalle de la orden no está disponible.");
    expect(screen.queryByText("Resumen no usado")).toBeNull();
});
it.each(["resolve", "reject"])("ignores a stale %s after selecting another order", async (outcome) => {
    let resolve!: (value: DatabaseOrderResult) => void;
    let reject!: (error: Error) => void;
    vi.mocked(getDatabaseOrder).mockReturnValueOnce(
        new Promise((done, fail) => {
            resolve = done;
            reject = fail;
        }),
    );
    const view = render(<FormalizationOrderDetails item={item} />);
    vi.mocked(getDatabaseOrder).mockResolvedValueOnce(snapshot({ ...detail, client: { ...detail.client, name: "Otro cliente" } }));
    view.rerender(<FormalizationOrderDetails item={{ ...item, id: "legacy:209" }} />);
    await screen.findByText("Otro cliente");
    if (outcome === "resolve") resolve(snapshot());
    else reject(new Error("old failure"));
    await waitFor(() => {
        expect(screen.queryByText("Cliente real")).toBeNull();
        expect(screen.queryByRole("alert")).toBeNull();
    });
});

it("distinguishes informative linked sources from unavailable data", async () => {
    vi.mocked(getDatabaseOrder).mockResolvedValue(snapshot({ ...detail, warnings: ["client:linked_sources"] }));
    render(<FormalizationOrderDetails item={item} />);
    await screen.findByText("Datos del cliente vinculados entre ambos sistemas.");
    expect(screen.queryByText(/Algunas relaciones o datos/)).toBeNull();
});

it("preserves drawer navigation and follow-up with one authorized client read and opens the full order explicitly", async () => {
    const onViewFull = vi.fn();
    render(<FormalizationOrderDrawer item={item} position={1} total={2} onClose={() => {}} onSelectPrevious={() => {}} onSelectNext={() => {}} onViewFull={onViewFull} />);
    const drawer = screen.getByRole("dialog");
    expect(getDatabaseOrder).toHaveBeenCalledExactlyOnceWith({ source: "legacy", id: "legacy:208" }, undefined);
    expect(within(drawer).getByText("Seguimiento")).toBeInTheDocument();
    expect(within(drawer).getByRole("button", { name: "Orden anterior" })).toBeDisabled();
    expect(within(drawer).getByRole("button", { name: "Orden siguiente" })).toBeEnabled();
    expect(within(drawer).queryByText("Cliente y unidad")).toBeNull();
    expect(within(drawer).queryByLabelText("Detalle completo de la orden")).toBeNull();
    fireEvent.click(within(drawer).getByRole("button", { name: "Ver orden completa" }));
    expect(onViewFull).toHaveBeenCalledTimes(1);
    await screen.findByText("Contacto");
    expect(getDatabaseOrder).toHaveBeenCalledTimes(1);
});

it("labels the authoritative returned source and suppresses an obsolete actor from the requested source", async () => {
    vi.mocked(getDatabaseOrder).mockResolvedValue({ ...snapshot(), source: "native" });
    render(<FormalizationOrderDetails item={item} />);
    await screen.findByText("Datos de la orden · Habita");
    expect(screen.queryByText("Datos de la orden · Sistema anterior")).toBeNull();
    expect(screen.queryByText("Autor verificado")).toBeNull();
});
