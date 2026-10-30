import "temporal-polyfill/global";
import "@fullcalendar/react/skeleton.css";
import "@fullcalendar/react/themes/monarch/theme.css";
import "@fullcalendar/react/themes/monarch/palettes/blue.css";
import "../home/FormalizationHomePage.css";
import "../home/FormalizationCalendarPage.css";
import "./SharedCalendarPage.css";

import PlusOutlined from "@ant-design/icons/PlusOutlined";
import ReloadOutlined from "@ant-design/icons/ReloadOutlined";
import FullCalendar, { type CalendarRef, type DatesSetInfo, type EventInput } from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/react/daygrid";
import listPlugin from "@fullcalendar/react/list";
import esLocale from "@fullcalendar/react/locales/es";
import monarchPlugin from "@fullcalendar/react/themes/monarch";
import timeGridPlugin from "@fullcalendar/react/timegrid";
import Button from "antd/es/button";
import Spin from "antd/es/spin";
import { type RefObject, useCallback, useMemo, useRef, useState } from "react";

import { CALENDAR_MODULES, type CalendarDescriptor, type CalendarEvent, type CalendarModule } from "../../services/calendar/calendar-service";
import { agendaStats } from "./calendar-agenda";
import { CALENDAR_CONTEXT, type CalendarPermission, canReadCalendar } from "./calendar-config";
import { CALENDAR_TIME_ZONE, calendarToday } from "./calendar-time";
import { CalendarEventDrawer } from "./CalendarEventDrawer";
import { CalendarSidebar } from "./CalendarSidebar";
import { CalendarSummary } from "./CalendarSummary";
import { useCalendarData } from "./useCalendarData";

const plugins = [monarchPlugin, dayGridPlugin, timeGridPlugin, listPlugin];
const toolbar = { start: "prev,next today title", end: "dayGridMonth,timeGridWeek,timeGridDay,listWeek" };
const noPermissions: readonly CalendarPermission[] = [];
interface Props {
    readonly moduleCode: CalendarModule;
    readonly effectivePermissions?: readonly CalendarPermission[] | undefined;
    readonly onNavigate?: ((path: string) => void) | undefined;
}
interface Selection {
    event: CalendarEvent | null;
    date: string;
}
type CalendarData = ReturnType<typeof useCalendarData>;
/** Each route uses one shared calendar, with current-module defaults and independent read grants. */
export function SharedCalendarPage({ moduleCode, effectivePermissions = noPermissions, onNavigate }: Props) {
    const readable = useMemo(() => CALENDAR_MODULES.filter((module) => canReadCalendar(effectivePermissions, module)), [effectivePermissions]);
    if (!readable.includes(moduleCode)) return <p role="alert">No tienes permiso para ver el calendario de {CALENDAR_CONTEXT[moduleCode].label}.</p>;
    return <CalendarWorkspace key={moduleCode} moduleCode={moduleCode} readable={readable} authorizationKey={JSON.stringify(effectivePermissions)} onNavigate={onNavigate} />;
}
function initialSelection() {
    const query = new URLSearchParams(window.location.search);
    const date = query.get("date") ?? "";
    return { date: /^\d{4}-\d\d-\d\d$/.test(date) && Number.isFinite(Date.parse(date)) ? date : calendarToday(), eventId: query.get("event") };
}
function CalendarWorkspace({ moduleCode, readable, authorizationKey, onNavigate }: { readonly moduleCode: CalendarModule; readonly readable: readonly CalendarModule[]; readonly authorizationKey: string; readonly onNavigate: Props["onNavigate"] }) {
    const data = useCalendarData(moduleCode, readable, authorizationKey);
    const [selection, setSelection] = useState<Selection | null>(null);
    const [initial] = useState(initialSelection);
    const [focus, setFocus] = useState(initial.date);
    const calendarRef = useRef<CalendarRef>(null);
    const [initialOpened, setInitialOpened] = useState(false);
    const selectedEvent = !initialOpened && initial.eventId ? data.events.find((event) => event.id === initial.eventId) : undefined;
    const activeSelection = selection ?? (selectedEvent ? { event: selectedEvent, date: initial.date } : null);
    const close = () => {
        setSelection(null);
        setInitialOpened(true);
    };
    const refresh = () => {
        close();
        data.refresh();
    };
    const open = (next: Selection) => {
        setInitialOpened(true);
        setSelection(next);
    };
    return (
        <div className="global-home-dashboard formalization-home formalization-calendar shared-calendar">
            <CalendarHeader
                moduleCode={moduleCode}
                calendars={data.calendars}
                refresh={refresh}
                create={() => {
                    if (!data.selectedModules.includes(moduleCode)) data.toggle(moduleCode);
                    open({ event: null, date: initial.date });
                }}
            />
            {data.loading && (
                <div className="calendar-notice" role="status">
                    <Spin size="small" /> Cargando calendario…
                </div>
            )}
            {data.error && (
                <p className="calendar-notice calendar-notice--error" role="alert">
                    No fue posible cargar el calendario. Pulsa recargar para reintentar.
                </p>
            )}
            <CalendarSummary stats={agendaStats(data.events, calendarToday(), data.selectedModules.length)} />
            <div className="shared-calendar__layout">
                <CalendarSidebar
                    calendars={data.calendars}
                    selected={data.selectedModules}
                    events={data.events}
                    focus={focus}
                    today={calendarToday()}
                    onToggle={(code) => {
                        close();
                        data.toggle(code);
                    }}
                    onPick={(date) => {
                        setFocus(date);
                        calendarRef.current?.getApi().gotoDate(date);
                    }}
                />
                <CalendarSurface data={data} moduleCode={moduleCode} date={initial.date} open={open} calendarRef={calendarRef} onFocus={setFocus} />
            </div>
            <SelectionDrawer selection={activeSelection} data={data} moduleCode={moduleCode} onClose={close} onRefresh={refresh} onNavigate={onNavigate} />
        </div>
    );
}
function CalendarHeader({ moduleCode, calendars, refresh, create }: { readonly moduleCode: CalendarModule; readonly calendars: readonly CalendarDescriptor[]; readonly refresh: () => void; readonly create: () => void }) {
    const current = calendars.find((calendar) => calendar.moduleCode === moduleCode);
    const canCreate = current?.canCreate && current.types.some((type) => type.formKey === `${moduleCode}.general.v1`);
    return (
        <header className="global-home-page-header formalization-page-header">
            <div>
                <nav className="formalization-breadcrumb" aria-label="Ruta">
                    <span>{CALENDAR_CONTEXT[moduleCode].label}</span>
                    <span aria-hidden="true">/</span>
                    <span>Calendario</span>
                </nav>
                <h1>Calendario</h1>
                <p>Tareas y reuniones · Hora de Costa Rica</p>
            </div>
            <div className="shared-calendar__actions">
                <Button className="formalization-command" icon={<ReloadOutlined aria-hidden="true" />} onClick={refresh}>
                    Recargar calendario
                </Button>
                {canCreate && (
                    <Button type="primary" className="calendar-primary" icon={<PlusOutlined aria-hidden="true" />} onClick={create}>
                        Nuevo evento
                    </Button>
                )}
            </div>
        </header>
    );
}
function calendarInput(event: CalendarEvent, calendars: readonly CalendarDescriptor[]): EventInput {
    const calendar = calendars.find((entry) => entry.moduleCode === event.originModule);
    const color = calendar?.types.find((type) => type.id === event.typeId)?.color ?? calendar?.color;
    return { id: `${event.source}:${event.id}`, title: event.title, start: event.start, end: event.end, allDay: event.allDay, ...(color ? { color } : {}) };
}
function CalendarSurface({ data, moduleCode, date, open, calendarRef, onFocus }: { readonly data: CalendarData; readonly moduleCode: CalendarModule; readonly date: string; readonly open: (selection: Selection) => void; readonly calendarRef: RefObject<CalendarRef | null>; readonly onFocus: (date: string) => void }) {
    const { updateInterval } = data;
    const datesSet = useCallback(
        (info: DatesSetInfo) => {
            updateInterval({ start: info.start.toISOString(), end: info.end.toISOString() });
            // The day to mark in the side month: today when it is in view, otherwise the first day of the period.
            const today = calendarToday();
            const first = info.view.currentStart.toISOString().slice(0, 10);
            const last = info.view.currentEnd.toISOString().slice(0, 10);
            onFocus(today >= first && today < last ? today : first);
        },
        [updateInterval, onFocus],
    );
    return (
        <section className="formalization-calendar__surface" aria-label={`Calendario de ${CALENDAR_CONTEXT[moduleCode].label}`} aria-busy={data.loading}>
            <FullCalendar
                ref={calendarRef}
                toolbarClass="cal-toolbar"
                toolbarTitleClass="cal-title"
                buttonClass="cal-btn"
                buttonGroupClass="cal-btngroup"
                dayHeaderClass="cal-dayhead"
                dayCellClass="cal-day"
                dayCellTopClass="cal-daytop"
                eventClass="cal-event"
                plugins={plugins}
                initialView="dayGridMonth"
                initialDate={date}
                locale={esLocale}
                timeZone={CALENDAR_TIME_ZONE}
                firstDay={1}
                headerToolbar={toolbar}
                events={data.events.map((event) => calendarInput(event, data.calendars))}
                datesSet={datesSet}
                eventClick={(info) => {
                    const event = data.events.find((entry) => `${entry.source}:${entry.id}` === info.event.id);
                    if (event) open({ event, date: event.start.slice(0, 10) });
                }}
                editable={false}
                selectable={false}
                navLinks={false}
                nowIndicator
                dayMaxEvents
                height="100%"
            />
        </section>
    );
}
function SelectionDrawer({ selection, data, moduleCode, onClose, onRefresh, onNavigate }: { readonly selection: Selection | null; readonly data: CalendarData; readonly moduleCode: CalendarModule; readonly onClose: () => void; readonly onRefresh: () => void; readonly onNavigate: Props["onNavigate"] }) {
    if (!currentSelection(selection, data.events)) return null;
    const origin = selection.event?.originModule ?? moduleCode;
    const descriptor = data.calendars.find((entry) => entry.moduleCode === origin);
    // The API may return an authorized invitation without granting membership in its origin.
    const calendar = descriptor && data.selectedModules.includes(origin) ? descriptor : invitationCalendar(selection.event);
    if (!calendar) return null;
    const key = selection.event ? `${selection.event.source}:${selection.event.id}:${String(selection.event.version)}` : "create";
    return <CalendarEventDrawer key={key} event={selection.event} date={selection.date} calendar={calendar} currentModule={moduleCode} onClose={onClose} onSaved={onRefresh} onRefresh={onRefresh} onNavigate={onNavigate} events={data.events} calendars={data.calendars} />;
}
function currentSelection(selection: Selection | null, events: readonly CalendarEvent[]): selection is Selection {
    return selection !== null && (!selection.event || events.includes(selection.event));
}
function invitationCalendar(event: CalendarEvent | null): CalendarDescriptor | null {
    if (!event) return null;
    return { moduleCode: event.originModule, label: CALENDAR_CONTEXT[event.originModule].label, color: "", canCreate: false, canUpdate: false, types: [] };
}
/** Marketing route adapter preserves the same global-calendar contract. */
export function MarketingCalendarPage(props: Omit<Props, "moduleCode">) {
    return <SharedCalendarPage {...props} moduleCode="mercadeo" />;
}
/** Sales route adapter. */
export function SalesCalendarPage(props: Omit<Props, "moduleCode">) {
    return <SharedCalendarPage {...props} moduleCode="ventas" />;
}
/** Accounting route adapter. */
export function AccountingCalendarPage(props: Omit<Props, "moduleCode">) {
    return <SharedCalendarPage {...props} moduleCode="contabilidad" />;
}
