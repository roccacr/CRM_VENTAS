import { Inject, Injectable, ServiceUnavailableException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { sql, type Transaction } from "kysely";

import type { CrmDatabase } from "../../database/database.types.js";
import type { AddendumOrder, AddendumStatus, SalesOrderAddendumLegacy } from "../../modules/crm/sales/sales-orders/sales-order-addendum.port.js";

/**
 * Marcador de adendum en la orden vieja. Cambia estado, version, fecha y nota.
 * No envia correo, no llama al ERP y no mueve el estado del lead.
 *
 * No usa la compuerta de catalogos ni exige `NODE_ENV`. La lectura pide fallback,
 * el esquema exacto y una transaccion. La escritura suma `ENABLE_LEGACY_WRITES`.
 * Con el fallback apagado, el conteo es cero y no consulta.
 */
@Injectable()
export class LegacySalesOrderAddendumWriter implements SalesOrderAddendumLegacy {
    /** Solo la configuracion. La conexion es la transaccion nativa. */
    constructor(@Inject(ConfigService) private readonly config: ConfigService) {}

    /** `Object(tx)` hace que un nulo falle por `isTransaction` en vez de reventar al leer la propiedad. */

    private assertEnabled(tx: unknown, write: boolean): void {
        if (Reflect.get(Object(tx) as object, "isTransaction") !== true || this.config.get<unknown>("ENABLE_LEGACY_FALLBACK") !== true || this.config.get<unknown>("LEGACY_CRM_DB_NAME") !== "crmdatabase-api" || (write && this.config.get<unknown>("ENABLE_LEGACY_WRITES") !== true)) throw new ServiceUnavailableException("La gestión de adéndum en la fuente antigua no está habilitada.");
    }

    /** Solo cuenta pendientes activos no promovidos; una fuente deshabilitada aporta cero de forma explícita. */
    async countPending(tx: Transaction<CrmDatabase>): Promise<number> {
        if (this.config.get<unknown>("ENABLE_LEGACY_FALLBACK") !== true) return 0;
        this.assertEnabled(tx, false);
        const row = (
            await sql<{
                total: string | number;
            }>`SELECT COUNT(*) AS total FROM \`crmdatabase-api\`.ordenventa o WHERE o.status_ov=1 AND o.caida_ov=0 AND o.estado_adendum_ov='pending' AND NOT EXISTS(SELECT 1 FROM crm_sales_order n WHERE n.id_old_produccion_sales_order=o.id_ov OR EXISTS(SELECT 1 FROM crm_sales_order_external_reference x JOIN int_external_system s ON s.id_external_system=x.external_system_id_sales_order_external_reference WHERE x.sales_order_id_sales_order_external_reference=n.id_sales_order AND x.external_id_sales_order_external_reference=CAST(o.id_ov AS CHAR) AND s.code_external_system='legacy_crm' AND s.status_external_system='active' AND x.status_sales_order_external_reference='active'))`.execute(
                tx,
            )
        ).rows[0];
        const total = Number(row?.total);
        if (!Number.isSafeInteger(total) || total < 0) throw new ServiceUnavailableException("No fue posible contar los adéndums pendientes.");
        return total;
    }

    /** El lead se adjunta solo si hay exactamente una fila para ese `idinterno_lead`. Cero o varias lo dejan nulo. */
    async read(tx: Transaction<CrmDatabase>, id: string, lock: boolean): Promise<AddendumOrder | undefined> {
        this.assertEnabled(tx, false);
        const ending = lock ? sql`FOR UPDATE` : sql``;
        const row = (await sql<Omit<AddendumOrder, "source" | "lead"> & { leadErpId: number | null }>`SELECT CAST(id_ov AS CHAR) AS id,CAST(id_ov AS CHAR) AS internalId,(status_ov=1 AND caida_ov=0) AS active,estado_adendum_ov AS status,version_adendum_ov AS version,DATE_FORMAT(fecha_adendum_ov,'%Y-%m-%dT%H:%i:%s.%fZ') AS changedAt,nota_adendum_ov AS note,id_ov_lead AS leadErpId FROM \`crmdatabase-api\`.ordenventa WHERE id_ov=${Number(id)} ${ending}`.execute(tx)).rows[0];
        if (!row) return undefined;
        const leads = row.leadErpId === null ? [] : (await sql<{ id: string }>`SELECT CAST(id_lead AS CHAR) AS id FROM \`crmdatabase-api\`.leads WHERE idinterno_lead=${row.leadErpId} ${ending}`.execute(tx)).rows;
        return { ...row, active: Number(row.active) === 1, source: "legacy", lead: leads.length === 1 && leads[0] ? { source: "legacy", id: leads[0].id } : null };
    }

    /** La fecha se guarda sin la T, en los primeros 23 caracteres. No toca otras columnas de la orden. */
    async write(tx: Transaction<CrmDatabase>, order: AddendumOrder, next: { status: AddendumStatus; version: number; changedAt: string; note: string | null }): Promise<void> {
        this.assertEnabled(tx, true);
        await sql`UPDATE \`crmdatabase-api\`.ordenventa SET estado_adendum_ov=${next.status},version_adendum_ov=${next.version},fecha_adendum_ov=${next.changedAt.slice(0, 23).replace("T", " ")},nota_adendum_ov=${next.note} WHERE id_ov=${Number(order.internalId)}`.execute(tx);
    }
}
