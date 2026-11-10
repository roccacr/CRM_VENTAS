import { ConflictException, Inject, Injectable, ServiceUnavailableException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { sql, type Transaction } from "kysely";
import { ulid } from "ulid";

import { DatabaseService } from "../../database/database.service.js";
import type { CrmDatabase } from "../../database/database.types.js";
import { type AuditActorSnapshot, captureIntegrationAuditActor } from "../../modules/crm/audit/audit-actor.js";
import { RecordAuditService } from "../../modules/crm/audit/record-audit.service.js";
import type { PersistedOrderEvent } from "./netsuite-order-event.contract.js";
import { mapOrderFields, mapOrderFlags, nativeRelationReferences, NETSUITE_DELIVERY_DATE_FIELD, orderApprovalMappings, type OrderEventChange, type OrderEventDestination, orderFieldMappings, orderFlagMappings, orderNumberMapping, orderRelationMappings, readOrderRelationValues } from "./netsuite-order-event.mapper.js";
import { isStaleOrderObservation, type PreviousOrderObservation } from "./netsuite-order-event.ordering.js";
import { advancePaidInstallments, PAID_INSTALLMENTS_STAGE_FIELD, syncOrderDeliveryDate } from "./netsuite-paid-installments.handler.js";
import { CANCELLATION_DATE_FIELD, CANCELLATION_DATE_NATIVE, planSalesOrderCancellation } from "./netsuite-sales-order-cancellation.handler.js";

export type OrderEventResult = { result: "applied" | "unchanged" | "not_found" | "stale"; destination: OrderEventDestination | null; orderId: string | null; changes: OrderEventChange[]; duplicate: boolean };
export type OrderEventIdentity = { payloadHash: string; snapshotHash: string; actor?: AuditActorSnapshot | undefined; imported?: boolean | undefined };
type Target = { destination: OrderEventDestination; id: string; row: Record<string, unknown> };
type EventAudit = { destination: OrderEventDestination | null; orderId: string | null; changes: OrderEventChange[]; result: OrderEventResult["result"] | "error"; error?: string };
type EventTransaction = Transaction<CrmDatabase>;
export interface ManualOrderSynchronization {
    importTranid?: string;
    allowUnlinkedOwner?: boolean;
    authorize(tx: EventTransaction, target: { destination: OrderEventDestination; id: string }): Promise<AuditActorSnapshot>;
}
/** Conserva el destino y diff intentado aunque la transaccion comercial termine en rollback. */
export class OrderEventPersistenceError extends Error {
    /**
     *
     */
    constructor(
        readonly original: unknown,
        readonly context: EventAudit,
    ) {
        super("No se pudo confirmar la sincronizacion.");
    }
}

/** Una conexion y transaccion InnoDB entre esquemas mantiene orden y bitacora atomicas. */
@Injectable()
export class NetsuiteOrderEventRepository {
    /** Reutiliza el pool nativo; nunca abre una segunda transaccion legacy. */
    constructor(
        @Inject(DatabaseService) private readonly database: DatabaseService,
        @Inject(ConfigService) private readonly config: ConfigService,
        @Inject(RecordAuditService) private readonly audit: RecordAuditService,
    ) {}

    /** Bloquea por orden antes de comprobar reenvios, resolver autoridad y calcular diferencias. */
    async apply(event: PersistedOrderEvent, identity: OrderEventIdentity, manual?: ManualOrderSynchronization): Promise<OrderEventResult> {
        let context: EventAudit = { result: "error", destination: null, orderId: null, changes: [] };
        return this.database.db
            .transaction()
            .execute(async (tx) => {
                const cursor = await this.lockCursor(tx, event);
                const replay = await this.replay(tx, event, identity.payloadHash);
                if (replay) return replay;
                const observed = Date.parse(event.event.sourceModifiedAt);
                const previous = await this.previousObservation(tx, event);
                const stale = isStaleOrderObservation({ event, cursor, hash: identity.snapshotHash, previous });
                if (stale) return this.complete(tx, event, identity, { result: "stale", destination: null, orderId: null, changes: [], duplicate: false });
                const target = await this.resolveEventTarget(tx, event, manual);
                const actor = await this.authorizeManual(tx, target, manual);
                if (target) {
                    context = { result: "error", destination: target.destination, orderId: target.id, changes: [] };
                    context.changes = await this.planChanges(tx, event, target);
                    // Si una relacion rechaza el evento, conservar el diff directo conocido en la evidencia de error.
                    context.changes.push(...(await this.planRelations(tx, event, target, manual?.allowUnlinkedOwner)));
                }
                const result = await this.update(tx, target, context.changes, event);
                await this.advanceInstallments(tx, event, target, result);
                await this.complete(tx, event, { ...identity, actor, imported: Boolean(manual?.importTranid) }, result);
                await sql`UPDATE int_netsuite_order_cursor SET source_modified_ms=${observed}, snapshot_hash=${identity.snapshotHash} WHERE account_id=${event.source.accountId} AND netsuite_id=${event.event.netsuiteId}`.execute(tx);
                return result;
            })
            .catch((error: unknown) => {
                throw new OrderEventPersistenceError(error, context);
            });
    }

    /** Manual requests must still resolve a destination before any field update. */
    private async authorizeManual(tx: EventTransaction, target: Target | null, manual?: ManualOrderSynchronization) {
        if (!manual) return undefined;
        if (!target) throw new ConflictException("La orden ya no esta disponible para sincronizar.");
        return manual.authorize(tx, target);
    }
    /** Los flags y la etapa opcional comparten transaccion, cursor y recibo tecnico. */
    private async advanceInstallments(tx: EventTransaction, event: PersistedOrderEvent, target: Target | null, result: OrderEventResult): Promise<void> {
        if (!target) return;
        const deliveryChange = await syncOrderDeliveryDate(tx, event, target);
        const stageChange = await advancePaidInstallments(tx, this.audit, { event, target, changes: result.changes });
        const changes = [deliveryChange, stageChange].filter((change) => change !== null);
        if (changes.length === 0) return;
        result.changes.push(...changes);
        result.result = "applied";
    }

    /** El rollback comercial no debe borrar la evidencia del error. No incluye SQL ni credenciales. */
    async recordError(event: PersistedOrderEvent, identity: OrderEventIdentity, message: string, context?: EventAudit): Promise<void> {
        await this.database.db.transaction().execute(async (tx) => {
            await this.writeAudit(tx, event, identity, { result: "error", destination: context?.destination ?? null, orderId: context?.orderId ?? null, changes: context?.changes ?? [], error: message });
        });
    }

    private async previousObservation(tx: EventTransaction, event: PersistedOrderEvent): Promise<PreviousOrderObservation | null> {
        const { rows } = await sql<PreviousOrderObservation>`SELECT JSON_UNQUOTE(JSON_EXTRACT(payload,'$.event.snapshotReadStartedAt')) AS startedAt,JSON_UNQUOTE(JSON_EXTRACT(payload,'$.event.snapshotReadCompletedAt')) AS completedAt,DATE_FORMAT(recorded_at,'%Y-%m-%dT%H:%i:%s.%fZ') AS recordedAt FROM audit_netsuite_order_event WHERE account_id=${event.source.accountId} AND netsuite_id=${event.event.netsuiteId} AND result IN ('applied','unchanged','not_found') ORDER BY id DESC LIMIT 1`.execute(
            tx,
        );
        return rows[0] ?? null;
    }

    private async lockCursor(tx: EventTransaction, event: PersistedOrderEvent) {
        await sql`INSERT INTO int_netsuite_order_cursor (account_id,netsuite_id) VALUES (${event.source.accountId},${event.event.netsuiteId}) ON DUPLICATE KEY UPDATE netsuite_id=netsuite_id`.execute(tx);
        const { rows } = await sql<{ observed: string | number | null; hash: string | null }>`SELECT source_modified_ms AS observed,snapshot_hash AS hash FROM int_netsuite_order_cursor WHERE account_id=${event.source.accountId} AND netsuite_id=${event.event.netsuiteId} FOR UPDATE`.execute(tx);
        if (!rows[0]) throw new ServiceUnavailableException("No fue posible bloquear la orden.");
        return rows[0];
    }

    private async replay(tx: EventTransaction, event: PersistedOrderEvent, hash: string): Promise<OrderEventResult | null> {
        const { rows } = await sql<{ hash: string; result: OrderEventResult["result"]; destination: OrderEventDestination | null; orderId: string | null; changes: string | OrderEventChange[] }>`SELECT payload_hash AS hash,result,destination,order_id AS orderId,changes FROM audit_netsuite_order_event WHERE account_id=${event.source.accountId} AND netsuite_id=${event.event.netsuiteId} AND event_id=${event.event.eventId} AND result<>'error' ORDER BY id LIMIT 1`.execute(tx);
        const prior = rows[0];
        if (!prior) return null;
        if (prior.hash !== hash) throw new ConflictException("El identificador de evento ya pertenece a otro payload.");
        return { result: prior.result, destination: prior.destination, orderId: prior.orderId, changes: typeof prior.changes === "string" ? (JSON.parse(prior.changes) as OrderEventChange[]) : prior.changes, duplicate: true };
    }

    private async resolve(tx: EventTransaction, netsuiteId: string): Promise<Target | null> {
        const native = await sql<
            Record<string, unknown>
        >`SELECT o.*,x.status_sales_order_external_reference AS referenceStatus,s.status_external_system AS integrationStatus FROM crm_sales_order o JOIN crm_sales_order_external_reference x ON x.sales_order_id_sales_order_external_reference=o.id_sales_order JOIN int_external_system s ON s.id_external_system=x.external_system_id_sales_order_external_reference WHERE s.code_external_system='netsuite' AND x.external_id_sales_order_external_reference=${netsuiteId} LIMIT 2 FOR UPDATE`.execute(tx);
        if (native.rows.some((row) => row.referenceStatus !== "active" || row.integrationStatus !== "active")) throw new ConflictException("Referencia nativa deshabilitada; no se permite fallback.");
        if (native.rows.length) return this.nativeTarget(native.rows);
        if (this.config.get<boolean>("ENABLE_LEGACY_FALLBACK") !== true) throw new ServiceUnavailableException("Busqueda legacy deshabilitada; no se puede declarar orden no encontrada.");
        const legacy = await sql<Record<string, unknown>>`SELECT * FROM ${sql.table("crmdatabase-api.ordenventa")} WHERE id_ov_netsuite=${netsuiteId} LIMIT 2 FOR UPDATE`.execute(tx);
        if (legacy.rows.length > 1) throw new ConflictException("Orden legacy ambigua.");
        const row = legacy.rows[0];
        if (!row) return null;
        // Una orden migrada sigue siendo nativa aunque aun falte completar su referencia ERP.
        const migrated = await sql<Record<string, unknown>>`SELECT * FROM crm_sales_order WHERE id_old_produccion_sales_order=${row.id_ov} LIMIT 2 FOR UPDATE`.execute(tx);
        if (migrated.rows.length) return this.nativeTarget(migrated.rows);
        if (this.config.get<boolean>("ENABLE_LEGACY_WRITES") !== true) throw new ServiceUnavailableException("Escritura legacy deshabilitada.");
        return { destination: "legacy", id: String(row.id_ov), row };
    }

    /** Solo la extracción manual crea órdenes; el webhook sigue siendo exclusivamente de actualización. */
    private async resolveEventTarget(tx: EventTransaction, event: PersistedOrderEvent, manual?: ManualOrderSynchronization): Promise<Target | null> {
        const existing = await this.resolve(tx, event.event.netsuiteId);
        if (!manual?.importTranid) return existing;
        if (existing) throw new ConflictException("La orden ya existe en Habita. Revisa los filtros de búsqueda.");
        await this.assertTranidAvailable(tx, manual.importTranid);
        return this.createImportedOrder(tx, event);
    }

    private async assertTranidAvailable(tx: EventTransaction, tranid: string): Promise<void> {
        const native = await sql`SELECT 1 FROM crm_sales_order_external_reference x JOIN int_external_system s ON s.id_external_system=x.external_system_id_sales_order_external_reference WHERE s.code_external_system='netsuite' AND UPPER(TRIM(x.transaction_number_sales_order_external_reference))=${tranid} LIMIT 1`.execute(tx);
        const legacy = await sql`SELECT 1 FROM ${sql.table("crmdatabase-api.ordenventa")} WHERE UPPER(TRIM(id_ov_tranid))=${tranid} LIMIT 1`.execute(tx);
        if (native.rows.length || legacy.rows.length) throw new ConflictException("La orden ya existe en Habita. Revisa los filtros de búsqueda.");
    }

    private async createImportedOrder(tx: EventTransaction, event: PersistedOrderEvent): Promise<Target> {
        const fields = event.snapshot.data.fields;
        if (!readOrderRelationValues(fields).entity) throw new ConflictException("NetSuite no indicó un cliente para esta orden.");
        const systems = await tx.selectFrom("int_external_system").select("id_external_system").where("code_external_system", "=", "netsuite").where("status_external_system", "=", "active").limit(2).execute();
        const system = systems[0];
        if (systems.length !== 1 || !system) throw new ServiceUnavailableException("No hay una integración activa de NetSuite.");
        const netsuiteId = event.event.netsuiteId;
        const insert = await sql`INSERT INTO crm_sales_order (public_id_sales_order,native_code_sales_order,status_sales_order) VALUES (${ulid()},${"NETSUITE-" + netsuiteId},'active')`.execute(tx);
        if (!insert.insertId) throw new Error("No se obtuvo el ID de la orden importada.");
        await sql`INSERT INTO crm_sales_order_external_reference (sales_order_id_sales_order_external_reference,external_system_id_sales_order_external_reference,external_id_sales_order_external_reference,status_sales_order_external_reference) VALUES (${insert.insertId.toString()},${system.id_external_system},${netsuiteId},'active')`.execute(tx);
        const target = await this.resolve(tx, netsuiteId);
        if (!target) throw new Error("No se pudo confirmar la referencia de la orden importada.");
        return target;
    }

    private nativeTarget(rows: Record<string, unknown>[]): Target {
        if (rows.length !== 1) throw new ConflictException("Orden nativa ambigua.");
        const row = rows[0];
        if (!row || row.deleted_at_sales_order !== null) throw new ConflictException("La autoridad nativa esta eliminada; no se permite fallback.");
        return { destination: "native", id: String(row.id_sales_order), row };
    }

    private async planChanges(tx: EventTransaction, event: PersistedOrderEvent, target: Target): Promise<OrderEventChange[]> {
        if (target.destination === "native" && event.snapshot.data.fields.crm_sync_projection === 1) await this.readNativeProjection(tx, event, target);
        const flags = mapOrderFlags(event.snapshot.data.fields, target.destination, target.row);
        const changes = [...flags, ...mapOrderFields(event.snapshot.data.fields, target.destination, target.row)];
        if (this.config.get<boolean>("NETSUITE_ORDER_CANCELLATION_EFFECTS_ENABLED") !== true) return changes;
        return [...changes, ...planSalesOrderCancellation({ destination: target.destination, before: target.row, changes: flags, at: new Date(event.event.sourceModifiedAt) })];
    }

    private async readNativeProjection(tx: EventTransaction, event: PersistedOrderEvent, target: Target): Promise<void> {
        const references = await sql<
            Record<string, unknown>
        >`SELECT x.transaction_number_sales_order_external_reference FROM crm_sales_order_external_reference x JOIN int_external_system s ON s.id_external_system=x.external_system_id_sales_order_external_reference WHERE x.sales_order_id_sales_order_external_reference=${target.id} AND x.external_id_sales_order_external_reference=${event.event.netsuiteId} AND s.code_external_system='netsuite' AND s.status_external_system='active' AND x.status_sales_order_external_reference='active' LIMIT 2 FOR UPDATE`.execute(
            tx,
        );
        if (references.rows.length !== 1) throw new ConflictException("La proyeccion completa requiere referencia ERP nativa conciliada.");
        Object.assign(target.row, references.rows[0]);
        const approvals = await tx.selectFrom("crm_sales_order_approval").select(["type_code_sales_order_approval", "status_sales_order_approval", "version_sales_order_approval"]).where("sales_order_id_sales_order_approval", "=", Number(target.id)).forUpdate().execute();
        for (const mapping of orderApprovalMappings) {
            const previous = approvals.find((approval) => approval.type_code_sales_order_approval === mapping.approval);
            target.row[mapping.native] = previous?.status_sales_order_approval ?? null;
            target.row[mapping.native + "_version"] = previous?.version_sales_order_approval ?? 0;
        }
    }

    /** Solo cambia la relacion de la OV; no crea ni modifica lead, unidad, usuario o subsidiaria. */
    private async planRelations(tx: EventTransaction, event: PersistedOrderEvent, target: Target, allowUnlinkedOwner = false): Promise<OrderEventChange[]> {
        if (event.snapshot.data.fields.crm_sync_projection !== 1) return [];
        const values = readOrderRelationValues(event.snapshot.data.fields);
        const changes: OrderEventChange[] = [];
        for (const mapping of orderRelationMappings) {
            try {
                changes.push(...(await this.planRelation(tx, mapping, values[mapping.netsuite] ?? null, target)));
            } catch (error) {
                if (!this.canIgnoreMissingOwner(mapping.domain, error, allowUnlinkedOwner)) throw error;
            }
        }
        return changes;
    }

    private canIgnoreMissingOwner(domain: string, error: unknown, allowed: boolean): boolean {
        return allowed && domain === "user" && error instanceof ConflictException;
    }

    private async planRelation(tx: EventTransaction, mapping: (typeof orderRelationMappings)[number], external: string | null, target: Target): Promise<OrderEventChange[]> {
        const column = mapping[target.destination];
        if (column === null) return [];
        const after = await this.relationValue(tx, mapping, external, target.destination);
        const before = target.row[column] ?? null;
        const comparable = typeof before === "number" ? String(before) : before;
        const next = typeof after === "number" ? String(after) : after;
        return comparable === next ? [] : [{ field: mapping.netsuite, column, before, after }];
    }

    private async relationValue(tx: EventTransaction, mapping: (typeof orderRelationMappings)[number], external: string | null, destination: OrderEventDestination): Promise<string | number | null> {
        if (external === null) return null;
        if (destination === "native") return this.resolveNativeRelation(tx, mapping, external);
        if (Number(external) > 2147483647) throw new ConflictException("Relacion ERP excede INT legacy: " + mapping.netsuite);
        return Number(external);
    }

    private async resolveNativeRelation(tx: EventTransaction, mapping: (typeof orderRelationMappings)[number], external: string): Promise<string> {
        if (mapping.domain === null) throw new Error("Relacion sin destino nativo.");
        const reference = nativeRelationReferences[mapping.domain];
        const deleted = reference.deleted ? sql`AND ${sql.ref("x." + reference.deleted)} IS NULL` : sql``;
        const { rows } = await sql<{ id: string | number }>`SELECT ${sql.ref("x." + reference.owner)} AS id FROM ${sql.table(reference.table)} x JOIN int_external_system s ON s.id_external_system=${sql.ref("x." + reference.system)} WHERE s.code_external_system='netsuite' AND s.status_external_system='active' AND ${sql.ref("x." + reference.external)}=${external} AND ${sql.ref("x." + reference.status)}='active' ${deleted} LIMIT 2 FOR UPDATE`.execute(tx);
        const row = rows[0];
        if (rows.length !== 1 || !row) throw new ConflictException("Relacion ERP nativa ausente o ambigua: " + mapping.netsuite);
        return String(row.id);
    }

    private async update(tx: EventTransaction, target: Target | null, changes: OrderEventChange[], event: PersistedOrderEvent): Promise<OrderEventResult> {
        if (!target) return { result: "not_found", destination: null, orderId: null, changes: [], duplicate: false };
        if (!changes.length) return { result: "unchanged", destination: target.destination, orderId: target.id, changes, duplicate: false };
        const native = target.destination === "native";
        const { table, key } = native ? { table: "crm_sales_order", key: "id_sales_order" } : { table: "crmdatabase-api.ordenventa", key: "id_ov" };
        const orderChanges = native ? changes.filter((change) => !orderApprovalMappings.some((mapping) => mapping.netsuite === change.field) && change.field !== orderNumberMapping.netsuite) : changes;
        const assignments = orderChanges.map((change) => sql`${sql.ref(change.column)}=${change.after}`);
        if (native) assignments.push(sql`updated_at_sales_order=UTC_TIMESTAMP(3)`);
        await sql`UPDATE ${sql.table(table)} SET ${sql.join(assignments)} WHERE ${sql.ref(key)}=${target.id}`.execute(tx);
        if (native) await this.updateRelated(tx, target, changes, event);
        return { result: "applied", destination: target.destination, orderId: target.id, changes, duplicate: false };
    }

    /** Las aprobaciones conservan su version e historial; el avance por cuotas pagadas se audita por separado. */
    private async updateRelated(tx: EventTransaction, target: Target, changes: OrderEventChange[], event: PersistedOrderEvent): Promise<void> {
        for (const change of changes) {
            if (change.field === orderNumberMapping.netsuite) {
                await sql`UPDATE crm_sales_order_external_reference x JOIN int_external_system s ON s.id_external_system=x.external_system_id_sales_order_external_reference SET x.transaction_number_sales_order_external_reference=${change.after},x.updated_at_sales_order_external_reference=UTC_TIMESTAMP(3) WHERE x.sales_order_id_sales_order_external_reference=${target.id} AND x.external_id_sales_order_external_reference=${event.event.netsuiteId} AND s.code_external_system='netsuite' AND x.status_sales_order_external_reference='active'`.execute(
                    tx,
                );
            }
            if (orderApprovalMappings.some((mapping) => mapping.netsuite === change.field)) await this.updateApproval(tx, target, event, change);
        }
    }

    private async updateApproval(tx: EventTransaction, target: Target, event: PersistedOrderEvent, change: OrderEventChange): Promise<void> {
        const mapping = orderApprovalMappings.find((candidate) => candidate.netsuite === change.field);
        if (!mapping) throw new Error("Aprobacion sin contrato.");
        if (change.after !== "approved" && change.after !== "not_approved") throw new Error("Estado de aprobacion fuera del contrato.");
        const version = Number(target.row[mapping.native + "_version"]) + 1;
        await tx
            .insertInto("crm_sales_order_approval")
            .values({ sales_order_id_sales_order_approval: Number(target.id), type_code_sales_order_approval: mapping.approval, status_sales_order_approval: change.after, version_sales_order_approval: version, updated_by_user_id_sales_order_approval: null })
            .onDuplicateKeyUpdate({ status_sales_order_approval: change.after, version_sales_order_approval: version, updated_at_sales_order_approval: sql<Date>`UTC_TIMESTAMP(3)`, updated_by_user_id_sales_order_approval: null })
            .execute();
        const previous = change.before;
        if (previous !== null && previous !== "approved" && previous !== "not_approved" && previous !== "unknown") throw new Error("Aprobacion anterior fuera del contrato.");
        await tx
            .insertInto("audit_sales_order_approval_event")
            .values({
                sales_order_id_sales_order_approval_event: Number(target.id),
                type_code_sales_order_approval_event: mapping.approval,
                version_sales_order_approval_event: version,
                before_status_sales_order_approval_event: previous,
                after_status_sales_order_approval_event: change.after,
                effective_at_sales_order_approval_event: sql<Date>`UTC_TIMESTAMP(3)`,
                actor_user_id_sales_order_approval_event: null,
                actor_snapshot_sales_order_approval_event: JSON.stringify({ publicId: "integration:netsuite:" + event.source.accountId, name: { production: "NetSuite Production UE", sandbox: "NetSuite Sandbox UE" }[event.source.environment] }),
                origin_sales_order_approval_event: "integration",
                reason_sales_order_approval_event: "Estado recibido desde NetSuite; no cambia etapa CRM.",
                operation_id_sales_order_approval_event: event.event.eventId,
                correlation_id_sales_order_approval_event: event.event.eventId,
            })
            .execute();
    }

    private async complete(tx: EventTransaction, event: PersistedOrderEvent, identity: OrderEventIdentity, result: OrderEventResult): Promise<OrderEventResult> {
        await this.appendCentralAudit(tx, event, result, identity);
        await this.writeAudit(tx, event, identity, result);
        return result;
    }

    private async appendCentralAudit(tx: EventTransaction, event: PersistedOrderEvent, result: OrderEventResult, identity: OrderEventIdentity): Promise<void> {
        if (!result.destination || !result.orderId) return;
        const native = result.destination === "native";
        const canonicalChanges = result.changes
            .filter((change) => change.field !== PAID_INSTALLMENTS_STAGE_FIELD)
            .map((change) => {
                if (change.field === NETSUITE_DELIVERY_DATE_FIELD) return { ...change, field: "delivered_on" };
                if (change.field === CANCELLATION_DATE_FIELD) return { ...change, field: CANCELLATION_DATE_NATIVE };
                const mapping = [...orderFlagMappings, ...orderFieldMappings, ...orderApprovalMappings, orderNumberMapping, ...orderRelationMappings].find((candidate) => candidate.netsuite === change.field);
                if (!mapping) throw new Error("Campo sin contrato de auditoria central.");
                return { ...change, field: mapping.native ?? mapping.legacy };
            });
        const actor = identity.actor ?? captureIntegrationAuditActor({ publicId: "integration:netsuite:" + event.source.accountId, name: { production: "NetSuite Production UE", sandbox: "NetSuite Sandbox UE" }[event.source.environment] });
        await this.audit.append(tx, {
            source: { schema: native ? "CRM_THINK_V2" : "crmdatabase-api", table: native ? "crm_sales_order" : "ordenventa", entity: "sales_order", id: result.orderId },
            actor,
            action: result.changes.length ? "update" : "annotation",
            module: "formalizacion",
            before: Object.fromEntries(canonicalChanges.map((change) => [change.field, change.before])),
            after: Object.fromEntries(canonicalChanges.map((change) => [change.field, change.after])),
            allowedFields: [...[...orderFlagMappings, ...orderFieldMappings, ...orderApprovalMappings, orderNumberMapping, ...orderRelationMappings].map((mapping) => mapping.native ?? mapping.legacy), CANCELLATION_DATE_NATIVE, "delivered_on"],
            operationId: "netsuite:" + event.source.accountId + ":" + event.event.eventId,
            correlationId: event.event.eventId,
            reason: orderEventOrigin(identity) + event.event.eventType + "; " + event.source.environment + "; ID " + event.event.netsuiteId,
            snapshotScope: "partial",
        });
    }

    private async writeAudit(tx: EventTransaction, event: PersistedOrderEvent, identity: OrderEventIdentity, audit: EventAudit): Promise<void> {
        await sql`INSERT INTO audit_netsuite_order_event (account_id,netsuite_id,event_id,payload_hash,destination,order_id,result,error_message,origin,changes,payload) VALUES (${event.source.accountId},${event.event.netsuiteId},${event.event.eventId},${identity.payloadHash},${audit.destination},${audit.orderId},${audit.result},${audit.error ?? null},${identity.actor ? (identity.imported ? "NetSuite import " : "NetSuite manual ") + identity.actor.publicId : "NetSuite UE " + event.event.eventType},${JSON.stringify(audit.changes)},${JSON.stringify(event)})`.execute(
            tx,
        );
    }
}

function orderEventOrigin(identity: OrderEventIdentity): string {
    if (identity.imported) return "Extraccion manual NetSuite ";
    return identity.actor ? "Sincronizacion manual NetSuite " : "NetSuite UE ";
}
