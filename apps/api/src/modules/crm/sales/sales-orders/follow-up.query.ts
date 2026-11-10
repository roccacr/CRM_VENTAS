import { type RawBuilder, sql, type Transaction } from "kysely";
import { z } from "zod";

import type { CrmDatabase } from "../../../../database/database.types.js";
import { type FollowUpAccess, type FollowUpCounts, type FollowUpQueue, followUpQueues, type FollowUpRead, followUpRow, type FollowUpSourcePage } from "./follow-up.contract.js";
import { aggregateNumber } from "./home-summary.types.js";
import { type DistributionKey, distributionKeys } from "./project-distribution.contract.js";

/** Shared field and state projections keep exact records identical to list items. */
const followUpClassification = sql`CASE
                WHEN approved=1 AND COALESCE(rawStage,'contract_pending_send') IN ('unclassified','pending_approval','contract_pending_send') THEN 'contract_pending_send'
                WHEN rawStage IN ('contract_pending_signature','bank_management','bank_management_in_progress','pending_balance','pending_transfer','transfer_signed','closed') THEN rawStage
                WHEN approvalPending=1 THEN 'pending_approval' ELSE 'unclassified' END`;
const followUpRowProjection = sql`JSON_OBJECT('sortId',CAST(sortId AS CHAR),'id',id,'source',source,'number',number,'nativeCode',nativeCode,
                'client',client,'clientEmail',clientEmail,'project',IF(projectId IS NULL,NULL,JSON_OBJECT('id',projectId,'name',projectName)),
                'unit',unit,'seller',IF(ownerName IS NULL,NULL,JSON_OBJECT('id',ownerId,'name',ownerName)),
                'responsible',IF(stageResponsibleName IS NULL,NULL,JSON_OBJECT('id',stageResponsibleId,'name',stageResponsibleName)),
                'changedBy',IF(changedByName IS NULL,NULL,JSON_OBJECT('id',changedById,'name',changedByName)),
                'stateCode',stateCode,'stateSince',IF(rawStage=stateCode,DATE_FORMAT(effectiveAt,'%Y-%m-%dT%H:%i:%s.000Z'),NULL),
                'stateVersion',stateVersion,'approvalsComplete',approved,'contractSigned',contractSigned,'saleLost',saleLost,'addendumStatus',addendumStatus,
                'salesManagementApproved',salesManagementApproved,'developerApproved',developerApproved,'formalizationApproved',formalizationApproved,
                'commercialClosureSigned',commercialClosureSigned,'contractSignedCheck',contractSignedCheck,'saleLostCheck',saleLostCheck,
                'unitTransferred',unitTransferred,'keysDelivered',keysDelivered,'unitDelivered',unitDelivered,'installmentsFullyPaid',installmentsFullyPaid,'purchaseFundsOrigin',purchaseFundsOrigin,'completedThisYear',completedThisYear)`;

/** Shared exact banner predicates preserve independent annual closure and addendum membership. */
function followUpMatches(access: FollowUpAccess) {
    const queuePermissions = { ...access.queues };
    const stages: Record<Exclude<FollowUpQueue, "all">, RawBuilder<unknown>> = {
        approvals: sql`(${access.approvals} AND approvalPending=1)`,
        contracts: sql`approved=1 AND stateCode IN ('contract_pending_send','contract_pending_signature')`,
        send: sql`approved=1 AND stateCode='contract_pending_send'`,
        signature: sql`approved=1 AND stateCode='contract_pending_signature'`,
        bank: sql`contractSigned=1 AND stateCode IN ('bank_management','bank_management_in_progress')`,
        balance: sql`contractSigned=1 AND stateCode='pending_balance'`,
        transfer: sql`contractSigned=1 AND stateCode='pending_transfer'`,
        signed: sql`contractSigned=1 AND stateCode='transfer_signed'`,
        closed: sql`contractSigned=1 AND completedThisYear=1`,
        addendum: sql`(${queuePermissions.addendum === true} AND addendumStatus='pending')`,
    };
    const visibility = { ...stages };
    stages.transfer = sql`contractSigned=1 AND stateCode='pending_transfer' AND installmentsFullyPaid=1 AND unitTransferred=0 AND unitDelivered=0`;
    // La firma registrada manualmente aparece mientras NetSuite confirma el traspaso.
    stages.signed = sql`contractSigned=1 AND stateCode='transfer_signed' AND installmentsFullyPaid=1 AND keysDelivered=0 AND unitDelivered=0`;
    stages.closed = sql`contractSigned=1 AND completedThisYear=1 AND unitDelivered=1`;
    for (const queue of Object.keys(stages) as Exclude<FollowUpQueue, "all">[]) {
        const key = queue === "send" || queue === "signature" ? "contracts" : queue;
        if (access.queues) {
            stages[queue] = sql`(${access.queues[key] === true} AND (${stages[queue]}))`;
            visibility[queue] = sql`(${access.queues[key] === true} AND (${visibility[queue]}))`;
        }
        stages[queue] = sql`(saleLost=0 AND ${stages[queue]})`;
        visibility[queue] = sql`(saleLost=0 AND ${visibility[queue]})`;
    }
    // Lost sales remain reachable in All for their independent finiquito, never in active-sale queues.
    const canReadLost = access.finiquito === true;
    // Stored-stage visibility keeps unsupported flag combinations available for review in "Todas".
    // OR counts a reopened order once even when its annual closure also qualifies.
    const matches: Record<FollowUpQueue, RawBuilder<unknown>> = { ...stages, all: sql`((${sql.join(Object.values(visibility), sql` OR `)}) OR (${canReadLost} AND saleLost=1 AND contractSigned=1))` };
    return matches;
}

/** Both sources share filters and a global project/unit order before LIMIT. The ordinal survives unordered JSON aggregation. */
export function followUpSourceQuery(base: RawBuilder<unknown>, query: FollowUpRead, access: FollowUpAccess) {
    const matches = followUpMatches(access);
    const { selectedProjects, selectionPredicate } = selectedFollowUpFilters(query, matches);
    const recordId = query.recordId ?? "";
    const legacyId = recordId.startsWith("legacy:") ? recordId.slice(7) : "";
    const search = query.search.toLocaleLowerCase("es");
    return sql<Record<string, unknown>>`
        WITH base AS (${base}), classified AS (
            SELECT base.*,${followUpClassification} AS stateCode
            FROM base
        ), visible AS (
            SELECT * FROM classified WHERE (${!access.ownOnly} OR ownerId=${access.actorId})
                AND ${matches.all}
        ), searched AS (
            SELECT * FROM visible WHERE (${recordId}='' OR id=${recordId}
                OR (source='native' AND id IN (SELECT public_id_sales_order FROM crm_sales_order WHERE id_old_produccion_sales_order=${legacyId})))
                AND ${selectedProjects}
                AND (${search}='' OR LOCATE(${search},LOWER(CONCAT_WS(' ',number,client,projectName,unit,ownerName)))>0)
        ), filtered AS (SELECT * FROM searched WHERE ${selectionPredicate}),
        ranked AS (SELECT filtered.*,ROW_NUMBER() OVER (ORDER BY projectName IS NULL,projectName,unit IS NULL,unit,source,sortId,id) AS pageOrdinal FROM filtered),
        paged AS (SELECT * FROM ranked ORDER BY pageOrdinal LIMIT ${query.limit} OFFSET ${query.offset}),
        projects AS (SELECT projectId AS id,COALESCE(MAX(CASE WHEN source='native' THEN projectName END),MAX(projectName)) AS name FROM visible WHERE projectId IS NOT NULL AND projectName IS NOT NULL GROUP BY projectId)
        SELECT /*+ MAX_EXECUTION_TIME(5000) */
            COALESCE(SUM(${access.queues?.bank !== false} AND saleLost=0 AND contractSigned=1 AND stateCode='bank_management_in_progress'),0) AS bankInProgress,
            (SELECT COUNT(*) FROM filtered) AS total,
            (SELECT COUNT(*) FROM filtered WHERE source='native') AS nativeTotal,
            (SELECT COUNT(*) FROM filtered WHERE source='legacy') AS legacyTotal,
            ${sql.join(followUpQueues.map((queue) => sql`COALESCE(SUM(${matches[queue]}),0) AS ${sql.ref(queue)}`))},
            (SELECT COALESCE(JSON_ARRAYAGG(JSON_OBJECT('id',id,'name',name)),JSON_ARRAY()) FROM projects) AS projects,
            (SELECT COALESCE(JSON_ARRAYAGG(JSON_SET(${followUpRowProjection},'$.pageOrdinal',CAST(pageOrdinal AS CHAR))),JSON_ARRAY()) FROM paged) AS items
        FROM searched`;
}

/** Multi-selection is an OR within each filter and an AND across projects/queues. */
function selectedFollowUpFilters(query: FollowUpRead, matches: Record<FollowUpQueue, RawBuilder<unknown>>) {
    const projectIds = query.projectIds?.length ? [...new Set(query.projectIds)] : [query.projectId].filter(Boolean);
    const selectedQueues = query.queues?.length ? [...new Set(query.queues)] : [query.queue];
    const selected = selectedQueues.map((queue) => (queue === "bank" && query.bankStages?.length ? sql`(${matches.bank} AND stateCode IN (${sql.join(query.bankStages)}))` : matches[queue]));
    const selectionPredicate = selected.length === 1 ? selected[0] : sql`(${sql.join(selected, sql` OR `)})`;
    const selectedProjects = projectIds.length ? sql`projectId IN (${sql.join(projectIds)})` : sql`TRUE`;
    return { selectedProjects, selectionPredicate };
}

/** mysql2 may decode JSON columns or leave them as text; validate either representation. */
const jsonValue = (value: unknown): unknown => (typeof value === "string" ? JSON.parse(value) : value);
const projectedRow = followUpRow.extend({ sortId: z.string().regex(/^[1-9][0-9]*$/), pageOrdinal: z.string().regex(/^[1-9][0-9]*$/) });
/** Query returns all counts but at most one page of records; internal sort IDs never reach HTTP. */
export async function readFollowUpSource(tx: Transaction<CrmDatabase>, statement: RawBuilder<Record<string, unknown>>): Promise<FollowUpSourcePage & { sourceTotals: { native: number; legacy: number } }> {
    const result = await statement.execute(tx);
    const row = result.rows[0];
    if (!row) throw new Error("Missing follow-up source result");
    const counts = Object.fromEntries(followUpQueues.map((queue) => [queue, aggregateNumber(row[queue] as string | number | null)])) as FollowUpCounts;
    counts.bankInProgress = aggregateNumber((row.bankInProgress ?? null) as string | number | null);
    const items = z
        .array(projectedRow)
        .max(100)
        .parse(jsonValue(row.items))
        .sort((a, b) => (BigInt(a.pageOrdinal) < BigInt(b.pageOrdinal) ? -1 : BigInt(a.pageOrdinal) > BigInt(b.pageOrdinal) ? 1 : 0))
        .map((item) => followUpRow.parse(item));
    const projects = z
        .array(z.object({ id: z.string().min(1), name: z.string().min(1) }))
        .max(5000)
        .parse(jsonValue(row.projects));
    return { total: aggregateNumber(row.total as string | number | null), counts, projects, items, sourceTotals: { native: aggregateNumber((row.nativeTotal ?? 0) as string | number | null), legacy: aggregateNumber((row.legacyTotal ?? 0) as string | number | null) } };
}

/** Exact-record rehydration reuses source aliases, without list counts, project options or banner filtering. */
export async function readFollowUpRecord(tx: Transaction<CrmDatabase>, base: RawBuilder<unknown>) {
    const result = await sql<{ item: unknown }>`
        WITH base AS (${base}), classified AS (
            SELECT base.*,${followUpClassification} AS stateCode
            FROM base
        ) SELECT /*+ MAX_EXECUTION_TIME(5000) */ ${followUpRowProjection} AS item FROM classified LIMIT 1`.execute(tx);
    const row = result.rows[0];
    return row ? followUpRow.parse(jsonValue(row.item)) : undefined;
}

/** Ordered series contain only authorized banners; bank uses its two stored stages. */
export function projectDistributionSeries(access: FollowUpAccess): DistributionKey[] {
    return distributionKeys.filter((key) => {
        if (key === "bank_not_started" || key === "bank_in_progress") return access.queues?.bank === true;
        if (key === "send" || key === "signature") return access.queues?.contracts === true;
        return access.queues?.[key] === true;
    });
}

/** One aggregate across the complete federated portfolio; no records or pagination reach the result. */
export function projectDistributionQuery(base: RawBuilder<unknown>, access: FollowUpAccess) {
    const matches = followUpMatches(access);
    const series = projectDistributionSeries(access);
    const predicates = series.map((key) => {
        if (key === "bank_not_started") return sql`(${matches.bank} AND stateCode='bank_management')`;
        if (key === "bank_in_progress") return sql`(${matches.bank} AND stateCode='bank_management_in_progress')`;
        return matches[key];
    });
    return sql<Record<string, unknown>>`
        WITH base AS (${base}), classified AS (SELECT base.*,${followUpClassification} AS stateCode FROM base),
        visible AS (SELECT * FROM classified WHERE (${!access.ownOnly} OR ownerId=${access.actorId}) AND (${predicates.length ? sql.join(predicates, sql` OR `) : sql`FALSE`}))
        SELECT /*+ MAX_EXECUTION_TIME(5000) */ projectId AS id,
            COALESCE(MAX(CASE WHEN source='native' THEN projectName END),MAX(projectName),'Sin proyecto') AS name,
            COUNT(*) AS total${series.length ? sql`,${sql.join(series.map((key, index) => sql`COALESCE(SUM(${predicates[index]}),0) AS ${sql.ref(key)}`))}` : sql``}
        FROM visible GROUP BY projectId ORDER BY total DESC,name,projectId`;
}

/** Numeric aggregate validation strips all source and contact columns. */
export async function readProjectDistribution(tx: Transaction<CrmDatabase>, base: RawBuilder<unknown>, access: FollowUpAccess) {
    const series = projectDistributionSeries(access);
    const result = await projectDistributionQuery(base, access).execute(tx);
    const projects = result.rows.map((row) => ({
        id: z.string().min(1).nullable().parse(row.id),
        name: z.string().min(1).parse(row.name),
        total: aggregateNumber(row.total as string | number | null),
        counts: Object.fromEntries(series.map((key) => [key, aggregateNumber(row[key] as string | number | null)])),
    }));
    return { series, projects, totalOrders: projects.reduce((sum, project) => sum + project.total, 0) };
}
