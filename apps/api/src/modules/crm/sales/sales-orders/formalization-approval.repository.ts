import { createHash } from "node:crypto";

import { ConflictException, ForbiddenException, Inject, Injectable, NotFoundException, ServiceUnavailableException } from "@nestjs/common";
import { sql, type Transaction } from "kysely";
import { ulid } from "ulid";

import { FORMALIZATION_APPROVAL_RECONCILIATION_RESPONSE } from "../../../../common/http-error.responses.js";
import { DatabaseService } from "../../../../database/database.service.js";
import type { CrmDatabase } from "../../../../database/database.types.js";
import type { AuditActorSnapshot } from "../../audit/audit-actor.js";
import { RecordAuditService } from "../../audit/record-audit.service.js";
import { FORMALIZATION_APPROVAL_ERP, FORMALIZATION_APPROVAL_LEGACY, type FormalizationApprovalCommand, type FormalizationApprovalErp, type FormalizationApprovalLegacy, type LegacyApprovalOrder } from "./formalization-approval.port.js";

interface ResolvedApproval extends LegacyApprovalOrder {
    source: "native" | "legacy";
    publicId: string;
    leadId: number | null;
    approvalVersion: number;
}
interface ApprovalChange {
    order: ResolvedApproval;
    actorId: number;
    actor: AuditActorSnapshot;
    command: FormalizationApprovalCommand;
    sequence: number;
    previousState: string | null;
    reason: string;
}
const PENDING_SEND = "contract_pending_send";

/** Bloquea la autoridad durante la confirmación del ERP. La marca local, el estado y la bitácora comparten un commit. */
@Injectable()
export class FormalizationApprovalRepository {
    /** Una transacción canónica y los puertos del dominio para el ERP y la persistencia vieja. */
    constructor(
        @Inject(DatabaseService) private readonly database: DatabaseService,
        @Inject(RecordAuditService) private readonly audit: RecordAuditService,
        @Inject(FORMALIZATION_APPROVAL_LEGACY) private readonly legacy: FormalizationApprovalLegacy,
        @Inject(FORMALIZATION_APPROVAL_ERP) private readonly erp: FormalizationApprovalErp,
    ) {}

    /** El ERP no entra en la transacción de MySQL. Un fallo después de confirmar exige una conciliación explícita. */
    async approve(command: FormalizationApprovalCommand) {
        if (!this.audit.enabled) throw new ServiceUnavailableException("La aprobación requiere bitácora habilitada.");
        const progress = { erpConfirmed: false };
        try {
            return await this.database.db.transaction().execute((tx) => this.execute(tx, command, progress));
        } catch (error) {
            if (progress.erpConfirmed) throw new ServiceUnavailableException(FORMALIZATION_APPROVAL_RECONCILIATION_RESPONSE);
            throw error;
        }
    }

    private async execute(tx: Transaction<CrmDatabase>, command: FormalizationApprovalCommand, progress: { erpConfirmed: boolean }) {
        const order = await this.resolve(tx, command);
        this.assertBusinessState(order);
        await this.assertScope(tx, order, command);
        const actor = await tx.selectFrom("sec_user").select("id_user").where("public_id_user", "=", command.actorPublicId).where("status_user", "=", "active").where("deleted_at_user", "is", null).executeTakeFirstOrThrow();
        const operationId = createHash("sha256")
            .update(JSON.stringify(["sales_order", "formalization_approval", command.operationId]))
            .digest("hex");
        const replay = await this.replay(tx, order, command, operationId);
        if (replay) return replay;
        const last = await this.lastState(tx, order);
        const { sequence, recordStage, state, nextSequence, previousState } = this.stagePlan(last);
        this.assertVersionAndStage(order, command, sequence, previousState);
        const snapshot = await this.audit.captureActor(tx, actor.id_user);
        const confirmation = await this.erp.approveFormalization(order.netsuiteId);
        if (confirmation.id !== order.netsuiteId) throw new ServiceUnavailableException("NetSuite no confirmó la aprobación de esta orden.");
        progress.erpConfirmed = true;
        // Aunque la marca ya estaba sincronizada, se registra esta confirmación externa. No se inventa un cambio de etapa.
        const localChange = order.formalization !== "approved" || recordStage;
        const reason = `Aprobación de Formalización confirmada en NetSuite ${confirmation.environment}; ID ${order.netsuiteId}; ${confirmation.alreadyApproved ? "ya estaba aprobada" : "marcada por el CRM"}.`;
        const change = { order, actorId: actor.id_user, actor: snapshot, command, sequence, previousState, reason };
        if (localChange) await this.persist(tx, change, recordStage);
        await this.audit.append(tx, {
            source: this.source(order),
            actor: snapshot,
            action: localChange ? "approval_change" : "annotation",
            module: "formalizacion",
            before: { type: "formalization", status: order.formalization, state: previousState ?? "pending_approval", version: sequence },
            after: { type: "formalization", status: "approved", state, version: nextSequence },
            allowedFields: ["type", "status", "state", "version"],
            operationId,
            correlationId: command.correlationId,
            reason,
            snapshotScope: "partial",
        });
        return { ...this.result(order, state, nextSequence, false), alreadyApproved: confirmation.alreadyApproved };
    }

    private stagePlan(last: { sequence: number; state: string } | undefined) {
        const sequence = last?.sequence ?? 0;
        const previousState = last?.state ?? null;
        const recordStage = previousState === null || ["pending_approval", "unclassified"].includes(previousState);
        return { sequence, previousState, recordStage, state: recordStage ? PENDING_SEND : previousState, nextSequence: sequence + Number(recordStage) };
    }

    private assertBusinessState(order: ResolvedApproval) {
        if (!order.active) throw new ConflictException({ statusCode: 409, code: "CRM_SALES_ORDER_UNAVAILABLE", message: "La orden está inactiva o marcada como venta caída en el CRM." });
        if (!order.prerequisitesApproved) throw new ConflictException({ statusCode: 409, code: "CRM_APPROVAL_PREREQUISITES_REQUIRED", message: "En el CRM faltan las aprobaciones de Jefe de Ventas y/o Desarrolladora." });
        if (order.approvalVersion >= 4294967295) throw new ConflictException("Versión de aprobación agotada.");
    }

    private assertVersionAndStage(order: ResolvedApproval, command: FormalizationApprovalCommand, sequence: number, state: string | null) {
        if (sequence !== command.expectedSequence || sequence >= 4294967295) throw new ConflictException("La orden cambió. Actualiza antes de aprobar.");
        if (order.formalization !== "approved" && state && !["pending_approval", "unclassified"].includes(state)) throw new ConflictException("La etapa actual no permite aprobar Formalización.");
    }

    private async replay(tx: Transaction<CrmDatabase>, order: ResolvedApproval, command: FormalizationApprovalCommand, operationId: string) {
        const row = await tx
            .selectFrom("audit_record as r")
            .innerJoin("audit_record_event as e", "e.record_id_record_event", "r.id_record")
            .select(["e.source_schema_record_event", "e.source_id_record_event", "e.actor_reference_record_event", "e.before_record_event", "e.after_record_event"])
            .where("r.source_schema_record", "=", this.source(order).schema)
            .where("r.entity_type_record", "=", "sales_order")
            .where("r.source_table_record", "=", this.source(order).table)
            .where("r.source_id_record", "=", order.id)
            .where("e.operation_id_record_event", "=", operationId)
            .forUpdate()
            .executeTakeFirst();
        if (!row) return undefined;
        const before = this.snapshot(row.before_record_event);
        const after = this.snapshot(row.after_record_event);
        const matches = [row.source_schema_record_event === this.source(order).schema, row.source_id_record_event === order.id, row.actor_reference_record_event === command.actorPublicId, before.version === command.expectedSequence];
        if (!matches.every(Boolean) || typeof after.version !== "number" || typeof after.state !== "string") throw new ConflictException("Operación reutilizada con otro contenido.");
        return this.result(order, after.state, after.version, true);
    }

    private async persist(tx: Transaction<CrmDatabase>, change: ApprovalChange, recordStage: boolean) {
        if (change.order.source === "native") await this.approveNative(tx, change);
        else await this.legacy.approveFormalization(tx, change.order.id);
        if (recordStage) await this.appendStage(tx, change);
    }

    private snapshot(value: unknown): Record<string, unknown> {
        const data: unknown = typeof value === "string" ? JSON.parse(value) : value;
        return data && typeof data === "object" && !Array.isArray(data) ? (data as Record<string, unknown>) : {};
    }

    /** Un alias nativo, incluso inactivo o borrado, tapa lo viejo. Promover bloquea primero el padre viejo. */
    private async resolve(tx: Transaction<CrmDatabase>, command: FormalizationApprovalCommand): Promise<ResolvedApproval> {
        let legacy: LegacyApprovalOrder | undefined;
        if (command.source === "legacy") {
            const probe = await tx.selectFrom("crm_sales_order").select("id_sales_order").where("id_old_produccion_sales_order", "=", Number(command.id)).executeTakeFirst();
            if (!probe) legacy = await this.legacy.lockApproval(tx, command.id);
        }
        const order = await tx
            .selectFrom("crm_sales_order")
            .select(["id_sales_order", "public_id_sales_order", "lead_id_sales_order", "status_sales_order", "cancelled_sales_order", "deleted_at_sales_order"])
            .where(command.source === "native" ? "public_id_sales_order" : "id_old_produccion_sales_order", "=", command.source === "native" ? command.id : Number(command.id))
            .forUpdate()
            .executeTakeFirst();
        if (!order) {
            if (!legacy) throw new NotFoundException({ statusCode: 404, code: "CRM_SALES_ORDER_NOT_FOUND", message: "Orden no encontrada en el CRM." });
            this.assertReference(legacy.netsuiteId);
            return { ...legacy, source: "legacy", publicId: legacy.id, leadId: null, approvalVersion: 0 };
        }
        return this.resolveNative(tx, order);
    }

    private async resolveNative(tx: Transaction<CrmDatabase>, order: { id_sales_order: number; public_id_sales_order: string; lead_id_sales_order: number | null; status_sales_order: string; cancelled_sales_order: string; deleted_at_sales_order: Date | null }): Promise<ResolvedApproval> {
        const approvals = await tx.selectFrom("crm_sales_order_approval").select(["type_code_sales_order_approval", "status_sales_order_approval", "version_sales_order_approval"]).where("sales_order_id_sales_order_approval", "=", order.id_sales_order).forUpdate().execute();
        const formalization = approvals.find((row) => row.type_code_sales_order_approval === "formalization");
        const refs = await tx
            .selectFrom("crm_sales_order_external_reference as x")
            .innerJoin("int_external_system as s", "s.id_external_system", "x.external_system_id_sales_order_external_reference")
            .select("x.external_id_sales_order_external_reference as netsuiteId")
            .where("x.sales_order_id_sales_order_external_reference", "=", order.id_sales_order)
            .where("s.code_external_system", "=", "netsuite")
            .where("s.status_external_system", "=", "active")
            .where("x.status_sales_order_external_reference", "=", "active")
            .limit(2)
            .forUpdate()
            .execute();
        const netsuiteId = refs[0]?.netsuiteId;
        if (refs.length !== 1 || !netsuiteId) throw new ConflictException("Referencia NetSuite ausente o ambigua.");
        this.assertReference(netsuiteId);
        return {
            source: "native",
            id: String(order.id_sales_order),
            publicId: order.public_id_sales_order,
            leadId: order.lead_id_sales_order,
            netsuiteId,
            active: [order.status_sales_order === "active", order.cancelled_sales_order === "no", order.deleted_at_sales_order === null].every(Boolean),
            prerequisitesApproved: ["sales_management", "developer"].every((type) => approvals.some((row) => row.type_code_sales_order_approval === type && row.status_sales_order_approval === "approved")),
            formalization: formalization?.status_sales_order_approval ?? "unknown",
            approvalVersion: formalization?.version_sales_order_approval ?? 0,
        };
    }

    private assertReference(id: string) {
        if (!/^[1-9][0-9]*$/.test(id) || !Number.isSafeInteger(Number(id))) throw new ConflictException("Referencia NetSuite inválida.");
    }

    private async assertScope(tx: Transaction<CrmDatabase>, order: ResolvedApproval, command: FormalizationApprovalCommand) {
        if (!command.ownOnly) return;
        const owner =
            order.source === "legacy"
                ? await this.legacy.owner(tx, order.id)
                : (
                      await tx
                          .selectFrom("crm_lead")
                          .innerJoin("sec_user", "sec_user.id_user", "crm_lead.owner_user_id_lead")
                          .select("sec_user.public_id_user")
                          .where("crm_lead.id_lead", "=", order.leadId ?? -1)
                          .where("crm_lead.deleted_at_lead", "is", null)
                          .where("sec_user.deleted_at_user", "is", null)
                          .forUpdate()
                          .executeTakeFirst()
                  )?.public_id_user;
        if (owner !== command.actorPublicId) throw new ForbiddenException("La orden está fuera de su alcance.");
    }

    private async lastState(tx: Transaction<CrmDatabase>, order: ResolvedApproval) {
        if (order.source === "legacy") return this.legacy.event(tx, order.id);
        const row = await tx.selectFrom("audit_sales_order_state_event").select(["sequence_sales_order_state_event as sequence", "to_state_code_sales_order_state_event as state"]).where("sales_order_id_sales_order_state_event", "=", Number(order.id)).orderBy("sequence_sales_order_state_event", "desc").forUpdate().limit(1).executeTakeFirst();
        return row;
    }

    private source(order: ResolvedApproval) {
        return { schema: order.source === "native" ? ("CRM_THINK_V2" as const) : ("crmdatabase-api" as const), entity: "sales_order", table: order.source === "native" ? "crm_sales_order" : "ordenventa", id: order.id };
    }

    private result(order: ResolvedApproval, state: string, sequence: number, replayed: boolean) {
        return { source: order.source, id: order.publicId, approved: true as const, state, sequence, replayed };
    }

    private async approveNative(tx: Transaction<CrmDatabase>, change: ApprovalChange) {
        const { order, actorId, actor, command, reason } = change;
        if (order.formalization === "approved") return;
        const version = order.approvalVersion + 1;
        await tx
            .insertInto("crm_sales_order_approval")
            .values({ sales_order_id_sales_order_approval: Number(order.id), type_code_sales_order_approval: "formalization", status_sales_order_approval: "approved", version_sales_order_approval: version, updated_by_user_id_sales_order_approval: actorId })
            .onDuplicateKeyUpdate({ status_sales_order_approval: "approved", version_sales_order_approval: version, updated_by_user_id_sales_order_approval: actorId, updated_at_sales_order_approval: sql<Date>`UTC_TIMESTAMP(3)` })
            .execute();
        await tx
            .insertInto("audit_sales_order_approval_event")
            .values({
                sales_order_id_sales_order_approval_event: Number(order.id),
                type_code_sales_order_approval_event: "formalization",
                version_sales_order_approval_event: version,
                before_status_sales_order_approval_event: order.formalization,
                after_status_sales_order_approval_event: "approved",
                effective_at_sales_order_approval_event: sql<Date>`UTC_TIMESTAMP(3)`,
                actor_user_id_sales_order_approval_event: actorId,
                actor_snapshot_sales_order_approval_event: JSON.stringify(actor),
                origin_sales_order_approval_event: "crm",
                reason_sales_order_approval_event: reason,
                operation_id_sales_order_approval_event: command.operationId,
                correlation_id_sales_order_approval_event: command.correlationId,
            })
            .execute();
        await tx
            .updateTable("crm_sales_order")
            .set({ updated_at_sales_order: sql<Date>`UTC_TIMESTAMP(3)`, updated_by_user_id_sales_order: actorId })
            .where("id_sales_order", "=", Number(order.id))
            .execute();
    }

    private async appendStage(tx: Transaction<CrmDatabase>, change: ApprovalChange) {
        const { order, actorId, actor, command, sequence, previousState, reason } = change;
        const event = { sequence: sequence + 1, from: sequence === 0 ? null : previousState, state: PENDING_SEND, actor: actor.publicId, actorSnapshot: actor, responsibleSnapshot: actor, reason, operationId: command.operationId, correlationId: command.correlationId };
        if (order.source === "legacy") return this.legacy.append(tx, order.id, event);
        await tx
            .insertInto("audit_sales_order_state_event")
            .values({
                public_id_sales_order_state_event: ulid(),
                sales_order_id_sales_order_state_event: Number(order.id),
                sequence_sales_order_state_event: event.sequence,
                from_state_code_sales_order_state_event: event.from,
                to_state_code_sales_order_state_event: PENDING_SEND,
                event_kind_sales_order_state_event: sequence === 0 ? "created" : "transition",
                effective_at_sales_order_state_event: sql<Date>`UTC_TIMESTAMP(3)`,
                actor_user_id_sales_order_state_event: actorId,
                actor_snapshot_sales_order_state_event: JSON.stringify(actor),
                responsible_user_id_sales_order_state_event: actorId,
                responsible_snapshot_sales_order_state_event: JSON.stringify(actor),
                origin_sales_order_state_event: "crm",
                reason_sales_order_state_event: reason,
                operation_id_sales_order_state_event: command.operationId,
                correlation_id_sales_order_state_event: command.correlationId,
            })
            .execute();
    }
}
