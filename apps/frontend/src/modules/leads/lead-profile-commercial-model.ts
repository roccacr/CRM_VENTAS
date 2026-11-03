import type { LeadProfileCommercialPage } from "../../services/leads/lead-profile-service";
import { formatAmount, formatStamp, isBlank, orderStatus } from "./lead-profile-model";

export type CommercialRecord = LeadProfileCommercialPage["items"][number];
type RecordField = CommercialRecord["fields"][number];

export interface RecordFact {
    readonly label: string;
    readonly value: string;
}
export interface RecordSummary {
    readonly number: string;
    readonly status: string | null;
    readonly created: string | null;
    readonly facts: readonly RecordFact[];
    /** Why an opportunity was set inactive, when the source says so. */
    readonly note: string | null;
}

/** Which fields headline each kind of record, in reading order. The full list stays one click away. */
const KINDS = {
    opportunity: { number: "tranid_oport", status: "chek_oport", created: "fecha_creada_oport", facts: ["entitystatus_oport", "probability_oport", "projectedtotal_oport", "expectedclosedate_oport", "Motico_Condicion", "salesrep_oport", "subsidiaria_oport"] },
    estimate: { number: "tranid_est", status: "status", created: "creado_est", facts: ["montoTotal_est", "caduca", "idOportunidad_est", "pre_reserva", "namesubsi_est"] },
} as const;
const AMOUNT = /^(monto|projectedtotal|rango)/iu;
const DATE = /^\d{4}-\d{2}-\d{2}/u;

/** Dates and amounts read the way the rest of the profile shows them; anything else stays as the source wrote it. */
export function displayValue(code: string, value: string | null): string {
    if (isBlank(value)) return "Sin dato";
    if (AMOUNT.test(code)) return formatAmount(value);
    return DATE.test(value ?? "") ? formatStamp(value) : (value ?? "Sin dato");
}
/** In the previous system an opportunity is "more likely" when its control flag is 1 and "less likely" otherwise; that, not the record status, is what the profile showed. */
const likelihood = (value: string | null): string | null => (value === null ? null : value === "1" ? "Más probable" : "Menos probable");
const kindOf = (record: CommercialRecord) => (record.fields.some((field) => field.code === KINDS.opportunity.number) ? KINDS.opportunity : KINDS.estimate);
const find = (record: CommercialRecord, code: string): RecordField | undefined => record.fields.find((field) => field.code === code && !isBlank(field.value));

function inactivation(record: CommercialRecord): string | null {
    const reason = find(record, "motivo_inactivacion_oport")?.value;
    if (!reason) return null;
    const when = find(record, "fecha_inactivacion_oport")?.value;
    return when ? `Inactivada el ${formatStamp(when)} · ${reason}` : `Inactivada · ${reason}`;
}

function statusOf(record: CommercialRecord, kind: ReturnType<typeof kindOf>): string | null {
    const value = find(record, kind.status)?.value ?? null;
    return kind === KINDS.opportunity ? likelihood(value) : orderStatus(value);
}
/** The number, status, date and four or five key facts of a record, so a list can be read without opening any of them. */
export function summarizeRecord(record: CommercialRecord): RecordSummary {
    const kind = kindOf(record);
    const facts = kind.facts.flatMap((code) => {
        const field = find(record, code);
        return field ? [{ label: field.label, value: displayValue(code, field.value) }] : [];
    });
    const created = find(record, kind.created)?.value ?? null;
    return {
        number: find(record, kind.number)?.value ?? record.id,
        status: statusOf(record, kind),
        created: created ? formatStamp(created) : null,
        facts,
        note: inactivation(record),
    };
}
export const recordCount = (total: number): string => `${String(total)} ${total === 1 ? "registro" : "registros"}`;
