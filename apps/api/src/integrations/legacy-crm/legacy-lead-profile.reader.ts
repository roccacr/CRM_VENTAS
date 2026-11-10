import { ConflictException, Inject, Injectable } from "@nestjs/common";
import { sql, type Transaction } from "kysely";

import type { CrmDatabase } from "../../database/database.types.js";
import type { LeadProfileEvent, LeadProfileOrder, LeadProfileSource } from "../../modules/crm/leads/lead-profile.contract.js";
import type { LeadProfileLegacyReader } from "../../modules/crm/leads/lead-profile.port.js";
import { LegacyCrmDatabaseService } from "./legacy-crm-database.service.js";
import { readLegacyLeadCommercial } from "./legacy-lead-commercial.query.js";

/**
 * Columnas del perfil ampliado. Los nombres fisicos se conservan, incluidos
 * `TelefonoAlternatovo_lead` y `info_extra_ZonaRecidencia`. `segimineto_lead` vive en el lead, no aqui.
 */
const extras = {
    extraId: "id_Info_lead",
    extraLeadReference: "id_lead_fk",
    identification: "cedula_lead",
    nationality: "Nacionalidad_lead",
    maritalStatus: "Estado_ciLead",
    age: "Edad_lead",
    profession: "Profesion_lead",
    children: "Hijos_lead",
    alternatePhone: "TelefonoAlternatovo_lead",
    address: "Direccion",
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

/**
 * Perfil del lead viejo, solo lectura, en la transaccion del llamador. No importa filas.
 *
 * `LIMIT 2` y mas de una fila es conflicto: no se elige con `MIN`. El nombre del
 * dueno sale solo si hay exactamente un admin. El estado 1 es Activo, 0 es
 * Inactivo y cualquier otro queda "Sin dato".
 */
@Injectable()
export class LegacyLeadProfileReader implements LeadProfileLegacyReader {
    /** Inyección explícita compatible con el runtime tsx y las pruebas. */
    constructor(@Inject(LegacyCrmDatabaseService) private readonly database: LegacyCrmDatabaseService) {}
    /** Respeta la compuerta existente de acceso legacy; leer no la activa. */
    enabled(): boolean {
        return this.database.isConfigured();
    }

    /** El extra solo se lee si la referencia externa pertenece a un unico lead. */
    async find(tx: Transaction<CrmDatabase>, key: "id" | "reference", value: string): Promise<LeadProfileSource | null> {
        const { rows } = await sql<Record<string, string | null>>`SELECT /*+ MAX_EXECUTION_TIME(3000) */ CAST(l.id_lead AS CHAR) AS id,CAST(l.idinterno_lead AS CHAR) AS reference,
            CAST(l.id_lead AS CHAR) AS localId,CAST(l.idinterno_lead AS CHAR) AS externalReference,l.idnetsuite_lead AS netsuiteId,
            CAST(l.id_admin_lead AS CHAR) AS adminReference,CAST(l.id_empleado_lead AS CHAR) AS employeeReference,CAST(l.id_rol_lead AS CHAR) AS roleReference,
            CAST(l.idproyecto_lead AS CHAR) AS projectReference,CAST(l.idsubsidaria_lead AS CHAR) AS subsidiaryReference,CAST(l.idestadointeresado_lead AS CHAR) AS interestReference,
            l.idcampana_lead AS campaignReference,l.idreferencia_lead AS acquisitionReference,CAST(l.id_Caida AS CHAR) AS followUpReasonReference,CAST(l.id_corredor AS CHAR) AS brokerReference,
            bk.nombre_corredor AS broker,l.nombre_lead AS fullName,l.email_lead AS email,l.telefono_lead AS phone,l.codigo_lead AS countryCode,l.empresa_lead AS company,l.proyecto_lead AS project,l.subsidiaria_lead AS subsidiary,l.moneda_lead AS currency,
            CASE l.estado_lead WHEN 1 THEN 'Activo' WHEN 0 THEN 'Inactivo' ELSE 'Sin dato' END AS status,l.segimineto_lead AS stage,l.campana_lead AS campaign,l.custentityaccion_campana AS ad,l.referencia_lead AS acquisitionSource,l.estadointeresado_lead AS interest,l.comentario_lead AS comment,
            l.valor_segimineto_lead AS followUpValue,c.nombre_caida AS followUpReason,l.contribucion_lead AS contribution,l.accion_lead AS action,
            CAST(l.actualizadaaccion_lead AS CHAR) AS actionAt,CAST(l.seguimiento_calendar AS CHAR) AS calendarFollowUp,CAST(l.whatsapp_template_contact_sent AS CHAR) AS templateSent,
            CAST(l.creado_lead AS CHAR) AS createdAt,CAST(l.actualizado_lead AS CHAR) AS updatedAt,
            (SELECT MIN(a.name_admin) FROM ${sql.table("crmdatabase-api.admins")} a WHERE a.idnetsuite_admin=l.id_empleado_lead HAVING COUNT(*)=1) AS owner
            FROM ${sql.table("crmdatabase-api.leads")} l LEFT JOIN ${sql.table("crmdatabase-api.caidas")} c ON c.id_caida=l.id_Caida LEFT JOIN ${sql.table("crmdatabase-api.corredores")} bk ON bk.id_corredor=l.id_corredor
            WHERE ${sql.ref(key === "id" ? "l.id_lead" : "l.idinterno_lead")}=${value} LIMIT 2`.execute(tx);
        if (rows.length > 1) throw new ConflictException("La relación del lead antiguo es ambigua.");
        const row = rows[0];
        if (!row?.id) return null;
        const { id, reference = null, ...values } = row;
        const additional = reference ? await this.extendedValues(tx, reference) : {};
        return { source: "legacy", id, internalId: id, reference, values: Object.fromEntries(Object.entries({ ...values, ...additional }).map(([key, value]) => [key, profileText(value)])) };
    }

    /** Mas de un extra, o una referencia que no es unica, es conflicto. Los valores vacios no se publican. */
    private async extendedValues(tx: Transaction<CrmDatabase>, reference: string): Promise<Record<string, unknown>> {
        const matches = await sql<{ id: string }>`SELECT id_lead AS id FROM ${sql.table("crmdatabase-api.leads")} WHERE idinterno_lead=${reference} LIMIT 2`.execute(tx);
        if (matches.rows.length !== 1) throw new ConflictException("La referencia del lead antiguo no es única.");
        const extra = await sql<Record<string, string | null>>`SELECT ${sql.join(Object.entries(extras).map(([alias, column]) => sql`${sql.ref(column)} AS ${sql.ref(alias)}`))} FROM ${sql.table("crmdatabase-api.info_extra_lead")} WHERE id_lead_fk=${reference} LIMIT 2`.execute(tx);
        if (extra.rows.length > 1) throw new ConflictException("El perfil ampliado del lead es ambiguo.");
        return Object.fromEntries(Object.entries(extra.rows[0] ?? {}).filter(([, value]) => profileText(value)?.trim()));
    }

    /** Citas del lead por `idinterno_lead`. La que ya tiene evento nativo no borrado no se repite. Se pide 51 para saber si hay otra pagina. */
    async events(tx: Transaction<CrmDatabase>, lead: LeadProfileSource, page: number) {
        if (!lead.reference) return { items: [], hasMore: false, page };
        const { rows } = await sql<LeadProfileEvent>`SELECT /*+ MAX_EXECUTION_TIME(3000) */ CAST(c.id_calendar AS CHAR) AS id,'legacy' AS source,c.nombre_calendar AS title,c.tipo_calendar AS type,c.accion_calendar AS status,
            c.fechaIni_calendar AS date,c.horaInicio_calendar AS startTime,c.horaFinal_calendar AS endTime
            FROM ${sql.table("crmdatabase-api.calendars")} c
            WHERE c.id_lead=${lead.reference}
            AND NOT EXISTS (SELECT 1 FROM crm_calendar_event n WHERE n.legacy_calendar_id_calendar_event=c.id_calendar AND n.deleted_at_calendar_event IS NULL)
            ORDER BY c.id_calendar DESC LIMIT 51 OFFSET ${(page - 1) * 50}`.execute(tx);
        return { items: rows.slice(0, 50), hasMore: rows.length > 50, page };
    }

    /** Oportunidades y estimaciones reales. No mezcla la bitacora. */
    commercial(tx: Transaction<CrmDatabase>, lead: LeadProfileSource, kind: "opportunities" | "estimates", page: number) {
        return readLegacyLeadCommercial(tx, lead, kind, page);
    }

    /**
     * La orden ya ligada a este lead nativo no se repite. Si existe una nativa con
     * el mismo id viejo, sin lead y no borrada, se publica como nativa. El resto
     * sigue como legado.
     */
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

/** Solo texto, numero o booleano. Un objeto no se vuelca a JSON. */
function profileText(value: unknown): string | null {
    if (typeof value === "string") return value;
    return typeof value === "number" || typeof value === "boolean" ? String(value) : null;
}
