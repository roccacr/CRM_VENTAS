import "temporal-polyfill/global";
import "@fullcalendar/react/skeleton.css";
import "@fullcalendar/react/themes/monarch/theme.css";
import "@fullcalendar/react/themes/monarch/palettes/blue.css";
import "../home/FormalizationHomePage.css";
import "../home/FormalizationCalendarPage.css";
import "./SharedCalendarPage.css";

import PlusOutlined from "@ant-design/icons/PlusOutlined";
import ReloadOutlined from "@ant-design/icons/ReloadOutlined";
import SearchOutlined from "@ant-design/icons/SearchOutlined";
import FullCalendar, { type CalendarRef, type DatesSetInfo, type EventInput } from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/react/daygrid";
import interactionPlugin from "@fullcalendar/react/interaction";
import listPlugin from "@fullcalendar/react/list";
import esLocale from "@fullcalendar/react/locales/es";
import monarchPlugin from "@fullcalendar/react/themes/monarch";
import timeGridPlugin from "@fullcalendar/react/timegrid";
import Button from "antd/es/button";
import Input, { type InputRef } from "antd/es/input";
import Spin from "antd/es/spin";
import { type RefObject, useCallback, useMemo, useRef, useState } from "react";

import { FormHelp } from "../../components/forms/FormHelp";
import { CALENDAR_MODULES, type CalendarDescriptor, type CalendarEvent, type CalendarModule } from "../../services/calendar/calendar-service";
import { agendaStats } from "./calendar-agenda";
import { CALENDAR_CONTEXT, type CalendarPermission, canReadCalendar } from "./calendar-config";
import { CALENDAR_TIME_ZONE, calendarToday, utcToLocal } from "./calendar-time";
import { calendarEventColors, eventSignals, typeFilters } from "./calendar-view-tools";
import { CalendarEventDrawer } from "./CalendarEventDrawer";
import { CalendarSidebar } from "./CalendarSidebar";
import { CalendarSummary } from "./CalendarSummary";
import { OutlookEventDrawer } from "./OutlookEventDrawer";
import { OutlookEventPopover } from "./OutlookEventPopover";
import { useCalendarData } from "./useCalendarData";
import { useCalendarFilters } from "./useCalendarFilters";
import { SHORTCUTS_HELP, useCalendarShortcuts } from "./useCalendarShortcuts";

const plugins = [monarchPlugin, dayGridPlugin, timeGridPlugin, listPlugin, interactionPlugin];
const toolbar = { start: "prev,next today title", end: "dayGridMonth,timeGridWorkWeek,timeGridWeek,timeGridDay,listWeek" };
const WEEKEND = [0, 6];
const TOOLBAR_BUTTONS = { timeGridWorkWeek: { text: "Semana laboral", hint: "Vista de la semana laboral" } };
const timeViews = (selectable: boolean) => ({ timeGridWeek: { selectable }, timeGridDay: { selectable }, timeGridWorkWeek: { type: "timeGrid", duration: { weeks: 1 }, hiddenDays: WEEKEND, selectable } });
/** Horas del hueco en la grilla, como hora de pared de Costa Rica para el formulario. */
const wallTime = (iso: string) => (/[zZ]$|[+-]\d\d:\d\d$/.test(iso) ? utcToLocal(new Date(iso).toISOString()).slice(0, 16) : iso.slice(0, 16));
const EVENT_TIME = { hour: "2-digit", minute: "2-digit", hour12: false } as const;
const DAY_HEADER = { weekday: "long" } as const;
const noPermissions: readonly CalendarPermission[] = [];
interface Props {
    readonly moduleCode: CalendarModule;
    readonly effectivePermissions?: readonly CalendarPermission[] | undefined;
    readonly onNavigate?: ((path: string) => void) | undefined;
}
interface Selection {
    editing?: boolean;
    event: CalendarEvent | null;
    date: string;
    /** Inicio y fin marcados en la grilla, como hora de pared local. */
    range?: { readonly start: string; readonly end: string } | undefined;
    /** Dónde quedó el evento en pantalla, para que uno de Outlook abra su tarjeta al lado. */
    anchor?: DOMRect | undefined;
    /** Eventos de Outlook: el panel de detalle a la derecha, en lugar de la tarjeta rápida. */
    expanded?: boolean | undefined;
}
type CalendarData = ReturnType<typeof useCalendarData>;
/** Cada ruta usa el mismo calendario, con los valores del módulo actual y un permiso de lectura propio. */
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
/** Crear exige el permiso de alta del calendario de este módulo y un tipo que atienda el formulario general. */
function canCreateIn(calendars: readonly CalendarDescriptor[], moduleCode: CalendarModule): boolean {
    const current = calendars.find((calendar) => calendar.moduleCode === moduleCode);
    return Boolean(current?.canCreate && current.types.some((type) => type.formKey === `${moduleCode}.general.v1`));
}
/** Un enlace con ?event= abre ese evento una vez, hasta que la persona abra o cierre otra cosa. */
function deepLinkedSelection(initial: { date: string; eventId: string | null }, opened: boolean, events: readonly CalendarEvent[]): Selection | null {
    const event = !opened && initial.eventId ? events.find((entry) => entry.id === initial.eventId) : undefined;
    return event ? { event, date: initial.date } : null;
}
function CalendarWorkspace({ moduleCode, readable, authorizationKey, onNavigate }: { readonly moduleCode: CalendarModule; readonly readable: readonly CalendarModule[]; readonly authorizationKey: string; readonly onNavigate: Props["onNavigate"] }) {
    const data = useCalendarData(moduleCode, readable, authorizationKey);
    const [selection, setSelection] = useState<Selection | null>(null);
    const [initial] = useState(initialSelection);
    const [initialOpened, setInitialOpened] = useState(false);
    const filters = useCalendarFilters(data.events);
    const calendarRef = useRef<CalendarRef>(null);
    const searchRef = useRef<InputRef>(null);
    const events = filters.visible;
    const canCreate = canCreateIn(data.calendars, moduleCode);
    const activeSelection = selection ?? deepLinkedSelection(initial, initialOpened, data.events);
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
    const create = (slot?: Pick<Selection, "date" | "range">) => {
        if (!data.selectedModules.includes(moduleCode)) data.toggle(moduleCode);
        open({ event: null, date: slot?.date ?? initial.date, range: slot?.range });
    };
    useCalendarShortcuts(calendarRef, {
        enabled: activeSelection === null,
        onCreate: canCreate
            ? () => {
                  create();
              }
            : null,
        onSearch: () => {
            searchRef.current?.focus();
        },
    });
    return (
        <div className="global-home-dashboard formalization-home formalization-calendar shared-calendar">
            <CalendarHeader
                moduleCode={moduleCode}
                canCreate={canCreate}
                refresh={refresh}
                create={() => {
                    create();
                }}
                query={filters.query}
                onQuery={filters.setQuery}
                searchRef={searchRef}
            />
            {data.error && (
                <p className="calendar-notice calendar-notice--error" role="alert">
                    No fue posible cargar el calendario. Pulsa recargar para reintentar.
                </p>
            )}
            <OutlookFeedNotice data={data} />
            <CalendarSummary stats={agendaStats(data.events, calendarToday(), data.selectedModules.length)} />
            <div className="shared-calendar__layout">
                <CalendarSidebar
                    calendars={data.calendars}
                    selected={data.selectedModules}
                    events={events}
                    types={typeFilters(data.calendars, data.selectedModules)}
                    hiddenTypes={filters.hiddenTypes}
                    showOutlook={filters.showOutlook}
                    today={calendarToday()}
                    onToggleType={filters.toggleType}
                    onToggleOutlook={filters.toggleOutlook}
                    onToggle={(code) => {
                        close();
                        data.toggle(code);
                    }}
                />
                <CalendarSurface data={data} events={events} moduleCode={moduleCode} date={initial.date} open={open} canCreate={canCreate} onCreate={create} calendarRef={calendarRef} selectedId={activeSelection?.event ? `${activeSelection.event.source}:${activeSelection.event.id}` : null} />
            </div>
            <SelectionDrawer
                selection={activeSelection}
                data={data}
                moduleCode={moduleCode}
                onClose={close}
                onRefresh={refresh}
                onNavigate={onNavigate}
                onExpand={(current) => {
                    setSelection({ ...current, expanded: true });
                }}
            />
        </div>
    );
}
function OutlookFeedNotice({ data }: { readonly data: CalendarData }) {
    if (data.loading || !data.outlookStatus || data.outlookStatus === "connected") return null;
    return (
        <p className="calendar-notice" role="status">
            Se muestran los eventos Habita. Outlook {data.outlookStatus === "consent_required" ? "requiere autorización de Microsoft" : "no pudo consultarse"}; su agenda está incompleta. Pulsa recargar para reintentar.
        </p>
    );
}
interface HeaderProps {
    readonly moduleCode: CalendarModule;
    readonly canCreate: boolean;
    readonly refresh: () => void;
    readonly create: () => void;
    readonly query: string;
    readonly onQuery: (query: string) => void;
    readonly searchRef: RefObject<InputRef | null>;
}
function CalendarHeader({ moduleCode, canCreate, refresh, create, query, onQuery, searchRef }: HeaderProps) {
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
                <Input
                    ref={searchRef}
                    className="calendar-search"
                    allowClear
                    prefix={<SearchOutlined aria-hidden="true" />}
                    placeholder="Buscar eventos"
                    aria-label="Buscar eventos"
                    value={query}
                    onChange={(change) => {
                        onQuery(change.target.value);
                    }}
                />
                <FormHelp text={SHORTCUTS_HELP} />
                <Button className="formalization-command" icon={<ReloadOutlined aria-hidden="true" />} onClick={refresh}>
                    Recargar calendario
                </Button>
                {canCreate && (
                    <Button type="primary" className="calendar-primary" icon={<PlusOutlined aria-hidden="true" />} title="Nuevo evento (N)" onClick={create}>
                        Nuevo evento
                    </Button>
                )}
            </div>
        </header>
    );
}
function calendarInput(event: CalendarEvent, calendars: readonly CalendarDescriptor[], selectedId: string | null): EventInput {
    const colors = calendarEventColors(event, calendars);
    return { id: `${event.source}:${event.id}`, title: event.title, start: event.start, end: event.end, allDay: event.allDay, classNames: [...eventSignals(event), ...(selectedId === `${event.source}:${event.id}` ? ["cal-event--selected"] : [])], color: colors.typeColor, extendedProps: colors };
}
interface SurfaceProps {
    readonly selectedId: string | null;
    readonly data: CalendarData;
    readonly events: readonly CalendarEvent[];
    readonly moduleCode: CalendarModule;
    readonly date: string;
    readonly open: (selection: Selection) => void;
    readonly canCreate: boolean;
    readonly onCreate: (slot: Pick<Selection, "date" | "range">) => void;
    readonly calendarRef: RefObject<CalendarRef | null>;
}
function CalendarSurface({ data, events, moduleCode, date, open, selectedId, canCreate, onCreate, calendarRef }: SurfaceProps) {
    const { updateInterval } = data;
    const datesSet = useCallback(
        (info: DatesSetInfo) => {
            updateInterval({ start: info.start.toISOString(), end: info.end.toISOString() });
        },
        [updateInterval],
    );
    return (
        <section className="formalization-calendar__surface" aria-label={`Calendario de ${CALENDAR_CONTEXT[moduleCode].label}`} aria-busy={data.loading}>
            {data.loading && (
                <div className="calendar-preload" role="status" aria-label="Cargando eventos" aria-live="polite">
                    <Spin size="large" />
                    <span>Cargando eventos…</span>
                </div>
            )}
            <div className="calendar-surface__body" aria-hidden={data.loading} inert={data.loading}>
                <FullCalendar
                    ref={calendarRef}
                    toolbarClass="cal-toolbar"
                    toolbarTitleClass="cal-title"
                    buttonClass="cal-btn"
                    buttonGroupClass="cal-btngroup"
                    dayHeaderClass="cal-dayhead"
                    dayHeaderInnerClass="cal-dayhead-text"
                    dayCellClass="cal-day"
                    dayCellTopClass="cal-daytop"
                    eventClass="cal-event"
                    eventDidMount={({ el, event }) => {
                        el.style.setProperty("--calendar-module-color", String(event.extendedProps.moduleColor));
                        el.title = `${event.title} · ${String(event.extendedProps.moduleLabel)} · ${String(event.extendedProps.typeLabel)}`;
                    }}
                    eventTimeClass="cal-event-time"
                    eventTitleClass="cal-event-title"
                    listItemEventBeforeClass="cal-event-dot"
                    moreLinkClass="cal-more"
                    popoverClass="cal-popover"
                    nowIndicatorLineClass="cal-now-line"
                    eventTimeFormat={EVENT_TIME}
                    dayHeaderFormat={DAY_HEADER}
                    plugins={plugins}
                    initialView="dayGridMonth"
                    initialDate={date}
                    locale={esLocale}
                    timeZone={CALENDAR_TIME_ZONE}
                    firstDay={1}
                    headerToolbar={toolbar}
                    events={events.map((event) => calendarInput(event, data.calendars, selectedId))}
                    datesSet={datesSet}
                    eventClick={(info) => {
                        const event = events.find((entry) => `${entry.source}:${entry.id}` === info.event.id);
                        if (event) open({ event, date: event.start.slice(0, 10), anchor: info.el.getBoundingClientRect() });
                    }}
                    editable={false}
                    selectable={false}
                    views={timeViews(canCreate)}
                    buttons={TOOLBAR_BUTTONS}
                    select={(info) => {
                        if (!canCreate) return;
                        const range = info.allDay ? undefined : { start: wallTime(info.startStr), end: wallTime(info.endStr) };
                        onCreate({ date: wallTime(info.startStr).slice(0, 10), range });
                        calendarRef.current?.getApi().unselect();
                    }}
                    navLinks={false}
                    nowIndicator
                    dayMaxEvents
                    height="100%"
                />
            </div>
        </section>
    );
}
/** Un evento de Outlook se abre como tarjeta al lado, o ampliado en el panel derecho. */
function OutlookSelection({ selection, event, onClose, onExpand, moduleCode, onSaved }: { readonly moduleCode: CalendarModule; readonly onSaved: () => void; readonly selection: Selection; readonly event: CalendarEvent; readonly onClose: () => void; readonly onExpand: (selection: Selection) => void }) {
    if (selection.expanded || !selection.anchor) return <OutlookEventDrawer event={event} onClose={onClose} moduleCode={moduleCode} onSaved={onSaved} />;
    return (
        <OutlookEventPopover
            event={event}
            anchor={selection.anchor ?? null}
            onClose={onClose}
            onExpand={() => {
                onExpand(selection);
            }}
        />
    );
}
function selectionKey(selection: Selection): string {
    return selection.event ? `${selection.event.source}:${selection.event.id}:${String(selection.event.version)}` : `create:${selection.range?.start ?? ""}`;
}
function SelectionDrawer({ selection, data, moduleCode, onClose, onRefresh, onNavigate, onExpand }: { readonly onExpand: (selection: Selection) => void; readonly selection: Selection | null; readonly data: CalendarData; readonly moduleCode: CalendarModule; readonly onClose: () => void; readonly onRefresh: () => void; readonly onNavigate: Props["onNavigate"] }) {
    if (!currentSelection(selection, data.events)) return null;
    if (selection.event?.source === "outlook") return <OutlookSelection selection={selection} event={selection.event} onClose={onClose} onExpand={onExpand} moduleCode={moduleCode} onSaved={onRefresh} />;
    if (selection.event?.outlookDetail && !selection.editing)
        return (
            <OutlookEventDrawer
                event={selection.event}
                onClose={onClose}
                onSaved={onRefresh}
                onEditCrm={() => {
                    onExpand({ ...selection, editing: true });
                }}
            />
        );
    const calendar = selectionCalendar(selection, data, moduleCode);
    if (!calendar) return null;
    const key = selectionKey(selection);
    return <CalendarEventDrawer key={key} event={selection.event} date={selection.date} range={selection.range} calendar={calendar} currentModule={moduleCode} onClose={onClose} onSaved={onRefresh} onRefresh={onRefresh} onNavigate={onNavigate} events={data.events} calendars={data.calendars} />;
}
/** La invitación no concede membresía ni edición sobre el módulo de origen. */
function selectionCalendar(selection: Selection, data: CalendarData, moduleCode: CalendarModule) {
    const origin = selection.event?.originModule ?? moduleCode;
    const descriptor = data.calendars.find((entry) => entry.moduleCode === origin);
    return descriptor && data.selectedModules.includes(origin) ? descriptor : invitationCalendar(selection.event);
}
function currentSelection(selection: Selection | null, events: readonly CalendarEvent[]): selection is Selection {
    return selection !== null && (!selection.event || events.includes(selection.event));
}
function invitationCalendar(event: CalendarEvent | null): CalendarDescriptor | null {
    if (!event?.originModule) return null;
    return { moduleCode: event.originModule, label: CALENDAR_CONTEXT[event.originModule].label, color: "", canCreate: false, canUpdate: false, types: [] };
}
/** Adaptador de Mercadeo. Conserva el mismo contrato del calendario global. */
export function MarketingCalendarPage(props: Omit<Props, "moduleCode">) {
    return <SharedCalendarPage {...props} moduleCode="mercadeo" />;
}
/** Adaptador de Ventas. */
export function SalesCalendarPage(props: Omit<Props, "moduleCode">) {
    return <SharedCalendarPage {...props} moduleCode="ventas" />;
}
/** Adaptador de Contabilidad. */
export function AccountingCalendarPage(props: Omit<Props, "moduleCode">) {
    return <SharedCalendarPage {...props} moduleCode="contabilidad" />;
}
