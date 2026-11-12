import { readFileSync } from "node:fs";

import { ConfigService } from "@nestjs/config";
import { parse } from "dotenv";
import fc from "fast-check";
import { sql } from "kysely";
import { describe, expect, it } from "vitest";

import { DatabaseService } from "../../src/database/database.service.js";
import { legacyLeadReservation } from "../../src/modules/crm/marketing/marketing-reservations.query.js";

type ReservationFlags = { reserved: boolean; active: boolean; fallen: boolean; pre: boolean; preFallen: boolean; promoted: boolean; nativeActive: boolean; nativeCancelled: boolean; nativeDeleted: boolean };

function expectedReservation(flags: ReservationFlags): boolean {
    const { promoted, nativeActive, nativeCancelled, nativeDeleted, active, fallen, reserved, pre, preFallen } = flags;
    return promoted ? [nativeActive, !nativeCancelled, !nativeDeleted].every(Boolean) : active && !fallen && (reserved || (pre && !preFallen));
}

/** Solo SELECT con CTE sintéticas dentro de una transacción READ ONLY; nunca crea ni cambia tablas compartidas. */
describe.skipIf(process.env.CRM_MARKETING_RESERVATIONS_LIVE !== "true")("reservation SQL read-only fixtures", () => {
    it("respects native authority and never counts ordinary estimates or fallen reservations", async () => {
        const env = parse(readFileSync(".env"));
        expect(env.DB_NAME).toBe("CRM_THINK_V2");
        const database = new DatabaseService(new ConfigService({ ...env, DB_PORT: Number(env.DB_PORT), DB_SSL: env.DB_SSL === "true" }));
        try {
            await database.db
                .transaction()
                .setAccessMode("read only")
                .execute(async (tx) => {
                    const expression = sql`SELECT ${legacyLeadReservation(sql.lit(100))} AS reserved`.compile(tx).sql.replaceAll("`crmdatabase-api`.`ordenventa`", "fixture_orders").replaceAll("`crmdatabase-api`.`estimaciones`", "fixture_estimates").replaceAll("crm_sales_order", "fixture_native");
                    const check = async (flags: ReservationFlags) => {
                        const { reserved, active, fallen, pre, preFallen, promoted, nativeActive, nativeCancelled, nativeDeleted } = flags;
                        const result = await sql<{ reserved: number }>`WITH fixture_orders AS (
                        SELECT 10 AS id_ov,100 AS id_ov_lead,20 AS id_ov_est,${Number(reserved)} AS reserva_ov,${Number(active)} AS status_ov,${Number(fallen)} AS caida_ov
                    ), fixture_estimates AS (
                        SELECT 20 AS idEstimacion_est,100 AS idLead_est,${Number(pre)} AS pre_reserva,${Number(preFallen)} AS pre_caida
                    ), fixture_native AS (
                        SELECT 10 AS id_old_produccion_sales_order,${nativeActive ? "active" : "inactive"} AS status_sales_order,
                            ${nativeCancelled ? "yes" : "no"} AS cancelled_sales_order,${nativeDeleted ? "2026-11-11" : null} AS deleted_at_sales_order WHERE ${Number(promoted)}=1
                    ) ${sql.raw(expression)}`.execute(tx);
                        const expected = expectedReservation(flags);
                        expect(Number(result.rows[0]?.reserved)).toBe(Number(expected));
                    };
                    const base = { reserved: true, active: true, fallen: false, pre: false, preFallen: false, promoted: true, nativeActive: true, nativeCancelled: false, nativeDeleted: false };
                    await check({ ...base, nativeCancelled: true });
                    await check({ ...base, nativeActive: false });
                    await check({ ...base, nativeDeleted: true });
                    await fc.assert(fc.asyncProperty(fc.record({ reserved: fc.boolean(), active: fc.boolean(), fallen: fc.boolean(), pre: fc.boolean(), preFallen: fc.boolean(), promoted: fc.boolean(), nativeActive: fc.boolean(), nativeCancelled: fc.boolean(), nativeDeleted: fc.boolean() }), check), { seed: 20261111, numRuns: 60 });
                });
        } finally {
            await database.onModuleDestroy();
        }
    }, 60000);
});
