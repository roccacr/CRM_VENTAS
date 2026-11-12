import { type RawBuilder, sql, type Transaction } from "kysely";
import { z } from "zod";

import type { CrmDatabase } from "../../../../database/database.types.js";
import { finiquitoAuditIdentity, outsideFiniquito } from "./finiquito-exclusion.query.js";
import { aggregateNumber } from "./home-summary.types.js";

export const finiquitoSections = ["validation", "pending_send", "waiting_signature", "formalized", "waiting_checks"] as const;
export const finiquitoOverviewQuery = z.strictObject({ section: z.enum(["all", ...finiquitoSections]).default("all"), page: z.preprocess((value) => (value === undefined ? 1 : typeof value === "string" && /^[1-9][0-9]*$/.test(value) ? Number(value) : value), z.number().int().min(1).max(100000)) });
/** La entrada pública inválida es 400, nunca un fallo genérico del servidor. */
export function parseFiniquitoOverviewInput(input: unknown) {
    const parsed = finiquitoOverviewQuery.safeParse(input);
    if (!parsed.success) throw new BadRequestException("Filtro de finiquito inválido.");
    return parsed.data;
}
const flag = z.union([z.boolean(), z.literal(0), z.literal(1)]).transform((value) => value === true || value === 1);
const overviewRow = z.object({ id: z.string(), source: z.enum(["native", "legacy"]), number: z.string(), section: z.enum(finiquitoSections), balanceValidated: flag, sent: flag, received: flag, saleLost: flag, contractSigned: flag, reservationApplied: flag, version: z.number().int().nonnegative() });
const nativeProjection = sql`SELECT o.public_id_sales_order AS id,CAST(o.id_sales_order AS CHAR) AS internalId,'native' AS source,
    COALESCE((SELECT x.transaction_number_sales_order_external_reference FROM crm_sales_order_external_reference x WHERE x.sales_order_id_sales_order_external_reference=o.id_sales_order AND x.transaction_number_sales_order_external_reference IS NOT NULL ORDER BY x.id_sales_order_external_reference LIMIT 1),o.native_code_sales_order) AS number,
    (o.cancelled_sales_order='yes') AS saleLost,(o.contract_signed_sales_order='yes') AS contractSigned,(o.reservation_applied_sales_order='yes') AS reservationApplied,
    o.balance_validated_sales_order AS balanceValidated,o.finiquito_sent_sales_order AS sent,o.finiquito_received_sales_order AS received
    FROM crm_sales_order o WHERE o.deleted_at_sales_order IS NULL`;

/** Una misma clasificación mantiene los conteos del banner y la tabla de seguimiento alineados. */
export const finiquitoClassification = sql`CASE
            WHEN balanceValidated=0 AND saleLost=1 AND reservationApplied=1 THEN 'validation'
            WHEN balanceValidated<>1 THEN 'waiting_checks'
            WHEN received=1 THEN 'formalized' WHEN sent=1 THEN 'waiting_signature'
            WHEN saleLost=1 AND reservationApplied=1 AND contractSigned=1 THEN 'pending_send'
            ELSE 'waiting_checks' END`;
export const finiquitoCandidate = sql`((saleLost=1 AND reservationApplied=1) OR balanceValidated=1 OR sent=1 OR received=1)`;
/** Volver a validación no borra la pertenencia histórica a la rama aunque el ERP retire checks. */
export function finiquitoCandidateFor(source: RawBuilder<unknown>, id: RawBuilder<unknown>) {
    return sql`(${finiquitoCandidate} OR NOT (${outsideFiniquito(source, id)}))`;
}
/** El último ajuste manual clasifica también órdenes antiguas con checks ERP incompletos. */
export function finiquitoClassificationFor(source: RawBuilder<unknown>, id: RawBuilder<unknown>) {
    return sql`COALESCE((SELECT CASE JSON_UNQUOTE(JSON_EXTRACT(manual_event.after_record_event,'$.finiquitoManualStage'))
        WHEN 'validation' THEN 'validation' WHEN 'pending_send' THEN 'pending_send'
        WHEN 'waiting_signature' THEN 'waiting_signature' WHEN 'formalized' THEN 'formalized' ELSE NULL END
        FROM audit_record_event manual_event JOIN audit_record manual_record ON manual_record.id_record=manual_event.record_id_record_event
        WHERE ${finiquitoAuditIdentity(source, id, "manual_record")} AND manual_event.module_record_event='formalizacion.finiquito'
        ORDER BY manual_event.sequence_record_event DESC LIMIT 1),${finiquitoClassification})`;
}
/** Conteos completos y una página global de 25 órdenes. Un alias nativo siempre tapa su registro viejo. */
export async function readFiniquitoOverview(tx: Transaction<CrmDatabase>, legacy: RawBuilder<unknown> | null, query: z.infer<typeof finiquitoOverviewQuery>) {
    const projection = legacy ? sql`${nativeProjection} UNION ALL ${legacy}` : nativeProjection;
    const { rows } = await sql<Record<string, unknown>>`WITH candidates AS (${projection}), classified AS (
        SELECT candidates.*,${finiquitoClassificationFor(sql`candidates.source`, sql`candidates.internalId`)} AS section
        FROM candidates WHERE ${finiquitoCandidateFor(sql`candidates.source`, sql`candidates.internalId`)}
    ), selected AS (SELECT * FROM classified WHERE ${query.section}='all' OR section=${query.section}),
    paged AS (SELECT * FROM selected ORDER BY number,source,id LIMIT 25 OFFSET ${(query.page - 1) * 25})
    SELECT COALESCE(SUM(section='validation'),0) AS validation,COALESCE(SUM(section='pending_send'),0) AS pending_send,
        COALESCE(SUM(section='waiting_signature'),0) AS waiting_signature,COALESCE(SUM(section='formalized'),0) AS formalized,
        COALESCE(SUM(section='waiting_checks'),0) AS waiting_checks,(SELECT COUNT(*) FROM selected) AS total,
        (SELECT COALESCE(JSON_ARRAYAGG(JSON_OBJECT('id',p.id,'source',p.source,'number',p.number,'section',p.section,
            'balanceValidated',p.balanceValidated,'sent',p.sent,'received',p.received,'saleLost',p.saleLost,'contractSigned',p.contractSigned,'reservationApplied',p.reservationApplied,
            'version',COALESCE((SELECT CAST(JSON_UNQUOTE(JSON_EXTRACT(e.after_record_event,'$.finiquitoVersion')) AS UNSIGNED)
                FROM audit_record_event e JOIN audit_record r ON r.id_record=e.record_id_record_event
                WHERE ${finiquitoAuditIdentity(sql`p.source`, sql`p.internalId`, "r")} AND e.module_record_event='formalizacion.finiquito' ORDER BY e.sequence_record_event DESC LIMIT 1),0))),JSON_ARRAY()) FROM paged p) AS items
    FROM classified`.execute(tx);
    const row = rows[0];
    if (!row) throw new Error("No se pudo confirmar el resumen de finiquito.");
    const counts = Object.fromEntries(finiquitoSections.map((section) => [section, aggregateNumber(row[section] as string | number | null)]));
    return {
        counts,
        total: aggregateNumber(row.total as string | number | null),
        page: query.page,
        pageSize: 25,
        items: z
            .array(overviewRow)
            .max(25)
            .parse(typeof row.items === "string" ? JSON.parse(row.items) : row.items),
    };
}
import { BadRequestException } from "@nestjs/common";
