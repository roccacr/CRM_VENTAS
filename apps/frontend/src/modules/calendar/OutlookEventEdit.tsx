import { useState } from "react";

import { type CalendarEvent, type CalendarModule, updateOwnOutlookEvent } from "../../services/calendar/calendar-service";
import { localToUtc, utcToLocal } from "./calendar-time";

/** Conserva contenido, asistentes y reunión online; modifica solo datos básicos de la cita propia. */
export function OutlookEventEdit({ event, moduleCode, onSaved }: { readonly event: CalendarEvent; readonly moduleCode: CalendarModule; readonly onSaved: () => void }) {
    const [editing, setEditing] = useState(false);
    const [fields, setFields] = useState({ title: event.title, location: event.location ?? "", start: utcToLocal(event.start).slice(0, 16), end: utcToLocal(event.end).slice(0, 16) });
    const [busy, setBusy] = useState(false);
    const [failure, setFailure] = useState("");
    const scheduleLocked = [busy, event.allDay].some(Boolean);
    if (![event.canEdit, event.outlookDetail?.isOrganizer, event.outlookVersion].every(Boolean)) return null;
    if (!editing)
        return (
            <button
                type="button"
                onClick={() => {
                    setEditing(true);
                }}
            >
                Editar mi evento
            </button>
        );
    const save = async () => {
        if (busy) return;
        setBusy(true);
        setFailure("");
        try {
            await updateOwnOutlookEvent(event, moduleCode, { ...fields, start: event.allDay ? event.start : localToUtc(fields.start), end: event.allDay ? event.end : localToUtc(fields.end), allDay: event.allDay });
            onSaved();
        } catch {
            setFailure("No se confirmó la edición en Outlook. Recarga el evento y revisa su versión y organizador antes de reintentar.");
        } finally {
            setBusy(false);
        }
    };
    return (
        <form
            className="event-card event-grid"
            aria-label="Editar evento propio de Outlook"
            onSubmit={(action) => {
                action.preventDefault();
                void save();
            }}
        >
            <label>
                Nombre del evento *
                <input
                    required
                    maxLength={300}
                    disabled={busy}
                    value={fields.title}
                    onChange={(e) => {
                        setFields({ ...fields, title: e.target.value });
                    }}
                />
            </label>
            <label>
                Lugar
                <input
                    maxLength={500}
                    disabled={busy}
                    value={fields.location}
                    onChange={(e) => {
                        setFields({ ...fields, location: e.target.value });
                    }}
                />
            </label>
            <label>
                Inicio *
                <input
                    required
                    type="datetime-local"
                    disabled={scheduleLocked}
                    value={fields.start}
                    onChange={(e) => {
                        setFields({ ...fields, start: e.target.value });
                    }}
                />
            </label>
            <label>
                Fin *
                <input
                    required
                    type="datetime-local"
                    disabled={scheduleLocked}
                    value={fields.end}
                    onChange={(e) => {
                        setFields({ ...fields, end: e.target.value });
                    }}
                />
            </label>
            {event.allDay && <p>Evento de día completo: se conservan las fechas originales de Outlook.</p>}
            {failure && <p role="alert">{failure}</p>}
            <button type="submit" disabled={busy}>
                {busy ? "Guardando…" : "Guardar cambios en Outlook"}
            </button>
            <button
                type="button"
                disabled={busy}
                onClick={() => {
                    setEditing(false);
                }}
            >
                Cancelar
            </button>
        </form>
    );
}
