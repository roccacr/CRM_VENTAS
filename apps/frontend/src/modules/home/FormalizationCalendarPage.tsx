import type { CalendarPermission } from "../calendar/calendar-config";
import { SharedCalendarPage } from "../calendar/SharedCalendarPage";

/** Conserva la entrada de ruta establecida y comparte el calendario global ya autorizado. */
export function FormalizationCalendarPage(props: { readonly effectivePermissions?: readonly CalendarPermission[]; readonly onNavigate?: (path: string) => void }) {
    return <SharedCalendarPage {...props} moduleCode="formalizacion" />;
}
