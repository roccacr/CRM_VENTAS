import "dotenv/config";

import { createHash } from "node:crypto";
import { appendFile, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { parseArgs } from "node:util";

import { ConfigService } from "@nestjs/config";
import { sql } from "kysely";
import { z } from "zod";

import { validateEnv } from "../src/config/env.validation.js";
import { DatabaseService } from "../src/database/database.service.js";
import { verifiedOrderEventFromSnapshot } from "../src/integrations/netsuite/netsuite-order-event.contract.js";
import { NetsuiteOrderEventRepository } from "../src/integrations/netsuite/netsuite-order-event.repository.js";
import { assertCursorTimestamps, NetsuiteOrderEventService, orderSnapshotHash } from "../src/integrations/netsuite/netsuite-order-event.service.js";
import { backfillReservationBatch, reservationBackfillId } from "../src/integrations/netsuite/netsuite-reservation-backfill.js";
import { NetsuiteRestletClient } from "../src/integrations/netsuite/netsuite-restlet.client.js";
import { RecordAuditService } from "../src/modules/crm/audit/record-audit.service.js";

type Options = { apply: boolean; output?: string | undefined; retry?: string | undefined };
type Runtime = ReturnType<typeof runtime>;

async function failedIds(path: string | undefined): Promise<string[] | undefined> {
    if (!path) return undefined;
    return (await readFile(resolve(path), "utf8"))
        .split(/\r?\n/)
        .filter(Boolean)
        .map((line) => z.object({ id: z.string(), result: z.string() }).parse(JSON.parse(line)))
        .filter((row) => row.result === "failed")
        .map((row) => reservationBackfillId.parse(row.id));
}

function runtime(database: DatabaseService, config: ConfigService) {
    const client = new NetsuiteRestletClient(config);
    const repository = new NetsuiteOrderEventRepository(database, config, new RecordAuditService(database, config));
    const environment = config.getOrThrow<"production" | "sandbox">("NETSUITE_ENVIRONMENT");
    const context = { environment, accountId: environment === "production" ? "4552704" : "4552704_SB1" };
    const source = sql`SELECT x.external_id_sales_order_external_reference AS netsuiteId FROM crm_sales_order_external_reference x JOIN int_external_system s ON s.id_external_system=x.external_system_id_sales_order_external_reference WHERE s.code_external_system='netsuite' ${config.get<boolean>("ENABLE_LEGACY_FALLBACK") === true ? sql`UNION SELECT CAST(id_ov_netsuite AS CHAR) FROM \`crmdatabase-api\`.ordenventa WHERE id_ov_netsuite IS NOT NULL` : sql``}`;
    return {
        enabled: new NetsuiteOrderEventService(repository, config).synchronizationEnabled(environment),
        read: async (cursor: string) => (await sql<{ netsuiteId: string }>`SELECT netsuiteId FROM (${source}) source WHERE netsuiteId>${cursor} ORDER BY netsuiteId LIMIT 50`.execute(database.db)).rows.map((row) => row.netsuiteId),
        synchronize: async (id: string) => {
            const event = verifiedOrderEventFromSnapshot(await client.readSalesOrderSnapshot(id), id, context);
            assertCursorTimestamps(event.event);
            const result = await repository.applyReservationSnapshot(event, { payloadHash: createHash("sha256").update(JSON.stringify(event)).digest("hex"), snapshotHash: orderSnapshotHash(event.snapshot.data.fields) });
            if (result.result === "stale") throw new Error("stale");
            return result.result;
        },
    };
}

async function prepareRun(target: Runtime, options: Options): Promise<string> {
    if (options.apply && !target.enabled) throw new Error("La persistencia NetSuite no está habilitada para este ambiente.");
    const output = options.output ? resolve(options.output) : "";
    if (options.apply && !output) throw new Error("--apply requiere --output para conservar los resultados.");
    if (options.apply) await writeFile(output, "", { flag: "wx" });
    return output;
}

async function executeBatches(target: Runtime, options: Options): Promise<void> {
    const output = await prepareRun(target, options);
    const retry = await failedIds(options.retry);
    const totals = { updated: 0, omitted: 0, failed: 0, selected: 0 };
    let cursor = "";
    for (;;) {
        const ids = retry ? retry.slice(totals.selected, totals.selected + 50) : await target.read(cursor);
        const last = ids.at(-1);
        if (last === undefined) break;
        totals.selected += ids.length;
        if (options.apply)
            await backfillReservationBatch(ids, {
                synchronize: target.synchronize,
                record: async (result) => {
                    await appendFile(output, JSON.stringify(result) + "\n");
                    totals[result.result]++;
                    process.stdout.write(JSON.stringify(result) + "\n");
                },
                pause: (milliseconds) => new Promise((done) => setTimeout(done, milliseconds)),
            });
        cursor = last;
    }
    process.stdout.write(JSON.stringify({ dryRun: !options.apply, ...totals }) + "\n");
    if (totals.failed) process.exitCode = 1;
}

/** No inicia Nest ni trabajadores; tampoco aplica DDL. --apply habilita exclusivamente este backfill. */
async function main(): Promise<void> {
    const { values } = parseArgs({ options: { apply: { type: "boolean", default: false }, output: { type: "string" }, retry: { type: "string" } }, strict: true });
    const config = new ConfigService(validateEnv(process.env));
    const database = new DatabaseService(config);
    try {
        await executeBatches(runtime(database, config), values);
    } finally {
        await database.onModuleDestroy();
    }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href)
    void main().catch(() => {
        process.stderr.write("Resincronización detenida. Revisa el diario; no se publican credenciales ni respuestas del proveedor.\n");
        process.exitCode = 1;
    });
