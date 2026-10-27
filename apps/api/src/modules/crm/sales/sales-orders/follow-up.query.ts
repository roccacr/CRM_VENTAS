import { type RawBuilder, sql, type Transaction } from "kysely";
import { z } from "zod";

import type { CrmDatabase } from "../../../../database/database.types.js";
import { type FollowUpAccess, type FollowUpCounts, type FollowUpQueue, followUpQueues, type FollowUpRead, followUpRow, type FollowUpSourcePage } from "./follow-up.contract.js";
import { aggregateNumber } from "./home-summary.types.js";

/** Both sources project the same aliases before filtering; all search values remain bound. */
export function followUpSourceQuery(base: RawBuilder<unknown>, query: FollowUpRead, access: FollowUpAccess) {
    const stages: Record<Exclude<FollowUpQueue, "all">, RawBuilder<unknown>> = {
        approvals: sql`approvalPending=1`,
        contracts: sql`approved=1 AND stateCode IN ('contract_pending_send','contract_pending_signature')`,
        send: sql`approved=1 AND stateCode='contract_pending_send'`,
        signature: sql`approved=1 AND stateCode='contract_pending_signature'`,
        bank: sql`contractSigned=1 AND stateCode='bank_management'`,
        balance: sql`contractSigned=1 AND stateCode='pending_balance'`,
        transfer: sql`contractSigned=1 AND stateCode='pending_transfer'`,
        signed: sql`contractSigned=1 AND stateCode='transfer_signed'`,
        closed: sql`contractSigned=1 AND completedThisYear=1`,
    };
    // "Todas" is the union of banner memberships, not every active sales order.
    // OR counts a reopened order once even when its annual closure also qualifies.
    const matches: Record<FollowUpQueue, RawBuilder<unknown>> = { ...stages, all: sql`(${sql.join(Object.values(stages), sql` OR `)})` };
    const recordId = query.recordId ?? "";
    const legacyId = recordId.startsWith("legacy:") ? recordId.slice(7) : "";
    const search = query.search.toLocaleLowerCase("es");
    return sql<Record<string, unknown>>`
        WITH base AS (${base}), classified AS (
            SELECT base.*,CASE
                WHEN approved=1 AND COALESCE(rawStage,'contract_pending_send') IN ('unclassified','pending_approval','contract_pending_send') THEN 'contract_pending_send'
                WHEN rawStage IN ('contract_pending_signature','bank_management','pending_balance','pending_transfer','transfer_signed','closed') THEN rawStage
                WHEN approvalPending=1 THEN 'pending_approval' ELSE 'unclassified' END AS stateCode
            FROM base
        ), visible AS (
            SELECT * FROM classified WHERE (${!access.ownOnly} OR ownerId=${access.actorId})
                AND (approvalPending=0 OR (${access.approvals} AND (${!access.approvalOwnOnly} OR ownerId=${access.actorId})))
                AND ${matches.all}
        ), searched AS (
            SELECT * FROM visible WHERE (${recordId}='' OR id=${recordId}
                OR (source='native' AND id IN (SELECT public_id_sales_order FROM crm_sales_order WHERE id_old_produccion_sales_order=${legacyId})))
                AND (${query.projectId}='' OR projectId=${query.projectId})
                AND (${search}='' OR LOCATE(${search},LOWER(CONCAT_WS(' ',number,client,projectName,unit,ownerName)))>0)
        ), filtered AS (SELECT * FROM searched WHERE ${matches[query.queue]}),
        paged AS (SELECT * FROM filtered ORDER BY sortId LIMIT ${query.limit} OFFSET ${query.offset}),
        projects AS (SELECT projectId AS id,MAX(projectName) AS name FROM visible WHERE projectId IS NOT NULL AND projectName IS NOT NULL GROUP BY projectId)
        SELECT /*+ MAX_EXECUTION_TIME(5000) */
            (SELECT COUNT(*) FROM filtered) AS total,
            ${sql.join(followUpQueues.map((queue) => sql`COALESCE(SUM(${matches[queue]}),0) AS ${sql.ref(queue)}`))},
            (SELECT COALESCE(JSON_ARRAYAGG(JSON_OBJECT('id',id,'name',name)),JSON_ARRAY()) FROM projects) AS projects,
            (SELECT COALESCE(JSON_ARRAYAGG(JSON_OBJECT('sortId',CAST(sortId AS CHAR),'id',id,'source',source,'number',number,'nativeCode',nativeCode,
                'client',client,'clientEmail',clientEmail,'project',IF(projectId IS NULL,NULL,JSON_OBJECT('id',projectId,'name',projectName)),
                'unit',unit,'seller',IF(ownerName IS NULL,NULL,JSON_OBJECT('id',ownerId,'name',ownerName)),
                'responsible',IF(stageResponsibleName IS NULL,NULL,JSON_OBJECT('id',stageResponsibleId,'name',stageResponsibleName)),
                'changedBy',IF(changedByName IS NULL,NULL,JSON_OBJECT('id',changedById,'name',changedByName)),
                'stateCode',stateCode,'stateSince',IF(rawStage=stateCode,DATE_FORMAT(effectiveAt,'%Y-%m-%dT%H:%i:%s.000Z'),NULL),
                'stateVersion',stateVersion,'approvalsComplete',approved,'contractSigned',contractSigned,
                'completedThisYear',completedThisYear)),JSON_ARRAY()) FROM paged) AS items
        FROM searched`;
}

/** mysql2 may decode JSON columns or leave them as text; validate either representation. */
const jsonValue = (value: unknown): unknown => (typeof value === "string" ? JSON.parse(value) : value);
const projectedRow = followUpRow.extend({ sortId: z.string().regex(/^[1-9][0-9]*$/) });
/** Query returns all counts but at most one page of records; internal sort IDs never reach HTTP. */
export async function readFollowUpSource(tx: Transaction<CrmDatabase>, statement: RawBuilder<Record<string, unknown>>): Promise<FollowUpSourcePage> {
    const result = await statement.execute(tx);
    const row = result.rows[0];
    if (!row) throw new Error("Missing follow-up source result");
    const counts = Object.fromEntries(followUpQueues.map((queue) => [queue, aggregateNumber(row[queue] as string | number | null)])) as FollowUpCounts;
    const items = z
        .array(projectedRow)
        .max(100)
        .parse(jsonValue(row.items))
        .sort((a, b) => (BigInt(a.sortId) < BigInt(b.sortId) ? -1 : BigInt(a.sortId) > BigInt(b.sortId) ? 1 : 0))
        .map((item) => followUpRow.parse(item));
    const projects = z
        .array(z.object({ id: z.string().min(1), name: z.string().min(1) }))
        .max(5000)
        .parse(jsonValue(row.projects));
    return { total: aggregateNumber(row.total as string | number | null), counts, projects, items };
}
