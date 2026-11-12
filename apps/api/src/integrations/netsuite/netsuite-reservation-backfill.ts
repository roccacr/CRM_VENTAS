import { createHash } from "node:crypto";

import { HttpException } from "@nestjs/common";
import { z } from "zod";

export const reservationBackfillId = z.string().regex(/^[1-9][0-9]{0,19}$/);
export interface ReservationBackfillResult {
    id: string;
    result: "updated" | "omitted" | "failed";
    attempts: number;
    reason?: string;
}
function failureReason(error: unknown): string {
    if (error instanceof HttpException) return "http_" + String(error.getStatus());
    if (error instanceof z.ZodError) return "invalid_snapshot";
    if (error instanceof Error && Reflect.get(error, "code") === "ER_BAD_FIELD_ERROR") return "schema_missing";
    return "sync_failed";
}
/** Una sola llamada simultánea. El cliente RESTlet existente conserva OAuth, timeout y límites de respuesta.
 * El diario se confirma por orden antes de seguir; un fallo no impide procesar el resto del lote.
 */
export async function backfillReservationBatch(
    ids: readonly string[],
    dependencies: {
        synchronize(id: string): Promise<"applied" | "unchanged" | "not_found">;
        record(result: ReservationBackfillResult): Promise<void>;
        pause(milliseconds: number): Promise<void>;
    },
): Promise<ReservationBackfillResult[]> {
    const selected = z.array(z.string().max(180)).max(50).parse(ids);
    const results: ReservationBackfillResult[] = [];
    for (const id of new Set(selected)) {
        if (!reservationBackfillId.safeParse(id).success) {
            const invalid: ReservationBackfillResult = { id: "invalid:" + createHash("sha256").update(id).digest("hex").slice(0, 12), result: "omitted", attempts: 0, reason: "invalid_id" };
            await dependencies.record(invalid);
            results.push(invalid);
            continue;
        }
        let outcome: ReservationBackfillResult = { id, result: "failed", attempts: 0 };
        for (let attempt = 1; attempt <= 3; attempt++) {
            await dependencies.pause(1000 * attempt);
            try {
                const result = await dependencies.synchronize(id);
                outcome = { id, result: result === "applied" ? "updated" : "omitted", attempts: attempt };
                break;
            } catch (error) {
                // No volcar snapshots, datos de clientes ni excepciones del proveedor en el diario.
                outcome = { id, result: "failed", attempts: attempt, reason: failureReason(error) };
            }
        }
        await dependencies.record(outcome);
        results.push(outcome);
    }
    return results;
}
