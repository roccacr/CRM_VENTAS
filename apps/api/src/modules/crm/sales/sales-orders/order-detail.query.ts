import { sql, type Transaction } from "kysely";

import type { CrmDatabase } from "../../../../database/database.types.js";

type Row = Record<string, unknown>;
type Source = "native" | "legacy";
interface Snapshot {
    source: Source;
    order: { number: unknown; sourceFields: Row };
    lead: { id: unknown; sourceFields: Row } | null;
    contact: { name: unknown; email: unknown; phone: unknown } | null;
    unitFile: { sourceFields: Row } | null;
    warnings: string[];
    references?: Row[];
}
export interface OrderDetail {
    sections: { title: string; fields: { code: string; label: string; value: string | null; kind: "text" | "date" | "money" | "boolean" | "link" }[] }[];
    currency: string | null;
    client: { name: string | null; identification: string | null; phone: string | null; email: string | null; advisor: string | null; identity: { source: Source; id: string } | null };
    warnings: string[];
}
interface Relations {
    project: string | null;
    subsidiary: string | null;
    seller: string | null;
    advisor: string | null;
    identification: string | null;
    client?: OrderDetail["client"];
    approvals: Row[];
    warnings: string[];
}
function text(value: unknown): string | null {
    if (value instanceof Date) return value.toISOString();
    if (typeof value === "string") return value.trim() ? value : null;
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
    return null;
}
function flag(source: Source, value: unknown): string | null {
    const values: Record<string, string> = source === "native" ? { yes: "yes", no: "no" } : { "1": "yes", "0": "no" };
    return values[String(value)] ?? null;
}
async function unique(tx: Transaction<CrmDatabase>, query: { table: string; columns: string; key: string; id: unknown; relation: string }, warnings: string[]): Promise<Row | null> {
    const { table, columns, key, id, relation } = query;
    if (id === null || id === undefined) return null;
    const { rows } = await sql<Row>`SELECT /*+ MAX_EXECUTION_TIME(3000) */ ${sql.join(columns.split(" ").map((column) => sql.ref(column)))} FROM ${sql.table(table)} WHERE ${sql.ref(key)}=${id} ${table === "crm_contact" ? sql`AND deleted_at_contact IS NULL` : sql``} LIMIT 2`.execute(tx);
    if (rows.length > 1) warnings.push(relation + ":ambiguous");
    return rows.length === 1 ? (rows[0] ?? null) : null;
}
async function identification(tx: Transaction<CrmDatabase>, reference: unknown, warnings: string[]) {
    if (reference === null || reference === undefined) return null;
    const row = await unique(tx, { table: "crmdatabase-api.info_extra_lead", columns: "cedula_lead", key: "id_lead_fk", id: reference, relation: "client.identification" }, warnings);
    return text(row?.cedula_lead);
}
// Each optional relation is independent; missing data stays null.
// eslint-disable-next-line complexity
async function nativeRelations(tx: Transaction<CrmDatabase>, data: Snapshot, relations: Relations) {
    const order = data.order.sourceFields;
    const unit = data.unitFile?.sourceFields;
    const lead = data.lead?.sourceFields;
    const project = await unique(tx, { table: "crm_project", columns: "name_project", key: "id_project", id: unit?.project_id_unit_file, relation: "project" }, relations.warnings);
    const subsidiary = await unique(tx, { table: "crm_subsidiary", columns: "name_subsidiary", key: "id_subsidiary", id: order.subsidiary_id_sales_order, relation: "subsidiary" }, relations.warnings);
    const seller = await unique(tx, { table: "sec_user", columns: "display_name_user", key: "id_user", id: order.owner_user_id_sales_order, relation: "seller" }, relations.warnings);
    const advisor = await unique(tx, { table: "sec_user", columns: "display_name_user", key: "id_user", id: lead?.owner_user_id_lead, relation: "client.advisor" }, relations.warnings);
    relations.project = text(project?.name_project) ?? text(unit?.project_name_snapshot_unit_file);
    relations.subsidiary = text(subsidiary?.name_subsidiary);
    relations.seller = text(seller?.display_name_user);
    relations.advisor = text(advisor?.display_name_user);
    if (order.id_sales_order !== undefined) relations.approvals = (await sql<Row>`SELECT type_code_sales_order_approval AS type,status_sales_order_approval AS status FROM crm_sales_order_approval WHERE sales_order_id_sales_order_approval=${order.id_sales_order} LIMIT 4`.execute(tx)).rows;
}
async function legacyRelations(tx: Transaction<CrmDatabase>, data: Snapshot, relations: Relations) {
    const order = data.order.sourceFields;
    const lead = data.lead?.sourceFields;
    const subsidiary = await unique(tx, { table: "crmdatabase-api.subsidiarias", columns: "Nombre_Subsidiaria", key: "id_NetsuiteSub", id: order.idsubsidiaria_ov, relation: "subsidiary" }, relations.warnings);
    const seller = await unique(tx, { table: "crmdatabase-api.admins", columns: "name_admin", key: "idnetsuite_admin", id: order.id_ov_admin, relation: "seller" }, relations.warnings);
    const advisor = await unique(tx, { table: "crmdatabase-api.admins", columns: "name_admin", key: "idnetsuite_admin", id: lead?.id_empleado_lead, relation: "client.advisor" }, relations.warnings);
    relations.project = text(data.unitFile?.sourceFields.proyectoPrincipal_exp);
    relations.subsidiary = text(subsidiary?.Nombre_Subsidiaria);
    relations.seller = text(seller?.name_admin);
    relations.advisor = text(advisor?.name_admin);
    relations.identification = await identification(tx, lead?.idinterno_lead, relations.warnings);
}
/** Explicit active provider references and history links are the only cross-source identity evidence. */
async function nativeCandidates(tx: Transaction<CrmDatabase>, legacy: Row): Promise<Row[]> {
    return (
        await sql<Row>`SELECT DISTINCT l.id_lead,l.public_id_lead,l.primary_contact_id_lead,l.owner_user_id_lead FROM crm_lead l WHERE l.deleted_at_lead IS NULL AND (
        EXISTS (SELECT 1 FROM crm_lead_external_reference x JOIN int_external_system s ON s.id_external_system=x.external_system_id_lead_external_reference WHERE x.lead_id_lead_external_reference=l.id_lead AND x.status_lead_external_reference='active' AND s.status_external_system='active' AND s.code_external_system='netsuite' AND x.external_id_lead_external_reference=${legacy.idinterno_lead})
        OR EXISTS (SELECT 1 FROM int_lead_history_link h JOIN audit_record r ON r.id_record=h.record_id_lead_history_link WHERE h.lead_id_lead_history_link=l.id_lead AND r.entity_type_record='lead' AND r.source_schema_record='crmdatabase-api' AND r.source_table_record='leads' AND r.source_id_record=${text(legacy.id_lead)})) LIMIT 2`.execute(tx)
    ).rows;
}
async function legacyCandidates(tx: Transaction<CrmDatabase>, native: Row): Promise<Row[]> {
    return (
        await sql<Row>`SELECT l.id_lead,l.idinterno_lead,l.nombre_lead,l.email_lead,l.telefono_lead,l.id_empleado_lead FROM ${sql.table("crmdatabase-api.leads")} l WHERE (
        EXISTS (SELECT 1 FROM crm_lead_external_reference x JOIN int_external_system s ON s.id_external_system=x.external_system_id_lead_external_reference WHERE x.lead_id_lead_external_reference=${native.id_lead} AND x.status_lead_external_reference='active' AND s.status_external_system='active' AND s.code_external_system='netsuite' AND x.external_id_lead_external_reference=CAST(l.idinterno_lead AS CHAR))
        OR EXISTS (SELECT 1 FROM int_lead_history_link h JOIN audit_record r ON r.id_record=h.record_id_lead_history_link WHERE h.lead_id_lead_history_link=${native.id_lead} AND r.entity_type_record='lead' AND r.source_schema_record='crmdatabase-api' AND r.source_table_record='leads' AND r.source_id_record=CAST(l.id_lead AS CHAR))) LIMIT 2`.execute(tx)
    ).rows;
}
// Missing optional contact fields are mapped independently after identity proof.
// eslint-disable-next-line complexity
async function nativeReferenceClient(tx: Transaction<CrmDatabase>, data: Snapshot, relations: Relations) {
    const reference = data.order.sourceFields.id_ov_lead;
    if (reference === null || reference === undefined) return;
    const candidates = await nativeCandidates(tx, { id_lead: null, idinterno_lead: reference });
    const native = candidates[0];
    if (candidates.length === 0) return;
    if (candidates.length !== 1 || !native) {
        relations.warnings.push("client.link:ambiguous");
        return;
    }
    // A missing old row may resolve through its explicit ERP reference, never through a name or a PK guess.
    if ((await legacyCandidates(tx, native)).length !== 0) {
        relations.warnings.push("client.link:conflicting");
        return;
    }
    const contact = await unique(tx, { table: "crm_contact", columns: "full_name_contact email_contact phone_contact", key: "id_contact", id: native.primary_contact_id_lead, relation: "client.link.contact" }, relations.warnings);
    const advisor = await unique(tx, { table: "sec_user", columns: "display_name_user", key: "id_user", id: native.owner_user_id_lead, relation: "client.link.advisor" }, relations.warnings);
    relations.client = { name: text(contact?.full_name_contact), email: text(contact?.email_contact), phone: text(contact?.phone_contact), identification: null, advisor: text(advisor?.display_name_user), identity: { source: "native", id: String(native.public_id_lead) } };
    relations.warnings.push("client:native_reference_only");
}
/** Reciprocal uniqueness rejects competing provider/history links before any field fallback. */
async function linkedSources(tx: Transaction<CrmDatabase>, source: Source, own: Row, warnings: string[]) {
    const readers = { native: [legacyCandidates, nativeCandidates], legacy: [nativeCandidates, legacyCandidates] } as const;
    const [findLinked, findReciprocal] = readers[source];
    const candidates = await findLinked(tx, own);
    if (candidates.length === 0) return null;
    const linked = candidates[0];
    if (candidates.length !== 1 || !linked) {
        warnings.push("client.link:ambiguous");
        return null;
    }
    const reciprocal = await findReciprocal(tx, linked);
    if (reciprocal.length !== 1 || text(reciprocal[0]?.id_lead) !== text(own.id_lead)) {
        warnings.push("client.link:conflicting");
        return null;
    }
    return source === "native" ? { native: own, legacy: linked } : { native: linked, legacy: own };
}
// Field fallbacks apply only after reciprocal identity proof; they are independent display fields.
// eslint-disable-next-line complexity
async function crossSourceClient(tx: Transaction<CrmDatabase>, data: Snapshot, relations: Relations) {
    const own = data.lead?.sourceFields;
    if (!own?.id_lead) return data.source === "legacy" ? nativeReferenceClient(tx, data, relations) : undefined;
    const linked = await linkedSources(tx, data.source, own, relations.warnings);
    if (!linked) return;
    const { native, legacy } = linked;
    const contact = data.source === "native" ? null : await unique(tx, { table: "crm_contact", columns: "full_name_contact email_contact phone_contact", key: "id_contact", id: native.primary_contact_id_lead, relation: "client.link.contact" }, relations.warnings);
    const advisor = data.source === "native" ? null : await unique(tx, { table: "sec_user", columns: "display_name_user", key: "id_user", id: native.owner_user_id_lead, relation: "client.link.advisor" }, relations.warnings);
    const base = client(data, relations);
    relations.client = {
        ...linkedContactFields(base, contact, legacy),
        advisor: text(advisor?.display_name_user) ?? base.advisor,
        identification: data.source === "native" ? await identification(tx, legacy.idinterno_lead, relations.warnings) : base.identification,
        identity: { source: "native", id: String(native.public_id_lead) },
    };
    relations.warnings.push("client:linked_sources");
}
function linkedContactFields(base: OrderDetail["client"], contact: Row | null, legacy: Row) {
    const values = contact ?? {};
    return {
        name: text(values.full_name_contact) ?? base.name ?? text(legacy.nombre_lead),
        email: text(values.email_contact) ?? base.email ?? text(legacy.email_lead),
        phone: text(values.phone_contact) ?? base.phone ?? text(legacy.telefono_lead),
    };
}
function client(data: Snapshot, relations: Relations): OrderDetail["client"] {
    const identity = data.lead?.id;
    return { name: text(data.contact?.name), email: text(data.contact?.email), phone: text(data.contact?.phone), advisor: relations.advisor, identification: relations.identification, identity: identity ? { source: data.source, id: (text(identity) ?? "").replace(/^legacy:/, "") } : null };
}
function orderNumber(data: Snapshot, warnings: string[]): string | null {
    if (data.source === "legacy" || !data.references) return text(data.order.number);
    const numbers = [...new Set(data.references.map((reference) => text(reference.number)).filter((value): value is string => value !== null))];
    if (numbers.length > 1) {
        warnings.push("order.number:ambiguous");
        return null;
    }
    return numbers[0] ?? text(data.order.sourceFields.native_code_sales_order);
}
/** Business-only projection preserves decimal/source date text; legacy currency is never inferred from the lead. */
// The projection lists independent nullable fields, not business transition branches.
// eslint-disable-next-line complexity
export function buildOrderDetail(data: Snapshot, relations: Relations): OrderDetail {
    const native = data.source === "native";
    const order = data.order.sourceFields;
    const read = (n: string, l: string) => order[native ? n : l];
    const fields: OrderDetail["sections"] = [];
    const add = (title: string, definitions: [string, string, unknown, OrderDetail["sections"][number]["fields"][number]["kind"]][]) => fields.push({ title, fields: definitions.map(([code, label, value, kind]) => ({ code, label, value: kind === "boolean" ? flag(data.source, value) : text(value), kind })) });
    const approval = (type: string, legacy: string) => {
        if (!native) return order[legacy];
        const matches = relations.approvals.filter((row) => row.type === type);
        if (matches.length > 1) relations.warnings.push("approval." + type + ":ambiguous");
        const status = matches.length === 1 ? matches[0]?.status : null;
        return status === "approved" ? "yes" : status === "not_approved" ? "no" : null;
    };
    add("Información general", [
        ["number", "Número de orden", orderNumber(data, relations.warnings), "text"],
        ["date", "Fecha de la orden", read("transaction_date_sales_order", "trandate_ov"), "date"],
        ["status", "Estado de la orden", native ? ({ active: "Activa", inactive: "Inactiva" } as Record<string, string>)[String(order.status_sales_order)] : ({ "1": "Activa", "0": "Inactiva" } as Record<string, string>)[String(order.status_ov)], "text"],
        ["project", "Proyecto", relations.project, "text"],
        ["unit", "Unidad", data.unitFile?.sourceFields[native ? "code_unit_file" : "codigo_exp"], "text"],
        ["subsidiary", "Subsidiaria", relations.subsidiary, "text"],
        ["seller", "Vendedor", relations.seller, "text"],
    ]);
    add("Montos y condiciones", [
        ["currency", "Moneda", native ? order.currency_code_sales_order : null, "text"],
        ["listPrice", "Precio de lista", read("list_price_sales_order", "pre_lista_ov"), "money"],
        ["netSalePrice", "Precio de venta neto", read("net_sale_price_sales_order", "prec_ventaneto_ov"), "money"],
        ["salePrice", "Precio de venta", read("sale_price_sales_order", "prec_venta_ov"), "money"],
        ["advisorCommission", "Comisión del asesor", read("advisor_commission_sales_order", "comison_asesor_ov"), "money"],
        ["trustDownPaymentValidated", "Prima del fideicomiso validada", read("trust_down_payment_validated_sales_order", "validacion_fideicomiso_prima_ov"), "boolean"],
        ["installmentsFullyPaid", "Cuotas pagadas por completo", read("installments_fully_paid_sales_order", "cuotas_pagadas_completo_ov"), "boolean"],
    ]);
    add("Aprobaciones", [
        ["salesManagementApproval", "Jefe de Ventas", approval("sales_management", "chekJefeVenta"), "boolean"],
        ["developerApproval", "Desarrolladora", approval("developer", "aprobacion__rdr_ov"), "boolean"],
        ["formalizationApproval", "Formalización", approval("formalization", "aprobacion_forma_ov"), "boolean"],
    ]);
    add("Contrato y comisiones", [
        ["contractSigned", "Contrato firmado", read("contract_signed_sales_order", "contrado_frima_ov"), "boolean"],
        ["commercialClosureSigned", "Cierre comercial firmado", read("commercial_closure_signed_sales_order", "cierre_firmado_ov"), "boolean"],
        ["commissionApproved", "Comisión aprobada", read("commission_approved_sales_order", "comision_aprobada_ov"), "boolean"],
        ["advisorCommissionCalculated", "Comisión del asesor calculada", read("advisor_commission_calculated_sales_order", "calculo_comision_asesor_ov"), "boolean"],
        ["advisorCommissionPaid", "Comisión del asesor pagada", read("advisor_commission_paid_sales_order", "comision_cancelada_ov"), "boolean"],
        ["brokerCommissionCalculated", "Comisión del corredor calculada", read("broker_commission_calculated_sales_order", "calculo_comision_corredor_ov"), "boolean"],
    ]);
    add("Entrega y traspaso", [
        ["unitDelivered", "Unidad entregada", read("unit_delivered_sales_order", "unidad_entregada_ov"), "boolean"],
        ["unitTransferred", "Unidad traspasada", read("unit_transferred_sales_order", "unidad_traspasada_ov"), "boolean"],
        ["keysDelivered", "Llaves entregadas", read("keys_delivered_sales_order", "entrega_llaves_ov"), "boolean"],
    ]);
    add("Cancelación", [
        ["cancelled", "Venta caída", read("cancelled_sales_order", "caida_ov"), "boolean"],
        ["cancellationDate", "Fecha de venta caída", read("cancellation_marked_on_sales_order", "envioReservaCaida"), "date"],
    ]);
    add("Documentos", [["unitFile", "Expediente de la unidad", data.unitFile?.sourceFields[native ? "unit_plans_unit_file" : "planosDeUnidad_exp"], "link"]]);
    add("Registro", [
        ["origin", "Origen", native ? "CRM" : "Sistema anterior", "text"],
        ["createdAt", "Creada", read("created_at_sales_order", "creado_ov"), "date"],
        ["updatedAt", "Actualizada", native ? order.updated_at_sales_order : null, "date"],
    ]);
    return { sections: fields, currency: native ? text(order.currency_code_sales_order) : null, client: relations.client ?? client(data, relations), warnings: [...new Set([...data.warnings, ...relations.warnings])] };
}
/** Bounded reads reuse the already authorized order snapshot; no lead profile/history or writes are performed here. */
export async function readOrderDetail(tx: Transaction<CrmDatabase>, data: Snapshot, options: { legacyEnabled?: boolean }): Promise<OrderDetail> {
    const relations: Relations = { project: null, subsidiary: null, seller: null, advisor: null, identification: null, approvals: [], warnings: [] };
    if (data.source === "native") await nativeRelations(tx, data, relations);
    else await legacyRelations(tx, data, relations);
    if (options.legacyEnabled === true) await crossSourceClient(tx, data, relations);
    return buildOrderDetail(data, relations);
}
