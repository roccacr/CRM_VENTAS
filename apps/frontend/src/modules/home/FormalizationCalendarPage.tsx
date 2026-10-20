import "./FormalizationHomePage.css";
import "./FormalizationCalendarPage.css";

import CalendarOutlined from "@ant-design/icons/CalendarOutlined";
import CheckCircleOutlined from "@ant-design/icons/CheckCircleOutlined";
import LeftOutlined from "@ant-design/icons/LeftOutlined";
import PlusOutlined from "@ant-design/icons/PlusOutlined";
import RightOutlined from "@ant-design/icons/RightOutlined";
import UnorderedListOutlined from "@ant-design/icons/UnorderedListOutlined";
import Button from "antd/es/button";
import Calendar from "antd/es/calendar";
import ConfigProvider from "antd/es/config-provider";
import esES from "antd/es/locale/es_ES";
import Segmented from "antd/es/segmented";
import { type ComponentProps, useEffect, useState } from "react";

import { PROJECTS_THEME } from "../administration/catalogs/projects-theme";
import { calendarDateKey, calendarDateLabel, EVENT_KIND_LABELS, EVENT_STATUS_LABELS, type FormalizationCalendarEvent, newCalendarEvent, recordCalendarChange, validateCalendarEvent } from "./formalization-calendar.model";
import type { FormalizationExample } from "./formalization-preview.model";
import { useFormalizationPreview } from "./formalization-preview-session";
import { FormalizationCalendarEventDialog } from "./FormalizationCalendarEventDialog";
import { FormalizationOrderPreview } from "./FormalizationOrderPreview";
import { FormalizationPreviewBoundary } from "./FormalizationPreviewSession";

type CalendarHeaderProps = Parameters<NonNullable<ComponentProps<typeof Calendar>["headerRender"]>>[0];

function CalendarHeader({ value, onChange, selectedDate }: CalendarHeaderProps & { readonly selectedDate: string }) {
    useEffect(() => {
        if (value.format("YYYY-MM-DD") === selectedDate) return;
        const target = new Date(`${selectedDate}T12:00:00`);
        onChange(value.date(1).year(target.getFullYear()).month(target.getMonth()).date(target.getDate()));
    }, [selectedDate, value, onChange]);
    return (
        <div className="formalization-calendar__month-head">
            <h2>{value.toDate().toLocaleDateString("es-CR", { month: "long", year: "numeric" })}</h2>
            <div>
                <Button
                    aria-label="Mes anterior"
                    title="Mes anterior"
                    icon={<LeftOutlined />}
                    onClick={() => {
                        onChange(value.subtract(1, "month"));
                    }}
                />
                <Button
                    onClick={() => {
                        const now = new Date();
                        onChange(value.date(1).year(now.getFullYear()).month(now.getMonth()).date(now.getDate()));
                    }}
                >
                    Hoy
                </Button>
                <Button
                    aria-label="Mes siguiente"
                    title="Mes siguiente"
                    icon={<RightOutlined />}
                    onClick={() => {
                        onChange(value.add(1, "month"));
                    }}
                />
            </div>
        </div>
    );
}

const formatEventTotal = (total: number) => `${String(total)} ${total === 1 ? "evento" : "eventos"}`;

function EventList({ events, onEdit }: { readonly events: readonly FormalizationCalendarEvent[]; readonly onEdit: (event: FormalizationCalendarEvent) => void }) {
    if (events.length === 0)
        return (
            <div className="formalization-calendar__empty">
                <CalendarOutlined aria-hidden="true" />
                <h3>Sin eventos</h3>
                <p>No hay tareas o reuniones con estos filtros.</p>
            </div>
        );
    return (
        <ul className="formalization-calendar__events">
            {events.map((event) => (
                <li key={event.id}>
                    <button
                        type="button"
                        className={`formalization-calendar__event formalization-calendar__event--${event.kind} formalization-calendar__event--${event.status}`}
                        onClick={() => {
                            onEdit(event);
                        }}
                    >
                        <span className="formalization-calendar__event-time">
                            {event.start} – {event.end} · {calendarDateLabel(event.date)}
                        </span>
                        <strong>{event.title}</strong>
                        <span className="formalization-calendar__event-order">
                            <code className="formalization-code">{event.orderId}</code> {event.owner}
                        </span>
                        <span className="formalization-calendar__event-meta">
                            <span className="formalization-calendar__kind">{EVENT_KIND_LABELS[event.kind]}</span>
                            <span className={`formalization-status formalization-calendar__status--${event.status}`}>{EVENT_STATUS_LABELS[event.status]}</span>
                        </span>
                    </button>
                </li>
            ))}
        </ul>
    );
}

interface CalendarToolbarProps {
    readonly view: string;
    readonly kind: string;
    readonly orderId: string;
    readonly orders: readonly FormalizationExample[];
    readonly onView: (view: string) => void;
    readonly onKind: (kind: string) => void;
    readonly onOrder: (orderId: string) => void;
}

function CalendarToolbar({ view, kind, orderId, orders, onView, onKind, onOrder }: CalendarToolbarProps) {
    const active = Number(kind !== "all") + Number(orderId !== "all");
    return (
        <div className="formalization-toolbar formalization-calendar__toolbar">
            <Segmented
                aria-label="Vista del calendario"
                options={[
                    { value: "month", label: "Mes", icon: <CalendarOutlined /> },
                    { value: "agenda", label: "Agenda", icon: <UnorderedListOutlined /> },
                ]}
                value={view}
                onChange={onView}
            />
            <label className="formalization-field">
                <span>Tipo</span>
                <select
                    aria-label="Filtrar tipo de evento"
                    value={kind}
                    onChange={(e) => {
                        onKind(e.target.value);
                    }}
                >
                    <option value="all">Todos</option>
                    <option value="meeting">Reuniones</option>
                    <option value="task">Tareas</option>
                </select>
            </label>
            <label className="formalization-field formalization-calendar__order-field">
                <span>Orden de venta</span>
                <select
                    aria-label="Filtrar orden de venta"
                    value={orderId}
                    onChange={(e) => {
                        onOrder(e.target.value);
                    }}
                >
                    <option value="all">Todas las órdenes</option>
                    {orders.map((item) => (
                        <option key={item.id} value={item.id}>
                            {item.id} · {item.project}
                        </option>
                    ))}
                </select>
            </label>
            <div className="formalization-toolbar__commands" aria-live="polite">
                {active > 0 && <span className="formalization-filter-counter">Filtros activos: {active}</span>}
                {active > 0 && (
                    <Button
                        className="formalization-command"
                        onClick={() => {
                            onKind("all");
                            onOrder("all");
                        }}
                    >
                        Limpiar
                    </Button>
                )}
            </div>
        </div>
    );
}

/** Agenda local de demostración. No persiste eventos ni modifica órdenes reales. */
function FormalizationCalendarContent() {
    const { events, setEvents, calendarOrderId, orders } = useFormalizationPreview();
    const [selectedDate, setSelectedDate] = useState(() => calendarDateKey(new Date()));
    const [draft, setDraft] = useState<FormalizationCalendarEvent | null>(null);
    const [kind, setKind] = useState("all");
    const [orderId, setOrderId] = useState(calendarOrderId);
    const [view, setView] = useState("month");
    const [order, setOrder] = useState<FormalizationExample | null>(null);
    const [notice, setNotice] = useState("");
    const filtered = events.filter((item) => (kind === "all" || item.kind === kind) && (orderId === "all" || item.orderId === orderId)).sort((a, b) => `${a.date}${a.start}`.localeCompare(`${b.date}${b.start}`));
    const dayEvents = filtered.filter((item) => item.date === selectedDate);
    const save = (event: FormalizationCalendarEvent) => {
        validateCalendarEvent(event);
        const saved = recordCalendarChange(
            { ...event, title: event.title.trim(), id: event.id || crypto.randomUUID() },
            events.find((item) => item.id === event.id),
            new Date().toLocaleString("es-CR"),
        );
        setEvents((current) => [...current.filter((item) => item.id !== saved.id), saved]);
        setSelectedDate(event.date);
        setKind("all");
        setOrderId("all");
        setDraft(null);
        setNotice("Evento guardado.");
    };
    if (order)
        return (
            <ConfigProvider theme={PROJECTS_THEME} locale={esES}>
                <div className="global-home-dashboard formalization-home">
                    <FormalizationOrderPreview
                        order={order}
                        onNavigate={() => {
                            setOrderId(order.id);
                            setOrder(null);
                        }}
                        onBack={() => {
                            setOrder(null);
                        }}
                    />
                </div>
            </ConfigProvider>
        );
    return (
        <ConfigProvider theme={PROJECTS_THEME} locale={esES}>
            <div className="global-home-dashboard formalization-home formalization-calendar">
                <header className="global-home-page-header formalization-page-header">
                    <div>
                        <nav className="formalization-breadcrumb" aria-label="Ruta">
                            <span>Formalización</span>
                            <span aria-hidden="true">/</span>
                            <span>Calendario</span>
                        </nav>
                        <div className="formalization-title-row">
                            <h1>Calendario</h1>
                            <span className="formalization-total">{formatEventTotal(filtered.length)}</span>
                        </div>
                        <p className="formalization-page-header__caption">Tareas y reuniones</p>
                    </div>
                    <div className="global-home-page-header__actions">
                        <Button
                            type="primary"
                            aria-label="Nuevo evento"
                            icon={<PlusOutlined />}
                            onClick={() => {
                                setDraft({ ...newCalendarEvent(selectedDate), orderId: orderId === "all" ? "" : orderId });
                            }}
                        >
                            Nuevo evento
                        </Button>
                    </div>
                </header>
                <p className="formalization-calendar__notice" role="status">
                    {notice && (
                        <>
                            <CheckCircleOutlined aria-hidden="true" /> {notice}
                        </>
                    )}
                </p>
                <section className="formalization-surface formalization-calendar__surface" aria-label="Agenda de Formalización">
                    <CalendarToolbar view={view} kind={kind} orderId={orderId} orders={orders} onView={setView} onKind={setKind} onOrder={setOrderId} />
                    <div className={`formalization-calendar__workspace formalization-calendar__workspace--${view}`}>
                        {view === "month" && (
                            <section className="formalization-calendar__month" aria-label="Calendario mensual">
                                <div className="formalization-calendar__month-scroll">
                                    <Calendar
                                        headerRender={(props) => <CalendarHeader {...props} selectedDate={selectedDate} />}
                                        onSelect={(date) => {
                                            setSelectedDate(date.format("YYYY-MM-DD"));
                                        }}
                                        cellRender={(date, info) => {
                                            if (info.type !== "date") return info.originNode;
                                            return (
                                                <div className="formalization-calendar__cell-events">
                                                    {filtered
                                                        .filter((item) => item.date === date.format("YYYY-MM-DD"))
                                                        .map((event) => (
                                                            <button
                                                                type="button"
                                                                key={event.id}
                                                                className={`formalization-calendar__cell-event formalization-calendar__cell-event--${event.kind} formalization-calendar__cell-event--${event.status}`}
                                                                title={`${event.title} · ${EVENT_STATUS_LABELS[event.status]}`}
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    setDraft(event);
                                                                }}
                                                            >
                                                                {event.start} {event.title}
                                                            </button>
                                                        ))}
                                                </div>
                                            );
                                        }}
                                    />
                                </div>
                            </section>
                        )}
                        <section className="formalization-calendar__agenda" aria-labelledby="calendar-agenda-title">
                            <div className="formalization-calendar__agenda-head">
                                <h2 id="calendar-agenda-title">{view === "month" ? "Agenda del día" : "Todos los eventos"}</h2>
                                <span>{view === "month" ? calendarDateLabel(selectedDate) : "Eventos"}</span>
                            </div>
                            <EventList events={view === "month" ? dayEvents : filtered} onEdit={setDraft} />
                        </section>
                    </div>
                </section>
                {draft && (
                    <FormalizationCalendarEventDialog
                        key={draft.id}
                        initial={draft}
                        onSave={save}
                        onClose={() => {
                            setDraft(null);
                        }}
                        onOpenOrder={(id) => {
                            setDraft(null);
                            setOrder(orders.find((item) => item.id === id) ?? null);
                        }}
                    />
                )}
            </div>
        </ConfigProvider>
    );
}

/** Agenda local vinculada a las mismas órdenes del recorrido visual. */
export function FormalizationCalendarPage() {
    return (
        <FormalizationPreviewBoundary>
            <FormalizationCalendarContent />
        </FormalizationPreviewBoundary>
    );
}
