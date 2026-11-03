import type { CaptureApiPeriod } from "../../services/marketing/lead-report-service";

/** Historical selections reuse the full authorized report. What the person picks. The API serves today, week, month and everything; quarter and year are cut from "everything" on this side. */
export type CapturePeriod = "day" | "week" | "month" | "quarter" | "year" | "custom";

export const apiPeriodOf = (period: CapturePeriod, historical = false): CaptureApiPeriod => (historical || period === "quarter" || period === "year" || period === "custom" ? "all" : period);

/** First day (yyyy-mm-dd) of the calendar quarter or year that contains `today`; null for the periods the API already cuts. */
function periodStart(period: CapturePeriod, today: string): string | null {
    if (period === "year") return `${today.slice(0, 4)}-01-01`;
    if (period !== "quarter") return null;
    const firstMonth = Math.floor((Number(today.slice(5, 7)) - 1) / 3) * 3 + 1;
    return `${today.slice(0, 4)}-${String(firstMonth).padStart(2, "0")}-01`;
}

/** Dates shown and filtered: the API's own range, or, for quarter and year, from the start of that quarter or year (never before the data begins) up to the report's end. */
export function periodRange(period: CapturePeriod, report: { readonly today: string; readonly range: { readonly start: string; readonly end: string } }): { readonly from: string; readonly to: string } {
    const start = periodStart(period, report.today);
    return { from: start !== null && start > report.range.start ? start : report.range.start, to: report.range.end };
}
