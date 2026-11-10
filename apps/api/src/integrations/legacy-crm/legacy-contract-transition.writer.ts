import { Inject, Injectable, ServiceUnavailableException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { sql, type Transaction } from "kysely";

import type { CrmDatabase } from "../../database/database.types.js";
import type { ContractEvent, ContractEventWrite, ContractOrder, ContractTransitionLegacy } from "../../modules/crm/sales/sales-orders/contract-transition.port.js";
import type { FormalizationApprovalLegacy, LegacyApprovalOrder } from "../../modules/crm/sales/sales-orders/formalization-approval.port.js";
import { mapLegacySalesOrder } from "./sales-order.mapper.js";

/** Solo 1 es verdadero y solo 0 es falso. Cualquier otro valor queda nulo: desconocido no es "sin marcar". */
const completionFlag = (value: unknown): boolean | null => {
    if (value === 1) return true;
    if (value === 0) return false;
    return null;
};

/** Cero filas o mas de una anulan el dueno. No se elige la primera. */
function uniqueOwnerEvidence<T>(rows: readonly T[]): T | undefined {
    return rows.length === 1 ? rows[0] : undefined;
}

/**
 * Escritor de transicion de contrato y de aprobacion de formalizacion.
 *
 * No usa la compuerta de catalogos y no exige `NODE_ENV=production`. Exige
 * fallback, el nombre exacto `crmdatabase-api` y, salvo lectura, `ENABLE_LEGACY_WRITES`.
 * Todo corre dentro de la transaccion nativa. Desarrollo puede escribir solo
 * si esas banderas estan encendidas a proposito.
 */
@Injectable()
export class LegacyContractTransitionWriter implements ContractTransitionLegacy, FormalizationApprovalLegacy {
    /** Solo cambia el origen de fondos, y solo a `own_funds` o `bank_financing`. El llamador ya bloqueo la orden. */
    async updatePurchaseFunds(tx: Transaction<CrmDatabase>, id: string, origin: "own_funds" | "bank_financing"): Promise<void> {
        this.assertEnabled(tx);
        await sql`UPDATE \`crmdatabase-api\`.ordenventa SET origen_fondos_compra_ov=${origin} WHERE id_ov=${Number(id)}`.execute(tx);
    }
    /** Lee la configuracion. No abre pool: la conexion es la transaccion nativa. */
    constructor(@Inject(ConfigService) private readonly config: ConfigService) {}

    /**
     * Apagado es 503, no un no-op. La lectura tambien exige fallback y el esquema
     * exacto. La mutacion suma `ENABLE_LEGACY_WRITES`. Sin `isTransaction` no corre:
     * las dos bases tienen que confirmar juntas.
     */
    private assertEnabled(tx: unknown, readOnly = false): void {
        if ([this.config.get<unknown>("ENABLE_LEGACY_FALLBACK") !== true, !readOnly && this.config.get<unknown>("ENABLE_LEGACY_WRITES") !== true, this.config.get<unknown>("LEGACY_CRM_DB_NAME") !== "crmdatabase-api"].some(Boolean)) throw new ServiceUnavailableException("Legacy contract writes are disabled; explicit ENABLE_LEGACY_WRITES and exact legacy schema are required");
        if (tx === null || typeof tx !== "object" || Reflect.get(tx, "isTransaction") !== true) throw new ServiceUnavailableException("Legacy contract writes require the native business transaction");
    }

    /** `FOR UPDATE` antes de promover. Los nombres fisicos se conservan, incluido `contrado_frima_ov`. */
    async lock(tx: Transaction<CrmDatabase>, id: string, readOnly = false): Promise<ContractOrder | undefined> {
        this.assertEnabled(tx, readOnly);
        const result = await sql<Record<string, unknown>>`SELECT id_ov, contrado_frima_ov, status_ov, caida_ov, chekJefeVenta, aprobacion__rdr_ov, aprobacion_forma_ov, origen_fondos_compra_ov, cuotas_pagadas_completo_ov, unidad_traspasada_ov, entrega_llaves_ov, unidad_entregada_ov FROM \`crmdatabase-api\`.ordenventa WHERE id_ov = ${Number(id)} FOR UPDATE`.execute(tx);
        const row = result.rows[0];
        if (!row) return undefined;
        const mapped = mapLegacySalesOrder(row, new Date().toISOString());
        return {
            installmentsFullyPaid: completionFlag(row.cuotas_pagadas_completo_ov),
            unitTransferred: completionFlag(row.unidad_traspasada_ov),
            keysDelivered: completionFlag(row.entrega_llaves_ov),
            unitDelivered: completionFlag(row.unidad_entregada_ov),
            purchaseFundsOrigin: row.origen_fondos_compra_ov === "own_funds" || row.origen_fondos_compra_ov === "bank_financing" ? row.origen_fondos_compra_ov : null,
            available: mapped.commercial.status === "active",
            saleLost: mapped.commercial.cancelled === "yes",
            contractSigned: mapped.commercial.contractSigned === "yes",
            id: String(mapped.identity.legacyId),
            businessId: mapped.identity.nativeCode,
            active: mapped.commercial.status === "active" && mapped.commercial.cancelled === "no",
            approved: mapped.approvals.formalization === "approved",
        };
    }

    /** Bloquea la orden antes de confirmar el ERP. Activa es status 1 y caida 0. Formalizacion 1, 0 o desconocida. */
    async lockApproval(tx: Transaction<CrmDatabase>, id: string): Promise<LegacyApprovalOrder | undefined> {
        this.assertEnabled(tx);
        const { rows } = await sql<{ id: string; netsuiteId: string; active: number; prerequisitesApproved: number; formalization: number | null }>`
            SELECT CAST(id_ov AS CHAR) AS id,CAST(id_ov_netsuite AS CHAR) AS netsuiteId,
                (status_ov=1 AND caida_ov=0) AS active,
                (chekJefeVenta=1 AND aprobacion__rdr_ov=1) AS prerequisitesApproved,
                aprobacion_forma_ov AS formalization
            FROM \`crmdatabase-api\`.ordenventa WHERE id_ov=${Number(id)} FOR UPDATE`.execute(tx);
        const row = rows[0];
        return row ? { ...row, active: row.active === 1, prerequisitesApproved: row.prerequisitesApproved === 1, formalization: row.formalization === 1 ? "approved" : row.formalization === 0 ? "not_approved" : "unknown" } : undefined;
    }

    /** Solo pone `aprobacion_forma_ov=1`. El llamador ya confirmo el resultado del ERP. */
    async approveFormalization(tx: Transaction<CrmDatabase>, id: string): Promise<void> {
        this.assertEnabled(tx);
        await sql`UPDATE \`crmdatabase-api\`.ordenventa SET aprobacion_forma_ov=1 WHERE id_ov=${Number(id)}`.execute(tx);
    }

    /** Bloquea lead y admin. Cero o varias coincidencias cortan el dueno antes de mirar el correo. */
    private async ownerAdmin(tx: Transaction<CrmDatabase>, id: string) {
        const leads = await sql<{ employee: number | string | null }>`SELECT l.id_empleado_lead AS employee FROM \`crmdatabase-api\`.leads l JOIN \`crmdatabase-api\`.ordenventa o ON o.id_ov_lead=l.idinterno_lead WHERE o.id_ov=${Number(id)} FOR UPDATE`.execute(tx);
        const employee = uniqueOwnerEvidence(leads.rows)?.employee;
        if (employee == null) return undefined;
        const admins = await sql<{ id: number; email: string | null }>`SELECT id_admin AS id, email_admin AS email FROM \`crmdatabase-api\`.admins WHERE idnetsuite_admin=${employee} FOR UPDATE`.execute(tx);
        return uniqueOwnerEvidence(admins.rows);
    }

    /**
     * El correo se compara en `utf8mb4_bin` despues de recortar y pasar a minusculas.
     * Otro admin con el mismo correo, o mas de un usuario nativo, deja el dueno en nulo.
     */
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

    /** Lee el ultimo evento ya confirmado, con el padre bloqueado. Al devolver el actor le quita el prefijo `CRM_THINK_V2:`. */
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

    /**
     * Inserta la transicion de auditoria. Actor y responsable salen con prefijo
     * `CRM_THINK_V2:`. La hora es `UTC_TIMESTAMP(3)`. Esta tabla no tiene id
     * publico ni llave al usuario nativo.
     */
    async append(tx: Transaction<CrmDatabase>, id: string, event: ContractEventWrite): Promise<void> {
        this.assertEnabled(tx);
        if (event.purchaseFundsOrigin) await sql`UPDATE \`crmdatabase-api\`.ordenventa SET origen_fondos_compra_ov=${event.purchaseFundsOrigin} WHERE id_ov=${Number(id)}`.execute(tx);
        await sql`INSERT INTO \`crmdatabase-api\`.audit_sales_order_state_event
            (legacy_order_id_sales_order_state_event, sequence_sales_order_state_event, from_state_code_sales_order_state_event, to_state_code_sales_order_state_event, event_kind_sales_order_state_event, effective_at_sales_order_state_event, actor_reference_sales_order_state_event, actor_snapshot_sales_order_state_event,responsible_reference_sales_order_state_event,responsible_snapshot_sales_order_state_event,origin_sales_order_state_event, reason_sales_order_state_event, operation_id_sales_order_state_event, correlation_id_sales_order_state_event)
            VALUES (${Number(id)}, ${event.sequence}, ${event.from}, ${event.state}, 'transition', UTC_TIMESTAMP(3), ${`CRM_THINK_V2:${event.actor}`}, ${event.actorSnapshot ? JSON.stringify(event.actorSnapshot) : null},${event.responsibleSnapshot ? `CRM_THINK_V2:${event.responsibleSnapshot.publicId}` : null},${event.responsibleSnapshot ? JSON.stringify(event.responsibleSnapshot) : null},'crm', ${event.reason}, ${event.operationId}, ${event.correlationId})`.execute(tx);
    }
}
