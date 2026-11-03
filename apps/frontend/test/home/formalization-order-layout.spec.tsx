import "@testing-library/jest-dom/vitest";

import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { FormalizationOrderRecord } from "../../src/modules/home/FormalizationOrderPreview";
import { getDatabaseOrder } from "../../src/services/formalization/database-order-service";
import type { FollowUpItem } from "../../src/services/formalization/follow-up-service";
import { readNetsuitePrimary } from "../../src/services/formalization/netsuite-primary";
import { installBrowserApiDoubles } from "../support/browser";

vi.mock("../../src/services/formalization/database-order-service", () => ({ getDatabaseOrder: vi.fn().mockResolvedValue({ source: "legacy", detail: undefined }) }));
beforeEach(installBrowserApiDoubles);
afterEach(() => {
    cleanup();
    vi.clearAllMocks();
});

it("conserva la ficha original completa de la orden sin insertar otro detalle ni su consulta adicional", () => {
    const item: FollowUpItem = { id: "legacy:208", source: "legacy", number: "RDR673", nativeCode: null, client: "Cliente de la orden", project: { id: "project", name: "Proyecto de la orden" }, unit: "Unidad de la orden", responsible: null, state: { code: "contract_pending_send", label: "Por enviar", since: null, days: null }, nextStep: "Registrar envío", completedThisYear: false };
    const primary = readNetsuitePrimary({ schemaVersion: 1, order: { source: "legacy", id: "208", netsuiteId: "123" }, data: { status: 200, data: { id: "123", type: "salesorder", fields: { initialtranid: "RDR673", currencyname: "US Dollar", custbody13: "381000", total: "391680", subtotal: "391680" } } } });
    render(<FormalizationOrderRecord item={item} primary={primary} onBack={() => {}} />);
    expect(screen.getByRole("heading", { name: "Orden de venta RDR673" })).toBeInTheDocument();
    for (const name of ["Información primaria", "Información de ventas", "Autorización de venta", "Resumen"]) expect(screen.getByRole("heading", { name })).toBeInTheDocument();
    for (const name of ["Artículos", "Reserva", "Detalle de pago", "OneDrive"]) expect(screen.getByRole("tab", { name })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Ver bitácora de la orden" })).toBeInTheDocument();
    expect(within(screen.getByRole("region", { name: "Información primaria" })).getByText("US Dollar")).toBeInTheDocument();
    expect(within(screen.getByRole("region", { name: "Resumen" })).getAllByText("391,680").length).toBeGreaterThan(0);
    expect(screen.queryByLabelText("Detalle completo de la orden")).not.toBeInTheDocument();
    expect(screen.queryByRole("status", { name: "Detalle de la orden" })).not.toBeInTheDocument();
    expect(getDatabaseOrder).not.toHaveBeenCalled();
});
