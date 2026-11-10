import type { CaptureApiPeriod } from "../../services/marketing/lead-report-service";

/** Una selección histórica reutiliza el reporte autorizado completo. El API sirve hoy, semana, mes y todo. Trimestre y año se recortan aquí desde todo. */
export type CapturePeriod = "day" | "week" | "month" | "quarter" | "year" | "custom";

/** Hoy, semana y mes se piden así. Un histórico, un trimestre, un año o un rango personalizado piden el reporte completo y el recorte se hace aquí. */
export const apiPeriodOf = (period: CapturePeriod, historical = false): CaptureApiPeriod => (historical || period === "quarter" || period === "year" || period === "custom" ? "all" : period);

/** Primer día, en `yyyy-mm-dd`, del trimestre o del año calendario que contiene hoy. Nulo en los periodos que el API ya recorta. */
function periodStart(period: CapturePeriod, today: string): string | null {
    if (period === "year") return `${today.slice(0, 4)}-01-01`;
    if (period !== "quarter") return null;
    const firstMonth = Math.floor((Number(today.slice(5, 7)) - 1) / 3) * 3 + 1;
    return `${today.slice(0, 4)}-${String(firstMonth).padStart(2, "0")}-01`;
}

/** Fechas mostradas y filtradas: el rango propio del API o, en trimestre y año, desde el inicio de ese trimestre o año hasta el fin del reporte. No empieza antes de que existan datos. */
export function periodRange(period: CapturePeriod, report: { readonly today: string; readonly range: { readonly start: string; readonly end: string } }): { readonly from: string; readonly to: string } {
    const start = periodStart(period, report.today);
    return { from: start !== null && start > report.range.start ? start : report.range.start, to: report.range.end };
}
