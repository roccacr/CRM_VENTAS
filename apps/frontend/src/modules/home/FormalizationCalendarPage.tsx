import type { CalendarPermission } from "../calendar/calendar-config";
import { SharedCalendarPage } from "../calendar/SharedCalendarPage";

/** Keeps the established route entrypoint while sharing the authorized global calendar. */
export function FormalizationCalendarPage(props: { readonly effectivePermissions?: readonly CalendarPermission[]; readonly onNavigate?: (path: string) => void }) {
    return <SharedCalendarPage {...props} moduleCode="formalizacion" />;
}
