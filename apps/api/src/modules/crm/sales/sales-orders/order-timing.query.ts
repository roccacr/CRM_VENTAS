import { type RawBuilder, sql, type Transaction } from "kysely";
import { z } from "zod";

import type { CrmDatabase } from "../../../../database/database.types.js";
import { aggregateNumber } from "./home-summary.types.js";
import { type TimingPage, type TimingPagination, timingPerson } from "./order-timing.contract.js";

const nullableDate = z.iso.datetime().nullable();
const seconds = z.number().nonnegative().max(Number.MAX_SAFE_INTEGER).nullable();
const boolean = z.union([z.boolean(), z.literal(0), z.literal(1)]).transform(Boolean);
const jsonValue = (value: unknown): unknown => (typeof value === "string" ? (JSON.parse(value) as unknown) : value);
const summarySchema = z.object({ startedAt: nullableDate, finishedAt: nullableDate, totalSeconds: seconds, knownSeconds: z.number().nonnegative().max(Number.MAX_SAFE_INTEGER), complete: boolean });
const visitSchema = z.object({ sequence: z.number().int().positive(), code: z.string(), label: z.string(), enteredAt: nullableDate, leftAt: nullableDate, seconds, isCurrent: boolean, recordedAt: z.iso.datetime(), actorSnapshot: z.unknown(), actorReference: z.unknown(), responsibleSnapshot: z.unknown(), responsibleReference: z.unknown() });
/** Las ventanas se calculan en SQL sobre el registro completo. Por HTTP sale solo la página de visitas pedida. */
export async function readOrderTiming(tx: Transaction<CrmDatabase>, tables: { view: RawBuilder<unknown>; states: RawBuilder<unknown> }, id: string, page: TimingPagination): Promise<TimingPage> {
    const { view, states } = tables;
    const result = await sql<Record<string, unknown>>`
        WITH visits AS (SELECT v.*,COALESCE(s.name_sales_order_state,v.state_code) AS label FROM ${view} v
            LEFT JOIN ${states} s ON s.code_sales_order_state=v.state_code WHERE v.order_id=${id}),
        paged AS (SELECT * FROM visits ORDER BY sequence LIMIT ${page.limit} OFFSET ${page.offset})
        SELECT /*+ MAX_EXECUTION_TIME(3000) */ COUNT(*) AS total,
            JSON_OBJECT('startedAt',DATE_FORMAT(MAX(process_started_at),'%Y-%m-%dT%H:%i:%s.000Z'),
                'finishedAt',DATE_FORMAT(MAX(process_finished_at),'%Y-%m-%dT%H:%i:%s.000Z'),
                'totalSeconds',MAX(total_duration_seconds),'knownSeconds',COALESCE(SUM(duration_seconds),0),
                'complete',COUNT(*)>0 AND COUNT(process_started_at)=COUNT(*) AND COUNT(duration_seconds)=COUNT(*)) AS summary,
            (SELECT COALESCE(JSON_ARRAYAGG(JSON_OBJECT('sequence',sequence,'code',state_code,'label',label,
                'enteredAt',DATE_FORMAT(entered_at,'%Y-%m-%dT%H:%i:%s.000Z'),'leftAt',DATE_FORMAT(left_at,'%Y-%m-%dT%H:%i:%s.000Z'),
                'seconds',duration_seconds,'isCurrent',is_current,'recordedAt',DATE_FORMAT(recorded_at,'%Y-%m-%dT%H:%i:%s.000Z'),
                'actorReference',actor_reference,'actorSnapshot',actor_snapshot,'responsibleReference',responsible_reference,'responsibleSnapshot',responsible_snapshot)),JSON_ARRAY()) FROM paged) AS items
        FROM visits`.execute(tx);
    const row = result.rows[0];
    if (!row) throw new Error("Missing order timing result");
    const summary = summarySchema.parse(jsonValue(row.summary));
    const items = z
        .array(visitSchema)
        .max(100)
        .parse(jsonValue(row.items))
        .sort((a, b) => a.sequence - b.sequence)
        .map((visit) => ({
            sequence: visit.sequence,
            state: { code: visit.code, label: visit.label },
            enteredAt: visit.enteredAt,
            leftAt: visit.leftAt,
            seconds: visit.seconds,
            isCurrent: visit.isCurrent,
            changedBy: timingPerson(visit.actorSnapshot, visit.actorReference),
            responsible: timingPerson(visit.responsibleSnapshot, visit.responsibleReference),
            recordedAt: visit.recordedAt,
        }));
    return { total: aggregateNumber(row.total as string | number | null), summary, items };
}
