import "dotenv/config";

import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { parseArgs } from "node:util";

import { ConfigService } from "@nestjs/config";
import { z } from "zod";

import { type PersistedOrderEvent, verifiedOrderEventFromSnapshot } from "../src/integrations/netsuite/netsuite-order-event.contract.js";
import { NetsuiteRestletClient } from "../src/integrations/netsuite/netsuite-restlet.client.js";

const idSchema = z.string().regex(/^[1-9][0-9]{0,14}$/);
const receiptSchema = z.object({ schemaVersion: z.literal(2), received: z.literal(true), persisted: z.boolean(), netsuiteId: idSchema, eventId: z.uuid(), result: z.enum(["applied", "unchanged", "not_found"]), importQueued: z.boolean().optional() });
type RetryResult = { id: string; result: "applied" | "unchanged" | "import_queued" | "failed"; httpStatus?: number };

/** HTTP 200 no basta: el recibo debe corresponder a esta orden, este evento y un COMMIT o encolado durable. */
async function confirmedReceipt(response: Response, event: PersistedOrderEvent): Promise<RetryResult> {
    const id = event.event.netsuiteId;
    if (response.status !== 200) {
        await response.body?.cancel();
        return { id, result: "failed", httpStatus: response.status };
    }
    const receipt = receiptSchema
        .extend({ netsuiteId: z.literal(id), eventId: z.literal(event.event.eventId) })
        .refine((value) => (value.result === "not_found" ? !value.persisted && value.importQueued === true : value.persisted))
        .parse(await response.json());
    return { id, result: receipt.result === "not_found" ? "import_queued" : receipt.result, httpStatus: 200 };
}

/** El JSON es evidencia, nunca código ni un payload para repetir. Solo se extraen IDs de eventos fallidos y se deduplican. */
export function failedOrderIds(input: unknown): string[] {
    const rows = z
        .array(z.object({ Detalles: z.string() }))
        .max(10000)
        .parse(input);
    const ids = new Set<string>();
    for (const row of rows) {
        const detail: unknown = JSON.parse(row.Detalles);
        const event = z.object({ recordType: z.string(), delivered: z.boolean(), netsuiteId: z.string().optional() }).parse(detail);
        if (event.recordType === "salesorder" && !event.delivered) ids.add(idSchema.parse(event.netsuiteId));
    }
    return [...ids];
}

/** Una foto fresca por orden, entrega secuencial y recibo correlacionado. No abre conexiones SQL ni crea usuarios. */
export async function retryOrderEvents(ids: readonly string[], read: (id: string) => Promise<unknown>, send: (event: PersistedOrderEvent) => Promise<Response>) {
    const results: RetryResult[] = [];
    const selected = z.array(idSchema).max(10000).parse(ids);
    for (const id of new Set(selected)) {
        try {
            const event = verifiedOrderEventFromSnapshot(await read(id), id, { accountId: "4552704", environment: "production" });
            results.push(await confirmedReceipt(await send(event), event));
        } catch {
            // No registrar respuestas crudas, snapshots, credenciales ni mensajes del proveedor.
            results.push({ id, result: "failed" });
        }
    }
    return results;
}

async function main() {
    const { values } = parseArgs({ options: { input: { type: "string" }, output: { type: "string" }, apply: { type: "boolean", default: false } }, strict: true });
    if (!values.input) throw new Error("Indica --input; --apply autoriza la sincronización real en producción.");
    const input: unknown = JSON.parse(await readFile(resolve(values.input), "utf8"));
    const ids = failedOrderIds(input);
    if (!values.apply) {
        process.stdout.write(JSON.stringify({ dryRun: true, count: ids.length, ids }) + "\n");
        return;
    }
    if (!values.output) throw new Error("La ejecución real requiere --output para conservar el resultado.");
    const secret = process.env.NETSUITE_PRODUCTION_EVENTS_SECRET;
    if (!secret || !/^[a-f0-9]{64}$/.test(secret)) throw new Error("Falta la credencial de producción en el entorno del proceso.");
    const output = resolve(values.output);
    await writeFile(output, JSON.stringify({ at: new Date().toISOString(), status: "started", ids }) + "\n", { flag: "wx" });
    // Selección explícita de la cuenta real autorizada: no altera .env ni la configuración del API local.
    const client = new NetsuiteRestletClient(new ConfigService({ ...process.env, FRONTEND_ORIGIN: "https://habita.roccacr.com", NETSUITE_ENVIRONMENT: "production" }));
    const results = await retryOrderEvents(
        ids,
        (id) => client.readSalesOrderSnapshot(id),
        (event) => fetch("https://api-habita.rdghub.com/integrations/netsuite/production/order-events", { method: "POST", redirect: "error", headers: { Authorization: "Bearer " + secret, "Content-Type": "application/json" }, body: JSON.stringify(event), signal: AbortSignal.timeout(60000) }),
    );
    const report = { at: new Date().toISOString(), results };
    await writeFile(output, JSON.stringify(report, null, 2) + "\n");
    process.stdout.write(JSON.stringify(report) + "\n");
    if (results.some((result) => result.result === "failed")) process.exitCode = 1;
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
    void main().catch(() => {
        process.stderr.write("La recuperación no pudo completarse. Revisa la configuración y el informe; no se muestran credenciales.\n");
        process.exitCode = 1;
    });
}
