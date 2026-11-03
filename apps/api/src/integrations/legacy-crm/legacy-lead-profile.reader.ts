import { ConflictException, Inject, Injectable } from "@nestjs/common";
import { sql, type Transaction } from "kysely";

import type { CrmDatabase } from "../../database/database.types.js";
import type { LeadProfileOrder, LeadProfileSource } from "../../modules/crm/leads/lead-profile.contract.js";
import type { LeadProfileLegacyReader } from "../../modules/crm/leads/lead-profile.port.js";
import { LegacyCrmDatabaseService } from "./legacy-crm-database.service.js";

const extras = {
    identification: "cedula_lead",
    nationality: "Nacionalidad_lead",
    maritalStatus: "Estado_ciLead",
    age: "Edad_lead",
    profession: "Profesion_lead",
    children: "Hijos_lead",
    alternatePhone: "TelefonoAlternatovo_lead",
    address: "Direccion",
    broker: "Corredor_lead",
    relatedName: "nombre_extra_lead",
    relatedIdentification: "cedula_extra_lead",
    relatedProfession: "profesion_extra_lead",
    relatedMaritalStatus: "estado_civil_extra_lead",
    relatedPhone: "telefono_extra_lead",
    relatedNationality: "nacionalidad_extra_lead",
    relatedEmail: "email_extra_lead",
    relatedResidence: "lugar_residencia_extra_lead",
    income: "info_extra_ingresos",
    purchaseReason: "info_extra_MotivoCompra",
    purchaseTiming: "info_extra_MomentodeCompra",
    employment: "info_extra_Trabajo",
    additionalInformation: "info_extra_leadcol",
    fundsOrigin: "info_extra_OrigenFondo",
    residenceZone: "info_extra_ZonaRecidencia",
    buyerProfile: "info_extra_PerfilClienteComprador",
} as const;

/** Resuelve el perfil mediante lecturas autorizadas, sin importar datos entre bases. */
@Injectable()
export class LegacyLeadProfileReader implements LeadProfileLegacyReader {
    /** Inyección explícita compatible con el runtime tsx y las pruebas. */
    constructor(@Inject(LegacyCrmDatabaseService) private readonly database: LegacyCrmDatabaseService) {}
    /** Respeta la compuerta existente de acceso legacy; leer no la activa. */
    enabled(): boolean {
        return this.database.isConfigured();
    }

    /** La FK del perfil extra usa la referencia externa, por eso se exige unicidad antes de leerlo. */
    async find(tx: Transaction<CrmDatabase>, key: "id" | "reference", value: string): Promise<LeadProfileSource | null> {
        const { rows } = await sql<Record<string, string | null>>`SELECT /*+ MAX_EXECUTION_TIME(3000) */ CAST(l.id_lead AS CHAR) AS id,CAST(l.idinterno_lead AS CHAR) AS reference,
            l.nombre_lead AS fullName,l.email_lead AS email,l.telefono_lead AS phone,l.codigo_lead AS countryCode,l.empresa_lead AS company,l.proyecto_lead AS project,l.subsidiaria_lead AS subsidiary,l.moneda_lead AS currency,
            CASE l.estado_lead WHEN 1 THEN 'Activo' WHEN 0 THEN 'Inactivo' ELSE 'Sin dato' END AS status,l.segimineto_lead AS stage,l.campana_lead AS campaign,l.custentityaccion_campana AS ad,l.referencia_lead AS acquisitionSource,l.estadointeresado_lead AS interest,l.comentario_lead AS comment,
            l.valor_segimineto_lead AS followUpValue,c.nombre_caida AS followUpReason,l.contribucion_lead AS contribution,l.accion_lead AS action,
            CAST(l.actualizadaaccion_lead AS CHAR) AS actionAt,CAST(l.seguimiento_calendar AS CHAR) AS calendarFollowUp,CAST(l.whatsapp_template_contact_sent AS CHAR) AS templateSent,
            CAST(l.creado_lead AS CHAR) AS createdAt,CAST(l.actualizado_lead AS CHAR) AS updatedAt,
            (SELECT MIN(a.name_admin) FROM ${sql.table("crmdatabase-api.admins")} a WHERE a.idnetsuite_admin=l.id_empleado_lead HAVING COUNT(*)=1) AS owner
            FROM ${sql.table("crmdatabase-api.leads")} l LEFT JOIN ${sql.table("crmdatabase-api.caidas")} c ON c.id_caida=l.id_Caida
            WHERE ${sql.ref(key === "id" ? "l.id_lead" : "l.idinterno_lead")}=${value} LIMIT 2`.execute(tx);
        if (rows.length > 1) throw new ConflictException("La relación del lead antiguo es ambigua.");
        const row = rows[0];
        if (!row?.id) return null;
        const { id, reference = null, ...values } = row;
        const additional = reference ? await this.extendedValues(tx, reference) : {};
        return { source: "legacy", id, internalId: id, reference, values: Object.fromEntries(Object.entries({ ...values, ...additional }).map(([key, value]) => [key, profileText(value)])) };
    }

    private async extendedValues(tx: Transaction<CrmDatabase>, reference: string): Promise<Record<string, unknown>> {
        const matches = await sql<{ id: string }>`SELECT id_lead AS id FROM ${sql.table("crmdatabase-api.leads")} WHERE idinterno_lead=${reference} LIMIT 2`.execute(tx);
        if (matches.rows.length !== 1) throw new ConflictException("La referencia del lead antiguo no es única.");
        const extra = await sql<Record<string, string | null>>`SELECT ${sql.join(Object.entries(extras).map(([alias, column]) => sql`${sql.ref(column)} AS ${sql.ref(alias)}`))} FROM ${sql.table("crmdatabase-api.info_extra_lead")} WHERE id_lead_fk=${reference} LIMIT 2`.execute(tx);
        if (extra.rows.length > 1) throw new ConflictException("El perfil ampliado del lead es ambiguo.");
        return Object.fromEntries(Object.entries(extra.rows[0] ?? {}).filter(([, value]) => value?.trim()));
    }

    /** Órdenes relacionadas por referencia única; una orden ya nativa no se duplica como legacy. */
    async orders(tx: Transaction<CrmDatabase>, lead: LeadProfileSource, page: number, nativeLeadId?: string) {
        if (!lead.reference) return { items: [], hasMore: false, page };
        const { rows } =
            await sql<LeadProfileOrder>`SELECT /*+ MAX_EXECUTION_TIME(3000) */ COALESCE(linked.public_id_sales_order,CAST(o.id_ov AS CHAR)) AS id,IF(linked.id_sales_order IS NULL,'legacy','native') AS source,COALESCE(linked.native_code_sales_order,o.id_ov_tranid) AS number,COALESCE(linked.status_sales_order,CAST(o.status_ov AS CHAR)) AS status,COALESCE(CAST(linked.transaction_date_sales_order AS CHAR),CAST(o.trandate_ov AS CHAR)) AS date,linked.currency_code_sales_order AS currency,COALESCE(CAST(linked.sale_price_sales_order AS CHAR),CAST(o.prec_venta_ov AS CHAR)) AS amount
            FROM ${sql.table("crmdatabase-api.ordenventa")} o
            LEFT JOIN crm_sales_order linked ON linked.id_old_produccion_sales_order=o.id_ov AND linked.lead_id_sales_order IS NULL AND linked.deleted_at_sales_order IS NULL AND ${nativeLeadId ?? null} IS NOT NULL
            WHERE o.id_ov_lead=${lead.reference}
            AND NOT EXISTS (SELECT 1 FROM crm_sales_order n WHERE n.id_old_produccion_sales_order=o.id_ov AND n.lead_id_sales_order=${nativeLeadId ?? null} AND n.deleted_at_sales_order IS NULL)
            ORDER BY o.id_ov DESC LIMIT 51 OFFSET ${(page - 1) * 50}`.execute(tx);
        return { items: rows.slice(0, 50), hasMore: rows.length > 50, page };
    }
}

function profileText(value: unknown): string | null {
    if (typeof value === "string") return value;
    return typeof value === "number" || typeof value === "boolean" ? String(value) : null;
}
