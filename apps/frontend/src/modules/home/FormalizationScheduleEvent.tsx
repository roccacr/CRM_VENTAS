import "../calendar/SharedCalendarPage.css";

import CalendarOutlined from "@ant-design/icons/CalendarOutlined";
import Button from "antd/es/button";
import { useEffect, useRef, useState } from "react";

import { type CalendarDescriptor, getCalendarLookup, getCalendars } from "../../services/calendar/calendar-service";
import type { FollowUpItem } from "../../services/formalization/follow-up-service";
import { type CalendarPermission, canReadCalendar } from "../calendar/calendar-config";
import { calendarToday } from "../calendar/calendar-time";
import { CalendarEventDrawer } from "../calendar/CalendarEventDrawer";
import { calendarEditAccess, type CalendarOrderContext } from "../calendar/useCalendarEventForm";

/** El calendario autoriza el alta y resuelve el cliente real; el nombre mostrado nunca decide la identidad. */
export function FormalizationScheduleEvent({ item, effectivePermissions, onClosed }: { readonly item: Pick<FollowUpItem, "source" | "id" | "number">; readonly effectivePermissions: readonly CalendarPermission[]; readonly onClosed?: (() => void) | undefined }) {
    const [calendar, setCalendar] = useState<CalendarDescriptor | null>(null);
    const [context, setContext] = useState<CalendarOrderContext | null>(null);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    const request = useRef(0);
    const assignmentPermissions = effectivePermissions.filter((permission) => permission.code === "formalizacion.calendar.assign_lead");
    const allowed = [canReadCalendar(effectivePermissions, "formalizacion"), assignmentPermissions.some((permission) => permission.effect === "allow"), !assignmentPermissions.some((permission) => permission.effect === "deny")].every(Boolean);
    useEffect(() => {
        let active = true;
        if (allowed)
            void getCalendars()
                .then((items) => {
                    if (active) setCalendar(items.find((entry) => entry.moduleCode === "formalizacion") ?? null);
                })
                .catch(() => {
                    if (active) setError("No fue posible consultar los permisos del calendario.");
                });
        return () => {
            active = false;
            request.current += 1;
        };
    }, [allowed, item.source, item.id]);
    if (!allowed) return null;
    const editable = calendar && calendarEditAccess(null, calendar, "formalizacion").editable;
    const schedule = async () => {
        if (!editable) return;
        const current = ++request.current;
        setBusy(true);
        setError("");
        try {
            const orders = await getCalendarLookup("orders", item.number, "formalizacion");
            if (current !== request.current) return;
            const order = orders.find((entry) => entry.source === item.source && entry.id === item.id.replace(/^legacy:/u, ""));
            if (!order?.lead) throw new Error("No se pudo confirmar el cliente autorizado de esta orden. Revisa su relación antes de agendar.");
            setContext({ reference: item.number, order: { ...order, lead: order.lead } });
        } catch {
            if (current === request.current) setError("No se pudo confirmar el cliente autorizado de esta orden. Revisa su relación y tus permisos antes de reintentar.");
        } finally {
            if (current === request.current) setBusy(false);
        }
    };
    return (
        <>
            {editable && (
                <Button
                    icon={<CalendarOutlined aria-hidden="true" />}
                    loading={busy}
                    onClick={() => {
                        void schedule();
                    }}
                >
                    Agendar evento
                </Button>
            )}
            {error && <p role="alert">{error}</p>}
            {editable && context && (
                <CalendarEventDrawer
                    key={`${item.source}:${item.id}`}
                    event={null}
                    date={calendarToday()}
                    calendar={calendar}
                    currentModule="formalizacion"
                    orderContext={context}
                    onClose={() => {
                        setContext(null);
                        onClosed?.();
                    }}
                    onSaved={() => {
                        setContext(null);
                        onClosed?.();
                    }}
                    onRefresh={() => {
                        setContext(null);
                        onClosed?.();
                    }}
                />
            )}
        </>
    );
}
