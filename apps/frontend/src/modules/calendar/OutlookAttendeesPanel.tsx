import type { OutlookEventDetail, OutlookPerson } from "../../services/calendar/calendar-service";
import { displayName, groupAttendees, initials, invitees, KIND_LABEL } from "./calendar-outlook-people";

function Person({ person, caption }: { readonly person: OutlookPerson; readonly caption: string }) {
    return (
        <li className="outlook-person">
            <span className="outlook-person__avatar" aria-hidden="true">
                {initials(person)}
            </span>
            <span className="outlook-person__text">
                <strong title={person.email ?? undefined}>{displayName(person)}</strong>
                <small>{caption}</small>
            </span>
        </li>
    );
}

/** Seguimiento: quién organizó el evento y cómo respondió cada persona invitada, como lo muestra Outlook. */
export function OutlookAttendeesPanel({ detail }: { readonly detail: OutlookEventDetail }) {
    const shown = invitees(detail);
    const groups = groupAttendees(shown);
    const hidden = detail.attendeeCount - detail.attendees.length;
    const total = shown.length + hidden;
    return (
        <aside className="event-card outlook-attendees" aria-label="Seguimiento">
            <h2 className="event-card__head">Seguimiento</h2>
            <div className="outlook-attendees__body">
                <h3>Organizador</h3>
                {detail.organizer ? (
                    <ul className="outlook-people">
                        <Person person={detail.organizer} caption={detail.organizer.email ?? "Organizador"} />
                    </ul>
                ) : (
                    <p className="outlook-attendees__empty">Sin organizador.</p>
                )}
                <h3>Asistentes{total > 0 ? ` (${String(total)})` : ""}</h3>
                {groups.length === 0 && <p className="outlook-attendees__empty">Nadie más fue invitado.</p>}
                {groups.map((group) => (
                    <details key={group.key} open>
                        <summary>
                            {group.label}: {group.items.length}
                        </summary>
                        <ul className="outlook-people">
                            {group.items.map((attendee, index) => (
                                <Person key={`${attendee.email ?? "x"}:${String(index)}`} person={attendee} caption={KIND_LABEL[attendee.kind]} />
                            ))}
                        </ul>
                    </details>
                ))}
                {hidden > 0 && <p className="outlook-attendees__empty">y {hidden} más no se muestran.</p>}
            </div>
        </aside>
    );
}
