import { BadRequestException } from "@nestjs/common";
import { type RawBuilder, sql, type Transaction } from "kysely";
import { z } from "zod";

import type { CrmDatabase } from "../../../../database/database.types.js";
import { displayHistoryEntry } from "../../leads/lead-history-reader.js";

type Row = Record<string, unknown>;
type Snapshot = { source: "native" | "legacy"; lead: { sourceFields: Row } | null };
type LinkedLegacyLead = { id: string; reference: string | null };
const cursorSchema = z.object({ lead: z.string(), before: z.string().max(40), key: z.string().max(100) }).strict();
export interface ClientHistoryItem {
    id: string;
    source: "native" | "legacy";
    action: string;
    detail: string | null;
    reason: { code: string; name: string } | null;
    actorName: string | null;
    actorCoverage: "at_event" | "current_directory";
    occurredAt: string | null;
    sourceDate: string | null;
    recordedAt: string | null;
    evidence: "native_event" | "legacy_observation";
    fromStatus: string | null;
    toStatus: string | null;
}
function string(value: unknown): string | null {
    return typeof value === "string" && value.trim() ? value.trim() : null;
}
/** La validez numérica del id viejo se normaliza aquí. React no la interpreta. La etapa comercial es otro dato. */
export function normalizeLeadStatus(source: "native" | "legacy", value: unknown) {
    const codes: Record<string, "active" | "inactive"> = source === "legacy" ? { "1": "active", "0": "inactive" } : { active: "active", inactive: "inactive" };
    const code = codes[String(value)] ?? "unknown";
    const labels = { active: "Activo", inactive: "Inactivo", unknown: "Sin dato" };
    return { code, label: labels[code] };
}
function readCursor(value: string | undefined, lead: string) {
    if (!value) return null;
    try {
        const cursor = cursorSchema.parse(JSON.parse(Buffer.from(value, "base64url").toString("utf8")));
        if (cursor.lead !== lead) throw new Error("scope");
        return cursor;
    } catch {
        throw new BadRequestException("Cursor de historial invalido para el cliente.");
    }
}
interface ClientContextOptions {
    legacyEnabled: boolean;
    cursor?: string;
    linkedLegacyLead?: LinkedLegacyLead;
    resolvedIdentity?: boolean;
}
async function resolvedScope(tx: Transaction<CrmDatabase>, data: Snapshot, linkedLegacyLead?: LinkedLegacyLead) {
    const nativeId = data.source === "native" ? String(data.lead?.sourceFields.id_lead) : "";
    const legacyId = data.source === "legacy" ? String(data.lead?.sourceFields.id_lead) : (linkedLegacyLead?.id ?? "");
    // El perfil completo ya resolvió la identidad; no expandir vínculos obsoletos o transitivos.
    return (await sql<{ id: string; source: string; sourceId: string }>`SELECT r.id_record AS id,r.source_schema_record AS source,r.source_id_record AS sourceId FROM audit_record r WHERE r.entity_type_record='lead' AND ((r.source_schema_record='CRM_THINK_V2' AND r.source_table_record='crm_lead' AND r.source_id_record=${nativeId}) OR (r.source_schema_record='crmdatabase-api' AND r.source_table_record='leads' AND r.source_id_record=${legacyId})) LIMIT 3`.execute(tx)).rows;
}
async function contextScope(tx: Transaction<CrmDatabase>, data: Snapshot, options: ClientContextOptions) {
    return options.resolvedIdentity ? resolvedScope(tx, data, options.linkedLegacyLead) : scope(tx, data);
}
async function contextReference(tx: Transaction<CrmDatabase>, data: Snapshot, records: Awaited<ReturnType<typeof scope>>, options: ClientContextOptions) {
    if (!options.resolvedIdentity) return legacyReference(tx, data, records, options.legacyEnabled);
    return options.linkedLegacyLead?.reference ?? (data.source === "legacy" ? data.lead?.sourceFields.idinterno_lead : null);
}
async function scope(tx: Transaction<CrmDatabase>, data: Snapshot) {
    const nativeId = data.source === "native" ? String(data.lead?.sourceFields.id_lead) : "";
    const legacyId = data.source === "legacy" ? String(data.lead?.sourceFields.id_lead) : "";
    const { rows } = await sql<{ id: string; source: string; sourceId: string }>`SELECT r.id_record AS id,r.source_schema_record AS source,r.source_id_record AS sourceId FROM audit_record r
        WHERE r.entity_type_record='lead' AND (
        (r.source_schema_record='CRM_THINK_V2' AND r.source_table_record='crm_lead' AND (r.source_id_record=${nativeId} OR r.source_id_record IN (
            SELECT CAST(l.lead_id_lead_history_link AS CHAR) FROM int_lead_history_link l JOIN audit_record old ON old.id_record=l.record_id_lead_history_link WHERE old.source_schema_record='crmdatabase-api' AND old.source_table_record='leads' AND old.source_id_record=${legacyId})))
        OR (r.source_schema_record='crmdatabase-api' AND r.source_table_record='leads' AND (r.source_id_record=${legacyId} OR r.id_record IN (
            SELECT l.record_id_lead_history_link FROM int_lead_history_link l WHERE l.lead_id_lead_history_link=${nativeId})))) LIMIT 101`.execute(tx);
    if (rows.length > 100) throw new BadRequestException("Relacion historica del cliente ambigua.");
    return rows;
}
function uniqueReference(rows: { ref: number; matches: number | string }[]) {
    const row = rows[0];
    if (rows.length !== 1 || !row) return null;
    return Number(row.matches) === 1 ? row.ref : null;
}
async function legacyReference(tx: Transaction<CrmDatabase>, data: Snapshot, records: Awaited<ReturnType<typeof scope>>, enabled: boolean) {
    if (!enabled) return null;
    if (data.source === "legacy") return data.lead?.sourceFields.idinterno_lead ?? null;
    const links = records.filter((record) => record.source === "crmdatabase-api");
    const [link] = links;
    if (links.length !== 1 || !link) return null;
    const { rows } = await sql<{ ref: number; matches: number | string }>`SELECT l.idinterno_lead AS ref,(SELECT COUNT(*) FROM ${sql.table("crmdatabase-api.leads")} other WHERE other.idinterno_lead=l.idinterno_lead) AS matches FROM ${sql.table("crmdatabase-api.leads")} l WHERE l.id_lead=${link.sourceId} LIMIT 2`.execute(tx);
    return uniqueReference(rows);
}
async function reason(tx: Transaction<CrmDatabase>, data: Snapshot) {
    if (data.source === "legacy") {
        const { rows } = await sql<{ code: string; name: string }>`SELECT CONCAT('legacy:',id_caida) AS code,TRIM(nombre_caida) AS name FROM ${sql.table("crmdatabase-api.caidas")} WHERE id_caida=${data.lead?.sourceFields.id_Caida ?? null} LIMIT 1`.execute(tx);
        return rows[0] ? { ...rows[0], name: rows[0].name.trim(), origin: "legacy" as const, meaning: "source_classification" as const } : null;
    }
    const { rows } = await sql<{ code: string; name: string }>`SELECT r.code_action_reason AS code,r.name_action_reason AS name FROM crm_lead_activity a JOIN conf_action_reason r ON r.code_action_reason=a.reason_code_lead_activity WHERE a.lead_id_lead_activity=${data.lead?.sourceFields.id_lead} ORDER BY a.id_lead_activity DESC LIMIT 1`.execute(tx);
    return rows[0] ? { ...rows[0], name: rows[0].name.trim(), origin: "native" as const, meaning: "last_recorded_reason" as const } : null;
}
function nativeQuery(recordIds: string[]): RawBuilder<Row> {
    const predicate = recordIds.length ? sql`e.record_id_record_event IN (${sql.join(recordIds)})` : sql`FALSE`;
    return sql<Row>`SELECT CONCAT('native:',e.id_record_event) AS eventKey,'native' AS source,
        COALESCE(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(e.after_record_event,'$.historyEntry.sourceDate')),'null'),DATE_FORMAT(COALESCE(e.occurred_at_record_event,e.recorded_at_record_event),'%Y-%m-%d %H:%i:%s')) AS sortAt,
        e.action_record_event AS action,e.after_record_event AS snapshot,e.actor_snapshot_record_event AS actor,e.snapshot_scope_record_event AS coverage,
        DATE_FORMAT(e.occurred_at_record_event,'%Y-%m-%dT%H:%i:%s.%fZ') AS occurredAt,DATE_FORMAT(e.recorded_at_record_event,'%Y-%m-%dT%H:%i:%s.%fZ') AS recordedAt,
        e.reason_record_event AS detail,NULL AS reasonId,NULL AS reasonName,NULL AS actorName,NULL AS sourceDate,NULL AS stageLabel
        FROM audit_record_event e WHERE ${predicate}`;
}
function legacyQuery(reference: unknown, recordIds: string[]): RawBuilder<Row> {
    const preservedScope = recordIds.length ? sql`preserved.record_id_record_event IN (${sql.join(recordIds)})` : sql`FALSE`;
    return sql<Row>`SELECT CONCAT('legacy:',b.id_bitacora_bit) AS eventKey,'legacy' AS source,COALESCE(DATE_FORMAT(b.fecha_creado_bit,'%Y-%m-%d %H:%i:%s'),'') AS sortAt,
        b.tipo_documento_bit AS action,NULL AS snapshot,NULL AS actor,'observation' AS coverage,NULL AS occurredAt,NULL AS recordedAt,b.detalle_bit AS detail,
        b.id_caida_bit AS reasonId,TRIM(c.nombre_caida) AS reasonName,
        (SELECT a.name_admin FROM ${sql.table("crmdatabase-api.admins")} a WHERE a.idnetsuite_admin=b.id_admin_bit
            AND (SELECT COUNT(*) FROM ${sql.table("crmdatabase-api.admins")} unique_actor WHERE unique_actor.idnetsuite_admin=b.id_admin_bit)=1 LIMIT 1) AS actorName,
        DATE_FORMAT(b.fecha_creado_bit,'%Y-%m-%d %H:%i:%s') AS sourceDate,b.estado_bit AS stageLabel
        FROM ${sql.table("crmdatabase-api.bitacoras")} b LEFT JOIN ${sql.table("crmdatabase-api.caidas")} c ON c.id_caida=b.id_caida_bit
        WHERE b.id_lead_bit=${reference} AND NOT EXISTS (SELECT 1 FROM int_lead_history_entry h JOIN audit_record_event preserved ON preserved.id_record_event=h.event_id_lead_history_entry
            WHERE h.source_entry_id_lead_history_entry=b.id_bitacora_bit AND h.source_lead_reference_lead_history_entry=CAST(b.id_lead_bit AS CHAR) AND h.resolution_lead_history_entry='matched' AND ${preservedScope})`;
}
function nativeActor(value: unknown): string | null {
    const decoded: unknown = typeof value === "string" ? JSON.parse(value) : value;
    const parsed = z.object({ name: z.string().optional(), nameObserved: z.string().nullable().optional() }).safeParse(decoded);
    return parsed.success ? (parsed.data.name ?? parsed.data.nameObserved ?? null) : null;
}
function sourceReason(name: unknown, code: string) {
    const label = string(name);
    return label ? { code, name: label } : null;
}
function legacyDisplay(row: Row): ClientHistoryItem {
    return { id: String(row.eventKey), source: "legacy", action: string(row.action) ?? "Registro de seguimiento", detail: string(row.detail), reason: sourceReason(row.reasonName, "legacy:" + String(row.reasonId)), actorName: string(row.actorName), actorCoverage: "current_directory", occurredAt: string(row.occurredAt), sourceDate: string(row.sourceDate), recordedAt: string(row.recordedAt), evidence: "legacy_observation", fromStatus: null, toStatus: null };
}
function entryDisplay(entry: NonNullable<ReturnType<typeof displayHistoryEntry>>) {
    return { action: entry.actionCode, detail: entry.detail, reason: entry.reason ?? sourceReason(entry.sourceReasonLabel, "source_label"), occurredAt: entry.occurredAt, sourceDate: entry.sourceDate ?? null, evidence: entry.evidence, fromStatus: entry.fromStatusCode ?? null, toStatus: entry.toStatusCode ?? null };
}
/** Proyecta solo campos de historia seguros para mostrar. Una foto arbitraria de la bitácora sigue privada. */
export function displayClientHistory(row: Row): ClientHistoryItem {
    const base = legacyDisplay(row);
    if (row.source !== "native") return base;
    const entry = displayHistoryEntry(row.snapshot);
    return { ...base, source: "native", actorName: nativeActor(row.actor), actorCoverage: row.coverage === "observation" ? "current_directory" : "at_event", evidence: "native_event", ...(entry ? entryDisplay(entry) : {}) };
}
function historyPage(rows: Row[], identity: string) {
    const page = rows.slice(0, 50);
    const last = page.at(-1);
    return { items: page.map(displayClientHistory), hasMore: rows.length > 50, nextCursor: rows.length > 50 && last ? Buffer.from(JSON.stringify({ lead: identity, before: String(last.sortAt), key: String(last.eventKey) })).toString("base64url") : null };
}
/** Una página acotada entre fuentes. El alcance sale solo del lead de la orden autorizada y de los vínculos históricos explícitos. */
export async function readOrderClientContext(tx: Transaction<CrmDatabase>, data: Snapshot, options: ClientContextOptions) {
    const lead = data.lead?.sourceFields;
    const identity = data.source + ":" + String(lead?.id_lead);
    const cursor = readCursor(options.cursor, identity);
    if (!lead?.id_lead) return { status: normalizeLeadStatus(data.source, null), followUpReason: null, history: { items: [], hasMore: false, nextCursor: null } };
    const records = await contextScope(tx, data, options);
    // El perfil completo ya verificó ambos extremos; no volver a inferir la relación por el historial.
    const reference = await contextReference(tx, data, records, options);
    const parts = [nativeQuery(records.map((record) => record.id))];
    if (reference !== null)
        parts.push(
            legacyQuery(
                reference,
                records.map((record) => record.id),
            ),
        );
    const before = cursor ? sql`(sortAt<${cursor.before} OR (sortAt=${cursor.before} AND eventKey<${cursor.key}))` : sql`TRUE`;
    const { rows } = await sql<Row>`SELECT /*+ MAX_EXECUTION_TIME(3000) */ * FROM (${sql.join(parts, sql` UNION ALL `)}) events WHERE ${before} ORDER BY sortAt DESC,eventKey DESC LIMIT 51`.execute(tx);
    return {
        status: normalizeLeadStatus(data.source, lead[data.source === "native" ? "status_lead" : "estado_lead"]),
        followUpReason: await reason(tx, data),
        history: { ...historyPage(rows, identity), legacyAvailable: options.legacyEnabled },
    };
}
