import { CALENDAR_CONTEXT } from "./calendar-config";
import { utcToLocal } from "./calendar-time";
import type { useCalendarNotifications } from "./useCalendarNotifications";
/** El enlace abre el detalle existente y el servidor vuelve a validar acceso y autoría. */
export function CalendarNotificationList({ model, onOpen }: { readonly model: ReturnType<typeof useCalendarNotifications>; readonly onOpen: () => void }) {
    if (model.items.length === 0) return model.failure ? <p role="status">{model.failure}</p> : null;
    return (
        <section aria-label="Avisos del calendario">
            <h3>Calendario</h3>
            {model.failure && <p role="status">{model.failure}</p>}
            <ul className="note-notification-list">
                {model.items.map((item) => (
                    <li key={item.id} data-unread={item.readAt === null}>
                        <a
                            className="note-notification-list__open"
                            href={`${CALENDAR_CONTEXT[item.contextModule].path}?${new URLSearchParams({ date: utcToLocal(item.start).slice(0, 10), event: item.eventId })}`}
                            onClick={(action) => {
                                action.preventDefault();
                                const path = action.currentTarget.href;
                                void model.mark(item).then(() => {
                                    onOpen();
                                    window.location.assign(path);
                                });
                            }}
                        >
                            <span className="note-notification-list__body">
                                <strong>{item.title}</strong>
                                <span>
                                    {item.organizer} · {({ invitation: "Te invitó al evento", event_cancelled: "Canceló el evento" } as Record<string, string>)[item.kind] ?? "Actualizó el evento"}
                                </span>
                                <time dateTime={item.start}>{new Date(item.start).toLocaleString("es-CR", { timeZone: "America/Costa_Rica" })}</time>
                            </span>
                        </a>
                        {item.readAt === null && (
                            <button
                                type="button"
                                aria-label={`Marcar aviso de ${item.title} como leído`}
                                onClick={() => {
                                    void model.mark(item);
                                }}
                            >
                                Marcar leído
                            </button>
                        )}
                    </li>
                ))}
            </ul>
        </section>
    );
}
