import type { CalendarRef } from "@fullcalendar/react";
import { type RefObject, useEffect } from "react";

export const SHORTCUTS_HELP = "Atajos: N nuevo evento · T hoy · ← → moverse en el tiempo · M mes · S semana laboral · W semana · D día · L agenda · / buscar";

type CalendarApi = ReturnType<CalendarRef["getApi"]>;
const VIEWS: Record<string, string> = { m: "dayGridMonth", s: "timeGridWorkWeek", w: "timeGridWeek", d: "timeGridDay", l: "listWeek" };
type Command = () => void;

const typing = (target: EventTarget | null) => target instanceof HTMLElement && (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName));
const blocked = (event: KeyboardEvent) => event.ctrlKey || event.metaKey || event.altKey || typing(event.target);

/** Navigation and view commands that only need the calendar itself. */
function navigation(api: CalendarApi): Record<string, Command> {
    const views = Object.fromEntries(
        Object.entries(VIEWS).map(([key, view]) => [
            key,
            () => {
                api.changeView(view);
            },
        ]),
    );
    return {
        ...views,
        t: () => {
            api.today();
        },
        ArrowLeft: () => {
            api.prev();
        },
        ArrowRight: () => {
            api.next();
        },
    };
}

/** Single-key shortcuts like Outlook's. They never fire while typing, with a modifier held, or while a card or panel is open. */
export function useCalendarShortcuts(calendar: RefObject<CalendarRef | null>, options: { readonly enabled: boolean; readonly onCreate: Command | null; readonly onSearch: Command }) {
    const { enabled, onCreate, onSearch } = options;
    useEffect(() => {
        if (!enabled) return;
        const handle = (event: KeyboardEvent) => {
            if (blocked(event)) return;
            const api = calendar.current?.getApi();
            const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
            const commands: Record<string, Command | undefined> = { ...(api ? navigation(api) : {}), ...(onCreate ? { n: onCreate } : {}), "/": onSearch };
            const command = commands[key];
            if (!command) return;
            command();
            event.preventDefault();
        };
        document.addEventListener("keydown", handle);
        return () => {
            document.removeEventListener("keydown", handle);
        };
    }, [calendar, enabled, onCreate, onSearch]);
}
