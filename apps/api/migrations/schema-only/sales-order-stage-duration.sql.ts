/** Compare MySQL's canonical view rendering without discarding literals or function boundaries.
 * Each condition uses only AND or only OR (no mixed precedence) and no arithmetic;
 * MySQL's extra expression grouping therefore cannot change its meaning.
 */
function ungroupViewTokens(normalized: string[]): string[] {
    const output: string[] = [];
    const parentheses: boolean[] = [];
    for (const [index, token] of normalized.entries()) {
        if (token === "(") {
            const previous = normalized[index - 1] ?? "";
            const keep = ["concat", "lead", "first_value", "utc_timestamp", "timestampdiff", "over"].includes(previous) || normalized[index + 1] === "select";
            parentheses.push(keep);
            if (keep) output.push(token);
        } else if (token === ")") {
            if (parentheses.pop()) output.push(token);
        } else output.push(token);
    }
    return output;
}

/** Normalize only canonical presentation, retaining source and literal drift. */
export function normalizeStageDurationView(value: string, source: "native" | "legacy"): string {
    const tokens = value.match(/'(?:''|[^'])*'|`(?:``|[^`])*`|[a-zA-Z_][a-zA-Z_0-9]*|<>|[0-9]+|[^\s]/g) ?? [];
    const normalized = tokens.map((token) => (token.startsWith("'") ? token : token.replace(/`/g, "").toLowerCase()));
    const schema = source === "native" ? "crm_think_v2" : "crmdatabase-api";
    const filtered = normalized.filter((token, index) => !["_utf8mb4", "as", "asc"].includes(token) && !(token === schema && normalized[index + 1] === ".") && !(token === "." && normalized[index - 1] === schema));
    // MySQL makes implicit projection aliases explicit (v.x AS x).
    return ungroupViewTokens(filtered)
        .join(" ")
        .replace(/\bv \. ([a-z_]+) \1\b/g, "v . $1");
}

/** Static identifiers only: the native runner must never compile a legacy view. */
export function buildSalesOrderStageDurationView(source: "native" | "legacy"): string {
    const orderId = source === "native" ? "sales_order_id_sales_order_state_event" : "legacy_order_id_sales_order_state_event";
    const actor = source === "native" ? "CONCAT('CRM_THINK_V2:', actor.public_id_user)" : "e.actor_reference_sales_order_state_event";
    const responsible = source === "native" ? "CONCAT('CRM_THINK_V2:', responsible.public_id_user)" : "e.responsible_reference_sales_order_state_event";
    const joins = source === "native" ? "LEFT JOIN sec_user actor ON actor.id_user = e.actor_user_id_sales_order_state_event LEFT JOIN sec_user responsible ON responsible.id_user = e.responsible_user_id_sales_order_state_event" : "";
    const visit = `(PARTITION BY e.${orderId} ORDER BY e.sequence_sales_order_state_event)`;
    const latest = `(PARTITION BY e.${orderId} ORDER BY e.sequence_sales_order_state_event DESC)`;
    const visitEnd = "CASE WHEN v.next_sequence IS NOT NULL THEN v.next_entered_at ELSE UTC_TIMESTAMP(3) END";
    const processEnd = "CASE WHEN v.last_state = 'closed' THEN v.last_entered_at ELSE UTC_TIMESTAMP(3) END";
    // Sequence distinguishes a terminal visit from a next visit whose effective time is unknown.
    // FIRST_VALUE deliberately preserves NULL: snapshots cannot invent a process start.
    return `SELECT v.order_id, v.sequence, v.state_code, v.from_state_code, v.entered_at, v.recorded_at,
CASE WHEN v.next_sequence IS NOT NULL THEN v.next_entered_at ELSE NULL END AS left_at,
CASE WHEN v.entered_at IS NULL OR v.entered_at > UTC_TIMESTAMP(3) THEN NULL WHEN v.state_code = 'closed' THEN 0 WHEN v.entered_at <= (${visitEnd}) AND (${visitEnd}) <= UTC_TIMESTAMP(3) THEN TIMESTAMPDIFF(SECOND, v.entered_at, ${visitEnd}) ELSE NULL END AS duration_seconds,
(v.next_sequence IS NULL) AS is_current, v.actor_reference, v.responsible_reference, v.actor_snapshot, v.responsible_snapshot,
v.process_started_at, CASE WHEN v.last_state = 'closed' AND v.last_entered_at <= UTC_TIMESTAMP(3) THEN v.last_entered_at ELSE NULL END AS process_finished_at,
CASE WHEN v.process_started_at <= (${processEnd}) AND (${processEnd}) <= UTC_TIMESTAMP(3) AND CASE WHEN v.last_entered_at > UTC_TIMESTAMP(3) THEN 0 ELSE 1 END = 1 THEN TIMESTAMPDIFF(SECOND, v.process_started_at, ${processEnd}) ELSE NULL END AS total_duration_seconds
FROM (SELECT e.${orderId} AS order_id, e.sequence_sales_order_state_event AS sequence, e.to_state_code_sales_order_state_event AS state_code,
e.from_state_code_sales_order_state_event AS from_state_code, e.effective_at_sales_order_state_event AS entered_at, e.recorded_at_sales_order_state_event AS recorded_at,
LEAD(e.effective_at_sales_order_state_event) OVER ${visit} AS next_entered_at, LEAD(e.sequence_sales_order_state_event) OVER ${visit} AS next_sequence,
CASE WHEN FIRST_VALUE(e.from_state_code_sales_order_state_event) OVER ${visit} IS NOT NULL OR FIRST_VALUE(e.sequence_sales_order_state_event) OVER ${visit} <> 1 OR FIRST_VALUE(e.event_kind_sales_order_state_event) OVER ${visit} = 'import_snapshot' THEN NULL ELSE FIRST_VALUE(e.effective_at_sales_order_state_event) OVER ${visit} END AS process_started_at,
FIRST_VALUE(e.to_state_code_sales_order_state_event) OVER ${latest} AS last_state, FIRST_VALUE(e.effective_at_sales_order_state_event) OVER ${latest} AS last_entered_at,
${actor} AS actor_reference, ${responsible} AS responsible_reference, e.actor_snapshot_sales_order_state_event AS actor_snapshot, e.responsible_snapshot_sales_order_state_event AS responsible_snapshot
FROM audit_sales_order_state_event e ${joins}) v`;
}
