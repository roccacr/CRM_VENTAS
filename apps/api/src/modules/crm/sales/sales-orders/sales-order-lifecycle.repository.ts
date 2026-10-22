import { BadRequestException, ConflictException, Inject, Injectable } from "@nestjs/common";
import { sql, type Transaction } from "kysely";
import { ulid } from "ulid";

import { DatabaseService } from "../../../../database/database.service.js";
import type { CrmDatabase } from "../../../../database/database.types.js";
import type { AuditActorSnapshot } from "../../audit/security-audit.service.js";

export interface LifecycleContext {
    readonly orderId: string;
    readonly actor: AuditActorSnapshot;
    readonly reason: string;
    readonly operationId: string;
    readonly correlationId: string;
}

const assertContext = (context: LifecycleContext): void => {
    const fields = [
        [context.reason, 500],
        [context.operationId, 100],
        [context.correlationId, 100],
    ] as const;
    if (!fields.every(([value, maximum]) => value.trim().length > 0 && value.length <= maximum)) throw new BadRequestException("Motivo e identificadores de operacion requeridos");
};

const assertReplay = (actual: readonly unknown[], expected: readonly unknown[]): void => {
    if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new ConflictException("Operacion reutilizada con otro contenido");
};

/** Internal persistence only. Callers must authenticate/authorize; no HTTP route exposes this repository. */
@Injectable()
export class SalesOrderLifecycleRepository {
    /** Only uses the canonical database pool. */
    constructor(@Inject(DatabaseService) private readonly database: DatabaseService) {}

    /** Locks the parent before inspecting the ledger, serializing state and approval writes. */
    private async lockOrder(tx: Transaction<CrmDatabase>, context: LifecycleContext) {
        assertContext(context);
        const order = await tx.selectFrom("crm_sales_order").select(["id_sales_order", "status_sales_order", "cancelled_sales_order"]).where("public_id_sales_order", "=", context.orderId).where("deleted_at_sales_order", "is", null).forUpdate().executeTakeFirstOrThrow();
        if (order.status_sales_order !== "active" || order.cancelled_sales_order !== "no") throw new ConflictException("La orden no esta activa o esta caida");
        const actor = await tx.selectFrom("sec_user").select("id_user").where("public_id_user", "=", context.actor.publicId).where("status_user", "=", "active").where("deleted_at_user", "is", null).executeTakeFirstOrThrow();
        return { id: order.id_sales_order, actorId: actor.id_user };
    }

    /** Records each visit independently, rejects stale callers and never overwrites history. */
    async transition(context: LifecycleContext & { readonly state: string; readonly expectedSequence: number }): Promise<number> {
        return this.database.db.transaction().execute(async (tx) => {
            const order = await this.lockOrder(tx, context);
            const repeated = await tx.selectFrom("audit_sales_order_state_event").select(["sequence_sales_order_state_event", "to_state_code_sales_order_state_event", "actor_user_id_sales_order_state_event", "reason_sales_order_state_event"]).where("sales_order_id_sales_order_state_event", "=", order.id).where("operation_id_sales_order_state_event", "=", context.operationId).executeTakeFirst();
            if (repeated) {
                assertReplay([repeated.to_state_code_sales_order_state_event, repeated.actor_user_id_sales_order_state_event, repeated.reason_sales_order_state_event], [context.state, order.actorId, context.reason]);
                return repeated.sequence_sales_order_state_event;
            }
            const last = (await tx.selectFrom("audit_sales_order_state_event").select(["sequence_sales_order_state_event", "to_state_code_sales_order_state_event"]).where("sales_order_id_sales_order_state_event", "=", order.id).orderBy("sequence_sales_order_state_event", "desc").limit(1).executeTakeFirst()) ?? { sequence_sales_order_state_event: 0, to_state_code_sales_order_state_event: null };
            const sequence = last.sequence_sales_order_state_event;
            if (sequence !== context.expectedSequence) throw new ConflictException("La orden cambio; actualice antes de continuar");
            if (last.to_state_code_sales_order_state_event === context.state) throw new ConflictException("La orden ya esta en ese estado");
            await tx
                .insertInto("audit_sales_order_state_event")
                .values({
                    public_id_sales_order_state_event: ulid(),
                    sales_order_id_sales_order_state_event: order.id,
                    sequence_sales_order_state_event: sequence + 1,
                    from_state_code_sales_order_state_event: last.to_state_code_sales_order_state_event,
                    to_state_code_sales_order_state_event: context.state,
                    event_kind_sales_order_state_event: sequence === 0 ? "created" : "transition",
                    effective_at_sales_order_state_event: sql<Date>`UTC_TIMESTAMP(3)`,
                    actor_user_id_sales_order_state_event: order.actorId,
                    actor_snapshot_sales_order_state_event: JSON.stringify(context.actor),
                    origin_sales_order_state_event: "crm",
                    reason_sales_order_state_event: context.reason,
                    operation_id_sales_order_state_event: context.operationId,
                    correlation_id_sales_order_state_event: context.correlationId,
                })
                .execute();
            await tx
                .updateTable("crm_sales_order")
                .set({ updated_at_sales_order: sql<Date>`UTC_TIMESTAMP(3)`, updated_by_user_id_sales_order: order.actorId })
                .where("id_sales_order", "=", order.id)
                .execute();
            return sequence + 1;
        });
    }

    /** Approval projection and its before/after evidence commit together under the same lock. */
    async recordApproval(context: LifecycleContext & { readonly type: string; readonly status: "approved" | "not_approved"; readonly expectedVersion: number }): Promise<number> {
        return this.database.db.transaction().execute(async (tx) => {
            const order = await this.lockOrder(tx, context);
            const repeated = await tx.selectFrom("audit_sales_order_approval_event").select(["version_sales_order_approval_event", "after_status_sales_order_approval_event", "actor_user_id_sales_order_approval_event", "reason_sales_order_approval_event"]).where("sales_order_id_sales_order_approval_event", "=", order.id).where("type_code_sales_order_approval_event", "=", context.type).where("operation_id_sales_order_approval_event", "=", context.operationId).executeTakeFirst();
            if (repeated) {
                assertReplay([repeated.after_status_sales_order_approval_event, repeated.actor_user_id_sales_order_approval_event, repeated.reason_sales_order_approval_event], [context.status, order.actorId, context.reason]);
                return repeated.version_sales_order_approval_event;
            }
            const previous = await tx.selectFrom("crm_sales_order_approval").select(["status_sales_order_approval", "version_sales_order_approval"]).where("sales_order_id_sales_order_approval", "=", order.id).where("type_code_sales_order_approval", "=", context.type).executeTakeFirst();
            const version = previous?.version_sales_order_approval ?? 0;
            if (version !== context.expectedVersion) throw new ConflictException("La aprobacion cambio; actualice antes de continuar");
            await tx
                .insertInto("audit_sales_order_approval_event")
                .values({
                    sales_order_id_sales_order_approval_event: order.id,
                    type_code_sales_order_approval_event: context.type,
                    version_sales_order_approval_event: version + 1,
                    before_status_sales_order_approval_event: previous?.status_sales_order_approval ?? null,
                    after_status_sales_order_approval_event: context.status,
                    effective_at_sales_order_approval_event: sql<Date>`UTC_TIMESTAMP(3)`,
                    actor_user_id_sales_order_approval_event: order.actorId,
                    actor_snapshot_sales_order_approval_event: JSON.stringify(context.actor),
                    origin_sales_order_approval_event: "crm",
                    reason_sales_order_approval_event: context.reason,
                    operation_id_sales_order_approval_event: context.operationId,
                    correlation_id_sales_order_approval_event: context.correlationId,
                })
                .execute();
            await tx
                .insertInto("crm_sales_order_approval")
                .values({
                    sales_order_id_sales_order_approval: order.id,
                    type_code_sales_order_approval: context.type,
                    status_sales_order_approval: context.status,
                    version_sales_order_approval: version + 1,
                    updated_at_sales_order_approval: sql<Date>`UTC_TIMESTAMP(3)`,
                    updated_by_user_id_sales_order_approval: order.actorId,
                })
                .onDuplicateKeyUpdate({
                    status_sales_order_approval: context.status,
                    version_sales_order_approval: version + 1,
                    updated_at_sales_order_approval: sql<Date>`UTC_TIMESTAMP(3)`,
                    updated_by_user_id_sales_order_approval: order.actorId,
                })
                .execute();
            await tx
                .updateTable("crm_sales_order")
                .set({ updated_at_sales_order: sql<Date>`UTC_TIMESTAMP(3)`, updated_by_user_id_sales_order: order.actorId })
                .where("id_sales_order", "=", order.id)
                .execute();
            return version + 1;
        });
    }
}
