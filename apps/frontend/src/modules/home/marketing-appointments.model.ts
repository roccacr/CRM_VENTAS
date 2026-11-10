import type { MarketingAppointmentEvent } from "../../services/marketing/home-summary-service";
import { type MarketingRange, toISODate } from "./marketing-home-preview.model";

/** Las dos dimensiones coinciden en el mismo vínculo de lead. Un evento se cuenta una vez aunque tenga participantes copiados o varios leads. */
export function summarizeAppointmentEvents(events: readonly MarketingAppointmentEvent[], period: MarketingRange, scope: { sellers: readonly string[]; projects: readonly string[] }) {
    const start = toISODate(period.start);
    const end = toISODate(period.end);
    const rows = events.filter((event) => event.date >= start && event.date <= end && event.links.some((link) => (scope.sellers.length === 0 || scope.sellers.includes(link.sellerId)) && (scope.projects.length === 0 || scope.projects.includes(link.projectId))));
    const completed = rows.filter((event) => event.status === "completed");
    return { completed: completed.length, pending: rows.filter((event) => event.status === "scheduled").length, cancelled: rows.filter((event) => event.status === "cancelled").length, attended: completed.filter((event) => event.attendance === "attended").length, missed: completed.filter((event) => event.attendance === "missed").length, unverified: completed.filter((event) => event.attendance === null).length };
}
/**
 *
 */
export function appointmentCaption(totals: ReturnType<typeof summarizeAppointmentEvents>): string {
    const verified = totals.attended + totals.missed;
    const attendance = verified ? `${String(totals.attended)} asistidas · ${String(totals.missed)} ausencias confirmadas${totals.unverified ? ` · ${String(totals.unverified)} sin verificar` : ""}` : "No hay información suficiente para confirmar quién asistió";
    return `${String(totals.pending)} pendientes de completar · ${String(totals.cancelled)} canceladas · ${attendance}`;
}
