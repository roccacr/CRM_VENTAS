import CalendarOutlined from "@ant-design/icons/CalendarOutlined";
import Button from "antd/es/button";
import Tag from "antd/es/tag";
import { useState } from "react";

import type { LeadProfileEvent, LeadProfileResult } from "../../services/leads/lead-profile-service";
import { formatStamp, labelTone, type OrderFilter, ORIGIN_LABEL, profileEvents } from "./lead-profile-model";
import { ProfileCard } from "./LeadProfileFields";

type Events = NonNullable<LeadProfileResult["events"]>;
interface Props {
    readonly events: Events;
    readonly page: number;
    readonly refreshing: boolean;
    readonly onPage: (page: number) => void;
}
const FILTERS: readonly { readonly id: OrderFilter; readonly label: string }[] = [
    { id: "all", label: "Todos" },
    { id: "native", label: "Nuevos" },
    { id: "legacy", label: "Anteriores" },
];
const timeRange = (event: LeadProfileEvent): string => [event.startTime, event.endTime].filter(Boolean).join(" – ") || "Todo el día";

function EventRow({ event }: { readonly event: LeadProfileEvent }) {
    return (
        <tr>
            <td>{event.date ? formatStamp(event.date) : "—"}</td>
            <td className="profile-table__time">{timeRange(event)}</td>
            <th scope="row">{event.title ?? "Sin nombre"}</th>
            <td>{event.type ?? "—"}</td>
            <td>
                {event.status ? (
                    <span className="profile-chip" data-tone={labelTone(event.status)}>
                        {event.status}
                    </span>
                ) : (
                    "—"
                )}
            </td>
            <td>
                <Tag>{ORIGIN_LABEL[event.source]}</Tag>
            </td>
        </tr>
    );
}
function EventsTable({ rows }: { readonly rows: readonly LeadProfileEvent[] }) {
    return (
        <div className="profile-table-wrap">
            <table className="profile-table">
                <thead>
                    <tr>
                        <th scope="col">Fecha</th>
                        <th scope="col">Hora</th>
                        <th scope="col">Evento</th>
                        <th scope="col">Tipo</th>
                        <th scope="col">Estado</th>
                        <th scope="col">Origen</th>
                    </tr>
                </thead>
                <tbody>
                    {rows.map((event) => (
                        <EventRow key={`${event.source}:${event.id}`} event={event} />
                    ))}
                </tbody>
            </table>
        </div>
    );
}
function SourceFilter({ events, filter, onChange }: { readonly events: Events; readonly filter: OrderFilter; readonly onChange: (filter: OrderFilter) => void }) {
    return (
        <div className="profile-toolbar">
            <div className="profile-filter" role="group" aria-label="Origen de los eventos">
                {FILTERS.map((option) => (
                    <button
                        key={option.id}
                        type="button"
                        aria-pressed={option.id === filter}
                        onClick={() => {
                            onChange(option.id);
                        }}
                    >
                        {option.label}
                        <em>{profileEvents(events, option.id).length}</em>
                    </button>
                ))}
            </div>
        </div>
    );
}

/** Eventos de calendario del cliente, de cualquiera de las dos bases, en una tabla y lo más nuevo primero. El paginador aparece solo si existe otra página. */
export function LeadProfileEvents({ events, page, refreshing, onPage }: Props) {
    const [filter, setFilter] = useState<OrderFilter>("all");
    const rows = profileEvents(events, filter);
    const hasMore = events.native.hasMore || events.legacy.hasMore;
    return (
        <ProfileCard title="Lista de eventos" className="profile-card--events">
            <SourceFilter events={events} filter={filter} onChange={setFilter} />
            <div className="profile-section-body" aria-busy={refreshing} data-loading={refreshing}>
                {rows.length === 0 ? (
                    <div className="profile-empty">
                        <CalendarOutlined aria-hidden="true" />
                        <p>No hay eventos registrados para este cliente.</p>
                    </div>
                ) : (
                    <EventsTable rows={rows} />
                )}
            </div>
            {(page > 1 || hasMore) && (
                <footer className="profile-pager">
                    <Button
                        disabled={page === 1 || refreshing}
                        onClick={() => {
                            onPage(page - 1);
                        }}
                    >
                        Eventos anteriores
                    </Button>
                    <span>Página {page}</span>
                    <Button
                        disabled={!hasMore || refreshing}
                        onClick={() => {
                            onPage(page + 1);
                        }}
                    >
                        Más eventos
                    </Button>
                </footer>
            )}
        </ProfileCard>
    );
}
