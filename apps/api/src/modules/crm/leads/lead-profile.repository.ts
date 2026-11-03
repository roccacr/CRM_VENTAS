import { ConflictException, HttpException, Inject, Injectable, NotFoundException, ServiceUnavailableException } from "@nestjs/common";
import { sql, type Transaction } from "kysely";

import { DatabaseService } from "../../../database/database.service.js";
import type { CrmDatabase } from "../../../database/database.types.js";
import { readOrderClientContext } from "../sales/sales-orders/order-client-context.query.js";
import { LEAD_PROFILE_LEGACY_READER, type LeadProfileEvent, type LeadProfileOrder, type LeadProfileQueryDto, type LeadProfileResponseDto, type LeadProfileSource } from "./lead-profile.contract.js";
import { buildLeadProfile } from "./lead-profile.mapper.js";
import type { LeadProfileLegacyReader } from "./lead-profile.port.js";

/** Resuelve el perfil mediante lecturas autorizadas, sin importar datos entre bases. */
@Injectable()
export class LeadProfileRepository {
    /** Inyección explícita compatible con el runtime tsx y las pruebas. */
    constructor(
        @Inject(DatabaseService) private readonly database: DatabaseService,
        @Inject(LEAD_PROFILE_LEGACY_READER) private readonly legacy: LeadProfileLegacyReader,
    ) {}

    /** Ambas fuentes comparten snapshot de solo lectura; un fallo no se disfraza como perfil completo. */
    async read(query: LeadProfileQueryDto): Promise<LeadProfileResponseDto> {
        try {
            return await this.database.db
                .transaction()
                .setIsolationLevel("repeatable read")
                .setAccessMode("read only")
                .execute((tx) => this.readProfile(tx, query));
        } catch (error) {
            if (error instanceof HttpException) throw error;
            throw new ServiceUnavailableException("No fue posible consultar el perfil completo del lead.");
        }
    }

    private async readProfile(tx: Transaction<CrmDatabase>, query: LeadProfileQueryDto) {
        const { native, legacy } = await this.resolve(tx, query);
        const primary = native ?? legacy;
        const context = await this.history(tx, primary, legacy, query.cursor);
        const page = Number(query.orderPage ?? 1);
        const nativeOrders = native ? await this.orders(tx, native.internalId, page) : { items: [], hasMore: false, page };
        const legacyOrders = legacy ? await this.legacy.orders(tx, legacy, page, native?.internalId) : { items: [], hasMore: false, page };
        const nativeEvents = native ? await this.events(tx, native, page) : { items: [], hasMore: false, page };
        const legacyEvents = legacy ? await this.legacy.events(tx, legacy, page) : { items: [], hasMore: false, page };
        const commercial = await this.commercial(tx, legacy, page);
        return { ...buildLeadProfile(native, legacy), history: context.history, orders: { native: nativeOrders, legacy: legacyOrders }, events: { native: nativeEvents, legacy: legacyEvents }, ...commercial };
    }

    private async commercial(tx: Transaction<CrmDatabase>, legacy: LeadProfileSource | null, page: number) {
        const unavailable = { items: [], total: 0, hasMore: false, page, available: false };
        if (!legacy) return { opportunities: unavailable, estimates: unavailable };
        return { opportunities: await this.legacy.commercial(tx, legacy, "opportunities", page), estimates: await this.legacy.commercial(tx, legacy, "estimates", page) };
    }

    private history(tx: Transaction<CrmDatabase>, primary: LeadProfileSource, legacy: LeadProfileSource | null, cursor?: string) {
        const options = { legacyEnabled: this.legacy.enabled(), resolvedIdentity: true, ...(cursor ? { cursor } : {}), ...(legacy ? { linkedLegacyLead: { id: legacy.internalId, reference: legacy.reference } } : {}) };
        return readOrderClientContext(tx, { source: primary.source, lead: { sourceFields: { id_lead: primary.internalId, idinterno_lead: primary.reference } } }, options);
    }

    private findLegacy(tx: Transaction<CrmDatabase>, kind: "id" | "reference", value: string) {
        if (!this.legacy.enabled()) throw new ServiceUnavailableException("La fuente legacy requerida no está disponible.");
        return this.legacy.find(tx, kind, value);
    }

    /** Solo referencias externas explícitas o vínculos históricos verificados autorizan la unión. */
    private async resolve(tx: Transaction<CrmDatabase>, query: LeadProfileQueryDto) {
        let legacy = query.source === "legacy" ? await this.findLegacy(tx, "id", query.id) : null;
        if (query.source === "legacy" && !legacy) throw new NotFoundException("Lead no encontrado.");
        let nativeId = query.id;
        if (legacy) {
            const candidates = await this.linkedNative(tx, legacy);
            if (!candidates[0]) return { native: null, legacy };
            nativeId = candidates[0];
        }
        const native = await this.native(tx, nativeId);
        if (!native) throw new NotFoundException("Lead no encontrado.");
        legacy = await this.resolveLegacy(tx, native, legacy);
        return { native, legacy };
    }

    private async resolveLegacy(tx: Transaction<CrmDatabase>, native: LeadProfileSource, legacy: LeadProfileSource | null) {
        const links = await sql<{ kind: "id" | "reference"; value: string }>`SELECT 'reference' AS kind,x.external_id_lead_external_reference AS value FROM crm_lead_external_reference x JOIN int_external_system s ON s.id_external_system=x.external_system_id_lead_external_reference
            WHERE x.lead_id_lead_external_reference=${native.internalId} AND x.status_lead_external_reference='active' AND s.status_external_system='active' AND s.code_external_system='netsuite'
            UNION SELECT 'id' AS kind,r.source_id_record AS value FROM int_lead_history_link h JOIN audit_record r ON r.id_record=h.record_id_lead_history_link
            WHERE h.lead_id_lead_history_link=${native.internalId} AND r.source_schema_record='crmdatabase-api' AND r.source_table_record='leads' AND r.entity_type_record='lead' LIMIT 3`.execute(tx);
        if (links.rows.length > 2) throw new ConflictException("El lead tiene relaciones antiguas ambiguas.");
        for (const link of links.rows) {
            const candidate = await this.findLegacy(tx, link.kind, link.value);
            if (!candidate) continue;
            if (legacy && legacy.id !== candidate.id) throw new ConflictException("Las referencias del lead no coinciden.");
            legacy = candidate;
        }
        if (legacy) {
            const candidates = await this.linkedNative(tx, legacy);
            if (candidates[0] !== native.id) throw new ConflictException("La relación entre bases no es única.");
        }
        return legacy;
    }

    private async linkedNative(tx: Transaction<CrmDatabase>, lead: LeadProfileSource): Promise<string[]> {
        const { rows } = await sql<{ id: string }>`SELECT DISTINCT l.public_id_lead AS id FROM crm_lead_external_reference x
            JOIN int_external_system s ON s.id_external_system=x.external_system_id_lead_external_reference JOIN crm_lead l ON l.id_lead=x.lead_id_lead_external_reference
            WHERE x.status_lead_external_reference='active' AND s.status_external_system='active' AND s.code_external_system='netsuite' AND x.external_id_lead_external_reference=${lead.reference}
            UNION SELECT l.public_id_lead AS id FROM int_lead_history_link h JOIN audit_record r ON r.id_record=h.record_id_lead_history_link JOIN crm_lead l ON l.id_lead=h.lead_id_lead_history_link
            WHERE r.entity_type_record='lead' AND r.source_schema_record='crmdatabase-api' AND r.source_table_record='leads' AND r.source_id_record=${lead.id} LIMIT 2`.execute(tx);
        if (rows.length > 1) throw new ConflictException("Más de un lead nativo está relacionado con el antiguo.");
        return rows.map((row) => row.id);
    }

    private async native(tx: Transaction<CrmDatabase>, publicId: string): Promise<LeadProfileSource | null> {
        const { rows } = await sql<Record<string, string | null>>`SELECT /*+ MAX_EXECUTION_TIME(3000) */ l.public_id_lead AS id,CAST(l.id_lead AS CHAR) AS internalId,CAST(l.id_lead AS CHAR) AS localId,l.public_id_lead AS publicId,
            CAST(l.primary_contact_id_lead AS CHAR) AS contactReference,CAST(l.owner_user_id_lead AS CHAR) AS employeeReference,CAST(l.project_id_lead AS CHAR) AS projectReference,
            CAST(l.campaign_id_lead AS CHAR) AS campaignReference,CAST(l.subsidiary_id_lead AS CHAR) AS subsidiaryReference,CAST(l.broker_id_lead AS CHAR) AS brokerReference,
            CAST(l.version_lead AS CHAR) AS version,CAST(l.source_created_at_lead AS CHAR) AS sourceCreatedAt,CAST(l.source_updated_at_lead AS CHAR) AS sourceUpdatedAt,
            CAST(l.created_by_user_id_lead AS CHAR) AS createdByReference,CAST(l.updated_by_user_id_lead AS CHAR) AS updatedByReference,CAST(l.inactivated_at_lead AS CHAR) AS inactivatedAt,c.full_name_contact AS fullName,c.email_contact AS email,c.phone_contact AS phone,c.country_code_contact AS countryCode,
            l.company_name_lead AS company,CASE l.status_lead WHEN 'active' THEN 'Activo' ELSE 'Inactivo' END AS status,COALESCE(st.name_lead_status,l.status_code_lead) AS stage,COALESCE(cs.name_lead_source,l.source_code_lead) AS acquisitionSource,COALESCE(ci.name_lead_interest,l.interest_code_lead) AS interest,l.ad_name_lead AS ad,l.initial_comment_lead AS comment,l.currency_code_lead AS currency,
            CAST(l.initial_contact_template_sent_lead AS CHAR) AS templateSent,CAST(l.has_related_lead_lead AS CHAR) AS relatedLead,CAST(l.created_at_lead AS CHAR) AS createdAt,CAST(l.updated_at_lead AS CHAR) AS updatedAt,
            u.display_name_user AS owner,p.name_project AS project,k.name_campaign AS campaign,b.name_broker AS broker,sb.name_subsidiary AS subsidiary
            FROM crm_lead l LEFT JOIN crm_contact c ON c.id_contact=l.primary_contact_id_lead AND c.deleted_at_contact IS NULL
            LEFT JOIN crm_broker b ON b.id_broker=l.broker_id_lead LEFT JOIN crm_subsidiary sb ON sb.id_subsidiary=l.subsidiary_id_lead
            LEFT JOIN sec_user u ON u.id_user=l.owner_user_id_lead LEFT JOIN crm_project p ON p.id_project=l.project_id_lead LEFT JOIN crm_campaign k ON k.id_campaign=l.campaign_id_lead
            LEFT JOIN conf_lead_status st ON st.code_lead_status=l.status_code_lead LEFT JOIN conf_lead_source cs ON cs.code_lead_source=l.source_code_lead LEFT JOIN conf_lead_interest ci ON ci.code_lead_interest=l.interest_code_lead
            WHERE l.public_id_lead=${publicId} AND l.deleted_at_lead IS NULL LIMIT 2`.execute(tx);
        if (rows.length > 1) throw new ConflictException("La identidad del lead nativo es ambigua.");
        const row = rows[0];
        if (!row?.id || !row.internalId) return null;
        const { id, internalId, ...values } = row;
        return { source: "native", id, internalId, reference: null, values };
    }

    /** Eventos nativos del cliente: los vinculados al lead y las citas comerciales; la hora se muestra en Costa Rica (UTC-6, sin horario de verano). */
    private async events(tx: Transaction<CrmDatabase>, lead: LeadProfileSource, page: number) {
        const { rows } = await sql<LeadProfileEvent>`SELECT /*+ MAX_EXECUTION_TIME(3000) */ e.public_id_calendar_event AS id,'native' AS source,e.title_calendar_event AS title,t.name_calendar_event_type AS type,
            CASE e.status_calendar_event WHEN 'completed' THEN 'Completado' WHEN 'cancelled' THEN 'Cancelado' ELSE 'Programado' END AS status,
            DATE_FORMAT(DATE_SUB(e.starts_at_calendar_event,INTERVAL 6 HOUR),'%Y-%m-%d') AS date,
            IF(e.all_day_calendar_event=1,NULL,DATE_FORMAT(DATE_SUB(e.starts_at_calendar_event,INTERVAL 6 HOUR),'%H:%i')) AS startTime,
            IF(e.all_day_calendar_event=1,NULL,DATE_FORMAT(DATE_SUB(e.ends_at_calendar_event,INTERVAL 6 HOUR),'%H:%i')) AS endTime
            FROM crm_calendar_event e JOIN conf_calendar_event_type t ON t.id_calendar_event_type=e.type_id_calendar_event
            WHERE e.deleted_at_calendar_event IS NULL AND e.id_calendar_event IN (
                SELECT x.event_id_calendar_event_link FROM crm_calendar_event_link x WHERE x.entity_type_calendar_event_link='lead' AND x.source_calendar_event_link='native' AND x.entity_public_id_calendar_event_link=${lead.id} AND x.deleted_at_calendar_event_link IS NULL
                UNION SELECT a.event_id_calendar_appointment FROM crm_calendar_appointment a WHERE a.lead_id_calendar_appointment=${lead.internalId})
            ORDER BY e.starts_at_calendar_event DESC,e.id_calendar_event DESC LIMIT 51 OFFSET ${(page - 1) * 50}`.execute(tx);
        return { items: rows.slice(0, 50), hasMore: rows.length > 50, page };
    }

    private async orders(tx: Transaction<CrmDatabase>, lead: string, page: number) {
        const { rows } = await sql<LeadProfileOrder>`SELECT public_id_sales_order AS id,'native' AS source,native_code_sales_order AS number,status_sales_order AS status,CAST(transaction_date_sales_order AS CHAR) AS date,currency_code_sales_order AS currency,CAST(sale_price_sales_order AS CHAR) AS amount
            FROM crm_sales_order WHERE lead_id_sales_order=${lead} AND deleted_at_sales_order IS NULL ORDER BY id_sales_order DESC LIMIT 51 OFFSET ${(page - 1) * 50}`.execute(tx);
        return { items: rows.slice(0, 50), hasMore: rows.length > 50, page };
    }
}
