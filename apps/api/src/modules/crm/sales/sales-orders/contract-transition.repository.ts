import { createHash } from "node:crypto";

import { ConflictException, ForbiddenException, Inject, Injectable, NotFoundException, ServiceUnavailableException } from "@nestjs/common";
import { sql, type Transaction } from "kysely";
import { ulid } from "ulid";

import { DatabaseService } from "../../../../database/database.service.js";
import type { CrmDatabase } from "../../../../database/database.types.js";
import type { AuditActorSnapshot } from "../../audit/audit-actor.js";
import { RecordAuditService } from "../../audit/record-audit.service.js";
import { type ContractAction, contractTarget, type ContractTransitionDto, FORMALIZATION_STAGE_CODES } from "./contract-transition.dto.js";
import { CONTRACT_TRANSITION_LEGACY, type ContractEvent, type ContractOrder, type ContractTransitionLegacy } from "./contract-transition.port.js";

/** Validated command plus server-derived context (actor, correlation id, network metadata); none of it comes from the client. */
export interface ContractTransitionCommand extends ContractTransitionDto {
    action: ContractAction;
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

/** Persistence collaborator of the authorized service, not an alternate public use case. */
@Injectable()
export class ContractTransitionRepository {
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
            .select(["id_sales_order", "public_id_sales_order", "native_code_sales_order", "id_old_produccion_sales_order", "lead_id_sales_order", "status_sales_order", "cancelled_sales_order", "deleted_at_sales_order", "contract_signed_sales_order"])
            .where(column, "=", source === "native" ? id : Number(id))
            .forUpdate()
            .executeTakeFirst();
    }

    /** Import/promotion must lock the legacy parent BEFORE inserting its native alias in the same transaction.
     * This protocol serializes legacy writes against migration; no legacy flags are ever updated here.
     */
    private async resolve(tx: Transaction<CrmDatabase>, command: ContractTransitionCommand): Promise<ResolvedOrder> {
        let legacy: ContractOrder | undefined;
        if (command.source === "legacy") {
            // A positive native probe avoids touching a retired/disabled legacy source.
            // A negative RR snapshot is never authoritative: lock legacy, then recheck native using a current locking read.
            const alias = await tx.selectFrom("crm_sales_order").select("id_sales_order").where("id_old_produccion_sales_order", "=", Number(command.id)).executeTakeFirst();
            if (!alias) legacy = await this.legacy.lock(tx, command.id);
        }
        const native = await this.nativeOrder(tx, command.source, command.id);
        if (!native) {
            if (!legacy) throw new NotFoundException("Order unavailable");
            return { native, order: legacy, source: "legacy" };
        }
        const approvals = await tx.selectFrom("crm_sales_order_approval").select(["type_code_sales_order_approval", "status_sales_order_approval"]).where("sales_order_id_sales_order_approval", "=", native.id_sales_order).forUpdate().execute();
        const approved = ["sales_management", "developer", "formalization"].every((type) => approvals.some((entry) => entry.type_code_sales_order_approval === type && entry.status_sales_order_approval === "approved"));
        const order: ContractOrder = { contractSigned: native.contract_signed_sales_order === "yes", id: String(native.id_sales_order), businessId: native.native_code_sales_order, active: native.status_sales_order === "active" && native.cancelled_sales_order === "no" && native.deleted_at_sales_order === null, approved };
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
            return this.result(resolved, target, replay.sequence, true);
        }
        const last = await this.readEvent(tx, resolved);
        const previous = last ?? { sequence: 0, state: null };
        const sequence = previous.sequence;
        const current = this.assertTransition(command, resolved.order, last);
        const snapshot = await this.audit.captureActor(tx, actor.id_user);
        // The prior logical state is known, but its historical entry date may not be.
        // The authenticated changer takes initial responsibility for the new visit; seller remains separate.
        const event = { sequence: sequence + 1, from: current, state: target, actor: snapshot.publicId, actorSnapshot: snapshot, responsibleSnapshot: snapshot, reason: command.reason, operationId: command.operationId, correlationId: command.correlationId };
        if (resolved.native) await this.appendNative(tx, resolved.native.id_sales_order, { id: actor.id_user, snapshot }, event);
        else await this.legacy.append(tx, resolved.order.id, event);
        await this.appendCentral(tx, { command, resolved, actor: snapshot, before: current, after: target, sequence });
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
        return { source: resolved.source, id: resolved.native?.public_id_sales_order ?? resolved.order.id, state, sequence, replayed };
    }

    /** A repeated operationId is accepted only if it carries the same target state, actor and reason. */
    private assertReplay(replay: ContractEvent, command: ContractTransitionCommand, actor: string): void {
        const target = contractTarget(command);
        if (replay.state !== target || replay.actor !== actor || replay.reason !== command.reason) throw new ConflictException("Operation reused with different content");
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

    /** Jumps are explicitly allowed; reversals retain a required reason and every visit. */
    private assertSelectedStage(command: ContractTransitionCommand, current: string, order: ContractOrder): void {
        const target = contractTarget(command);
        if (current === target) throw new ConflictException("Order is already in that stage");
        const before = FORMALIZATION_STAGE_CODES.findIndex((code) => code === current);
        const after = FORMALIZATION_STAGE_CODES.findIndex((code) => code === target);
        if (before < 0) throw new ConflictException("Unknown current stage");
        this.assertBankingPrerequisites(order, before, after);
        if (after < before && !command.reason.trim()) throw new ConflictException("Reversal reason required");
    }

    /** Firma observada is a prerequisite, never an ERP mutation or a substitute for registering send. */
    private assertBankingPrerequisites(order: ContractOrder, before: number, after: number): void {
        if (after < 2) return;
        if (!order.contractSigned) throw new ConflictException({ code: "CONTRACT_SIGNATURE_REQUIRED", message: "Se requiere el contrato firmado para pasar a Gestión bancaria o etapas posteriores." });
        if (before < 1) throw new ConflictException({ code: "CONTRACT_SEND_REQUIRED", message: "Primero registra el envío del contrato y completa la etapa Pendiente de firma." });
    }

    /** Orders without a stored stage are treated as pending send; inactive or not fully approved orders cannot move. */
    private currentStage(order: ContractOrder, stored?: string): string {
        if (!order.active || !order.approved) throw new ConflictException("Order requires active noncancelled status and three approvals");
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
            .set({ updated_at_sales_order: sql<Date>`UTC_TIMESTAMP(3)`, updated_by_user_id_sales_order: actor.id })
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
            before: { businessId: resolved.order.businessId, state: before, version: sequence },
            after: { businessId: resolved.order.businessId, state: after, version: sequence + 1 },
            allowedFields: ["businessId", "state", "version"],
            operationId: createHash("sha256")
                .update(JSON.stringify(["sales_order", "state", command.operationId]))
                .digest("hex"),
            correlationId: command.correlationId,
            reason: command.reason,
            snapshotScope: "partial",
            ...(command.ipAddress ? { ipAddress: command.ipAddress } : {}),
            ...(command.userAgent ? { userAgent: command.userAgent } : {}),
        });
    }
}
