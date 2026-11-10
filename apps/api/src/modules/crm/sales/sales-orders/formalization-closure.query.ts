import { sql } from "kysely";

/** La fecha ERP es de calendario en Costa Rica; los eventos de Habita se guardan en UTC. */
export function formalizationClosedThisYear(source: "native" | "legacy", period: { start: string; endExclusive: string }) {
    const native = source === "native";
    const id = sql.ref(native ? "o.id_sales_order" : "o.id_ov");
    const history = sql.table(native ? "audit_sales_order_state_event" : "crmdatabase-api.audit_sales_order_state_event");
    const key = sql.ref(native ? "closed_event.sales_order_id_sales_order_state_event" : "closed_event.legacy_order_id_sales_order_state_event");
    const start = period.start.slice(0, 23).replace("T", " ");
    const end = period.endExclusive.slice(0, 23).replace("T", " ");
    return sql`COALESCE(
        (SELECT delivered_on >= ${start.slice(0, 10)} AND delivered_on < ${end.slice(0, 10)}
            FROM int_netsuite_order_delivery WHERE destination=${source} AND order_id=${id}),
        EXISTS(SELECT 1 FROM ${history} closed_event WHERE ${key}=${id}
            AND closed_event.to_state_code_sales_order_state_event='closed'
            AND closed_event.effective_at_sales_order_state_event >= ${start}
            AND closed_event.effective_at_sales_order_state_event < ${end})
    )`;
}
