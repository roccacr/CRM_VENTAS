import { Inject, Injectable, ServiceUnavailableException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { sql, type Transaction } from "kysely";

import type { CrmDatabase } from "../../database/database.types.js";
import type { ContractEvent, ContractEventWrite, ContractOrder, ContractTransitionLegacy } from "../../modules/crm/sales/sales-orders/contract-transition.port.js";
import { mapLegacySalesOrder } from "./sales-order.mapper.js";

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
        const result = await sql<Record<string, unknown>>`SELECT id_ov, status_ov, caida_ov, chekJefeVenta, aprobacion__rdr_ov, aprobacion_forma_ov FROM \`crmdatabase-api\`.ordenventa WHERE id_ov = ${Number(id)} FOR UPDATE`.execute(tx);
        const row = result.rows[0];
        if (!row) return undefined;
        const mapped = mapLegacySalesOrder(row, new Date().toISOString());
        return { id: String(mapped.identity.legacyId), businessId: mapped.identity.nativeCode, active: mapped.commercial.status === "active" && mapped.commercial.cancelled === "no", approved: Object.values(mapped.approvals).every((approval) => approval === "approved") };
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
            (legacy_order_id_sales_order_state_event, sequence_sales_order_state_event, from_state_code_sales_order_state_event, to_state_code_sales_order_state_event, event_kind_sales_order_state_event, effective_at_sales_order_state_event, actor_reference_sales_order_state_event, origin_sales_order_state_event, reason_sales_order_state_event, operation_id_sales_order_state_event, correlation_id_sales_order_state_event)
            VALUES (${Number(id)}, ${event.sequence}, ${event.from}, ${event.state}, 'transition', UTC_TIMESTAMP(3), ${`CRM_THINK_V2:${event.actor}`}, 'crm', ${event.reason}, ${event.operationId}, ${event.correlationId})`.execute(tx);
    }
}
