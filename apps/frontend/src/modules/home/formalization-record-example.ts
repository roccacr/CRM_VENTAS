// Local presentation fixture only; replace with the canonical DTO when its binding is approved.
// Never use this example as an API error fallback or to modify the selected order.
// Field names follow the sales-order record the business already uses; every value here is invented.

export interface RecordField {
    readonly label: string;
    readonly value: string | number | null;
    readonly kind?: "money";
    /** Long text. The label stays above the value, aligned to the left. */
    readonly wide?: boolean;
}

export interface RecordGroup {
    readonly title: string;
    readonly fields: readonly RecordField[];
}

export interface RecordChapterData {
    readonly id: string;
    readonly label: string;
    readonly groups?: readonly RecordGroup[];
    /** Honest empty state when this part of the file has no records yet. */
    readonly empty?: string;
}

export interface RecordFlag {
    readonly label: string;
    readonly checked: boolean;
}

export interface CheckGroup {
    readonly title: string;
    /** Show "n de m" only where every flag answers the same question (milestones, approvals). */
    readonly counted?: boolean;
    readonly items: readonly RecordFlag[];
}

const money = (label: string, value: number | null): RecordField => ({ label, value, kind: "money" });
const text = (label: string, value: string | null, wide = false): RecordField => ({ label, value, ...(wide ? { wide: true } : {}) });
const mark = (label: string, checked: boolean): RecordFlag => ({ label, checked });

export const RECORD_EXAMPLE = {
    currency: "USD",
    amounts: [
        { label: "Subtotal", value: 229000 },
        { label: "Total de impuesto", value: 0 },
        { label: "Certificado de regalo", value: 0 },
        { label: "Total", value: 229000 },
    ],
    checks: [
        {
            title: "Hitos de la orden",
            counted: true,
            items: [mark("Contrato firmado", false), mark("Cuotas pagadas por completo", false), mark("Cierre firmado", true), mark("Validación de fideicomiso / prima", false), mark("Unidad traspasada", false), mark("Unidad entregada", false), mark("Entrega de llaves", false)],
        },
        {
            title: "Aprobaciones",
            counted: true,
            items: [mark("Aprobación jefe de ventas", true), mark("Aprobación formalización", true), mark("Aprobación desarrolladora", true), mark("Comisión aprobada", true)],
        },
        { title: "Cálculos de comisión", items: [mark("Cálculo comisión asesor (auto)", false), mark("Cálculo comisión corredor (auto)", false)] },
        { title: "Condiciones comerciales", items: [mark("No paga traspaso S.A.", false), mark("No paga cesión de acciones", false), mark("Mezzanine", false)] },
        { title: "Excepciones", items: [mark("Venta caída", false), mark("Comisión cancelada", false)] },
    ] as readonly CheckGroup[],
    chapters: [
        {
            id: "primary",
            label: "Información primaria",
            groups: [
                {
                    title: "Pedido",
                    fields: [text("N.º de pedido", "OV-DEMO-001"), text("Fecha", "26/10/2026"), text("Firma de contrato", "28/10/2026"), text("Moneda", "Dólar estadounidense (USD)"), text("Nota", "Coordinar la firma con el cliente.", true)],
                },
                {
                    title: "Cliente y empresa",
                    fields: [text("Cliente", "Cliente de ejemplo"), text("Estado de cuenta", null), text("Subsidiaria", "Desarrolladora de ejemplo"), text("Departamento", "Ventas")],
                },
                {
                    title: "Unidad y entrega",
                    fields: [text("Clase", "Residencial de ejemplo"), text("Ubicación", "Torre A · Ejemplo"), text("Traspaso / entrega de llaves", "30/06/2027"), text("Lectura del medidor de agua", "125 m³")],
                },
            ],
        },
        {
            id: "sales",
            label: "Información de ventas",
            groups: [
                {
                    title: "Origen",
                    fields: [text("Unidad expediente ligado VTA", "Unidad de ejemplo 101"), text("Oportunidad", "Oportunidad de ejemplo"), text("Creado desde", "Estimación de ejemplo"), text("Campaña de marketing", "Campaña de ejemplo"), text("Representante de ventas", "Vendedor de ejemplo"), text("Socio", null)],
                },
                {
                    title: "Compra",
                    fields: [text("Motivo de compra", "Primera casa"), text("Método de pago", "Contra entrega"), text("Fondos de compra", null), money("Precio de venta", 229000), money("Monto cortesías", 0)],
                },
                {
                    title: "Fechas",
                    fields: [text("Fecha de vigencia de la venta", "26/11/2026"), text("Entrega estimada", "30/03/2028"), text("Fecha de entrega contractual", "30/06/2027"), text("Vigencia de garantía", null), text("Fecha adenda", null)],
                },
                {
                    title: "Cancelación",
                    fields: [text("Motivo de cancelación de reserva o venta caída", null), text("Comentarios cancelación de reserva", null, true)],
                },
            ],
        },
        {
            id: "authorization",
            label: "Autorización de venta",
            groups: [
                {
                    title: "Precios",
                    fields: [money("Precio de lista", 229000), money("Monto extras sobre el precio de lista", 0), text("Descripción de extras sobre el precio de lista", null, true), money("Precio de venta neto", 229000), money("Precio de venta mínimo", 217550), money("Diferencia entre PVN y PVM", 11450), text("Tipo de cambio", "457,85"), money("Cashback", 0), text("Cargos adicionales", null, true), text("Unidad expediente ligado", "Unidad de ejemplo 101")],
                },
                {
                    title: "Comisiones",
                    fields: [money("Precio cálculo comisión corredor", 229000), text("% comisión del corredor", "0,0 %"), money("Monto de comisión de corredor", 0), money("IVA corredor (13 %)", 0), text("Comisión del asesor %", "0,38 %"), money("Monto de comisión del asesor", 870.2), money("Monto de comisión segundo asesor", 0), money("Monto total de cortesías", 0), text("Descripción de cortesías", null, true)],
                },
                {
                    title: "Notas",
                    fields: [text("Comentario de autorización de venta", null, true), text("Avisos importantes", null, true)],
                },
            ],
        },
        { id: "articles", label: "Artículos", groups: [{ title: "", fields: [money("Monto descuento directo", null), money("Monto reserva", null), money("Prima total", null), money("Diferencia de extras sobre el precio de lista", null)] }] },
        { id: "reservation", label: "Reserva", groups: [{ title: "", fields: [text("Medio de pago", null), text("Número de transacción", null), money("Monto reserva aplicada", null), text("Fecha de reserva aplicada", null), money("Monto pre reserva", null), text("Fecha de pre reserva", null), text("Observaciones confirma reserva", null, true)] }] },
        {
            id: "payment",
            label: "Detalle de pago",
            groups: [
                { title: "Tractos de prima", fields: [text("Cantidad de tractos", null), money("Monto prima", null), text("Observaciones prima", null, true), text("Fechas prima", null), text("Observaciones reserva", null, true), text("Fecha reserva", null), text("Cashbacknotes", null, true), text("Fecha cashback", null)] },
                {
                    title: "Forma de pago por avance de obra",
                    fields: [
                        money("Hito 1", null),
                        money("Hito 2", null),
                        money("Hito 3", null),
                        money("Hito 4", null),
                        money("Hito 5", null),
                        money("Hito 6", null),
                        money("Monto total hitos", null),
                        text("Fecha inicial", null),
                        text("Fecha proyectada hito #1", null),
                        text("Observaciones hito 1", null, true),
                        text("Prima %", null),
                        text("Monto hitos %", null),
                        text("H1 %", null),
                        text("H2 %", null),
                        text("H3 %", null),
                        text("H4 %", null),
                        text("H5 %", null),
                        text("H6 %", null),
                        money("Monto prima neta (no editable)", null),
                        money("Monto hitos total", null),
                    ],
                },
            ],
        },
        { id: "onedrive", label: "OneDrive" },
    ] as readonly RecordChapterData[],
} as const;
