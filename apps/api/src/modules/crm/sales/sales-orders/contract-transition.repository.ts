import { createHash } from "node:crypto";
import { isDeepStrictEqual } from "node:util";

import { ConflictException, ForbiddenException, Inject, Injectable, NotFoundException, ServiceUnavailableException } from "@nestjs/common";
import { sql, type Transaction } from "kysely";
import { ulid } from "ulid";
import { z } from "zod";

import { DatabaseService } from "../../../../database/database.service.js";
import type { CrmDatabase } from "../../../../database/database.types.js";
import type { AuditActorSnapshot } from "../../audit/audit-actor.js";
import { RecordAuditService } from "../../audit/record-audit.service.js";
import { type ContractAction, contractTarget, type ContractTransitionDto, FORMALIZATION_STAGE_CODES, PURCHASE_FUNDS_ORIGINS } from "./contract-transition.dto.js";
import { CONTRACT_TRANSITION_LEGACY, type ContractEvent, type ContractOrder, type ContractTransitionLegacy } from "./contract-transition.port.js";
import { assertFiniquitoTransition, finiquitoEligible, finiquitoSnapshot, type FiniquitoStatus } from "./finiquito.policy.js";
import { formalizationCompletionTarget } from "./formalization-completion.policy.js";
import type { PurchaseFundsDto } from "./purchase-funds.dto.js";

/** Validated command plus server-derived context (actor, correlation id, network metadata); none of it comes from the client. */
export interface ContractTransitionCommand extends ContractTransitionDto {
    action: ContractAction;
    /** Trusted capability derived from the live profile, never from the request body. */
    canSkipStages?: boolean;
    actorPublicId: string;
    /** Server-derived only. Omission keeps internal callers owner-only, never unrestricted. */
    ownOnly?: boolean;
    reason: string;
    correlationId: string;
    ipAddress?: string;
    userAgent?: string;
}
/** Native order row, or undefined when the order only exists in legacy. */
type NativeOrder = Awaited<ReturnType<ContractTransitionRepository["nativeOrder"]>>;
/** Order located in either source, with the native alias when both exist. */
interface ResolvedOrder {
    native: NativeOrder;
    order: ContractOrder;
    source: "native" | "legacy";
}
/** Everything the central audit needs to record one state change. */
interface CentralChange {
    command: ContractTransitionCommand;
    resolved: ResolvedOrder;
    actor: AuditActorSnapshot;
    before: string;
    after: string;
    sequence: number;
}

const SEND = "contract_pending_send";
const SIGNATURE = "contract_pending_signature";
const replayFundsSnapshot = z.object({ purchaseFundsOrigin: z.enum(PURCHASE_FUNDS_ORIGINS).nullable() });

/** Fail closed on missing/corrupt history; JSON object key order is immaterial. */
function assertFundsReplay(replay: { actor_reference_record_event: string | null; before_record_event: unknown; after_record_event: unknown; action_record_event: string }, actor: string, before: object, after: object): void {
    try {
        const decode = (value: unknown): unknown => (typeof value === "string" ? JSON.parse(value) : value);
        const matches = [replay.actor_reference_record_event === actor, replay.action_record_event === "update", isDeepStrictEqual(decode(replay.before_record_event), before), isDeepStrictEqual(decode(replay.after_record_event), after)].every(Boolean);
        if (matches) return;
    } catch {
        /* Invalid stored JSON is rejected as a conflict, never replayed. */
    }
    throw new ConflictException("Operación reutilizada con datos diferentes");
}

/** Persistence collaborator of the authorized service, not an alternate public use case. */
@Injectable()
export class ContractTransitionRepository {
    /** Edit snapshot includes the central version: even an A→B→A edit invalidates stale forms. */
    async purchaseFundsSnapshot(command: ContractTransitionCommand) {
        return this.database.db.transaction().execute(async (tx) => {
            const resolved = await this.resolve(tx, command);
            if (!resolved.order.active) throw new ConflictException("Orden inactiva o cancelada");
            await this.assertOwnerScope(tx, resolved, command);
            const last = await this.readEvent(tx, resolved);
            return { ...this.result(resolved, last?.state ?? "contract_pending_send", last?.sequence ?? 0, false), auditSequence: await this.fundsAuditSequence(tx, resolved) };
        });
    }

    /** Durable independent branch in the existing append-only record journal; no commercial visit is written. */
    async finiquito(command: ContractTransitionCommand, change?: { status: FiniquitoStatus; expectedVersion: number }) {
        if (!this.audit.enabled) throw new ServiceUnavailableException("Finiquito requiere auditoría habilitada.");
        // Keep flags, replay, CAS and journal append inside the same locked transaction.
        // eslint-disable-next-line complexity
        return this.database.db.transaction().execute(async (tx) => {
            const resolved = await this.resolve(tx, command, !change);
            const { order } = resolved;
            if (!order.available) throw new NotFoundException("Orden no disponible.");
            await this.assertOwnerScope(tx, resolved, command);
            const source = this.auditSource(resolved);
            const events = () =>
                tx
                    .selectFrom("audit_record_event as event")
                    .innerJoin("audit_record as record", "record.id_record", "event.record_id_record_event")
                    .select(["event.after_record_event", "event.actor_reference_record_event", "event.operation_id_record_event"])
                    .where("record.source_schema_record", "=", source.source.schema)
                    .where("record.source_table_record", "=", source.source.table)
                    .where("record.source_id_record", "=", source.source.id)
                    .where("event.module_record_event", "=", "formalizacion.finiquito");
            const decode = (value: unknown) => finiquitoSnapshot.parse(typeof value === "string" ? JSON.parse(value) : value);
            const latest = await events().orderBy("event.sequence_record_event", "desc").limit(1).forUpdate().executeTakeFirst();
            const before = latest ? decode(latest.after_record_event) : null;
            const eligible = finiquitoEligible(order);
            if (!change) return { eligible, status: before?.finiquitoStatus ?? null, version: before?.finiquitoVersion ?? 0, originStage: before?.finiquitoOriginStage ?? null };
            if (!eligible) throw new ConflictException("El finiquito requiere Venta caída y Contrato firmado confirmados.");
            const operationId = createHash("sha256")
                .update(JSON.stringify(["sales_order", "finiquito", command.operationId]))
                .digest("hex");
            const replay = await events().where("event.operation_id_record_event", "=", operationId).limit(1).forUpdate().executeTakeFirst();
            if (replay) {
                const saved = decode(replay.after_record_event);
                if (replay.actor_reference_record_event !== command.actorPublicId || saved.finiquitoStatus !== change.status || saved.finiquitoVersion !== change.expectedVersion + 1) throw new ConflictException("Operación reutilizada con datos diferentes.");
                return { eligible, status: saved.finiquitoStatus, version: saved.finiquitoVersion, originStage: saved.finiquitoOriginStage };
            }
            if ((before?.finiquitoVersion ?? 0) !== change.expectedVersion) throw new ConflictException("El finiquito cambió. Actualiza antes de guardar.");
            assertFiniquitoTransition(before?.finiquitoStatus ?? null, change.status);
            const last = await this.readEvent(tx, resolved);
            const originStage = before?.finiquitoOriginStage ?? last?.state ?? (order.approved ? "contract_pending_send" : "unclassified");
            const after = { finiquitoStatus: change.status, finiquitoVersion: change.expectedVersion + 1, finiquitoOriginStage: originStage };
            const actor = await tx.selectFrom("sec_user").select("id_user").where("public_id_user", "=", command.actorPublicId).where("status_user", "=", "active").where("deleted_at_user", "is", null).executeTakeFirstOrThrow();
            const captured = await this.audit.captureActor(tx, actor.id_user);
            await this.audit.append(tx, {
                ...source,
                actor: captured,
                action: "state_change",
                module: "formalizacion.finiquito",
                before: before ?? { finiquitoStatus: null, finiquitoVersion: 0, finiquitoOriginStage: null },
                after,
                allowedFields: ["finiquitoStatus", "finiquitoVersion", "finiquitoOriginStage"],
                operationId,
                correlationId: command.correlationId,
                snapshotScope: "partial",
                ...(command.ipAddress ? { ipAddress: command.ipAddress } : {}),
                ...(command.userAgent ? { userAgent: command.userAgent } : {}),
            });
            return { eligible, status: after.finiquitoStatus, version: after.finiquitoVersion, originStage };
        });
    }

    private async fundsAuditSequence(tx: Transaction<CrmDatabase>, resolved: ResolvedOrder) {
        const { source } = this.auditSource(resolved);
        const last = await tx.selectFrom("audit_record_event as event").innerJoin("audit_record as record", "record.id_record", "event.record_id_record_event").select("event.sequence_record_event").where("record.source_schema_record", "=", source.schema).where("record.source_table_record", "=", source.table).where("record.source_id_record", "=", source.id).orderBy("event.sequence_record_event", "desc").limit(1).forUpdate().executeTakeFirst();
        return last?.sequence_record_event ?? 0;
    }

    /** One transaction updates classification and central audit; no stage visit or stage timer changes. */
    async updatePurchaseFunds(command: ContractTransitionCommand & PurchaseFundsDto) {
        if (!this.audit.enabled) throw new ServiceUnavailableException("Purchase funds require enabled record audit");
        return this.database.db.transaction().execute(async (tx) => {
            const resolved = await this.resolve(tx, command);
            if (!resolved.order.active) throw new ConflictException("Orden inactiva o cancelada");
            await this.assertOwnerScope(tx, resolved, command);
            const user = await tx.selectFrom("sec_user").select("id_user").where("public_id_user", "=", command.actorPublicId).where("status_user", "=", "active").where("deleted_at_user", "is", null).executeTakeFirstOrThrow();
            const actor = await this.audit.captureActor(tx, user.id_user);
            const before = { purchaseFundsOrigin: command.expectedPurchaseFundsOrigin, stateVersion: command.expectedSequence, auditVersion: command.expectedAuditSequence };
            const after = { ...before, purchaseFundsOrigin: command.purchaseFundsOrigin };
            const operationId = createHash("sha256")
                .update(JSON.stringify(["sales_order", "purchase_funds", command.operationId]))
                .digest("hex");
            const { source } = this.auditSource(resolved);
            const replay = await tx
                .selectFrom("audit_record_event as event")
                .innerJoin("audit_record as record", "record.id_record", "event.record_id_record_event")
                .select(["event.actor_reference_record_event", "event.before_record_event", "event.after_record_event", "event.action_record_event"])
                .where("record.source_schema_record", "=", source.schema)
                .where("record.source_table_record", "=", source.table)
                .where("record.source_id_record", "=", source.id)
                .where("event.operation_id_record_event", "=", operationId)
                .forUpdate()
                .executeTakeFirst();
            if (replay) {
                assertFundsReplay(replay, actor.publicId, before, after);
                return { purchaseFundsOrigin: command.purchaseFundsOrigin, sequence: command.expectedSequence, replayed: true };
            }
            await this.assertFreshFunds(tx, resolved, command);
            if (resolved.native)
                await tx
                    .updateTable("crm_sales_order")
                    .set({ purchase_funds_origin_sales_order: command.purchaseFundsOrigin, updated_at_sales_order: sql<Date>`UTC_TIMESTAMP(3)`, updated_by_user_id_sales_order: user.id_user })
                    .where("id_sales_order", "=", resolved.native.id_sales_order)
                    .execute();
            else await this.legacy.updatePurchaseFunds(tx, resolved.order.id, command.purchaseFundsOrigin);
            await this.audit.append(tx, { ...this.auditSource(resolved), actor, action: "update", module: "formalizacion", before, after, allowedFields: ["purchaseFundsOrigin", "stateVersion", "auditVersion"], operationId, correlationId: command.correlationId, expectedSequence: command.expectedAuditSequence, snapshotScope: "partial", ...(command.ipAddress ? { ipAddress: command.ipAddress } : {}), ...(command.userAgent ? { userAgent: command.userAgent } : {}) });
            return { purchaseFundsOrigin: command.purchaseFundsOrigin, sequence: command.expectedSequence, replayed: false };
        });
    }
    private async assertFreshFunds(tx: Transaction<CrmDatabase>, resolved: ResolvedOrder, command: ContractTransitionCommand & PurchaseFundsDto) {
        const last = await this.readEvent(tx, resolved);
        const stale = [(last?.sequence ?? 0) !== command.expectedSequence, (resolved.order.purchaseFundsOrigin ?? null) !== command.expectedPurchaseFundsOrigin, (await this.fundsAuditSequence(tx, resolved)) !== command.expectedAuditSequence].some(Boolean);
        if (stale) throw new ConflictException("La orden cambió. Actualiza antes de guardar.");
    }
    /** Uses the canonical pool and the domain-owned port, never an integration import. */
    constructor(
        @Inject(DatabaseService) private readonly database: DatabaseService,
        @Inject(RecordAuditService) private readonly audit: RecordAuditService,
        @Inject(CONTRACT_TRANSITION_LEGACY) private readonly legacy: ContractTransitionLegacy,
    ) {}

    /** Locks include inactive/deleted aliases: a native row always shadows its legacy source. */
    async nativeOrder(tx: Transaction<CrmDatabase>, source: "native" | "legacy", id: string) {
        const column = source === "native" ? "public_id_sales_order" : "id_old_produccion_sales_order";
        return tx
            .selectFrom("crm_sales_order")
            .select(["id_sales_order", "public_id_sales_order", "native_code_sales_order", "id_old_produccion_sales_order", "lead_id_sales_order", "status_sales_order", "cancelled_sales_order", "deleted_at_sales_order", "contract_signed_sales_order", "purchase_funds_origin_sales_order", "installments_fully_paid_sales_order", "unit_transferred_sales_order", "keys_delivered_sales_order", "unit_delivered_sales_order"])
            .where(column, "=", source === "native" ? id : Number(id))
            .forUpdate()
            .executeTakeFirst();
    }

    /** Import/promotion must lock the legacy parent BEFORE inserting its native alias in the same transaction.
     * This protocol serializes legacy writes against migration; no legacy flags are ever updated here.
     */
    private async resolve(tx: Transaction<CrmDatabase>, command: ContractTransitionCommand, readOnlyLegacy?: boolean): Promise<ResolvedOrder> {
        let legacy: ContractOrder | undefined;
        if (command.source === "legacy") {
            // A positive native probe avoids touching a retired/disabled legacy source.
            // A negative RR snapshot is never authoritative: lock legacy, then recheck native using a current locking read.
            const alias = await tx.selectFrom("crm_sales_order").select("id_sales_order").where("id_old_produccion_sales_order", "=", Number(command.id)).executeTakeFirst();
            if (!alias) legacy = await this.legacy.lock(tx, command.id, readOnlyLegacy);
        }
        const native = await this.nativeOrder(tx, command.source, command.id);
        if (!native) {
            if (!legacy) throw new NotFoundException("Order unavailable");
            return { native, order: legacy, source: "legacy" };
        }
        const approvals = await tx.selectFrom("crm_sales_order_approval").select(["type_code_sales_order_approval", "status_sales_order_approval"]).where("sales_order_id_sales_order_approval", "=", native.id_sales_order).forUpdate().execute();
        const approved = approvals.some((entry) => entry.type_code_sales_order_approval === "formalization" && entry.status_sales_order_approval === "approved");
        const order: ContractOrder = {
            installmentsFullyPaid: { yes: true, no: false, unknown: null }[native.installments_fully_paid_sales_order],
            unitTransferred: { yes: true, no: false, unknown: null }[native.unit_transferred_sales_order],
            keysDelivered: { yes: true, no: false, unknown: null }[native.keys_delivered_sales_order],
            unitDelivered: { yes: true, no: false, unknown: null }[native.unit_delivered_sales_order],
            purchaseFundsOrigin: native.purchase_funds_origin_sales_order,
            available: native.status_sales_order === "active" && native.deleted_at_sales_order === null,
            saleLost: native.cancelled_sales_order === "yes",
            contractSigned: native.contract_signed_sales_order === "yes",
            id: String(native.id_sales_order),
            businessId: native.native_code_sales_order,
            active: native.status_sales_order === "active" && native.cancelled_sales_order === "no" && native.deleted_at_sales_order === null,
            approved,
        };
        return { native, order, source: "native" as const };
    }

    private async nativeEvent(tx: Transaction<CrmDatabase>, id: number, operationId?: string): Promise<ContractEvent | undefined> {
        let query = tx.selectFrom("audit_sales_order_state_event").select(["sequence_sales_order_state_event", "to_state_code_sales_order_state_event", "actor_user_id_sales_order_state_event", "reason_sales_order_state_event"]).where("sales_order_id_sales_order_state_event", "=", id);
        if (operationId !== undefined) query = query.where("operation_id_sales_order_state_event", "=", operationId);
        const row = await query.orderBy("sequence_sales_order_state_event", "desc").limit(1).forUpdate().executeTakeFirst();
        return row ? { sequence: row.sequence_sales_order_state_event, state: row.to_state_code_sales_order_state_event, actor: row.actor_user_id_sales_order_state_event === null ? null : String(row.actor_user_id_sales_order_state_event), reason: row.reason_sales_order_state_event } : undefined;
    }

    /** Specialized and central history share one native connection and commit boundary. */
    async transition(command: ContractTransitionCommand) {
        if (!this.audit.enabled) throw new ServiceUnavailableException("Contract transitions require enabled central record audit");
        return this.database.db.transaction().execute((tx) => this.executeTransition(tx, command));
    }

    private async readEvent(tx: Transaction<CrmDatabase>, resolved: ResolvedOrder, operationId?: string) {
        return resolved.native ? this.nativeEvent(tx, resolved.native.id_sales_order, operationId) : this.legacy.event(tx, resolved.order.id, operationId);
    }

    private async executeTransition(tx: Transaction<CrmDatabase>, command: ContractTransitionCommand) {
        const resolved = await this.resolve(tx, command);
        if (!resolved.order.active) throw new ConflictException("Order is inactive, deleted or cancelled");
        const actor = await tx.selectFrom("sec_user").select("id_user").where("public_id_user", "=", command.actorPublicId).where("status_user", "=", "active").where("deleted_at_user", "is", null).executeTakeFirstOrThrow();
        await this.assertOwnerScope(tx, resolved, command);
        const target = contractTarget(command);
        const replay = await this.readEvent(tx, resolved, command.operationId);
        if (replay) {
            this.assertReplay(replay, command, resolved.native ? String(actor.id_user) : command.actorPublicId);
            return { ...this.result(resolved, target, replay.sequence, true), purchaseFundsOrigin: await this.replayFunds(tx, resolved, command) };
        }
        const last = await this.readEvent(tx, resolved);
        const previous = last ?? { sequence: 0, state: null };
        const sequence = previous.sequence;
        const current = this.assertTransition(command, resolved.order, last);
        const snapshot = await this.audit.captureActor(tx, actor.id_user);
        // The first stored visit has no previous stored visit (both schemas require a NULL predecessor).
        // Central audit below retains the known logical before/after; no historical visit/date is invented.
        // The authenticated changer takes initial responsibility for the new visit; seller remains separate.
        const event = { sequence: sequence + 1, from: sequence === 0 ? null : current, state: target, actor: snapshot.publicId, actorSnapshot: snapshot, responsibleSnapshot: snapshot, purchaseFundsOrigin: command.purchaseFundsOrigin, reason: command.reason, operationId: command.operationId, correlationId: command.correlationId };
        if (resolved.native) await this.appendNative(tx, resolved.native.id_sales_order, { id: actor.id_user, snapshot }, event);
        else await this.legacy.append(tx, resolved.order.id, event);
        await this.appendCentral(tx, { command, resolved, actor: snapshot, before: current, after: target, sequence });
        if (command.purchaseFundsOrigin) resolved.order.purchaseFundsOrigin = command.purchaseFundsOrigin;
        return this.result(resolved, target, sequence + 1, false);
    }

    /** Lock the linked lead and canonical user; the order owner or stage responsible is not the seller. */
    private async nativeOwner(tx: Transaction<CrmDatabase>, leadId: number | null): Promise<string | null> {
        if (leadId === null) return null;
        const owner = await tx.selectFrom("crm_lead").innerJoin("sec_user", "sec_user.id_user", "crm_lead.owner_user_id_lead").select("sec_user.public_id_user").where("crm_lead.id_lead", "=", leadId).where("crm_lead.deleted_at_lead", "is", null).where("sec_user.deleted_at_user", "is", null).forUpdate().executeTakeFirst();
        return owner?.public_id_user ?? null;
    }

    /** Ownership is checked before replay, so retries cannot bypass a reassignment or scope reduction. */
    private async assertOwnerScope(tx: Transaction<CrmDatabase>, resolved: ResolvedOrder, command: ContractTransitionCommand): Promise<void> {
        if (command.ownOnly === false) return;
        const owner = resolved.native ? await this.nativeOwner(tx, resolved.native.lead_id_sales_order) : await this.legacy.owner(tx, resolved.order.id);
        if (owner !== command.actorPublicId) throw new ForbiddenException("No tiene alcance sobre el responsable del lead de esta orden");
    }

    /** Response shape; `replayed` tells the client an identical earlier operation was returned. */
    private result(resolved: ResolvedOrder, state: string, sequence: number, replayed: boolean) {
        return { purchaseFundsOrigin: resolved.order.purchaseFundsOrigin ?? null, source: resolved.source, id: resolved.native?.public_id_sales_order ?? resolved.order.id, state, sequence, replayed };
    }

    /** A repeated operationId is accepted only if it carries the same target state, actor and reason. */
    private assertReplay(replay: ContractEvent, command: ContractTransitionCommand, actor: string): void {
        const target = contractTarget(command);
        if (replay.state !== target || replay.actor !== actor || replay.reason !== command.reason) throw new ConflictException("Operation reused with different content");
    }

    private auditOperationId(operationId: string): string {
        return createHash("sha256")
            .update(JSON.stringify(["sales_order", "state", operationId]))
            .digest("hex");
    }

    /** Compare a retry with its original audit snapshot, even if a later command changed the funds choice. */
    private async replayFunds(tx: Transaction<CrmDatabase>, resolved: ResolvedOrder, command: ContractTransitionCommand) {
        const { source } = this.auditSource(resolved);
        const event = await tx.selectFrom("audit_record_event as event").innerJoin("audit_record as record", "record.id_record", "event.record_id_record_event").select("event.after_record_event").where("record.source_schema_record", "=", source.schema).where("record.source_table_record", "=", source.table).where("record.source_id_record", "=", source.id).where("event.operation_id_record_event", "=", this.auditOperationId(command.operationId)).executeTakeFirst();
        const snapshot: unknown = typeof event?.after_record_event === "string" ? JSON.parse(event.after_record_event) : event?.after_record_event;
        const parsed = replayFundsSnapshot.safeParse(snapshot);
        const original = parsed.success ? parsed.data.purchaseFundsOrigin : (resolved.order.purchaseFundsOrigin ?? null);
        if (command.purchaseFundsOrigin !== undefined && command.purchaseFundsOrigin !== original) throw new ConflictException("Operation reused with different content");
        return original;
    }

    /** Optimistic check: the expected sequence sent by the client must match the latest event, and the order must be in the stage the action leaves. */
    private assertTransition(command: ContractTransitionCommand, order: ContractOrder, last?: ContractEvent): string {
        const sequence = last?.sequence ?? 0;
        if (sequence !== command.expectedSequence || sequence >= 4294967295) throw new ConflictException("Order changed; reload before continuing");
        const current = this.currentStage(order, last?.state);
        if (command.action === "set") {
            this.assertSelectedStage(command, current, order);
            return current;
        }
        const required = { send: SEND, revert: SIGNATURE }[command.action];
        if (current !== required) throw new ConflictException("Contract stage does not permit this action");
        return current;
    }

    /** Sequential by default; exceptional jumps require a server-derived capability and reason. */
    private assertSelectedStage(command: ContractTransitionCommand, current: string, order: ContractOrder): void {
        const target = contractTarget(command);
        if (current === target) throw new ConflictException("Order is already in that stage");
        const before = FORMALIZATION_STAGE_CODES.findIndex((code) => code === current);
        const after = FORMALIZATION_STAGE_CODES.findIndex((code) => code === target);
        if (before < 0) throw new ConflictException("Unknown current stage");
        this.assertBankingPrerequisites(order, command.canSkipStages === true ? 1 : before, after);
        this.assertPurchaseFundsRoute(before, after, command, order);
        this.assertCompletionRoute(order, before, target);
        const next = this.nextStage(current, command.purchaseFundsOrigin ?? order.purchaseFundsOrigin, order);
        if (target !== next) this.assertExceptionalStage(command);
        if (after < before && !command.reason.trim()) throw new ConflictException("Reversal reason required");
    }

    private assertCompletionRoute(order: ContractOrder, before: number, target: string): void {
        const transferIndex = FORMALIZATION_STAGE_CODES.indexOf("pending_transfer");
        // El operador puede registrar la firma antes de que NetSuite confirme el traspaso.
        const manualSignature = [before === transferIndex, target === "transfer_signed", order.installmentsFullyPaid === true, order.keysDelivered === false, order.unitDelivered === false].every(Boolean);
        if (!manualSignature && ["pending_transfer", "transfer_signed", "closed"].includes(target) && formalizationCompletionTarget(order) !== target) throw new ConflictException({ code: "FORMALIZATION_COMPLETION_FLAGS_REQUIRED", message: "Avance bloqueado: revisar cuotas, unidad traspasada, llaves entregadas y unidad entregada en NetSuite para la etapa seleccionada." });
        if (before >= transferIndex && target === "pending_balance") throw new ConflictException({ code: "PENDING_BALANCE_RETURN_FORBIDDEN", message: "No se permite volver a Pendiente de saldo despues de iniciar el traspaso." });
    }

    /** The exit choice is mandatory and fixes the destination even for exceptional stage grants. */
    private assertPurchaseFundsRoute(before: number, after: number, command: ContractTransitionCommand, order: ContractOrder): void {
        if (before >= 2 || after < 2) return;
        const origin = command.purchaseFundsOrigin ?? order.purchaseFundsOrigin;
        if (!origin) throw new ConflictException({ code: "PURCHASE_FUNDS_ORIGIN_REQUIRED", message: "Selecciona el origen de fondos de la compra para salir de Contratos." });
        if (contractTarget(command) !== this.contractExitStage(origin)) throw new ConflictException({ code: "PURCHASE_FUNDS_ROUTE_REQUIRED", message: "La etapa de salida de Contratos debe corresponder al origen de fondos seleccionado." });
    }

    /** ERP evidence may advance directly to a later completion target; stored stages change only on explicit commands. */
    private nextStage(current: string, origin: ContractOrder["purchaseFundsOrigin"], order: ContractOrder): string | undefined {
        if (["pending_balance", "pending_transfer", "transfer_signed"].includes(current)) {
            const completion = formalizationCompletionTarget(order);
            if (completion && FORMALIZATION_STAGE_CODES.indexOf(completion) > FORMALIZATION_STAGE_CODES.findIndex((code) => code === current)) return completion;
        }
        if (current === SIGNATURE) return this.contractExitStage(origin);
        return FORMALIZATION_STAGE_CODES[FORMALIZATION_STAGE_CODES.findIndex((code) => code === current) + 1];
    }

    /** Financed orders enter the queue before an operator starts banking. */
    private contractExitStage(origin: ContractOrder["purchaseFundsOrigin"]): string {
        return origin === "own_funds" ? "pending_balance" : "bank_management";
    }

    private assertExceptionalStage(command: ContractTransitionCommand): void {
        if (command.canSkipStages !== true) throw new ForbiddenException("Se requiere permiso para saltar etapas de Formalización");
        if (!command.reason.trim()) throw new ConflictException("Se requiere un motivo para el cambio excepcional");
    }

    /** Firma observada is a prerequisite, never an ERP mutation or a substitute for registering send. */
    private assertBankingPrerequisites(order: ContractOrder, before: number, after: number): void {
        if (after < 2) return;
        if (!order.contractSigned) throw new ConflictException({ code: "CONTRACT_SIGNATURE_REQUIRED", message: "Se requiere el contrato firmado para pasar a Gestión bancaria o etapas posteriores." });
        if (before < 1) throw new ConflictException({ code: "CONTRACT_SEND_REQUIRED", message: "Primero registra el envío del contrato y completa la etapa Pendiente de firma." });
    }

    /** Orders without a stored stage are pending send; Formalization approval is the contract eligibility gate. */
    private currentStage(order: ContractOrder, stored?: string): string {
        if (!order.active || !order.approved) throw new ConflictException("Order requires active noncancelled status and Formalization approval");
        // A signed flag gates banking, but does not invent an earlier CRM send event.
        if (stored === undefined || stored === "unclassified" || stored === "pending_approval") return SEND;
        return stored;
    }

    private async appendNative(tx: Transaction<CrmDatabase>, id: number, actor: { id: number; snapshot: AuditActorSnapshot }, event: Parameters<ContractTransitionLegacy["append"]>[2]) {
        await tx
            .insertInto("audit_sales_order_state_event")
            .values({
                public_id_sales_order_state_event: ulid(),
                sales_order_id_sales_order_state_event: id,
                sequence_sales_order_state_event: event.sequence,
                from_state_code_sales_order_state_event: event.from,
                to_state_code_sales_order_state_event: event.state,
                event_kind_sales_order_state_event: event.sequence === 1 ? "created" : "transition",
                effective_at_sales_order_state_event: sql<Date>`UTC_TIMESTAMP(3)`,
                actor_user_id_sales_order_state_event: actor.id,
                actor_snapshot_sales_order_state_event: JSON.stringify(actor.snapshot),
                responsible_user_id_sales_order_state_event: actor.id,
                responsible_snapshot_sales_order_state_event: JSON.stringify(actor.snapshot),
                origin_sales_order_state_event: "crm",
                reason_sales_order_state_event: event.reason,
                operation_id_sales_order_state_event: event.operationId,
                correlation_id_sales_order_state_event: event.correlationId,
            })
            .execute();
        await tx
            .updateTable("crm_sales_order")
            .set({ ...(event.purchaseFundsOrigin ? { purchase_funds_origin_sales_order: event.purchaseFundsOrigin } : {}), updated_at_sales_order: sql<Date>`UTC_TIMESTAMP(3)`, updated_by_user_id_sales_order: actor.id })
            .where("id_sales_order", "=", id)
            .execute();
    }

    /** Audit identity: legacy orders are audited against the legacy table, native aliases also record their effective native source. */
    private auditSource({ native, order }: ResolvedOrder) {
        const nativeSource = { schema: "CRM_THINK_V2", entity: "sales_order", table: "crm_sales_order", id: order.id } as const;
        const legacyId = native?.id_old_produccion_sales_order ?? (native ? null : order.id);
        const source = legacyId === null ? nativeSource : ({ schema: "crmdatabase-api", entity: "sales_order", table: "ordenventa", id: String(legacyId) } as const);
        return {
            source,
            ...(native && legacyId !== null ? { effectiveSource: { schema: nativeSource.schema, table: nativeSource.table, id: nativeSource.id } } : {}),
        };
    }

    private async appendCentral(tx: Transaction<CrmDatabase>, change: CentralChange) {
        const { command, resolved, actor, before, after, sequence } = change;
        await this.audit.append(tx, {
            ...this.auditSource(resolved),
            actor,
            action: FORMALIZATION_STAGE_CODES.findIndex((code) => code === after) < FORMALIZATION_STAGE_CODES.findIndex((code) => code === before) ? "revert" : "state_change",
            module: "formalizacion",
            before: { businessId: resolved.order.businessId, state: before, version: sequence, purchaseFundsOrigin: resolved.order.purchaseFundsOrigin ?? null },
            after: { businessId: resolved.order.businessId, state: after, version: sequence + 1, purchaseFundsOrigin: command.purchaseFundsOrigin ?? resolved.order.purchaseFundsOrigin ?? null },
            allowedFields: ["businessId", "state", "version", "purchaseFundsOrigin"],
            operationId: this.auditOperationId(command.operationId),
            correlationId: command.correlationId,
            reason: command.reason,
            snapshotScope: "partial",
            ...(command.ipAddress ? { ipAddress: command.ipAddress } : {}),
            ...(command.userAgent ? { userAgent: command.userAgent } : {}),
        });
    }
}
