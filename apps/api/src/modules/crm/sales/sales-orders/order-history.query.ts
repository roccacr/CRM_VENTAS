import { BadRequestException } from "@nestjs/common";
import { type RawBuilder, sql, type Transaction } from "kysely";
import { z } from "zod";

import type { CrmDatabase } from "../../../../database/database.types.js";
import { ORDER_RECORD_FIELDS } from "./order-record.query.js";

type Row = Record<string, unknown>;
interface Identity {
    source: "native" | "legacy";
    id: string;
    legacyId: string | null;
}
const cursorSchema = z.object({ order: z.string(), date: z.string().max(40), key: z.string().max(100) }).strict();
const safeFields = new Set([
    ...ORDER_RECORD_FIELDS,
    "approval_sales_management",
    "approval_developer",
    "approval_formalization",
    "transaction_number_sales_order_external_reference",
    "broker_commission_calculated_sales_order",
    "cancellation_marked_on_sales_order",
    "unit_delivered_sales_order",
    "unit_transferred_sales_order",
    "keys_delivered_sales_order",
    "trust_down_payment_validated_sales_order",
    "commission_approved_sales_order",
    "installments_fully_paid_sales_order",
    "businessId",
    "state",
    "version",
    "type",
    "status",
    "contractSigned",
    "finiquitoStatus",
    "finiquitoVersion",
    "finiquitoOriginStage",
    "commercialClosureSigned",
    "cancelled",
    "salePrice",
    "netSalePrice",
    "currency",
    "transactionDate",
]);
const labels: Record<string, string> = { create: "Orden creada", update: "Orden editada", state_change: "Cambio de etapa", approval_change: "Cambio de aprobación", revert: "Cambio revertido", annotation: "Nota registrada", import_snapshot: "Estado observado", created: "Etapa registrada", transition: "Cambio de etapa" };
function text(value: unknown): string | null {
    return typeof value === "string" && value.trim() ? value.trim() : null;
}
function decoded(value: unknown): unknown {
    return typeof value === "string" ? (JSON.parse(value) as unknown) : value;
}
function object(value: unknown): Row {
    const row = decoded(value);
    return row && typeof row === "object" && !Array.isArray(row) ? (row as Row) : {};
}
function scalar(value: unknown): string | number | boolean | null {
    return typeof value === "string" || typeof value === "boolean" || typeof value === "number" ? value : null;
}
function changes(value: unknown) {
    const data = decoded(value);
    if (!Array.isArray(data)) return [];
    return data.flatMap((entry: unknown) => {
        const row = object(entry);
        const field = typeof row.path === "string" ? row.path.split("/")[1]?.replaceAll("~1", "/").replaceAll("~0", "~") : undefined;
        if (!field || !safeFields.has(field) || String(row.path).split("/").length !== 2) return [];
        return [{ field, before: scalar(row.before), after: scalar(row.after), beforeExists: row.beforeExists === true, afterExists: row.afterExists === true }];
    });
}
/** Only known order business changes are public; raw snapshots, tokens and request metadata never leave the API. */
export function displayOrderHistory(row: Row) {
    const actor = object(row.actor);
    const before = object(row.beforeSnapshot);
    const after = object(row.afterSnapshot);
    const action = String(row.action);
    return {
        id: String(row.eventKey),
        source: row.source === "legacy" ? ("legacy" as const) : ("native" as const),
        action,
        label: text(after.finiquitoStatus) ? "Finiquito actualizado" : (labels[action] ?? "Acción registrada"),
        reason: text(row.reason),
        occurredAt: text(row.occurredAt),
        recordedAt: text(row.recordedAt),
        actorName: text(actor.name),
        fromState: text(before.state),
        toState: text(after.state),
        fromStateLabel: text(row.fromLabel) ?? text(before.state),
        toStateLabel: text(row.toLabel) ?? text(after.state),
        snapshotScope: text(row.coverage) ?? "partial",
        changes: changes(row.changes),
        hiddenChanges: Array.isArray(decoded(row.changes)) ? (decoded(row.changes) as unknown[]).length - changes(row.changes).length : 0,
    };
}
function readCursor(value: string | undefined, identity: string) {
    if (!value) return null;
    try {
        const cursor = cursorSchema.parse(JSON.parse(Buffer.from(value, "base64url").toString("utf8")));
        if (cursor.order !== identity) throw new Error("scope");
        return cursor;
    } catch {
        throw new BadRequestException("Cursor de bitácora inválido para esta orden.");
    }
}
async function identity(tx: Transaction<CrmDatabase>, source: "native" | "legacy", id: string): Promise<Identity> {
    if (source === "legacy") return { source, id, legacyId: id };
    const result = await sql<{ legacyId: string | null }>`SELECT CAST(id_old_produccion_sales_order AS CHAR) AS legacyId FROM crm_sales_order WHERE id_sales_order=${id}`.execute(tx);
    return { source, id, legacyId: result.rows[0]?.legacyId ?? null };
}
async function records(tx: Transaction<CrmDatabase>, order: Identity) {
    const { rows } = await sql<{ id: string }>`SELECT id_record AS id FROM audit_record WHERE entity_type_record='sales_order' AND (
        (source_schema_record='CRM_THINK_V2' AND source_table_record='crm_sales_order' AND source_id_record=${order.source === "native" ? order.id : null}) OR
        (source_schema_record='crmdatabase-api' AND source_table_record='ordenventa' AND source_id_record=${order.legacyId})) LIMIT 3`.execute(tx);
    if (rows.length > 2) throw new BadRequestException("Identidad de bitácora ambigua.");
    return rows.map((row) => row.id);
}
function central(recordIds: string[], canReadAddendum: boolean) {
    const scoped = recordIds.length ? sql`e.record_id_record_event IN (${sql.join(recordIds)})` : sql`FALSE`;
    return sql<Row>`SELECT CONCAT('audit:',e.id_record_event) AS eventKey,'native' AS source,
        DATE_FORMAT(COALESCE(e.occurred_at_record_event,e.recorded_at_record_event),'%Y-%m-%d %H:%i:%s.%f') AS sortAt,
        e.action_record_event AS action,e.reason_record_event AS reason,e.actor_snapshot_record_event AS actor,
        DATE_FORMAT(e.occurred_at_record_event,'%Y-%m-%dT%H:%i:%s.%fZ') AS occurredAt,DATE_FORMAT(e.recorded_at_record_event,'%Y-%m-%dT%H:%i:%s.%fZ') AS recordedAt,
        e.before_record_event AS beforeSnapshot,e.after_record_event AS afterSnapshot,e.changes_record_event AS changes,e.snapshot_scope_record_event AS coverage,
        fs.name_sales_order_state AS fromLabel,ts.name_sales_order_state AS toLabel
        FROM audit_record_event e LEFT JOIN conf_sales_order_state fs ON fs.code_sales_order_state=JSON_UNQUOTE(JSON_EXTRACT(e.before_record_event,'$.state'))
        LEFT JOIN conf_sales_order_state ts ON ts.code_sales_order_state=JSON_UNQUOTE(JSON_EXTRACT(e.after_record_event,'$.state')) WHERE ${scoped}
        AND (${canReadAddendum} OR e.operation_id_record_event IS NULL OR e.operation_id_record_event NOT LIKE 'addendum:%')`;
}
function notPreserved(recordIds: string[], operation: RawBuilder<unknown>) {
    if (!recordIds.length) return sql`TRUE`;
    return sql`NOT EXISTS(SELECT 1 FROM audit_record_event a WHERE a.record_id_record_event IN (${sql.join(recordIds)}) AND a.operation_id_record_event=${operation})`;
}
function stage(order: Identity, source: "native" | "legacy", recordIds: string[]) {
    const old = source === "legacy";
    const table = old ? "crmdatabase-api.audit_sales_order_state_event" : "audit_sales_order_state_event";
    const key = old ? "legacy_order_id_sales_order_state_event" : "sales_order_id_sales_order_state_event";
    const states = old ? "crmdatabase-api.conf_sales_order_state" : "conf_sales_order_state";
    const operation = sql`SHA2(CONCAT('["sales_order","state",',JSON_QUOTE(e.operation_id_sales_order_state_event),']'),256)`;
    return sql<Row>`SELECT CONCAT(${source + ":stage:"},e.id_sales_order_state_event) AS eventKey,${source} AS source,
        DATE_FORMAT(COALESCE(e.effective_at_sales_order_state_event,e.recorded_at_sales_order_state_event),'%Y-%m-%d %H:%i:%s.%f') AS sortAt,
        e.event_kind_sales_order_state_event AS action,e.reason_sales_order_state_event AS reason,e.actor_snapshot_sales_order_state_event AS actor,
        DATE_FORMAT(e.effective_at_sales_order_state_event,'%Y-%m-%dT%H:%i:%s.%fZ') AS occurredAt,DATE_FORMAT(e.recorded_at_sales_order_state_event,'%Y-%m-%dT%H:%i:%s.%fZ') AS recordedAt,
        JSON_OBJECT('state',e.from_state_code_sales_order_state_event) AS beforeSnapshot,JSON_OBJECT('state',e.to_state_code_sales_order_state_event) AS afterSnapshot,
        JSON_ARRAY(JSON_OBJECT('path','/state','before',e.from_state_code_sales_order_state_event,'after',e.to_state_code_sales_order_state_event,'beforeExists',true,'afterExists',true)) AS changes,'partial' AS coverage,
        fs.name_sales_order_state AS fromLabel,ts.name_sales_order_state AS toLabel
        FROM ${sql.table(table)} e LEFT JOIN ${sql.table(states)} fs ON fs.code_sales_order_state=e.from_state_code_sales_order_state_event
        LEFT JOIN ${sql.table(states)} ts ON ts.code_sales_order_state=e.to_state_code_sales_order_state_event
        WHERE ${sql.ref("e." + key)}=${old ? order.legacyId : order.id} AND ${notPreserved(recordIds, operation)}`;
}
function approvals(order: Identity, recordIds: string[]) {
    const operation = sql`SHA2(CONCAT('["sales_order","approval",',JSON_QUOTE(e.type_code_sales_order_approval_event),',',JSON_QUOTE(e.operation_id_sales_order_approval_event),']'),256)`;
    return sql<Row>`SELECT CONCAT('native:approval:',e.id_sales_order_approval_event) AS eventKey,'native' AS source,
        DATE_FORMAT(COALESCE(e.effective_at_sales_order_approval_event,e.recorded_at_sales_order_approval_event),'%Y-%m-%d %H:%i:%s.%f') AS sortAt,'approval_change' AS action,
        e.reason_sales_order_approval_event AS reason,e.actor_snapshot_sales_order_approval_event AS actor,
        DATE_FORMAT(e.effective_at_sales_order_approval_event,'%Y-%m-%dT%H:%i:%s.%fZ') AS occurredAt,DATE_FORMAT(e.recorded_at_sales_order_approval_event,'%Y-%m-%dT%H:%i:%s.%fZ') AS recordedAt,
        JSON_OBJECT('status',e.before_status_sales_order_approval_event) AS beforeSnapshot,JSON_OBJECT('status',e.after_status_sales_order_approval_event) AS afterSnapshot,
        JSON_ARRAY(JSON_OBJECT('path','/status','before',e.before_status_sales_order_approval_event,'after',e.after_status_sales_order_approval_event,'beforeExists',true,'afterExists',true),
        JSON_OBJECT('path','/type','before',e.type_code_sales_order_approval_event,'after',e.type_code_sales_order_approval_event,'beforeExists',true,'afterExists',true)) AS changes,'partial' AS coverage,NULL AS fromLabel,NULL AS toLabel
        FROM audit_sales_order_approval_event e WHERE e.sales_order_id_sales_order_approval_event=${order.id} AND ${notPreserved(recordIds, operation)}`;
}
/** One authorized snapshot, with deterministic keyset pagination over all available sources and deduplication by writer operation identity. */
export async function readOrderHistory(tx: Transaction<CrmDatabase>, source: "native" | "legacy", id: string, options: { legacyEnabled: boolean; cursor?: string; canReadAddendum?: boolean }) {
    const order = await identity(tx, source, id);
    const identityKey = source + ":" + id;
    const cursor = readCursor(options.cursor, identityKey);
    const recordIds = await records(tx, order);
    const parts = [central(recordIds, options.canReadAddendum === true)];
    if (source === "native") parts.push(stage(order, "native", recordIds), approvals(order, recordIds));
    let legacyAvailable = false;
    if (options.legacyEnabled && order.legacyId) {
        const found = await sql<{ name: string }>`SELECT TABLE_NAME AS name FROM information_schema.TABLES WHERE TABLE_SCHEMA='crmdatabase-api' AND TABLE_NAME IN ('audit_sales_order_state_event','conf_sales_order_state')`.execute(tx);
        legacyAvailable = found.rows.length === 2;
        if (legacyAvailable) parts.push(stage(order, "legacy", recordIds));
    }
    const before = cursor ? sql`(sortAt<${cursor.date} OR (sortAt=${cursor.date} AND eventKey<${cursor.key}))` : sql`TRUE`;
    const result = await sql<Row>`SELECT /*+ MAX_EXECUTION_TIME(3000) */ * FROM (${sql.join(parts, sql` UNION ALL `)}) timeline WHERE ${before} ORDER BY sortAt DESC,eventKey DESC LIMIT 51`.execute(tx);
    const page = result.rows.slice(0, 50);
    const last = page.at(-1);
    const hasMore = result.rows.length > 50;
    return { schemaVersion: 1 as const, source, items: page.map(displayOrderHistory), hasMore, nextCursor: hasMore && last ? Buffer.from(JSON.stringify({ order: identityKey, date: String(last.sortAt), key: String(last.eventKey) })).toString("base64url") : null, coverage: { legacyAvailable, legacyLinked: order.legacyId !== null, note: "Solo acciones registradas. Los cambios externos sin bitácora no pueden reconstruirse; los snapshots parciales no representan una copia completa de la orden." } };
}
