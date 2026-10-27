import { Inject, Injectable, ServiceUnavailableException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { sql, type Transaction } from "kysely";

import type { CrmDatabase } from "../../database/database.types.js";
import type { ContractEvent, ContractEventWrite, ContractOrder, ContractTransitionLegacy } from "../../modules/crm/sales/sales-orders/contract-transition.port.js";
import { mapLegacySalesOrder } from "./sales-order.mapper.js";

/** Owner reconciliation must reject both absent and duplicate evidence at every hop. */
function uniqueOwnerEvidence<T>(rows: readonly T[]): T | undefined {
    return rows.length === 1 ? rows[0] : undefined;
}

/** Contract-only opt-in permits development as explicitly approved; catalog guards are unchanged. */
@Injectable()
export class LegacyContractTransitionWriter implements ContractTransitionLegacy {
    /** Uses validated shared configuration without creating another connection. */
    constructor(@Inject(ConfigService) private readonly config: ConfigService) {}

    /**
     * Triple gate: fallback flag, explicit write flag and the exact legacy schema name must all hold,
     * and the call must run inside the native business transaction so legacy and native writes commit together.
     */
    private assertEnabled(tx: unknown): void {
        if (this.config.get<unknown>("ENABLE_LEGACY_FALLBACK") !== true || this.config.get<unknown>("ENABLE_LEGACY_WRITES") !== true || this.config.get<unknown>("LEGACY_CRM_DB_NAME") !== "crmdatabase-api") throw new ServiceUnavailableException("Legacy contract writes are disabled; explicit ENABLE_LEGACY_WRITES and exact legacy schema are required");
        if (tx === null || typeof tx !== "object" || Reflect.get(tx, "isTransaction") !== true) throw new ServiceUnavailableException("Legacy contract writes require the native business transaction");
    }

    /** Promotion/import must take this parent lock before creating a native alias. */
    async lock(tx: Transaction<CrmDatabase>, id: string): Promise<ContractOrder | undefined> {
        this.assertEnabled(tx);
        const result = await sql<Record<string, unknown>>`SELECT id_ov, contrado_frima_ov, status_ov, caida_ov, chekJefeVenta, aprobacion__rdr_ov, aprobacion_forma_ov FROM \`crmdatabase-api\`.ordenventa WHERE id_ov = ${Number(id)} FOR UPDATE`.execute(tx);
        const row = result.rows[0];
        if (!row) return undefined;
        const mapped = mapLegacySalesOrder(row, new Date().toISOString());
        return { contractSigned: mapped.commercial.contractSigned === "yes", id: String(mapped.identity.legacyId), businessId: mapped.identity.nativeCode, active: mapped.commercial.status === "active" && mapped.commercial.cancelled === "no", approved: Object.values(mapped.approvals).every((approval) => approval === "approved") };
    }

    /** Lock current lead and employee matches before attempting canonical identity reconciliation. */
    private async ownerAdmin(tx: Transaction<CrmDatabase>, id: string) {
        const leads = await sql<{ employee: number | string | null }>`SELECT l.id_empleado_lead AS employee FROM \`crmdatabase-api\`.leads l JOIN \`crmdatabase-api\`.ordenventa o ON o.id_ov_lead=l.idinterno_lead WHERE o.id_ov=${Number(id)} FOR UPDATE`.execute(tx);
        const employee = uniqueOwnerEvidence(leads.rows)?.employee;
        if (employee == null) return undefined;
        const admins = await sql<{ id: number; email: string | null }>`SELECT id_admin AS id, email_admin AS email FROM \`crmdatabase-api\`.admins WHERE idnetsuite_admin=${employee} FOR UPDATE`.execute(tx);
        return uniqueOwnerEvidence(admins.rows);
    }

    /** Current locking reads reject duplicate lead, employee and email matches, never guess an owner. */
    async owner(tx: Transaction<CrmDatabase>, id: string): Promise<string | null> {
        this.assertEnabled(tx);
        const admin = await this.ownerAdmin(tx, id);
        if (!admin) return null;
        const email = admin.email?.trim().toLowerCase();
        if (!email) return null;
        const matches = await sql<{ id: number }>`SELECT id_admin AS id FROM \`crmdatabase-api\`.admins WHERE NULLIF(LOWER(TRIM(email_admin)),'') COLLATE utf8mb4_bin=${email} COLLATE utf8mb4_bin FOR UPDATE`.execute(tx);
        if (uniqueOwnerEvidence(matches.rows)?.id !== admin.id) return null;
        const users = await sql<{ publicId: string }>`SELECT public_id_user AS publicId FROM sec_user WHERE normalized_email_user COLLATE utf8mb4_bin=${email} COLLATE utf8mb4_bin AND deleted_at_user IS NULL FOR UPDATE`.execute(tx);
        return uniqueOwnerEvidence(users.rows)?.publicId ?? null;
    }

    /** FOR UPDATE reads current committed history after the parent lock, including alias races. */
    async event(tx: Transaction<CrmDatabase>, id: string, operationId?: string): Promise<ContractEvent | undefined> {
        this.assertEnabled(tx);
        const filter = operationId === undefined ? sql`` : sql`AND operation_id_sales_order_state_event = ${operationId}`;
        const result = await sql<{
            sequence: number;
            state: string;
            actor: string | null;
            reason: string;
        }>`SELECT sequence_sales_order_state_event AS sequence, to_state_code_sales_order_state_event AS state, actor_reference_sales_order_state_event AS actor, reason_sales_order_state_event AS reason FROM \`crmdatabase-api\`.audit_sales_order_state_event WHERE legacy_order_id_sales_order_state_event = ${Number(id)} ${filter} ORDER BY sequence_sales_order_state_event DESC LIMIT 1 FOR UPDATE`.execute(tx);
        const row = result.rows[0];
        return row ? { ...row, actor: row.actor?.startsWith("CRM_THINK_V2:") ? row.actor.slice("CRM_THINK_V2:".length) : row.actor } : undefined;
    }

    /** SQL 021 has no public event ID or native actor FK; first explicit send is a transition. */
    async append(tx: Transaction<CrmDatabase>, id: string, event: ContractEventWrite): Promise<void> {
        this.assertEnabled(tx);
        await sql`INSERT INTO \`crmdatabase-api\`.audit_sales_order_state_event
            (legacy_order_id_sales_order_state_event, sequence_sales_order_state_event, from_state_code_sales_order_state_event, to_state_code_sales_order_state_event, event_kind_sales_order_state_event, effective_at_sales_order_state_event, actor_reference_sales_order_state_event, actor_snapshot_sales_order_state_event,responsible_reference_sales_order_state_event,responsible_snapshot_sales_order_state_event,origin_sales_order_state_event, reason_sales_order_state_event, operation_id_sales_order_state_event, correlation_id_sales_order_state_event)
            VALUES (${Number(id)}, ${event.sequence}, ${event.from}, ${event.state}, 'transition', UTC_TIMESTAMP(3), ${`CRM_THINK_V2:${event.actor}`}, ${event.actorSnapshot ? JSON.stringify(event.actorSnapshot) : null},${event.responsibleSnapshot ? `CRM_THINK_V2:${event.responsibleSnapshot.publicId}` : null},${event.responsibleSnapshot ? JSON.stringify(event.responsibleSnapshot) : null},'crm', ${event.reason}, ${event.operationId}, ${event.correlationId})`.execute(tx);
    }
}
