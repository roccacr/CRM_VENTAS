import { createHash } from "node:crypto";

import { ServiceUnavailableException } from "@nestjs/common";
import { sql, type Transaction } from "kysely";
import { ulid } from "ulid";

import type { CrmDatabase } from "../../database/database.types.js";
import { captureIntegrationAuditActor } from "../../modules/crm/audit/audit-actor.js";
import type { RecordAuditService } from "../../modules/crm/audit/record-audit.service.js";
import { formalizationCompletionTarget } from "../../modules/crm/sales/sales-orders/formalization-completion.policy.js";
import type { PersistedOrderEvent } from "./netsuite-order-event.contract.js";
import type { OrderEventChange, OrderEventDestination } from "./netsuite-order-event.mapper.js";

export const PAID_INSTALLMENTS_STAGE_FIELD = "formalization_state";
type EventTransaction = Transaction<CrmDatabase>;
type StageVisit = { sequence: number; state: string; responsible: number | string | null; responsibleSnapshot: string | object | null };
type AdvanceContext = { event: PersistedOrderEvent; target: Target; changes: OrderEventChange[] };
type Target = { destination: OrderEventDestination; id: string; row: Record<string, unknown> };

/** Los indicadores observados solo avanzan visitas de finalizacion existentes; no inventan ni revierten etapas. */
export async function advancePaidInstallments(tx: Transaction<CrmDatabase>, audit: RecordAuditService, { event, target, changes }: AdvanceContext): Promise<OrderEventChange | null> {
    if (!["edit", "xedit"].includes(event.event.eventType)) return null;
    const row = { ...target.row, ...Object.fromEntries(changes.map((change) => [change.column, change.after])) };
    const next = completionTarget(target.destination, row);
    if (!next) return null;
    if (!(await eligibleOrder(tx, target, row))) return null;
    const previous = await latestVisit(tx, target);
    const stages = ["pending_balance", "pending_transfer", "transfer_signed", "closed"];
    if (!previous || !stages.slice(0, stages.indexOf(next)).includes(previous.state) || previous.sequence >= 4294967295) return null;
    if (!audit.enabled) throw new ServiceUnavailableException("Automatic contract transitions require enabled central record audit");
    const actor = captureIntegrationAuditActor({ publicId: "integration:netsuite:" + event.source.accountId, name: { production: "NetSuite Production UE", sandbox: "NetSuite Sandbox UE" }[event.source.environment] });
    const operationId = "netsuite:" + event.source.accountId + ":" + event.event.eventId + ":paid";
    const reason = "Indicadores de finalizacion confirmados por NetSuite " + event.source.environment + "; avance automatico a " + next + ".";
    await appendVisit(tx, { target, previous, next, actor, operationId, reason, correlationId: event.event.eventId });
    await audit.append(tx, {
        source: { ...auditSources[target.destination], entity: "sales_order", id: target.id },
        actor,
        action: "state_change",
        module: "formalizacion",
        before: { state: previous.state, version: previous.sequence },
        after: { state: next, version: previous.sequence + 1 },
        allowedFields: ["state", "version"],
        operationId: createHash("sha256")
            .update(JSON.stringify(["sales_order", "state", operationId]))
            .digest("hex"),
        correlationId: event.event.eventId,
        reason,
        snapshotScope: "partial",
    });
    return { field: PAID_INSTALLMENTS_STAGE_FIELD, column: "state", before: previous.state, after: next };
}

/** Traduce enums nativos y enteros legacy sin convertir valores desconocidos en falsos. */
function completionTarget(destination: OrderEventDestination, row: Record<string, unknown>) {
    const native = destination === "native";
    const flag = (column: string): boolean | null => (row[column] === (native ? "yes" : 1) ? true : row[column] === (native ? "no" : 0) ? false : null);
    return formalizationCompletionTarget({ installmentsFullyPaid: flag(native ? "installments_fully_paid_sales_order" : "cuotas_pagadas_completo_ov"), unitTransferred: flag(native ? "unit_transferred_sales_order" : "unidad_traspasada_ov"), keysDelivered: flag(native ? "keys_delivered_sales_order" : "entrega_llaves_ov"), unitDelivered: flag(native ? "unit_delivered_sales_order" : "unidad_entregada_ov") });
}

/** Evalua la fila sincronizada; requisitos incompletos conservan la visita actual. */
async function eligibleOrder(tx: EventTransaction, target: Target, row: Record<string, unknown>): Promise<boolean> {
    if (target.destination === "legacy") return eligibleLegacyOrder(row);
    if (row.status_sales_order !== "active" || row.cancelled_sales_order !== "no" || row.deleted_at_sales_order !== null || row.contract_signed_sales_order !== "yes") return false;
    const approval = await tx.selectFrom("crm_sales_order_approval").select("status_sales_order_approval").where("sales_order_id_sales_order_approval", "=", Number(target.id)).where("type_code_sales_order_approval", "=", "formalization").forUpdate().executeTakeFirst();
    return approval?.status_sales_order_approval === "approved";
}

/** La orden bloqueada serializa esta visita con los comandos manuales. */
async function latestVisit(tx: EventTransaction, target: Target): Promise<StageVisit | undefined> {
    const native = target.destination === "native";
    const table = native ? "audit_sales_order_state_event" : "crmdatabase-api.audit_sales_order_state_event";
    const key = native ? "sales_order_id_sales_order_state_event" : "legacy_order_id_sales_order_state_event";
    const responsibleColumn = native ? "responsible_user_id_sales_order_state_event" : "responsible_reference_sales_order_state_event";
    const { rows } = await sql<StageVisit>`SELECT sequence_sales_order_state_event AS sequence,to_state_code_sales_order_state_event AS state,${sql.ref(responsibleColumn)} AS responsible,responsible_snapshot_sales_order_state_event AS responsibleSnapshot FROM ${sql.table(table)} WHERE ${sql.ref(key)}=${target.id} ORDER BY sequence_sales_order_state_event DESC LIMIT 1 FOR UPDATE`.execute(tx);
    return rows[0];
}

/** Conserva el responsable y atribuye el cambio automatico a la integracion confiable. */
async function appendVisit(tx: EventTransaction, context: { target: Target; previous: StageVisit; next: string; actor: ReturnType<typeof captureIntegrationAuditActor>; operationId: string; reason: string; correlationId: string }): Promise<void> {
    const { target, previous, next, actor, operationId, reason, correlationId } = context;
    const native = target.destination === "native";
    const { table, key, actorColumn, responsibleColumn } = stageSources[target.destination];
    const publicIdColumn = native ? sql`public_id_sales_order_state_event,` : sql``;
    const publicIdValue = native ? sql`${ulid()},` : sql``;
    const responsibleSnapshot = snapshotJson(previous.responsibleSnapshot);
    await sql`INSERT INTO ${sql.table(table)} (${publicIdColumn}${sql.ref(key)},sequence_sales_order_state_event,from_state_code_sales_order_state_event,to_state_code_sales_order_state_event,event_kind_sales_order_state_event,effective_at_sales_order_state_event,${sql.ref(responsibleColumn)},responsible_snapshot_sales_order_state_event,${sql.ref(actorColumn)},actor_snapshot_sales_order_state_event,origin_sales_order_state_event,reason_sales_order_state_event,operation_id_sales_order_state_event,correlation_id_sales_order_state_event) VALUES (${publicIdValue}${target.id},${previous.sequence + 1},${previous.state},${next},'transition',UTC_TIMESTAMP(3),${previous.responsible ?? null},${responsibleSnapshot ?? null},${native ? null : actor.publicId},${JSON.stringify(actor)},'integration',${reason},${operationId},${correlationId})`.execute(
        tx,
    );
}

const auditSources = { native: { schema: "CRM_THINK_V2", table: "crm_sales_order" }, legacy: { schema: "crmdatabase-api", table: "ordenventa" } } as const;
const stageSources = {
    native: { table: "audit_sales_order_state_event", key: "sales_order_id_sales_order_state_event", actorColumn: "actor_user_id_sales_order_state_event", responsibleColumn: "responsible_user_id_sales_order_state_event" },
    legacy: { table: "crmdatabase-api.audit_sales_order_state_event", key: "legacy_order_id_sales_order_state_event", actorColumn: "actor_reference_sales_order_state_event", responsibleColumn: "responsible_reference_sales_order_state_event" },
} as const;
/** MySQL puede entregar JSON decodificado o serializado. */
function snapshotJson(value: StageVisit["responsibleSnapshot"]): string | null {
    if (value == null) return null;
    return typeof value === "string" ? value : JSON.stringify(value);
}

/** Los flags enteros legacy conservan la semantica estricta de los enums nativos. */
function eligibleLegacyOrder(row: Record<string, unknown>): boolean {
    return row.status_ov === 1 && row.caida_ov === 0 && row.contrado_frima_ov === 1 && row.aprobacion_forma_ov === 1;
}
