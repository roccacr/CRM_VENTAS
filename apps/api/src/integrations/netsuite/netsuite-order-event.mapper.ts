import { BadRequestException } from "@nestjs/common";
export const NETSUITE_DELIVERY_DATE_FIELD = "custbody_fecha_unidad_entregada";
export const orderFlagMappings = [
    {
        netsuite: "custbody90",
        native: "contract_signed_sales_order",
        legacy: "contrado_frima_ov",
    },
    {
        netsuite: "custbody51",
        native: "commercial_closure_signed_sales_order",
        legacy: "cierre_firmado_ov",
    },
    {
        netsuite: "custbody91",
        native: "unit_delivered_sales_order",
        legacy: "unidad_entregada_ov",
    },
    {
        netsuite: "custbody105",
        native: "unit_transferred_sales_order",
        legacy: "unidad_traspasada_ov",
    },
    {
        netsuite: "custbody43",
        native: "cancelled_sales_order",
        legacy: "caida_ov",
    },
    {
        netsuite: "custbody103",
        native: "commission_approved_sales_order",
        legacy: "comision_aprobada_ov",
    },
    {
        netsuite: "custbody_ix_comision_pagada",
        native: "advisor_commission_paid_sales_order",
        legacy: "comision_cancelada_ov",
    },
    {
        netsuite: "custbody_entrega_de_llaves",
        native: "keys_delivered_sales_order",
        legacy: "entrega_llaves_ov",
    },
    {
        netsuite: "custbody274",
        native: "trust_down_payment_validated_sales_order",
        legacy: "validacion_fideicomiso_prima_ov",
    },
    {
        netsuite: "custbody_cuotas_pagadas",
        native: "installments_fully_paid_sales_order",
        legacy: "cuotas_pagadas_completo_ov",
    },
] as const;
export type OrderEventDestination = "native" | "legacy";
export type OrderFlagChange = { field: string; column: string; before: unknown; after: "yes" | "no" | 0 | 1 };
/** Solo `true`, `false`, `T` o `F`. `F` no se evalua con truthiness. Un valor ausente no es falso: se rechaza. */
function checked(value: unknown, field: string): boolean {
    if (![true, false, "T", "F"].includes(value as boolean | string)) throw new BadRequestException("Checkbox requerido invalido: " + field);
    return value === true || value === "T";
}
/** Nativo guarda `yes` o `no`. Legado guarda 1 o 0. Si el valor no cambio, no hay diff. Los nombres fisicos se conservan, incluido `contrado_frima_ov`. */
export function mapOrderFlags(fields: Record<string, unknown>, destination: OrderEventDestination, before: Record<string, unknown>): OrderFlagChange[] {
    return orderFlagMappings.flatMap((mapping) => {
        const value = fields[mapping.netsuite];
        const flag = checked(value, mapping.netsuite);
        const column = mapping[destination];
        const after = destination === "native" ? (flag ? "yes" : "no") : flag ? 1 : 0;
        const previous = before[column] ?? null;
        return previous === after ? [] : [{ field: mapping.netsuite, column, before: previous, after }];
    });
}

/** Diff comercial compartido por flags y efectos de negocio de la orden. */
export type OrderEventChange = { field: string; column: string; before: unknown; after: string | number | null };

/** Proyeccion declarativa de campos directos confirmados; las identidades/FK se concilian aparte. */
export const orderFieldMappings = [
    { netsuite: "custbody37", native: "purchase_funds_origin_sales_order", legacy: "origen_fondos_compra_ov", type: "funds" },
    { netsuite: "custbody74", native: "advisor_commission_calculated_sales_order", legacy: "calculo_comision_asesor_ov", type: "checkbox" },
    { netsuite: "custbody13", native: "list_price_sales_order", legacy: "pre_lista_ov", type: "decimal" },
    { netsuite: "custbody17", native: "net_sale_price_sales_order", legacy: "prec_ventaneto_ov", type: "decimal" },
    { netsuite: "custbody_ix_total_amount", native: "sale_price_sales_order", legacy: "prec_venta_ov", type: "decimal" },
    { netsuite: "custbody21", native: "advisor_commission_sales_order", legacy: "comison_asesor_ov", type: "decimal" },
    { netsuite: "crm_transaction_date", native: "transaction_date_sales_order", legacy: "trandate_ov", type: "date" },
] as const;

export const orderApprovalMappings = [
    { netsuite: "custbody_aprueba_jefe_ventas", native: "approval_sales_management", legacy: "chekJefeVenta", approval: "sales_management" },
    { netsuite: "custbodyid_firma_rocca", native: "approval_developer", legacy: "aprobacion__rdr_ov", approval: "developer" },
    { netsuite: "custbodyid_firma_rc", native: "approval_formalization", legacy: "aprobacion_forma_ov", approval: "formalization" },
] as const;
export const orderNumberMapping = { netsuite: "initialtranid", native: "transaction_number_sales_order_external_reference", legacy: "id_ov_tranid" } as const;
/** El id de NetSuite no se copia a una llave nativa. Tiene que existir ya una referencia activa y unica. */
export const orderRelationMappings = [
    { netsuite: "entity", native: "lead_id_sales_order", legacy: "id_ov_lead", domain: "lead" },
    { netsuite: "custbody38", native: "unit_file_id_sales_order", legacy: "idExpediente_ov", domain: "unit_file" },
    { netsuite: "subsidiary", native: "subsidiary_id_sales_order", legacy: "idsubsidiaria_ov", domain: "subsidiary" },
    { netsuite: "crm_owner_employee", native: "owner_user_id_sales_order", legacy: "id_ov_admin", domain: "user" },
    { netsuite: "opportunity", native: null, legacy: "id_ov_opt", domain: null },
] as const;
/** Nombres de tabla cerrados. La entrada HTTP no elige la tabla. */
export const nativeRelationReferences = {
    lead: { table: "crm_lead_external_reference", owner: "lead_id_lead_external_reference", external: "external_id_lead_external_reference", system: "external_system_id_lead_external_reference", status: "status_lead_external_reference", deleted: null },
    unit_file: { table: "crm_unit_file_external_reference", owner: "unit_file_id_unit_file_external_reference", external: "external_id_unit_file_external_reference", system: "external_system_id_unit_file_external_reference", status: "status_unit_file_external_reference", deleted: null },
    subsidiary: { table: "crm_subsidiary_external_reference", owner: "subsidiary_id_subsidiary_external_reference", external: "external_id_subsidiary_external_reference", system: "external_system_id_subsidiary_external_reference", status: "status_subsidiary_external_reference", deleted: "deleted_at_subsidiary_external_reference" },
    user: { table: "int_user_external_identity", owner: "user_id_user_external_identity", external: "external_user_id_user_external_identity", system: "external_system_id_user_external_identity", status: "status_user_external_identity", deleted: "deleted_at_user_external_identity" },
} as const;

/** Solo corre con `crm_sync_projection=1`. Nulo o vacio limpian. Un id que no es entero positivo se rechaza y no borra la relacion. Sin la proyeccion, no se toca nada. */
export function readOrderRelationValues(fields: Record<string, unknown>): Record<string, string | null> {
    if (fields.crm_sync_projection !== 1) return {};
    return Object.fromEntries(
        orderRelationMappings.map((mapping) => {
            const value = fields[mapping.netsuite];
            if (value === null || value === "") return [mapping.netsuite, null];
            if ((typeof value !== "string" && typeof value !== "number") || !/^[1-9][0-9]{0,14}$/.test(String(value))) throw new BadRequestException("Relacion ERP invalida o ausente: " + mapping.netsuite);
            return [mapping.netsuite, String(value)];
        }),
    );
}

/** El monto queda como texto de cuatro decimales. No hay float ni separador regional. Un formato ambiguo se rechaza. */
function money(value: unknown): string | null {
    if (value === null || value === "") return null;
    if (typeof value !== "string" && typeof value !== "number") throw new BadRequestException("Monto NetSuite ausente o invalido.");
    const match = /^(-?)(\d{1,15})(?:\.(\d{1,4}))?$/.exec(String(value));
    if (!match) throw new BadRequestException("Monto NetSuite excede precision o usa formato ambiguo.");
    const integer = String(match[2]).replace(/^0+(?=\d)/, "");
    const fraction = (match[3] ?? "").padEnd(4, "0");
    return `${String(match[1])}${integer}.${fraction}`.replace(/^-0\.0000$/, "0.0000");
}

/** Una fecha que llega como `Date` usa su calendario local, no se convierte a UTC. Un texto tiene que ser un dia ISO real. */
export function calendarDate(value: unknown): string | null {
    if (value === null || value === "") return null;
    if (value instanceof Date) return [value.getFullYear(), String(value.getMonth() + 1).padStart(2, "0"), String(value.getDate()).padStart(2, "0")].join("-");
    if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString().slice(0, 10) !== value) throw new BadRequestException("Fecha NetSuite requiere calendario ISO YYYY-MM-DD.");
    return value;
}

/** Ids de lista confirmados: 1 es fondos propios y 2 es financiamiento. La etiqueta no se adivina. Vacio es nulo. */
function purchaseFunds(value: unknown): "own_funds" | "bank_financing" | null {
    if (value === null || value === "") return null;
    if (value === 1 || value === "1") return "own_funds";
    if (value === 2 || value === "2") return "bank_financing";
    throw new BadRequestException("custbody37 requiere 1 (Propios), 2 (Financiado) o vacio.");
}

function fieldValue(mapping: (typeof orderFieldMappings)[number], value: unknown, destination: OrderEventDestination): string | number | null {
    if (mapping.type === "decimal") return money(value);
    if (mapping.type === "date") return calendarDate(value);
    if (mapping.type === "funds") return purchaseFunds(value);
    const flag = checked(value, mapping.netsuite);
    if (destination === "native") return flag ? "yes" : "no";
    return flag ? 1 : 0;
}

function historicalValue(mapping: (typeof orderFieldMappings)[number], value: unknown): unknown {
    // Un texto viejo invalido no impide guardar el valor bueno que acaba de llegar del ERP.
    try {
        if (mapping.type === "decimal") return money(value);
        if (mapping.type === "date") return calendarDate(value);
    } catch {
        return value;
    }
    return value;
}

function mapApprovals(fields: Record<string, unknown>, destination: OrderEventDestination, before: Record<string, unknown>): OrderEventChange[] {
    return orderApprovalMappings.flatMap((mapping): OrderEventChange[] => {
        const flag = checked(fields[mapping.netsuite], mapping.netsuite);
        const after = destination === "native" ? (flag ? "approved" : "not_approved") : flag ? 1 : 0;
        const column = mapping[destination];
        const previous = before[column] ?? null;
        return previous === after ? [] : [{ field: mapping.netsuite, column, before: previous, after }];
    });
}

function mapNumber(fields: Record<string, unknown>, destination: OrderEventDestination, before: Record<string, unknown>): OrderEventChange[] {
    const number = fields.initialtranid;
    if (typeof number !== "string" || !number.trim() || number.length > (destination === "native" ? 180 : 50)) throw new BadRequestException("Numero de orden NetSuite invalido o demasiado largo.");
    const numberColumn = orderNumberMapping[destination];
    const previousNumber = before[numberColumn] ?? null;
    return previousNumber === number ? [] : [{ field: orderNumberMapping.netsuite, column: numberColumn, before: previousNumber, after: number }];
}

/** Sin `crm_sync_projection` no hay campos ampliados: es un evento anterior. Un valor distinto de 1 se rechaza. El numero nativo admite 180 caracteres y el legado 50. */
export function mapOrderFields(fields: Record<string, unknown>, destination: OrderEventDestination, before: Record<string, unknown>): OrderEventChange[] {
    if (fields.crm_sync_projection === undefined) return [];
    if (fields.crm_sync_projection !== 1) throw new BadRequestException("Proyeccion NetSuite no soportada.");
    const direct = orderFieldMappings.flatMap((mapping) => {
        // Si el productor viejo no mando el id de la lista, no se borra el origen de fondos guardado.
        if (mapping.type === "funds" && !Object.hasOwn(fields, mapping.netsuite)) return [];
        const after = fieldValue(mapping, fields[mapping.netsuite], destination);
        const column = mapping[destination];
        const previous = before[column] ?? null;
        return historicalValue(mapping, previous) === after ? [] : [{ field: mapping.netsuite, column, before: previous, after }];
    });
    return [...direct, ...mapApprovals(fields, destination, before), ...mapNumber(fields, destination, before)];
}
