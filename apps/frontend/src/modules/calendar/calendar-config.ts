import type { CalendarModule } from "../../services/calendar/calendar-service";

export const CALENDAR_CONTEXT: Record<CalendarModule, { label: string; path: string; referenceLabel: string }> = {
    formalizacion: { label: "Formalización", path: "/home/formalization/calendar", referenceLabel: "Referencia interna (opcional)" },
    mercadeo: { label: "Mercadeo", path: "/home/marketing/calendar", referenceLabel: "Referencia de campaña" },
    ventas: { label: "Ventas", path: "/home/sales/calendar", referenceLabel: "Referencia comercial" },
};
export interface CalendarPermission {
    readonly code: string;
    readonly effect: string;
}
/** Hace falta el allow exacto de `${módulo}.calendar.read` y un deny lo quita. El nombre Owner no abre el calendario. */
export function canReadCalendar(permissions: readonly CalendarPermission[], module: CalendarModule): boolean {
    if (module === "ventas") return false;
    const matches = permissions.filter((permission) => permission.code === `${module}.calendar.read`);
    return matches.some((entry) => entry.effect === "allow") && !matches.some((entry) => entry.effect === "deny");
}
