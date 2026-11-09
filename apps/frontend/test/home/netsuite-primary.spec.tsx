import "@testing-library/jest-dom/vitest";

import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";

import { FormalizationRecordSummary } from "../../src/modules/home/FormalizationRecordSummary";
import type { FollowUpItem } from "../../src/services/formalization/follow-up-service";
import type { NetsuiteOrderResult } from "../../src/services/formalization/netsuite-order-service";
import { readNetsuitePrimary } from "../../src/services/formalization/netsuite-primary";
const result: NetsuiteOrderResult = {
    schemaVersion: 1,
    order: { source: "legacy", id: "legacy:208", netsuiteId: "11998725" },
    data: {
        status: 200,
        data: { id: "11998725", type: "salesorder", fields: { initialtranid: "RDR673", trandate: "31/01/2025", custbody68: "17/03/2025", currency: "1", currencyname: "US Dollar", memo: "--", custbody90: "T", custbody51: "T", custbody91: "F", custbody105: "F", custbody43: "F", custbody103: "F", custbody_ix_comision_pagada: "F", custbody_entrega_de_llaves: "F", custbody274: "F", shipdate: "31/01/2025", department: "15" } },
        cli: JSON.stringify("112829 Francisco Yau Cheng"),
        Subsidaria: JSON.stringify("Rocca Desarrollos Residenciales"),
        Departamento: JSON.stringify("Ventas"),
        Clase: JSON.stringify("LE Gaia"),
        Ubi: JSON.stringify("LE Gaia"),
    },
};
const order: FollowUpItem = { id: "legacy:208", source: "legacy", number: "RDR673", nativeCode: null, client: "Cliente según BD", project: null, unit: null, responsible: null, state: { code: "contract_pending_send", label: "Por enviar", since: null, days: null }, nextStep: "Registrar envío", completedThisYear: false };
afterEach(cleanup);
it("projects the exact RESTlet nesting and decodes display strings without using select IDs", () => {
    const mapped = readNetsuitePrimary(result);
    expect(mapped.fields).toMatchObject({ "N.º de pedido": "RDR673", Cliente: "112829 Francisco Yau Cheng", Fecha: "31/01/2025", "Firma de contrato": "17/03/2025", Moneda: "US Dollar", Subsidiaria: "Rocca Desarrollos Residenciales", Departamento: "Ventas", Clase: "LE Gaia", Ubicación: "LE Gaia", Nota: "--" });
    expect(mapped.fields["Estado de cuenta"]).toBeNull();
    expect(mapped.fields["Traspaso / entrega de llaves"]).toBeNull();
    expect(mapped.fields["Lectura del medidor de agua"]).toBeNull();
    expect(mapped.checks).toMatchObject({ "Contrato firmado": true, "Cierre firmado": true, "Unidad entregada": false, "Comisión aprobada": false, "Comisión cancelada": false });
});
it("keeps absent checks unknown instead of inventing unchecked answers", () => {
    const mapped = readNetsuitePrimary({ ...result, data: { status: 200, data: { type: "salesorder", fields: { initialtranid: "RDR1", currency: "1" } } } });
    expect(mapped.fields.Moneda).toBeNull();
    expect(mapped.checks["Contrato firmado"]).toBeNull();
});
it("rejects a provider record for another transaction and malformed upstream data", () => {
    expect(() => readNetsuitePrimary({ ...result, order: { ...result.order, netsuiteId: "999" } })).toThrow();
    expect(() => readNetsuitePrimary({ ...result, data: { status: 500 } })).toThrow();
});
it("fills only primary information and the nine approved checks, keeping database highlights and other sections untouched", () => {
    render(<FormalizationRecordSummary item={order} primary={readNetsuitePrimary(result)} />);
    const section = screen.getByRole("region", { name: "Información primaria" });
    expect(within(section).getByText("112829 Francisco Yau Cheng")).toBeInTheDocument();
    expect(within(section).getByText("RDR673")).toBeInTheDocument();
    expect(within(section).getByText("US Dollar")).toBeInTheDocument();
    expect(screen.getByLabelText("Datos clave de la orden")).toHaveTextContent("Cliente según BD");
    const margin = screen.getByRole("complementary");
    expect(within(margin).getByRole("list", { name: "Hitos de la orden" })).toHaveTextContent("Contrato firmadoSí");
    expect(within(margin).getByRole("list", { name: "Hitos de la orden" })).toHaveTextContent("Unidad entregadaNo");
    expect(within(margin).getByRole("list", { name: "Aprobaciones" })).toHaveTextContent("Aprobación jefe de ventasSin dato");
    for (const label of ["Autorización de venta"]) for (const value of screen.getByRole("region", { name: label }).querySelectorAll("dd")) expect(value).toHaveTextContent("Sin dato");
});

it("maps sales display names, exact dates and decimal amounts", () => {
    const data = {
        status: 200,
        data: { id: "11998725", type: "salesorder", fields: { initialtranid: "RDR673", saleseffectivedate: "31/01/2025", custbody114: "31/12/2026", custbody140: "31/12/2026", custbody_ix_total_amount: "391680.00", custbody16: "2000.00", custbody36: "2000.00", custbody116: "-", custbody_mezzanine_verifica: "F" } },
        Expediente: JSON.stringify("LE-Ga FF008"),
        MOTIVO_COMPRA: JSON.stringify("Primera Casa"),
        METODO_PAGO: JSON.stringify("Avance De Obra"),
        CAMPANA: JSON.stringify("20 Landing"),
        Oportunidad: JSON.stringify("Oportunidad #RDR1098"),
        CREADO: JSON.stringify("Estimación #RDR601"),
        FONDOS: JSON.stringify("Financiado"),
        vendedor: JSON.stringify("Claudio Córdoba - RDG"),
        socio: JSON.stringify(""),
        MOTIVO_CANCE: JSON.stringify(""),
    };
    const mapped = readNetsuitePrimary({ ...result, data });
    expect(mapped.sales).toMatchObject({
        "Unidad expediente ligado VTA": "LE-Ga FF008",
        "Motivo de compra": "Primera Casa",
        "Método de pago": "Avance De Obra",
        "Fondos de compra": "Financiado",
        "Fecha de vigencia de la venta": "31/01/2025",
        "Entrega estimada": "31/12/2026",
        "Fecha de entrega contractual": "31/12/2026",
        "Campaña de marketing": "20 Landing",
        Oportunidad: "Oportunidad #RDR1098",
        "Creado desde": "Estimación #RDR601",
        "Representante de ventas": "Claudio Córdoba - RDG",
        Socio: null,
        "Vigencia de garantía": null,
        "Fecha adenda": null,
        "Motivo de cancelación de reserva o venta caída": null,
        "Comentarios cancelación de reserva": "-",
        "Precio de venta": "391,680.00",
        "Monto cortesías": "2,000.00",
    });
    expect(mapped.checks.Mezzanine).toBe(false);
    render(<FormalizationRecordSummary item={order} primary={mapped} />);
    const sales = screen.getByRole("region", { name: "Información de ventas" });
    expect(within(sales).getByText("LE-Ga FF008")).toBeInTheDocument();
    expect(within(sales).getByText("Estimación #RDR601")).toBeInTheDocument();
    expect(within(sales).getByText("391,680.00")).toBeInTheDocument();
    expect(within(sales).getByText("2,000.00")).toBeInTheDocument();
    expect(
        within(screen.getByRole("list", { name: "Condiciones comerciales" }))
            .getByText("Mezzanine")
            .closest("li"),
    ).toHaveTextContent("MezzanineNo");
    expect(within(screen.getByRole("region", { name: "Autorización de venta" })).getByText("2,000.00")).toBeInTheDocument();
});
it("preserves zero and decimal precision and does not manufacture missing dates or unchecked flags", () => {
    const mapped = readNetsuitePrimary({ ...result, data: { status: 200, data: { type: "salesorder", fields: { initialtranid: "RDR673", custbody_ix_total_amount: "12345678901234567890.1234", custbody16: "0.00", custbody36: "0.00", custbodytpv_vigencia_garantia: "12/12/2027" } } } });
    expect(mapped.sales["Precio de venta"]).toBe("12,345,678,901,234,567,890.1234");
    expect(mapped.sales["Monto cortesías"]).toBe("0.00");
    expect(mapped.sales["Vigencia de garantía"]).toBe("12/12/2027");
    expect(mapped.sales["Fecha de entrega contractual"]).toBeNull();
    expect(mapped.checks.Mezzanine).toBeNull();
});

it("keeps a pre-sales snapshot readable during Fast Refresh without crashing the record", () => {
    const current = readNetsuitePrimary(result);
    const previous = { fields: current.fields, checks: current.checks };
    render(<FormalizationRecordSummary item={order} primary={previous} />);
    expect(within(screen.getByRole("region", { name: "Información primaria" })).getByText("RDR673")).toBeInTheDocument();
    for (const value of screen.getByRole("region", { name: "Información de ventas" }).querySelectorAll("dd")) expect(value).toHaveTextContent("Sin dato");
});

it("handles partially available presentation sections without inventing confirmations", () => {
    render(<FormalizationRecordSummary item={order} primary={{}} />);
    for (const name of ["Información primaria", "Información de ventas"]) for (const value of screen.getByRole("region", { name }).querySelectorAll("dd")) expect(value).toHaveTextContent("Sin dato");
    expect(screen.getByRole("list", { name: "Hitos de la orden" })).toHaveTextContent("Contrato firmadoSin dato");
});

it("maps authorization amounts, percentages and exactly the seven approved authorization flags", () => {
    const fields = {
        initialtranid: "RDR673",
        custbody13: "381000.00",
        custbody22: "362680.00",
        custbody14: "0.0%",
        custbody15: "0.00",
        custbody16: "2000.00",
        custbody35: "Aplicable en extras",
        custbody46: "27000.00",
        custbody47: "Mezanine con bodega",
        custbodyix_salesorder_cashback: "0.00",
        custbody17: "389680.00",
        custbody18: "361950.00",
        custbody19: "27730.00",
        custbody185: "10680.00",
        custbody20: "0.28%",
        custbody21: "1091.10",
        custbody71: "0.00",
        exchangerate: "510.66",
        primarycurrencyfxrate: "455.53",
        custbody_ov_cargos_adicionales: "0.00",
        custbody_aprueba_jefe_ventas: "T",
        custbodyid_firma_rc: "T",
        custbodyid_firma_rocca: "T",
        custbody74: "T",
        custbody73: "F",
        custbody141: "T",
        custbody157: "T",
    };
    const mapped = readNetsuitePrimary({ ...result, data: { status: 200, data: { type: "salesorder", fields }, UNIDAD: JSON.stringify(""), Expediente: JSON.stringify("NO USAR ESTA UNIDAD") } });
    expect(mapped.authorization).toMatchObject({
        "Precio de lista": "381,000.00",
        "Precio cálculo comisión corredor": "362,680.00",
        "% comisión del corredor": "0.0%",
        "Monto de comisión de corredor": "0.00",
        "IVA corredor (13 %)": null,
        "Monto total de cortesías": "2,000.00",
        "Descripción de cortesías": "Aplicable en extras",
        "Monto extras sobre el precio de lista": "27,000.00",
        "Descripción de extras sobre el precio de lista": "Mezanine con bodega",
        Cashback: "0.00",
        "Precio de venta neto": "389,680.00",
        "Precio de venta mínimo": "361,950.00",
        "Diferencia entre PVN y PVM": "27,730.00",
        "Comisión del asesor %": "0.28%",
        "Monto de comisión del asesor": "1,091.10",
        "Monto de comisión segundo asesor": "0.00",
        "Unidad expediente ligado": null,
        "Comentario de autorización de venta": null,
        "Tipo de cambio": "510.66",
        "Cargos adicionales": "0.00",
        "Avisos importantes": null,
    });
    expect(mapped.checks).toMatchObject({ "Aprobación jefe de ventas": true, "Aprobación formalización": true, "Aprobación desarrolladora": true, "Cálculo comisión asesor (auto)": true, "Cálculo comisión corredor (auto)": false, "No paga traspaso S.A.": true, "No paga cesión de acciones": true });
    render(<FormalizationRecordSummary item={order} primary={mapped} />);
    const auth = screen.getByRole("region", { name: "Autorización de venta" });
    for (const value of ["381,000.00", "362,680.00", "389,680.00", "361,950.00", "27,730.00", "0.28%", "1,091.10", "510.66", "Aplicable en extras"]) expect(within(auth).getByText(value)).toBeInTheDocument();
    for (const label of ["Comentario de autorización de venta", "Avisos importantes"]) expect(within(auth).queryByText(label)).not.toBeInTheDocument();
    expect(screen.getByRole("list", { name: "Aprobaciones" })).toHaveTextContent("Aprobación desarrolladoraSí");
    expect(screen.getByRole("list", { name: "Cálculos de comisión" })).toHaveTextContent("Cálculo comisión corredor (auto)No");
    expect(screen.getByRole("list", { name: "Condiciones comerciales" })).toHaveTextContent("No paga cesión de accionesSí");
});
it("retains older snapshots without authorization and does not reuse a different unit or recalculate missing IVA", () => {
    const mapped = readNetsuitePrimary({ ...result, data: { status: 200, data: { type: "salesorder", fields: { initialtranid: "RDR673", custbody15: "100.00" } }, UNIDAD: JSON.stringify("Unidad específica"), Expediente: JSON.stringify("Otra unidad") } });
    expect(mapped.authorization["Unidad expediente ligado"]).toBe("Unidad específica");
    expect(mapped.authorization["IVA corredor (13 %)"]).toBeNull();
    expect(mapped.checks["Cálculo comisión corredor (auto)"]).toBeNull();
    const previous = { fields: mapped.fields, sales: mapped.sales, checks: mapped.checks };
    render(<FormalizationRecordSummary item={order} primary={previous} />);
    for (const value of screen.getByRole("region", { name: "Autorización de venta" }).querySelectorAll("dd")) expect(value).toHaveTextContent("Sin dato");
});

it("shows a zero commission base when returned by the current provider, without deriving one from sale prices", () => {
    const mapped = readNetsuitePrimary({ ...result, data: { status: 200, data: { type: "salesorder", fields: { initialtranid: "RDR673", custbody22: "0.00", custbody17: "389680.00" } } } });
    expect(mapped.authorization["Precio cálculo comisión corredor"]).toBe("0.00");
    expect(mapped.authorization["Monto de comisión de corredor"]).toBeNull();
});

it("maps articles, reservation and payment without mixing distinct amounts or inventing missing dates", () => {
    const mapped = readNetsuitePrimary({
        ...result,
        data: {
            status: 200,
            METODO_PAGO: JSON.stringify("Avance De Obra"),
            data: {
                id: "11998725",
                type: "salesorder",
                fields: {
                    custbody132: "-16320.00",
                    custbody52: "4000.00",
                    custbody39: "58752.00",
                    custbody185: "10680.00",
                    custbody188: "1",
                    custbody189: "00951773",
                    custbody207: "4000.00",
                    custbody208: "30/01/2025",
                    custbody190: "Coordinar modificaciones",
                    custbody_ix_salesorder_monto_prima: "54752.00",
                    custbodyix_salesorder_hito1: "49939.20",
                    custbody_ix_salesorder_hito2: "83232.00",
                    custbody_i_amount_hitos: "0.0",
                    custbody_total_hitos_amount: "0.00",
                    custbody211: "0.00",
                    custbody163: "332928.00",
                    custbody60: "15",
                    custbody62: "0.15%",
                },
            },
        },
    });
    expect(mapped.articles).toEqual({ "Monto descuento directo": "-16,320.00", "Monto reserva": "4,000.00", "Prima total": "58,752.00", "Diferencia de extras sobre el precio de lista": "10,680.00" });
    expect(mapped.reservation).toMatchObject({ "Medio de pago": "Transferencia", "Número de transacción": "00951773", "Monto reserva aplicada": "4,000.00", "Fecha de reserva aplicada": "30/01/2025", "Monto pre reserva": null, "Fecha de pre reserva": null });
    expect(mapped.payment).toMatchObject({ "Monto prima": "54,752.00", "Hito 1": "49,939.20", "Hito 2": "83,232.00", "Monto total hitos": "0.0", "Monto hitos total": "0.00", "Monto prima neta (no editable)": "0.00", "Prima %": "15", "H1 %": "0.15%", "Cantidad de tractos": null, "Fecha reserva": null, "Fecha inicial": null });
    render(<FormalizationRecordSummary item={order} primary={mapped} />);
    expect(screen.getByRole("tabpanel", { name: "Artículos", hidden: true })).toHaveTextContent("-16,320.00");
    fireEvent.click(screen.getByRole("tab", { name: "Reserva" }));
    expect(screen.getByRole("tabpanel", { name: "Reserva" })).toHaveTextContent("Transferencia");
    fireEvent.click(screen.getByRole("tab", { name: "Detalle de pago" }));
    expect(screen.getByRole("tabpanel", { name: "Detalle de pago" })).toHaveTextContent("54,752.00");
    fireEvent.click(screen.getByRole("tab", { name: "OneDrive" }));
    // La pestaña OneDrive ya muestra el explorador de documentos real, no el marcador provisional.
    expect(screen.queryByRole("heading", { level: 1, name: "AQUI VA EL ONEDRIVE" })).not.toBeInTheDocument();
    expect(within(screen.getByRole("tabpanel", { name: "OneDrive" })).getByText("No tienes permiso para consultar los documentos de la orden.")).toBeVisible();
    expect(screen.queryByRole("region", { name: "Información del sistema" })).not.toBeInTheDocument();
});
it("keeps unknown reservation methods and pre-additional-chapter snapshots safe", () => {
    const mapped = readNetsuitePrimary({ ...result, data: { status: 200, METODO_PAGO: JSON.stringify("Avance De Obra"), data: { type: "salesorder", fields: { custbody188: "999" } } } });
    expect(mapped.reservation["Medio de pago"]).toBeNull();
    render(<FormalizationRecordSummary item={order} primary={{ fields: mapped.fields, sales: mapped.sales, authorization: mapped.authorization, checks: mapped.checks }} />);
    expect(screen.getByRole("tabpanel", { name: "Artículos", hidden: true })).toHaveTextContent("Sin dato");
    fireEvent.click(screen.getByRole("tab", { name: "Detalle de pago" }));
    expect(screen.getByRole("tabpanel", { name: "Detalle de pago" })).toHaveTextContent("Sin dato");
});

it("projects the four monetary summary values and renders source zero without sample amounts", () => {
    const mapped = readNetsuitePrimary({ ...result, data: { status: 200, data: { id: "11998725", type: "salesorder", fields: { subtotal: "391680.00", taxtotal: "0.00", giftcertapplied: "0.00", total: "391680.00" } } } });
    expect(mapped.summary).toEqual({ Subtotal: "391,680.00", "Total de impuesto": "0.00", "Certificado de regalo": "0.00", Total: "391,680.00" });
    render(<FormalizationRecordSummary item={order} primary={mapped} />);
    const summary = screen.getByRole("region", { name: "Resumen" });
    expect(within(summary).getAllByText("391,680.00")).toHaveLength(2);
    expect(within(summary).getAllByText("0.00")).toHaveLength(2);
    expect(within(summary).queryByText("—")).not.toBeInTheDocument();
});
it("keeps missing monetary values unknown and preserves source precision", () => {
    const mapped = readNetsuitePrimary({ ...result, data: { status: 200, data: { type: "salesorder", fields: { subtotal: "9999999999999999.99", total: "invalid", taxtotal: "" } } } });
    expect(mapped.summary).toEqual({ Subtotal: "9,999,999,999,999,999.99", "Total de impuesto": null, "Certificado de regalo": null, Total: null });
    render(<FormalizationRecordSummary item={order} primary={{ fields: mapped.fields }} />);
    expect(within(screen.getByRole("region", { name: "Resumen" })).getAllByText("—")).toHaveLength(4);
});

it("uses the confirmed NetSuite IDs independently across sandbox and production values", () => {
    const mapped = readNetsuitePrimary({ ...result, data: { status: 200, data: { type: "salesorder", fields: { custbody22: "362680.00", custbody140: "31/12/2026", custbody116: "-", giftcertapplied: "0.00", custbody36: "125.00", custbody16: "2000.00", custbody219: "13.00" } } } });
    expect(mapped.sales["Monto cortesías"]).toBe("125.00");
    expect(mapped.authorization["Monto total de cortesías"]).toBe("2,000.00");
    expect(mapped.authorization["IVA corredor (13 %)"]).toBe("13.00");
    expect(mapped.authorization["Precio cálculo comisión corredor"]).toBe("362,680.00");
    expect(mapped.sales["Fecha de entrega contractual"]).toBe("31/12/2026");
    expect(mapped.sales["Comentarios cancelación de reserva"]).toBe("-");
    expect(mapped.summary["Certificado de regalo"]).toBe("0.00");
    render(<FormalizationRecordSummary item={order} primary={mapped} />);
    const auth = screen.getByRole("region", { name: "Autorización de venta" });
    expect(within(auth).getByText("IVA corredor (13 %)")).toBeInTheDocument();
    expect(within(auth).getByText("13.00")).toBeInTheDocument();
});

it("renders only the seven requested item columns in source line order, excluding the editor row", () => {
    const mapped = readNetsuitePrimary({ ...result, data: { status: 200, data: { type: "salesorder", fields: { tranid: "RDR673" }, sublists: { item: { currentline: { item_display: "Editor" }, "line 10": { item_display: "Hito", quantity: "1", amount: "5000.00" }, "line 2": { item_display: "Prima", custcolfecha_pago_proyectado: "28/02/2025", quantity: "22", description: "Prima fraccionada", rate: "1500.00", amount: "33000.00", grossamt: "33000.00" } } } } } });
    expect(mapped.items).toHaveLength(2);
    expect(mapped.items[0]?.values).toEqual(["Prima", "28/02/2025", "22", "Prima fraccionada", "1,500.00", "33,000.00", "33,000.00"]);
    render(<FormalizationRecordSummary item={order} primary={mapped} />);
    const table = within(screen.getByRole("region", { name: "Líneas de artículos" })).getByRole("table");
    expect(
        within(table)
            .getAllByRole("columnheader")
            .map((cell) => cell.textContent),
    ).toEqual(["Artículo", "Fecha de pago proyectado", "Cantidad", "Descripción", "Precio unitario", "Importe lista", "Imp. bruto"]);
    expect(within(table).getAllByRole("row")).toHaveLength(3);
    expect(within(table).queryByText("Editor")).not.toBeInTheDocument();
});
