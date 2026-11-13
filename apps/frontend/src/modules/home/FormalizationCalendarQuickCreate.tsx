import "../calendar/SharedCalendarPage.css";

import CalendarOutlined from "@ant-design/icons/CalendarOutlined";
import { useEffect, useState } from "react";

import { type CalendarDescriptor, type CalendarModule, getCalendars } from "../../services/calendar/calendar-service";
import { CALENDAR_CONTEXT, type CalendarPermission, canReadCalendar } from "../calendar/calendar-config";
import { calendarToday } from "../calendar/calendar-time";
import { CalendarEventDrawer } from "../calendar/CalendarEventDrawer";
import { calendarEditAccess } from "../calendar/useCalendarEventForm";

const calendarModules: Readonly<Record<string, CalendarModule | undefined>> = { formalization: "formalizacion", marketing: "mercadeo", sales: "ventas" };

/** La acción global abre un evento vacío: el contexto de la orden actual no se hereda del URL. */
export function FormalizationCalendarQuickCreate({ workspaceCode, permissions }: { readonly workspaceCode: string; readonly permissions: readonly CalendarPermission[] }) {
    const module = calendarModules[workspaceCode];
    if (!module || !canReadCalendar(permissions, module)) return null;
    const permissionKey = JSON.stringify([module, permissions.filter((permission) => permission.code.startsWith(`${module}.calendar.`))]);
    return <QuickCreate key={permissionKey} module={module} />;
}

function QuickCreate({ module }: { readonly module: CalendarModule }) {
    const [calendar, setCalendar] = useState<CalendarDescriptor | null>(null);
    const [open, setOpen] = useState(false);
    useEffect(() => {
        let active = true;
        void getCalendars().then(
            (items) => {
                if (active) setCalendar(items.find((item) => item.moduleCode === module) ?? null);
            },
            () => {
                if (active) setCalendar(null);
            },
        );
        return () => {
            active = false;
        };
    }, [module]);
    if (!calendar || !calendarEditAccess(null, calendar, module).editable) return null;
    const close = () => {
        setOpen(false);
    };
    return (
        <>
            <button
                className="global-home-header__icon-button"
                type="button"
                aria-label={`Nuevo evento de ${CALENDAR_CONTEXT[module].label}`}
                title={`Nuevo evento de ${CALENDAR_CONTEXT[module].label}`}
                onClick={() => {
                    setOpen(true);
                }}
            >
                <CalendarOutlined aria-hidden="true" />
            </button>
            {open && <CalendarEventDrawer event={null} date={calendarToday()} calendar={calendar} currentModule={module} onClose={close} onSaved={close} onRefresh={close} />}
        </>
    );
}
