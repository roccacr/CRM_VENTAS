import { ConflictException, NotFoundException } from "@nestjs/common";
import { sql, type Transaction } from "kysely";

import type { CrmDatabase } from "../../../../database/database.types.js";
import { readOrderDetail } from "./order-detail.query.js";

// Explicit business-column allowlists: schema additions never become public automatically.
const nativeOrder =
    "id_sales_order public_id_sales_order native_code_sales_order id_old_produccion_sales_order unit_file_id_sales_order subsidiary_id_sales_order owner_user_id_sales_order status_sales_order cancelled_sales_order currency_code_sales_order transaction_date_sales_order list_price_sales_order net_sale_price_sales_order sale_price_sales_order advisor_commission_sales_order contract_signed_sales_order commercial_closure_signed_sales_order advisor_commission_calculated_sales_order advisor_commission_paid_sales_order source_created_at_sales_order created_at_sales_order created_by_user_id_sales_order updated_at_sales_order updated_by_user_id_sales_order deleted_at_sales_order lead_id_sales_order unit_delivered_sales_order unit_transferred_sales_order keys_delivered_sales_order trust_down_payment_validated_sales_order commission_approved_sales_order broker_commission_calculated_sales_order installments_fully_paid_sales_order cancellation_marked_on_sales_order";
const nativeLead =
    "id_lead public_id_lead primary_contact_id_lead owner_user_id_lead project_id_lead campaign_id_lead subsidiary_id_lead broker_id_lead source_code_lead interest_code_lead status_code_lead status_lead ad_name_lead company_name_lead currency_code_lead initial_comment_lead initial_contact_template_sent_lead has_related_lead_lead version_lead source_created_at_lead source_updated_at_lead created_at_lead updated_at_lead created_by_user_id_lead updated_by_user_id_lead inactivated_at_lead deleted_at_lead";
const nativeContact = "id_contact public_id_contact full_name_contact email_contact phone_contact country_code_contact status_contact created_at_contact updated_at_contact deleted_at_contact";
const nativeUnit =
    "id_unit_file public_id_unit_file native_code_unit_file project_id_unit_file id_old_produccion_unit_file source_project_reference_unit_file code_unit_file project_name_snapshot_unit_file housing_type_unit_file lot_area_unit_file source_status_unit_file advertised_sale_price_unit_file habitable_area_unit_file total_area_unit_file approximate_maintenance_fee_unit_file unit_plans_unit_file estimated_delivery_unit_file storage_area_unit_file mezzanine_area_unit_file balcony_area_unit_file ground_floor_area_unit_file upper_floor_area_unit_file extension_area_unit_file terrace_area_unit_file price_per_square_meter_unit_file third_level_basement_area_unit_file approximate_parking_area_unit_file external_garden_area_unit_file sloped_garden_area_unit_file open_common_area_unit_file minimum_sale_price_unit_file modified_at_unit_file cron_value_unit_file created_at_unit_file updated_at_unit_file";
const legacyOrder =
    "id_ov id_ov_tranid id_ov_netsuite id_ov_est id_ov_opt id_ov_admin id_ov_lead idExpediente_ov idsubsidiaria_ov namesubsi_ov chek_ov contrado_frima_ov cierre_firmado_ov aprobacion_forma_ov aprobacion__rdr_ov calculo_comision_asesor_ov comision_cancelada_ov status_ov creado_ov caida_ov reserva_ov pre_lista_ov trandate_ov prec_ventaneto_ov prec_venta_ov comison_asesor_ov ubicacion entity_cliente_ov envioReserva envioReservaCaida fechaClienteComprobante_ov pagadas_ov chekJefeVenta unidad_entregada_ov unidad_traspasada_ov entrega_llaves_ov validacion_fideicomiso_prima_ov comision_aprobada_ov calculo_comision_corredor_ov cuotas_pagadas_completo_ov";
const legacyLead =
    "id_lead id_admin_lead id_empleado_lead id_rol_lead idnetsuite_lead idinterno_lead nombre_lead email_lead telefono_lead codigo_lead proyecto_lead idproyecto_lead subsidiaria_lead idsubsidaria_lead idestadointeresado_lead estadointeresado_lead comentario_lead campana_lead idcampana_lead empresa_lead referencia_lead idreferencia_lead moneda_lead contribucion_lead estado_lead creado_lead actualizado_lead accion_lead actualizadaaccion_lead segimineto_lead id_Caida valor_segimineto_lead id_corredor seguimiento_calendar whatsapp_template_contact_sent custentityaccion_campana";
const legacyUnit =
    "id_expediente ID_interno_expediente codigo_exp proyectoPrincipal_exp idProyectoPrincipal_exp tipoDeVivienda_exp loteM2_exp estado_exp precioVentaUncio_exp m2Habitables_exp areaTotalM2_exp cuotaMantenimientoAprox_exp planosDeUnidad_exp entregaEstimada areaDeBodegaM2_exp areaDeMezzanieM2_exp areaDeBalconM2_exp areaDePlantaBaja_exp areaDePlantaAlta_exp areaDeAmpliacion_exp areaDeTerraza_exp precioPorM2_exp tercerNivelSotano_exp areaDeParqueoAprox areaExternaJardin_exp jardinConTalud_exp areacomunLibe_exp precioDeVentaMinimo fecha_mod cron_value";
/** Public business fields shared with the read-only audit projection; new DB columns remain private. */
export const ORDER_RECORD_FIELDS = [...nativeOrder.split(" "), ...legacyOrder.split(" ")];

type Row = Record<string, unknown>;

interface TableRead {
    table: string;
    columns: string;
    key: string;
    id: unknown;
}
async function one(tx: Transaction<CrmDatabase>, query: TableRead, warnings: string[], relation: string): Promise<Row | null> {
    if (query.id === null || query.id === undefined) {
        warnings.push(relation + ":missing");
        return null;
    }
    const { rows } = await sql<Row>`SELECT /*+ MAX_EXECUTION_TIME(3000) */ ${sql.join(query.columns.split(" ").map((column) => sql.ref(column)))} FROM ${sql.table(query.table)} WHERE ${sql.ref(query.key)}=${query.id} LIMIT 2`.execute(tx);
    if (rows.length > 1) {
        warnings.push(relation + ":ambiguous");
        return null;
    }
    const row = rows[0] ?? null;
    if (!row) warnings.push(relation + ":missing");
    return row;
}
const tables = {
    native: {
        order: { table: "crm_sales_order", columns: nativeOrder, key: "id_sales_order" },
        lead: { table: "crm_lead", columns: nativeLead, key: "id_lead" },
        unit: { table: "crm_unit_file", columns: nativeUnit, key: "id_unit_file" },
        leadLink: "lead_id_sales_order",
        unitLink: "unit_file_id_sales_order",
        leadPublic: "public_id_lead",
        unitPublic: "public_id_unit_file",
        unitCode: "code_unit_file",
    },
    legacy: {
        order: { table: "crmdatabase-api.ordenventa", columns: legacyOrder, key: "id_ov" },
        lead: { table: "crmdatabase-api.leads", columns: legacyLead, key: "idinterno_lead" },
        unit: { table: "crmdatabase-api.expedientes", columns: legacyUnit, key: "ID_interno_expediente" },
        leadLink: "id_ov_lead",
        unitLink: "idExpediente_ov",
        leadPublic: "id_lead",
        unitPublic: "id_expediente",
        unitCode: "codigo_exp",
    },
} as const;
async function references(tx: Transaction<CrmDatabase>, source: "native" | "legacy", order: Row, id: string): Promise<Row[]> {
    if (source === "legacy") return [{ provider: "netsuite", externalId: order.id_ov_netsuite, number: order.id_ov_tranid }];
    const result =
        await sql<Row>`SELECT s.code_external_system AS provider,x.external_id_sales_order_external_reference AS externalId,x.transaction_number_sales_order_external_reference AS number FROM crm_sales_order_external_reference x JOIN int_external_system s ON s.id_external_system=x.external_system_id_sales_order_external_reference WHERE x.sales_order_id_sales_order_external_reference=${id} AND x.status_sales_order_external_reference='active' AND s.status_external_system='active' ORDER BY s.code_external_system,x.id_sales_order_external_reference LIMIT 101`.execute(
            tx,
        );
    if (result.rows.length > 100) throw new ConflictException("Demasiadas referencias externas para la orden.");
    return result.rows;
}
async function readContact(tx: Transaction<CrmDatabase>, source: "native" | "legacy", lead: Row | null, warnings: string[]) {
    if (!lead) return null;
    if (source === "legacy") return { id: null, name: lead.nombre_lead, email: lead.email_lead, phone: lead.telefono_lead, sourceFields: null };
    const row = await one(tx, { table: "crm_contact", columns: nativeContact, key: "id_contact", id: lead.primary_contact_id_lead }, warnings, "contact");
    return row ? { id: row.public_id_contact, name: row.full_name_contact, email: row.email_contact, phone: row.phone_contact, sourceFields: row } : null;
}
function entity(row: Row | null, fields: { id: string; code?: string }, source: "native" | "legacy") {
    if (!row) return null;
    return { id: source === "legacy" ? "legacy:" + String(row[fields.id]) : row[fields.id], ...(fields.code ? { code: row[fields.code] } : {}), sourceFields: row };
}
/** Complete business snapshots in a common envelope; unconfirmed source fields stay separate until mapped explicitly. */
// Optional gate preserves the existing four-argument reader contract.
// eslint-disable-next-line max-params
export async function readOrderRecord(tx: Transaction<CrmDatabase>, source: "native" | "legacy", internalId: string, publicId: string, options: { legacyEnabled?: boolean } = {}) {
    const config = tables[source];
    const warnings: string[] = [];
    const order = await one(tx, { ...config.order, id: internalId }, warnings, "order");
    if (!order) throw new NotFoundException("Orden no disponible o ambigua.");
    const lead = await one(tx, { ...config.lead, id: order[config.leadLink] }, warnings, "lead");
    const unit = await one(tx, { ...config.unit, id: order[config.unitLink] }, warnings, "unitFile");
    const contact = await readContact(tx, source, lead, warnings);
    const refs = await references(tx, source, order, internalId);
    const snapshot = {
        schemaVersion: 1 as const,
        observedAt: new Date().toISOString(),
        source,
        order: { id: publicId, number: refs[0]?.number ?? order.native_code_sales_order ?? null, sourceFields: order },
        lead: entity(lead, { id: config.leadPublic }, source),
        contact,
        unitFile: entity(unit, { id: config.unitPublic, code: config.unitCode }, source),
        references: refs,
        warnings,
    };
    return { ...snapshot, detail: await readOrderDetail(tx, snapshot, options) };
}
