import type { NetsuiteOrderResult } from "./netsuite-order-service";

export const ORDER_ITEM_COLUMNS = ["Artículo", "Fecha de pago proyectado", "Cantidad", "Descripción", "Precio unitario", "Importe lista", "Imp. bruto"] as const;

export interface NetsuitePrimary {
    readonly items: readonly { readonly key: string; readonly values: readonly (string | null)[] }[];
    readonly fields: Readonly<Record<string, string | null>>;
    readonly sales: Readonly<Record<string, string | null>>;
    readonly authorization: Readonly<Record<string, string | null>>;
    readonly articles: Readonly<Record<string, string | null>>;
    readonly reservation: Readonly<Record<string, string | null>>;
    readonly payment: Readonly<Record<string, string | null>>;
    readonly summary: Readonly<Record<string, string | null>>;
    readonly checks: Readonly<Record<string, boolean | null>>;
}
function object(value: unknown): Record<string, unknown> {
    return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}
/** RESTlet display names are JSON-encoded strings, not numeric select IDs. Never execute or render source HTML. */
function text(value: unknown): string | null {
    if (typeof value !== "string") return null;
    const raw = value.trim();
    if (!raw) return null;
    try {
        const parsed: unknown = JSON.parse(raw);
        return typeof parsed === "string" ? parsed.trim() || null : raw;
    } catch {
        return raw;
    }
}
function checked(value: unknown): boolean | null {
    if (value === "T" || value === true) return true;
    if (value === "F" || value === false) return false;
    return null;
}
/** Add grouping without converting decimal strings through floating point or inventing a currency. */
function amount(value: unknown): string | null {
    const raw = typeof value === "number" ? String(value) : text(value);
    if (!raw || !/^-?\d+(?:\.\d+)?$/.test(raw)) return null;
    const [integer = "", decimal] = raw.split(".");
    return integer.replace(/\B(?=(\d{3})+(?!\d))/g, ",") + (decimal === undefined ? "" : "." + decimal);
}
function sales(detail: Record<string, unknown>, fields: Record<string, unknown>) {
    return {
        "Unidad expediente ligado VTA": text(detail.Expediente),
        "Motivo de compra": text(detail.MOTIVO_COMPRA),
        "Método de pago": text(detail.METODO_PAGO),
        "Fecha de vigencia de la venta": text(fields.saleseffectivedate),
        "Campaña de marketing": text(detail.CAMPANA),
        Oportunidad: text(detail.Oportunidad),
        "Creado desde": text(detail.CREADO),
        "Fondos de compra": text(detail.FONDOS),
        "Vigencia de garantía": text(fields.custbodytpv_vigencia_garantia),
        "Representante de ventas": text(detail.vendedor),
        Socio: text(detail.socio),
        "Motivo de cancelación de reserva o venta caída": text(detail.MOTIVO_CANCE),
        "Entrega estimada": text(fields.custbody114),
        "Fecha de entrega contractual": text(fields.custbody140),
        // The source ID for Fecha adenda is not confirmed; do not borrow another date.
        "Fecha adenda": null,
        "Comentarios cancelación de reserva": text(fields.custbody116),
        "Precio de venta": amount(fields.custbody_ix_total_amount),
        "Monto cortesías": amount(fields.custbody36),
    };
}
function authorization(detail: Record<string, unknown>, fields: Record<string, unknown>) {
    return {
        "Precio de lista": amount(fields.custbody13),
        "Precio cálculo comisión corredor": amount(fields.custbody22),
        "% comisión del corredor": text(fields.custbody14),
        "Monto de comisión de corredor": amount(fields.custbody15),
        "IVA corredor (13 %)": amount(fields.custbody219),
        "Monto total de cortesías": amount(fields.custbody16),
        "Descripción de cortesías": text(fields.custbody35),
        "Monto extras sobre el precio de lista": amount(fields.custbody46),
        "Descripción de extras sobre el precio de lista": text(fields.custbody47),
        Cashback: amount(fields.custbodyix_salesorder_cashback),
        "Precio de venta neto": amount(fields.custbody17),
        "Precio de venta mínimo": amount(fields.custbody18),
        "Diferencia entre PVN y PVM": amount(fields.custbody19),
        "Comisión del asesor %": text(fields.custbody20),
        "Monto de comisión del asesor": amount(fields.custbody21),
        "Monto de comisión segundo asesor": amount(fields.custbody71),
        // UNIDAD is a different relation from Expediente / Unidad expediente ligado VTA.
        "Unidad expediente ligado": text(detail.UNIDAD),
        "Comentario de autorización de venta": null,
        "Tipo de cambio": text(fields.exchangerate),
        "Cargos adicionales": amount(fields.custbody_ov_cargos_adicionales),
        "Avisos importantes": null,
    };
}
function articles(fields: Record<string, unknown>) {
    return { "Monto descuento directo": amount(fields.custbody132), "Monto reserva": amount(fields.custbody52), "Prima total": amount(fields.custbody39), "Diferencia de extras sobre el precio de lista": amount(fields.custbody185) };
}
// Confirmed custbody188 catalog from the legacy reservation editor; it is NOT custbody75 / METODO_PAGO.
const reservationMethods: Readonly<Record<string, string>> = { "1": "Transferencia", "2": "Efectivo", "3": "Cheque", "4": "Paypal", "5": "Tarjeta de crédito", "6": "Tarjeta de débito" };
function reservation(fields: Record<string, unknown>) {
    return { "Medio de pago": reservationMethods[text(fields.custbody188) ?? ""] ?? null, "Número de transacción": text(fields.custbody189), "Monto reserva aplicada": amount(fields.custbody207), "Fecha de reserva aplicada": text(fields.custbody208), "Monto pre reserva": amount(fields.custbody191), "Fecha de pre reserva": text(fields.custbody206), "Observaciones confirma reserva": text(fields.custbody190) };
}
function payment(fields: Record<string, unknown>) {
    return {
        // Empty fields without confirmed source IDs stay unknown; never derive dates, tract counts or observations from other sections.
        "Cantidad de tractos": null,
        "Monto prima": amount(fields.custbody_ix_salesorder_monto_prima),
        "Observaciones prima": null,
        "Fechas prima": null,
        "Observaciones reserva": null,
        "Fecha reserva": null,
        Cashbacknotes: null,
        "Fecha cashback": null,
        "Hito 1": amount(fields.custbodyix_salesorder_hito1),
        "Hito 2": amount(fields.custbody_ix_salesorder_hito2),
        "Hito 3": amount(fields.custbody_ix_salesorder_hito3),
        "Hito 4": amount(fields.custbody_ix_salesorder_hito4),
        "Hito 5": amount(fields.custbody_ix_salesorder_hito5),
        "Hito 6": amount(fields.custbody_ix_salesorder_hito6),
        "Monto total hitos": amount(fields.custbody_i_amount_hitos),
        "Fecha inicial": null,
        "Fecha proyectada hito #1": null,
        "Observaciones hito 1": null,
        "Prima %": text(fields.custbody60),
        "Monto hitos %": null,
        "H1 %": text(fields.custbody62),
        "H2 %": text(fields.custbody63),
        "H3 %": text(fields.custbody64),
        "H4 %": text(fields.custbody65),
        "H5 %": text(fields.custbody66),
        "H6 %": text(fields.custbody67),
        "Monto prima neta (no editable)": amount(fields.custbody211),
        "Monto hitos total": amount(fields.custbody_total_hitos_amount),
    };
}
const flags: Readonly<Record<string, string>> = {
    "Contrato firmado": "custbody90",
    "Cierre firmado": "custbody51",
    "Unidad entregada": "custbody91",
    "Unidad traspasada": "custbody105",
    "Venta caída": "custbody43",
    "Comisión aprobada": "custbody103",
    "Comisión cancelada": "custbody_ix_comision_pagada",
    "Entrega de llaves": "custbody_entrega_de_llaves",
    "Validación de fideicomiso / prima": "custbody274",
    Mezzanine: "custbody_mezzanine_verifica",
    "Aprobación jefe de ventas": "custbody_aprueba_jefe_ventas",
    "Aprobación formalización": "custbodyid_firma_rc",
    "Aprobación desarrolladora": "custbodyid_firma_rocca",
    "Cálculo comisión asesor (auto)": "custbody74",
    "Cálculo comisión corredor (auto)": "custbody73",
    "No paga traspaso S.A.": "custbody141",
    "No paga cesión de acciones": "custbody157",
};
/** Approved read-only chapters only; no provider values mutate CRM workflow. */
export function readNetsuitePrimary(result: NetsuiteOrderResult): NetsuitePrimary {
    const detail = object(result.data);
    const record = object(detail.data);
    const fields = object(record.fields);
    if (detail.status !== 200 || record.type !== "salesorder" || Object.keys(fields).length === 0) throw new Error("Información primaria de NetSuite no disponible");
    if (record.id !== undefined && record.id !== result.order.netsuiteId) throw new Error("La respuesta no corresponde a esta orden");
    return {
        items: Object.entries(object(object(record.sublists).item))
            .filter(([key]) => /^line \d+$/.test(key))
            .sort(([a], [b]) => Number(a.slice(5)) - Number(b.slice(5)))
            .map(([key, value]) => {
                const line = object(value);
                return { key, values: [text(line.item_display), text(line.custcolfecha_pago_proyectado), amount(line.quantity), text(line.description), amount(line.rate), amount(line.amount), amount(line.grossamt)] };
            }),
        fields: {
            "N.º de pedido": text(fields.initialtranid),
            Cliente: text(detail.cli),
            Fecha: text(fields.trandate),
            "Firma de contrato": text(fields.custbody68),
            Moneda: text(fields.currencyname),
            "Estado de cuenta": null,
            Subsidiaria: text(detail.Subsidaria),
            Departamento: text(detail.Departamento),
            Clase: text(detail.Clase),
            Ubicación: text(detail.Ubi),
            // No confirmed source field for these values in the current payload. Do not substitute shipping or estimated dates.
            "Traspaso / entrega de llaves": null,
            "Lectura del medidor de agua": null,
            Nota: text(fields.memo),
        },
        sales: sales(detail, fields),
        authorization: authorization(detail, fields),
        articles: articles(fields),
        reservation: reservation(fields),
        payment: payment(fields),
        summary: { Subtotal: amount(fields.subtotal), "Total de impuesto": amount(fields.taxtotal), "Certificado de regalo": amount(fields.giftcertapplied), Total: amount(fields.total) },
        checks: Object.fromEntries(Object.entries(flags).map(([label, key]) => [label, checked(fields[key])])),
    };
}
