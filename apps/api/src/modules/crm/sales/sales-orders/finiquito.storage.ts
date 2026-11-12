import { sql, type Transaction } from "kysely";

import type { CrmDatabase } from "../../../../database/database.types.js";
import type { FiniquitoFlags } from "./finiquito.policy.js";

export const finiquitoFields = {
    native: {
        balanceValidated: ["balance_validated_sales_order", "balance_validated_by_sales_order", "balance_validated_at_sales_order"],
        sent: ["finiquito_sent_sales_order", "finiquito_sent_by_sales_order", "finiquito_sent_at_sales_order"],
        received: ["finiquito_received_sales_order", "finiquito_received_by_sales_order", "finiquito_received_at_sales_order"],
    },
    legacy: {
        balanceValidated: ["saldo_validado_ov", "saldo_validado_por_ov", "saldo_validado_fecha_ov"],
        sent: ["finiquito_enviado_ov", "finiquito_enviado_por_ov", "finiquito_enviado_fecha_ov"],
        received: ["finiquito_recibido_ov", "finiquito_recibido_por_ov", "finiquito_recibido_fecha_ov"],
    },
} as const;
export interface FiniquitoTarget {
    source: "native" | "legacy";
    id: string;
}
function storage(target: FiniquitoTarget) {
    return target.source === "native" ? { table: "crm_sales_order", key: "id_sales_order" } : { table: "crmdatabase-api.ordenventa", key: "id_ov" };
}
/** Foto financiera bajo el mismo bloqueo de la orden; el indicador de reserva no participa en estos SET. */
export async function readFiniquitoFlags(tx: Transaction<CrmDatabase>, target: FiniquitoTarget): Promise<FiniquitoFlags> {
    const { table, key } = storage(target);
    const fields = finiquitoFields[target.source];
    const { rows } = await sql<Record<string, unknown>>`SELECT ${sql.ref(fields.balanceValidated[0])} AS balanceValidated,${sql.ref(fields.sent[0])} AS sent,${sql.ref(fields.received[0])} AS received FROM ${sql.table(table)} WHERE ${sql.ref(key)}=${target.id} FOR UPDATE`.execute(tx);
    const row = rows[0];
    if (!row || !Object.values(row).every((value) => value === 0 || value === 1)) throw new Error("Estado financiero inválido o ausente.");
    return { balanceValidated: row.balanceValidated === 1, sent: row.sent === 1, received: row.received === 1 };
}
/** Marca única con autor de sesión y hora UTC del servidor SQL. El llamador decide transición y auditoría. */
export async function markFiniquitoFlag(tx: Transaction<CrmDatabase>, target: FiniquitoTarget, field: keyof FiniquitoFlags, actor: string): Promise<void> {
    const { table, key } = storage(target);
    const [flag, by, at] = finiquitoFields[target.source][field];
    await sql`UPDATE ${sql.table(table)} SET ${sql.ref(flag)}=1,${sql.ref(by)}=${actor},${sql.ref(at)}=UTC_TIMESTAMP(3) WHERE ${sql.ref(key)}=${target.id}`.execute(tx);
}

/** Reconciliar conserva atribución de checks que siguen marcados; al revertir limpia su marca, nunca la historia. */
export async function setFiniquitoFlags(tx: Transaction<CrmDatabase>, target: FiniquitoTarget, flags: FiniquitoFlags, actor: string): Promise<void> {
    const { table, key } = storage(target);
    const assignments = (Object.keys(flags) as (keyof FiniquitoFlags)[]).flatMap((field) => {
        const [flag, by, at] = finiquitoFields[target.source][field];
        const enabled = flags[field];
        return [sql`${sql.ref(by)}=CASE WHEN ${enabled}=0 THEN NULL WHEN ${sql.ref(flag)}=1 THEN ${sql.ref(by)} ELSE ${actor} END`, sql`${sql.ref(at)}=CASE WHEN ${enabled}=0 THEN NULL WHEN ${sql.ref(flag)}=1 THEN ${sql.ref(at)} ELSE UTC_TIMESTAMP(3) END`, sql`${sql.ref(flag)}=${enabled ? 1 : 0}`];
    });
    await sql`UPDATE ${sql.table(table)} SET ${sql.join(assignments)} WHERE ${sql.ref(key)}=${target.id}`.execute(tx);
}

/** Los pasos normales marcan una sola casilla; la reconciliación ajusta la combinación completa. */
export function persistFiniquitoPlan(tx: Transaction<CrmDatabase>, target: FiniquitoTarget, plan: { flag: keyof FiniquitoFlags | null; flags: FiniquitoFlags; actor: string }): Promise<void> {
    return plan.flag ? markFiniquitoFlag(tx, target, plan.flag, plan.actor) : setFiniquitoFlags(tx, target, plan.flags, plan.actor);
}
