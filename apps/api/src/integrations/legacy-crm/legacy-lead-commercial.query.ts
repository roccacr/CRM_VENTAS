import { sql, type Transaction } from "kysely";

import type { CrmDatabase } from "../../database/database.types.js";
import type { LeadProfileCommercialPage, LeadProfileSource } from "../../modules/crm/leads/lead-profile.contract.js";
const opportunityFields = {
    id_oport: "Identificador local",
    id_oportunidad_oport: "Identificador externo",
    tranid_oport: "Número de oportunidad",
    entity_oport: "Referencia del lead",
    entityname_oport: "Cliente",
    employee_oport: "Empleado",
    salesrep_oport: "Asesor",
    companyid_oport: "Empresa",
    credholdentity_oport: "Retención de crédito",
    exp_custbody38_oport: "Expediente",
    entitystatus_oport: "Código de etapa",
    forecasttype_oport: "Tipo de pronóstico",
    probability_oport: "Probabilidad",
    expectedclosedate_oport: "Cierre esperado",
    custbody76_oport: "Campo comercial 76",
    custbody75_oport: "Campo comercial 75",
    rangelow_oport: "Rango mínimo",
    rangehigh_oport: "Rango máximo",
    projectedtotal_oport: "Total proyectado",
    subsidiary_oport: "Subsidiaria (referencia)",
    subsidiaria_oport: "Subsidiaria",
    memo_oport: "Observación",
    fecha_creada_oport: "Creada",
    update_fecha_oport: "Actualizada",
    fecha_menos_probable_oport: "Fecha menos probable",
    motivo_inactivacion_oport: "Motivo de inactivación",
    fecha_inactivacion_oport: "Fecha de inactivación",
    id_usuario_inactivo_oport: "Usuario que inactivó",
    tipo_actor_inactivacion_oport: "Tipo de actor de inactivación",
    fuente_inactivacion_oport: "Fuente de inactivación",
    detalle_inactivacion_oport: "Detalle de inactivación",
    fecha_reactivacion_oport: "Fecha de reactivación",
    id_usuario_reactivo_oport: "Usuario que reactivó",
    tipo_actor_reactivacion_oport: "Tipo de actor de reactivación",
    fuente_reactivacion_oport: "Fuente de reactivación",
    detalle_reactivacion_oport: "Detalle de reactivación",
    duracion_ultima_inactividad_seg_oport: "Última inactividad (segundos)",
    estatus_oport: "Estado registrado",
    chek_oport: "Indicador de control",
    fecha_Condicion: "Fecha de condición",
    Motico_Condicion: "Motivo de condición",
    id_valor_opt: "Valor de referencia",
    nota_opt: "Nota",
    custbody13: "Campo comercial 13",
    chek2_oport: "Indicador de control adicional",
};
const estimateFields = {
    id_estimacion: "Identificador local",
    idEstimacion_est: "Identificador externo",
    tranid_est: "Número de estimación",
    idLead_est: "Referencia del lead",
    idOportunidad_est: "Oportunidad vinculada",
    idExpediente_est: "Expediente vinculado",
    nombreLead_est: "Cliente",
    idAdmin_est: "Asesor (referencia)",
    idsubsidiaria: "Subsidiaria (referencia)",
    namesubsi_est: "Subsidiaria",
    caduca: "Vencimiento",
    chek_est: "Indicador de control",
    status: "Estado registrado",
    creado_est: "Creada",
    pre_reserva: "Pre-reserva",
    pre_caida: "Pre-reserva caída",
    montoTotal_est: "Monto total",
    envioPreReserva: "Envío de pre-reserva",
    envioPreReservaCaida: "Envío de pre-reserva caída",
    fechaClienteComprobante_est: "Fecha del comprobante del cliente",
};
/** La FK comercial apunta a idinterno_lead, nunca al id local ni al nombre del cliente. */
export async function readLegacyLeadCommercial(tx: Transaction<CrmDatabase>, lead: LeadProfileSource, kind: "opportunities" | "estimates", page: number): Promise<LeadProfileCommercialPage> {
    if (!lead.reference) return { items: [], total: 0, hasMore: false, page, available: true };
    const opportunity = kind === "opportunities";
    const columns = opportunity ? opportunityFields : estimateFields;
    const table = sql.table(`crmdatabase-api.${opportunity ? "oportunidades" : "estimaciones"}`);
    const foreignKey = sql.ref(opportunity ? "entity_oport" : "idLead_est");
    const primaryKey = sql.ref(opportunity ? "id_oport" : "id_estimacion");
    const count = await sql<{ total: string | number }>`SELECT COUNT(*) AS total FROM ${table} WHERE ${foreignKey}=${lead.reference}`.execute(tx);
    const result = await sql<Record<string, string | null>>`SELECT /*+ MAX_EXECUTION_TIME(3000) */ ${sql.join(Object.keys(columns).map((column) => sql`CAST(${sql.ref(column)} AS CHAR) AS ${sql.ref(column)}`))} FROM ${table} WHERE ${foreignKey}=${lead.reference} ORDER BY ${primaryKey} DESC LIMIT 50 OFFSET ${(page - 1) * 50}`.execute(tx);
    const total = Number(count.rows[0]?.total ?? 0);
    return { items: result.rows.map((row) => ({ id: row[opportunity ? "id_oport" : "id_estimacion"] ?? "", source: "legacy", fields: Object.entries(columns).map(([code, label]) => ({ code, label, value: row[code] ?? null })) })), total, page, hasMore: page * 50 < total, available: true };
}
