import { ConflictException, Inject, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { type RawBuilder, sql, type Transaction } from "kysely";

import { DatabaseService } from "../../../database/database.service.js";
import type { CrmDatabase } from "../../../database/database.types.js";
import { type NoteRelatedReference, relatedReferenceSchema } from "./note-related-records.contract.js";

export interface RelatedResourceAccess {
    actor: string;
    all: boolean;
    own: boolean;
    orders: boolean;
}
export interface RelatedResourceRow {
    reference: NoteRelatedReference;
    aliases: NoteRelatedReference[];
    label: string;
    description: string | null;
    active: boolean;
    ownerId: string | null;
    hasOrder: boolean;
    relatedLead?: NoteRelatedReference;
    orderEvidenceUnavailable?: boolean;
}
interface Row {
    id: string;
    label: string;
    description: string | null;
    active: number;
    ownerId: string | null;
    hasOrder: number;
    legacyAliases: unknown;
    relatedLeadId: string | null;
}
type Kind = NoteRelatedReference["kind"];
type Source = NoteRelatedReference["source"];

const activeOrder = sql`o.status_sales_order='active' AND o.cancelled_sales_order='no' AND o.deleted_at_sales_order IS NULL`;
const nativeLeadOrder = sql`EXISTS(SELECT 1 FROM crm_sales_order no WHERE no.lead_id_sales_order=l.id_lead AND no.status_sales_order='active' AND no.cancelled_sales_order='no' AND no.deleted_at_sales_order IS NULL)`;
const legacyLeadOrder = sql`(NOT EXISTS(SELECT 1 FROM ${sql.table("crmdatabase-api.leads")} sibling WHERE sibling.idinterno_lead=l.idinterno_lead AND sibling.id_lead<>l.id_lead) AND EXISTS(SELECT 1 FROM ${sql.table("crmdatabase-api.ordenventa")} lo WHERE lo.id_ov_lead=l.idinterno_lead AND lo.status_ov=1 AND lo.caida_ov=0))`;
// Un id de proveedor no autoriza al dueño. Solo entra si el administrador legacy y el puente de correo son únicos.
const legacyOwner = sql<
    string | null
>`(SELECT nu.public_id_user FROM ${sql.table("crmdatabase-api.admins")} a JOIN sec_user nu ON nu.normalized_email_user COLLATE utf8mb4_bin=NULLIF(LOWER(TRIM(a.email_admin)),'') COLLATE utf8mb4_bin AND nu.deleted_at_user IS NULL WHERE a.idnetsuite_admin=l.id_empleado_lead AND NOT EXISTS(SELECT 1 FROM ${sql.table("crmdatabase-api.admins")} sibling WHERE sibling.idnetsuite_admin=a.idnetsuite_admin AND sibling.id_admin<>a.id_admin) AND NOT EXISTS(SELECT 1 FROM ${sql.table("crmdatabase-api.admins")} sibling WHERE NULLIF(LOWER(TRIM(sibling.email_admin)),'') COLLATE utf8mb4_bin=NULLIF(LOWER(TRIM(a.email_admin)),'') COLLATE utf8mb4_bin AND sibling.id_admin<>a.id_admin) LIMIT 1)`;

function aliases(kind: Kind, source: Source, row: Row): NoteRelatedReference[] {
    let decoded: unknown;
    try {
        decoded = typeof row.legacyAliases === "string" ? JSON.parse(row.legacyAliases) : row.legacyAliases;
    } catch {
        throw new ConflictException("Referencias del registro ambiguas.");
    }
    if (!Array.isArray(decoded) || decoded.length > 100) throw new ConflictException("Referencias del registro ambiguas.");
    const legacy = decoded.map((id: unknown) => {
        const parsed = relatedReferenceSchema.safeParse({ kind, source: "legacy", id });
        if (!parsed.success) throw new ConflictException("Referencias del registro ambiguas.");
        return parsed.data;
    });
    return [{ kind, source, id: row.id }, ...legacy];
}
function resource(kind: Kind, source: Source, row: Row): RelatedResourceRow {
    return { reference: { kind, source, id: row.id }, aliases: aliases(kind, source, row), label: row.label, description: row.description, active: row.active === 1, ownerId: row.ownerId, hasOrder: row.hasOrder === 1, ...(row.relatedLeadId ? { relatedLead: { kind: "lead" as const, source, id: row.relatedLeadId } } : {}) };
}
function nativeQuery(kind: Kind, where: RawBuilder<unknown>) {
    if (kind === "lead")
        return sql<Row>`SELECT /*+ MAX_EXECUTION_TIME(3000) */ l.public_id_lead AS id,COALESCE(NULLIF(c.full_name_contact,''),NULLIF(l.company_name_lead,''),'Cliente sin nombre') AS label,p.name_project AS description,(l.status_lead='active' AND l.deleted_at_lead IS NULL) AS active,u.public_id_user AS ownerId,${nativeLeadOrder} AS hasOrder,NULL AS relatedLeadId,
        COALESCE((SELECT JSON_ARRAYAGG(x.external_id_lead_external_reference) FROM crm_lead_external_reference x JOIN int_external_system s ON s.id_external_system=x.external_system_id_lead_external_reference WHERE x.lead_id_lead_external_reference=l.id_lead AND x.status_lead_external_reference='active' AND s.code_external_system='legacy_crm' AND s.status_external_system='active'),JSON_ARRAY()) AS legacyAliases
        FROM crm_lead l LEFT JOIN crm_contact c ON c.id_contact=l.primary_contact_id_lead AND c.deleted_at_contact IS NULL LEFT JOIN crm_project p ON p.id_project=l.project_id_lead LEFT JOIN sec_user u ON u.id_user=l.owner_user_id_lead AND u.deleted_at_user IS NULL WHERE ${where}`;
    return sql<Row>`SELECT /*+ MAX_EXECUTION_TIME(3000) */ o.public_id_sales_order AS id,COALESCE(NULLIF(o.native_code_sales_order,''),'Orden sin folio') AS label,p.name_project AS description,(${activeOrder}) AS active,NULL AS ownerId,1 AS hasOrder,
        IF(l.status_lead='active' AND l.deleted_at_lead IS NULL,l.public_id_lead,NULL) AS relatedLeadId,IF(o.id_old_produccion_sales_order IS NULL,JSON_ARRAY(),JSON_ARRAY(CAST(o.id_old_produccion_sales_order AS CHAR))) AS legacyAliases
        FROM crm_sales_order o LEFT JOIN crm_lead l ON l.id_lead=o.lead_id_sales_order LEFT JOIN crm_project p ON p.id_project=l.project_id_lead WHERE ${where}`;
}
function legacyQuery(kind: Kind, where: RawBuilder<unknown>) {
    if (kind === "lead") return sql<Row>`SELECT /*+ MAX_EXECUTION_TIME(3000) */ CAST(l.id_lead AS CHAR) AS id,COALESCE(NULLIF(l.nombre_lead,''),'Cliente sin nombre') AS label,NULLIF(l.proyecto_lead,'') AS description,(l.estado_lead=1) AS active,${legacyOwner} AS ownerId,${legacyLeadOrder} AS hasOrder,NULL AS relatedLeadId,JSON_ARRAY() AS legacyAliases FROM ${sql.table("crmdatabase-api.leads")} l WHERE ${where}`;
    return sql<Row>`SELECT /*+ MAX_EXECUTION_TIME(3000) */ CAST(o.id_ov AS CHAR) AS id,COALESCE(NULLIF(o.id_ov_tranid,''),'Orden sin folio') AS label,NULLIF(l.proyecto_lead,'') AS description,(o.status_ov=1 AND o.caida_ov=0) AS active,NULL AS ownerId,1 AS hasOrder,IF(l.estado_lead=1,CAST(l.id_lead AS CHAR),NULL) AS relatedLeadId,JSON_ARRAY() AS legacyAliases
        FROM ${sql.table("crmdatabase-api.ordenventa")} o LEFT JOIN ${sql.table("crmdatabase-api.leads")} l ON l.idinterno_lead=o.id_ov_lead AND NOT EXISTS(SELECT 1 FROM ${sql.table("crmdatabase-api.leads")} sibling WHERE sibling.idinterno_lead=l.idinterno_lead AND sibling.id_lead<>l.id_lead) WHERE ${where}`;
}
function nativeIdentity(kind: Kind, references: readonly NoteRelatedReference[]) {
    const native = references.filter((ref) => ref.source === "native").map((ref) => ref.id);
    const legacy = references.filter((ref) => ref.source === "legacy").map((ref) => ref.id);
    const publicKey = kind === "lead" ? sql.ref("l.public_id_lead") : sql.ref("o.public_id_sales_order");
    const direct = native.length ? sql`${publicKey} IN (${sql.join(native)})` : sql`0=1`;
    if (!legacy.length) return direct;
    const bridge =
        kind === "lead" ? sql`EXISTS(SELECT 1 FROM crm_lead_external_reference x JOIN int_external_system s ON s.id_external_system=x.external_system_id_lead_external_reference WHERE x.lead_id_lead_external_reference=l.id_lead AND x.status_lead_external_reference='active' AND s.code_external_system='legacy_crm' AND s.status_external_system='active' AND x.external_id_lead_external_reference IN (${sql.join(legacy)}))` : sql`o.id_old_produccion_sales_order IN (${sql.join(legacy.map(Number))})`;
    return sql`(${direct} OR ${bridge})`;
}
function unmappedLegacy(kind: Kind) {
    return kind === "lead" ? sql`NOT EXISTS(SELECT 1 FROM crm_lead_external_reference x JOIN int_external_system s ON s.id_external_system=x.external_system_id_lead_external_reference WHERE s.code_external_system='legacy_crm' AND s.status_external_system='active' AND x.status_lead_external_reference='active' AND x.external_id_lead_external_reference=CAST(l.id_lead AS CHAR))` : sql`NOT EXISTS(SELECT 1 FROM crm_sales_order no WHERE no.id_old_produccion_sales_order=o.id_ov)`;
}
function searchWhere(kind: Kind, source: Source, search: string, access: RelatedResourceAccess) {
    const like = `%${search.replace(/[!%_]/g, "!$&")}%`;
    if (kind === "sales_order") return source === "native" ? sql`(${activeOrder}) AND COALESCE(o.native_code_sales_order,'') LIKE ${like} ESCAPE '!'` : sql`o.status_ov=1 AND o.caida_ov=0 AND COALESCE(o.id_ov_tranid,'') LIKE ${like} ESCAPE '!' AND ${unmappedLegacy(kind)}`;
    const owner = source === "native" ? sql`u.public_id_user` : legacyOwner;
    const hasOrder = source === "native" ? nativeLeadOrder : legacyLeadOrder;
    const allowed = sql`(${access.all} OR (${access.own} AND ${owner}=${access.actor}) OR (${access.orders} AND ${hasOrder}))`;
    return source === "native" ? sql`l.status_lead='active' AND l.deleted_at_lead IS NULL AND ${allowed} AND (COALESCE(c.full_name_contact,'') LIKE ${like} ESCAPE '!' OR COALESCE(l.company_name_lead,'') LIKE ${like} ESCAPE '!')` : sql`l.estado_lead=1 AND ${allowed} AND COALESCE(l.nombre_lead,'') LIKE ${like} ESCAPE '!' AND ${unmappedLegacy(kind)}`;
}

/** Proyecciones acotadas y de solo lectura. El legado es opcional y no aporta las llaves foráneas nativas. */
@Injectable()
export class NoteRelatedRecordsReader {
    /** Reutiliza el pool nativo y el interruptor legacy configurado. No abre una conexión legacy de escritura. */
    constructor(
        @Inject(DatabaseService) private readonly database: DatabaseService,
        @Inject(ConfigService) private readonly config: ConfigService,
    ) {}
    /** Dice si consultar el esquema viejo quedó configurado de forma explícita. */
    legacyEnabled(): boolean {
        return this.config.get<string>("LEGACY_CRM_DB_NAME") === "crmdatabase-api";
    }
    /** Carga identidades nativas directas y alias legacy explícitos, incluidas las lápidas no disponibles. */
    async readNative(references: readonly NoteRelatedReference[]): Promise<RelatedResourceRow[]> {
        return this.snapshot(async (tx) => {
            const result: RelatedResourceRow[] = [];
            for (const kind of ["lead", "sales_order"] as const) {
                const selected = references.filter((reference) => reference.kind === kind);
                if (selected.length) result.push(...(await nativeQuery(kind, nativeIdentity(kind, selected)).execute(tx)).rows.map((row) => resource(kind, "native", row)));
            }
            return result;
        });
    }
    /** La búsqueda legacy usa la llave primaria. No usa el id del proveedor. Quien llama demuestra antes que no hay fila nativa. */
    async readLegacy(references: readonly NoteRelatedReference[]): Promise<RelatedResourceRow[]> {
        return this.snapshot(async (tx) => {
            const result: RelatedResourceRow[] = [];
            for (const kind of ["lead", "sales_order"] as const) {
                const selected = references.filter((reference) => reference.kind === kind && reference.source === "legacy");
                const key = kind === "lead" ? sql.ref("l.id_lead") : sql.ref("o.id_ov");
                if (selected.length) result.push(...(await legacyQuery(kind, sql`${key} IN (${sql.join(selected.map((reference) => Number(reference.id)))})`).execute(tx)).rows.map((row) => resource(kind, "legacy", row)));
            }
            return result;
        });
    }
    /** Confirma solo la relación de clientes nativos ya mapeados con órdenes legacy que se pueden leer. */
    async legacyOrderClients(references: readonly NoteRelatedReference[]): Promise<string[]> {
        const ids = references.filter((reference) => reference.kind === "lead" && reference.source === "legacy").map((reference) => Number(reference.id));
        if (!ids.length) return [];
        return this.snapshot(async (tx) => (await sql<{ id: string }>`SELECT CAST(l.id_lead AS CHAR) AS id FROM ${sql.table("crmdatabase-api.leads")} l WHERE l.id_lead IN (${sql.join(ids)}) AND l.estado_lead=1 AND ${legacyLeadOrder}`.execute(tx)).rows.map((row) => row.id));
    }
    /** Los candidatos nativos se acotan antes de paginar. */
    // eslint-disable-next-line max-params
    searchNative(kind: Kind, search: string, offset: number, limit: number, access: RelatedResourceAccess) {
        return this.search({ kind, source: "native", search, offset, limit, access });
    }
    /** Un mapeo nativo oculta la copia legacy vieja, aunque la fila nativa esté inactiva o no sea accesible. */
    // eslint-disable-next-line max-params
    searchLegacy(kind: Kind, search: string, offset: number, limit: number, access: RelatedResourceAccess) {
        return this.search({ kind, source: "legacy", search, offset, limit, access });
    }
    private search({ kind, source, search, offset, limit, access }: { kind: Kind; source: Source; search: string; offset: number; limit: number; access: RelatedResourceAccess }) {
        return this.snapshot(async (tx) => {
            const query = source === "native" ? nativeQuery(kind, searchWhere(kind, source, search, access)) : legacyQuery(kind, searchWhere(kind, source, search, access));
            const total = (await sql<{ total: number | string }>`SELECT COUNT(*) AS total FROM (${query}) authorized_records`.execute(tx)).rows[0]?.total ?? 0;
            const rows = (await sql<Row>`${query} ORDER BY label,id LIMIT ${limit} OFFSET ${offset}`.execute(tx)).rows;
            return { total: Number(total), rows: rows.map((row) => resource(kind, source, row)) };
        });
    }
    private snapshot<T>(read: (tx: Transaction<CrmDatabase>) => Promise<T>): Promise<T> {
        return this.database.db.transaction().setIsolationLevel("repeatable read").setAccessMode("read only").execute(read);
    }
}
