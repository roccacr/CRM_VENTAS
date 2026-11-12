import { createHash } from "node:crypto";
import { isDeepStrictEqual } from "node:util";

import { ConflictException, ForbiddenException, HttpException, Inject, Injectable, NotFoundException, ServiceUnavailableException } from "@nestjs/common";
import { sql, type Transaction } from "kysely";
import { ulid } from "ulid";
import { z } from "zod";

import { DatabaseService } from "../../../../database/database.service.js";
import type { CrmDatabase } from "../../../../database/database.types.js";
import type { AuditActorSnapshot } from "../../audit/audit-actor.js";
import { RecordAuditService } from "../../audit/record-audit.service.js";
import { type ContractAction, contractTarget, type ContractTransitionDto, FORMALIZATION_STAGE_CODES, PURCHASE_FUNDS_ORIGINS } from "./contract-transition.dto.js";
import { CONTRACT_TRANSITION_LEGACY, type ContractEvent, type ContractOrder, type ContractTransitionLegacy } from "./contract-transition.port.js";
import { type FiniquitoChange, finiquitoManualEvidence, finiquitoSnapshot, finiquitoValidationEligible, normalizedFiniquitoReason, planFiniquitoUpdate } from "./finiquito.policy.js";
import { persistFiniquitoPlan, readFiniquitoFlags } from "./finiquito.storage.js";
import { outsideFiniquito } from "./finiquito-exclusion.query.js";
import { finiquitoOverviewQuery, readFiniquitoOverview } from "./finiquito-overview.query.js";
import { formalizationCompletionTarget } from "./formalization-completion.policy.js";
import type { PurchaseFundsDto } from "./purchase-funds.dto.js";
import { UNIT_TRANSFER_WORKFLOW, type UnitTransferWorkflow } from "./unit-transfer-workflow.port.js";

/** Comando ya validado más el contexto que arma el servidor: actor, correlación y red. Nada de eso viene del cliente. */
export interface ContractTransitionCommand extends ContractTransitionDto {
    action: ContractAction;
    /** Capacidad de confianza tomada del perfil vivo. No viene del cuerpo. */
    canSkipStages?: boolean;
    actorPublicId: string;
    /** Solo lo arma el servidor. Si se omite, el llamador interno queda limitado al dueño. No queda sin restricción. */
    ownOnly?: boolean;
    reason: string;
    correlationId: string;
    ipAddress?: string;
    userAgent?: string;
}
/** Fila nativa de la orden. Queda indefinida si la orden solo existe en el CRM viejo. */
type NativeOrder = Awaited<ReturnType<ContractTransitionRepository["nativeOrder"]>>;
/** Orden encontrada en cualquiera de las dos fuentes. Si existen las dos, manda el alias nativo. */
interface ResolvedOrder {
    native: NativeOrder;
    order: ContractOrder;
    source: "native" | "legacy";
}
/** Lo que la bitácora central necesita para registrar un cambio de estado. */
interface CentralChange {
    workflowResult?: string | undefined;
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

/** Una historia ausente o corrupta se cierra. El orden de las claves del JSON no importa. */
function assertFundsReplay(replay: { actor_reference_record_event: string | null; before_record_event: unknown; after_record_event: unknown; action_record_event: string }, actor: string, before: object, after: object): void {
    try {
        const decode = (value: unknown): unknown => (typeof value === "string" ? JSON.parse(value) : value);
        const matches = [replay.actor_reference_record_event === actor, replay.action_record_event === "update", isDeepStrictEqual(decode(replay.before_record_event), before), isDeepStrictEqual(decode(replay.after_record_event), after)].every(Boolean);
        if (matches) return;
    } catch {
        /* Un JSON guardado inválido es conflicto. No se trata como repetición. */
    }
    throw new ConflictException("Operación reutilizada con datos diferentes");
}

/** Colaborador de persistencia del servicio ya autorizado. No es otro caso de uso público. */
@Injectable()
export class ContractTransitionRepository {
    /** Conteos y lista comparten foto y autoridad nativa primero, sin depender del responsable comercial. */
    async finiquitoOverview(query: z.infer<typeof finiquitoOverviewQuery>) {
        return this.database.db.transaction().execute((tx) => readFiniquitoOverview(tx, this.legacy.finiquitoProjection?.(tx) ?? null, query));
    }
    /** La foto de edición incluye la versión central. Un cambio A, B y otra vez A invalida un formulario viejo. */
    async purchaseFundsSnapshot(command: ContractTransitionCommand) {
        return this.database.db.transaction().execute(async (tx) => {
            const resolved = await this.resolve(tx, command);
            if (!resolved.order.active) throw new ConflictException("Orden inactiva o cancelada");
            await this.assertOwnerScope(tx, resolved, command);
            const last = await this.readEvent(tx, resolved);
            return { ...this.result(resolved, last?.state ?? "contract_pending_send", last?.sequence ?? 0, false), auditSequence: await this.fundsAuditSequence(tx, resolved) };
        });
    }

    /** Rama durable e independiente en el diario de solo agregado. No escribe una visita comercial. */
    async finiquito(command: ContractTransitionCommand, change?: FiniquitoChange) {
        if (change?.status === "set_stage") change = { ...change, reason: normalizedFiniquitoReason(change.reason) };
        if (!this.audit.enabled) throw new ServiceUnavailableException("Finiquito requiere auditoría habilitada.");
        // Banderas, repetición, control optimista y el agregado al diario quedan en la misma transacción bloqueada.
        // eslint-disable-next-line complexity
        return this.database.db.transaction().execute(async (tx) => {
            const resolved = await this.resolve(tx, command, !change);
            const { order } = resolved;
            if (resolved.native?.deleted_at_sales_order != null) throw new NotFoundException("Orden no disponible.");
            await this.assertOwnerScope(tx, resolved, command);
            order.reservationApplied ??= await this.reservationApplied(tx, resolved);
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
            const target = { source: resolved.source, id: order.id };
            const flags = await readFiniquitoFlags(tx, target);
            const eligible = finiquitoValidationEligible({ ...order, available: true });
            const view = (saved: typeof before, values = flags) => ({ eligible, ...values, contractSigned: order.contractSigned, saleLost: order.saleLost === true, status: saved?.finiquitoStatus ?? null, version: saved?.finiquitoVersion ?? 0, originStage: saved?.finiquitoOriginStage ?? null });
            if (!change) return view(before);
            const operationId = createHash("sha256")
                .update(JSON.stringify(["sales_order", "finiquito", command.operationId]))
                .digest("hex");
            const replay = await events().where("event.operation_id_record_event", "=", operationId).limit(1).forUpdate().executeTakeFirst();
            if (replay) {
                const saved = decode(replay.after_record_event);
                if (replay.actor_reference_record_event !== command.actorPublicId || (saved.finiquitoAction ?? saved.finiquitoStatus) !== change.status || saved.finiquitoVersion !== change.expectedVersion + 1 || saved.finiquitoManualStage !== change.targetStage || saved.finiquitoReason !== change.reason) throw new ConflictException("Operación reutilizada con datos diferentes.");
                return view(before);
            }
            if (!eligible) throw new ConflictException("Se requiere Venta caída y Reserva Aplicada para gestionar este flujo.");
            if ((before?.finiquitoVersion ?? 0) !== change.expectedVersion) throw new ConflictException("El finiquito cambió. Actualiza antes de guardar.");
            const step = planFiniquitoUpdate(before?.finiquitoStatus ?? null, flags, change, order.contractSigned);
            const last = await this.readEvent(tx, resolved);
            const originStage = before?.finiquitoOriginStage ?? last?.state ?? (order.approved ? "contract_pending_send" : "unclassified");
            const nextFlags = step.flags;
            const after = { finiquitoStatus: step.status, finiquitoAction: change.status, finiquitoVersion: change.expectedVersion + 1, finiquitoOriginStage: originStage, ...finiquitoManualEvidence(change), ...nextFlags };
            const actor = await tx.selectFrom("sec_user").select("id_user").where("public_id_user", "=", command.actorPublicId).where("status_user", "=", "active").where("deleted_at_user", "is", null).executeTakeFirstOrThrow();
            const captured = await this.audit.captureActor(tx, actor.id_user);
            await persistFiniquitoPlan(tx, target, { ...step, actor: command.actorPublicId });
            await this.audit.append(tx, {
                ...source,
                actor: captured,
                action: "state_change",
                module: "formalizacion.finiquito",
                before: { ...(before ?? { finiquitoStatus: null, finiquitoVersion: 0, finiquitoOriginStage: null }), ...flags },
                after,
                allowedFields: ["finiquitoStatus", "finiquitoAction", "finiquitoVersion", "finiquitoOriginStage", "balanceValidated", "sent", "received", "finiquitoManualStage", "finiquitoReason"],
                reason: change.reason ?? null,
                operationId,
                correlationId: command.correlationId,
                snapshotScope: "partial",
                ...(command.ipAddress ? { ipAddress: command.ipAddress } : {}),
                ...(command.userAgent ? { userAgent: command.userAgent } : {}),
            });
            return view(after, nextFlags);
        });
    }

    private async fundsAuditSequence(tx: Transaction<CrmDatabase>, resolved: ResolvedOrder) {
        const { source } = this.auditSource(resolved);
        const last = await tx.selectFrom("audit_record_event as event").innerJoin("audit_record as record", "record.id_record", "event.record_id_record_event").select("event.sequence_record_event").where("record.source_schema_record", "=", source.schema).where("record.source_table_record", "=", source.table).where("record.source_id_record", "=", source.id).orderBy("event.sequence_record_event", "desc").limit(1).forUpdate().executeTakeFirst();
        return last?.sequence_record_event ?? 0;
    }

    private async reservationApplied(tx: Transaction<CrmDatabase>, resolved: ResolvedOrder): Promise<boolean> {
        if (resolved.native) {
            const row = await tx.selectFrom("crm_sales_order").select("reservation_applied_sales_order").where("id_sales_order", "=", resolved.native.id_sales_order).forUpdate().executeTakeFirst();
            return row?.reservation_applied_sales_order === "yes";
        }
        if (!this.legacy.reservationApplied) throw new ServiceUnavailableException("La fuente legacy no permite confirmar Reserva Aplicada.");
        return this.legacy.reservationApplied(tx, resolved.order.id);
    }

    private async assertOutsideFiniquito(tx: Transaction<CrmDatabase>, resolved: ResolvedOrder): Promise<void> {
        const exclusion = await sql<{ allowed: number }>`SELECT ${outsideFiniquito(resolved.source, sql`${resolved.order.id}`)} AS allowed`.execute(tx);
        if (exclusion.rows[0]?.allowed !== 1) throw new ConflictException("La orden pertenece al flujo de finiquito y no puede avanzar en etapas comerciales.");
    }

    /** Una transacción actualiza la clasificación y la bitácora central. No cambia la visita ni el temporizador de etapa. */
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
    /** Usa el pool canónico y el puerto del dominio. No importa la integración. */
    constructor(
        @Inject(DatabaseService) private readonly database: DatabaseService,
        @Inject(RecordAuditService) private readonly audit: RecordAuditService,
        @Inject(CONTRACT_TRANSITION_LEGACY) private readonly legacy: ContractTransitionLegacy,
        @Inject(UNIT_TRANSFER_WORKFLOW) private readonly unitTransfer: UnitTransferWorkflow,
    ) {}

    /** El bloqueo incluye alias inactivos y borrados. Una fila nativa tapa su fuente vieja. */
    async nativeOrder(tx: Transaction<CrmDatabase>, source: "native" | "legacy", id: string) {
        const column = source === "native" ? "public_id_sales_order" : "id_old_produccion_sales_order";
        return tx
            .selectFrom("crm_sales_order")
            .select(["id_sales_order", "public_id_sales_order", "native_code_sales_order", "id_old_produccion_sales_order", "lead_id_sales_order", "status_sales_order", "cancelled_sales_order", "deleted_at_sales_order", "contract_signed_sales_order", "purchase_funds_origin_sales_order", "installments_fully_paid_sales_order", "unit_transferred_sales_order", "keys_delivered_sales_order", "unit_delivered_sales_order"])
            .where(column, "=", source === "native" ? id : Number(id))
            .forUpdate()
            .executeTakeFirst();
    }

    /** Importar o promover bloquea primero el padre viejo y después inserta el alias nativo, en la misma transacción.
     * Ese orden serializa la escritura vieja contra la migración. Aquí no se actualizan banderas del CRM viejo.
     */
    private async resolve(tx: Transaction<CrmDatabase>, command: ContractTransitionCommand, readOnlyLegacy?: boolean): Promise<ResolvedOrder> {
        let legacy: ContractOrder | undefined;
        if (command.source === "legacy") {
            // Si ya hay alias nativo, no se toca una fuente vieja retirada o apagada.
            // Una foto de lectura repetible que no vio el alias no manda. Se bloquea lo viejo y se vuelve a leer lo nativo con un bloqueo actual.
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

    /** La historia especializada y la central comparten la conexión nativa y el mismo commit. */
    async transition(command: ContractTransitionCommand) {
        if (!this.audit.enabled) throw new ServiceUnavailableException("Contract transitions require enabled central record audit");
        try {
            return await this.database.db.transaction().execute((tx) => this.executeTransition(tx, command));
        } catch (error) {
            if (command.targetState === "closed" && !(error instanceof HttpException)) throw new ServiceUnavailableException({ code: "UNIT_TRANSFER_LOCAL_COMMIT_UNCONFIRMED", message: "No se confirmó el guardado de la etapa. Actualiza la orden y concilia la ejecución externa antes de reintentar." });
            throw error;
        }
    }

    private async readEvent(tx: Transaction<CrmDatabase>, resolved: ResolvedOrder, operationId?: string) {
        return resolved.native ? this.nativeEvent(tx, resolved.native.id_sales_order, operationId) : this.legacy.event(tx, resolved.order.id, operationId);
    }

    private async executeTransition(tx: Transaction<CrmDatabase>, command: ContractTransitionCommand) {
        const resolved = await this.resolve(tx, command);
        if (!resolved.order.active) throw new ConflictException("Order is inactive, deleted or cancelled");
        await this.assertOutsideFiniquito(tx, resolved);
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
        // La primera visita guardada no tiene visita previa. Los dos esquemas exigen un predecesor nulo.
        // La bitácora central conserva el antes y el después lógicos conocidos. No se inventa una visita ni una fecha histórica.
        // Quien está autenticado asume la responsabilidad inicial de la visita nueva. El vendedor sigue siendo otro dato.
        const workflowResult = await this.confirmClosure(tx, resolved, command, current);
        const event = { sequence: sequence + 1, from: sequence === 0 ? null : current, state: target, actor: snapshot.publicId, actorSnapshot: snapshot, responsibleSnapshot: snapshot, purchaseFundsOrigin: command.purchaseFundsOrigin, reason: command.reason, operationId: command.operationId, correlationId: command.correlationId };
        if (resolved.native) await this.appendNative(tx, resolved.native.id_sales_order, { id: actor.id_user, snapshot }, event);
        else await this.legacy.append(tx, resolved.order.id, event);
        await this.appendCentral(tx, { command, resolved, actor: snapshot, before: current, after: target, sequence, workflowResult });
        if (command.purchaseFundsOrigin) resolved.order.purchaseFundsOrigin = command.purchaseFundsOrigin;
        return this.result(resolved, target, sequence + 1, false);
    }

    private async confirmClosure(tx: Transaction<CrmDatabase>, resolved: ResolvedOrder, command: ContractTransitionCommand, current: string): Promise<string | undefined> {
        if (current !== "transfer_signed" || contractTarget(command) !== "closed") return undefined;
        return this.unitTransfer.execute(tx, { source: resolved.source, id: resolved.order.id, actorPublicId: command.actorPublicId, operationId: command.operationId, correlationId: command.correlationId });
    }

    /** Bloquea el lead vinculado y el usuario canónico. El dueño de la orden o el responsable de la etapa no es el vendedor. */
    private async nativeOwner(tx: Transaction<CrmDatabase>, leadId: number | null): Promise<string | null> {
        if (leadId === null) return null;
        const owner = await tx.selectFrom("crm_lead").innerJoin("sec_user", "sec_user.id_user", "crm_lead.owner_user_id_lead").select("sec_user.public_id_user").where("crm_lead.id_lead", "=", leadId).where("crm_lead.deleted_at_lead", "is", null).where("sec_user.deleted_at_user", "is", null).forUpdate().executeTakeFirst();
        return owner?.public_id_user ?? null;
    }

    /** La propiedad se comprueba antes de la repetición. Un reintento no salta una reasignación ni un alcance reducido. */
    private async assertOwnerScope(tx: Transaction<CrmDatabase>, resolved: ResolvedOrder, command: ContractTransitionCommand): Promise<void> {
        if (command.ownOnly === false) return;
        const owner = resolved.native ? await this.nativeOwner(tx, resolved.native.lead_id_sales_order) : await this.legacy.owner(tx, resolved.order.id);
        if (owner !== command.actorPublicId) throw new ForbiddenException("No tiene alcance sobre el responsable del lead de esta orden");
    }

    /** Forma de la respuesta. `replayed` dice que se devolvió la operación anterior idéntica. */
    private result(resolved: ResolvedOrder, state: string, sequence: number, replayed: boolean) {
        return { purchaseFundsOrigin: resolved.order.purchaseFundsOrigin ?? null, source: resolved.source, id: resolved.native?.public_id_sales_order ?? resolved.order.id, state, sequence, replayed };
    }

    /** Un operationId repetido se acepta solo si trae el mismo estado destino, el mismo actor y el mismo motivo. */
    private assertReplay(replay: ContractEvent, command: ContractTransitionCommand, actor: string): void {
        const target = contractTarget(command);
        if (replay.state !== target || replay.actor !== actor || replay.reason !== command.reason) throw new ConflictException("Operation reused with different content");
    }

    private auditOperationId(operationId: string): string {
        return createHash("sha256")
            .update(JSON.stringify(["sales_order", "state", operationId]))
            .digest("hex");
    }

    /** El reintento se compara con la foto original de la bitácora, aunque un comando posterior haya cambiado los fondos. */
    private async replayFunds(tx: Transaction<CrmDatabase>, resolved: ResolvedOrder, command: ContractTransitionCommand) {
        const { source } = this.auditSource(resolved);
        const event = await tx.selectFrom("audit_record_event as event").innerJoin("audit_record as record", "record.id_record", "event.record_id_record_event").select("event.after_record_event").where("record.source_schema_record", "=", source.schema).where("record.source_table_record", "=", source.table).where("record.source_id_record", "=", source.id).where("event.operation_id_record_event", "=", this.auditOperationId(command.operationId)).executeTakeFirst();
        const snapshot: unknown = typeof event?.after_record_event === "string" ? JSON.parse(event.after_record_event) : event?.after_record_event;
        const parsed = replayFundsSnapshot.safeParse(snapshot);
        const original = parsed.success ? parsed.data.purchaseFundsOrigin : (resolved.order.purchaseFundsOrigin ?? null);
        if (command.purchaseFundsOrigin !== undefined && command.purchaseFundsOrigin !== original) throw new ConflictException("Operation reused with different content");
        return original;
    }

    /** Control optimista: la secuencia esperada tiene que ser el último evento, y la orden tiene que estar en la etapa de la que sale la acción. */
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

    /** Por defecto el avance es secuencial. Un salto excepcional exige una capacidad armada en el servidor y un motivo. */
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
        // Desde la firma, el cierre lo confirma el workflow externo antes de persistir la etapa.
        if (before === FORMALIZATION_STAGE_CODES.indexOf("transfer_signed") && target === "closed") return;
        const transferIndex = FORMALIZATION_STAGE_CODES.indexOf("pending_transfer");
        // El operador puede registrar la firma antes de que NetSuite confirme el traspaso.
        const manualSignature = [before === transferIndex, target === "transfer_signed", order.installmentsFullyPaid === true, order.keysDelivered === false, order.unitDelivered === false].every(Boolean);
        if (!manualSignature && ["pending_transfer", "transfer_signed", "closed"].includes(target) && formalizationCompletionTarget(order) !== target) throw new ConflictException({ code: "FORMALIZATION_COMPLETION_FLAGS_REQUIRED", message: "Avance bloqueado: revisar cuotas, unidad traspasada, llaves entregadas y unidad entregada en NetSuite para la etapa seleccionada." });
        if (before >= transferIndex && target === "pending_balance") throw new ConflictException({ code: "PENDING_BALANCE_RETURN_FORBIDDEN", message: "No se permite volver a Pendiente de saldo despues de iniciar el traspaso." });
    }

    /** La salida es obligatoria y fija el destino, también cuando el permiso de etapa es excepcional. */
    private assertPurchaseFundsRoute(before: number, after: number, command: ContractTransitionCommand, order: ContractOrder): void {
        if (before >= 2 || after < 2) return;
        const origin = command.purchaseFundsOrigin ?? order.purchaseFundsOrigin;
        if (!origin) throw new ConflictException({ code: "PURCHASE_FUNDS_ORIGIN_REQUIRED", message: "Selecciona el origen de fondos de la compra para salir de Contratos." });
        if (contractTarget(command) !== this.contractExitStage(origin)) throw new ConflictException({ code: "PURCHASE_FUNDS_ROUTE_REQUIRED", message: "La etapa de salida de Contratos debe corresponder al origen de fondos seleccionado." });
    }

    /** La evidencia del ERP puede avanzar directo a un cierre posterior. La etapa guardada cambia solo con un comando explícito. */
    private nextStage(current: string, origin: ContractOrder["purchaseFundsOrigin"], order: ContractOrder): string | undefined {
        if (["pending_balance", "pending_transfer", "transfer_signed"].includes(current)) {
            const completion = formalizationCompletionTarget(order);
            if (completion && FORMALIZATION_STAGE_CODES.indexOf(completion) > FORMALIZATION_STAGE_CODES.findIndex((code) => code === current)) return completion;
        }
        if (current === SIGNATURE) return this.contractExitStage(origin);
        return FORMALIZATION_STAGE_CODES[FORMALIZATION_STAGE_CODES.findIndex((code) => code === current) + 1];
    }

    /** Una orden financiada entra a la cola antes de que un operador empiece la gestión bancaria. */
    private contractExitStage(origin: ContractOrder["purchaseFundsOrigin"]): string {
        return origin === "own_funds" ? "pending_balance" : "bank_management";
    }

    private assertExceptionalStage(command: ContractTransitionCommand): void {
        if (command.canSkipStages !== true) throw new ForbiddenException("Se requiere permiso para saltar etapas de Formalización");
        if (!command.reason.trim()) throw new ConflictException("Se requiere un motivo para el cambio excepcional");
    }

    /** La firma observada es un requisito. No muta el ERP ni sustituye registrar el envío. */
    private assertBankingPrerequisites(order: ContractOrder, before: number, after: number): void {
        if (after < 2) return;
        if (!order.contractSigned) throw new ConflictException({ code: "CONTRACT_SIGNATURE_REQUIRED", message: "Se requiere el contrato firmado para pasar a Gestión bancaria o etapas posteriores." });
        if (before < 1) throw new ConflictException({ code: "CONTRACT_SEND_REQUIRED", message: "Primero registra el envío del contrato y completa la etapa Pendiente de firma." });
    }

    /** Una orden sin etapa guardada está pendiente de envío. La elegibilidad del contrato la abre la aprobación de formalización. */
    private currentStage(order: ContractOrder, stored?: string): string {
        if (!order.active || !order.approved) throw new ConflictException("Order requires active noncancelled status and Formalization approval");
        // La bandera de firma abre la banca. No inventa un envío anterior del CRM.
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

    /** Identidad de la bitácora: la orden vieja se audita contra su tabla vieja. El alias nativo también registra su fuente nativa efectiva. */
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
            after: { businessId: resolved.order.businessId, state: after, version: sequence + 1, purchaseFundsOrigin: command.purchaseFundsOrigin ?? resolved.order.purchaseFundsOrigin ?? null, ...(change.workflowResult ? { workflowResult: change.workflowResult } : {}) },
            allowedFields: ["businessId", "state", "version", "purchaseFundsOrigin", "workflowResult"],
            operationId: this.auditOperationId(command.operationId),
            correlationId: command.correlationId,
            reason: command.reason,
            snapshotScope: "partial",
            ...(command.ipAddress ? { ipAddress: command.ipAddress } : {}),
            ...(command.userAgent ? { userAgent: command.userAgent } : {}),
        });
    }
}
