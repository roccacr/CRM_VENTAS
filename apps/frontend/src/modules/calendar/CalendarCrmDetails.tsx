import Skeleton from "antd/es/skeleton";
import { useEffect, useState } from "react";

import { type CalendarCrmDetail, type CalendarEvent, getCalendarCrmDetail, markCalendarEventRead } from "../../services/calendar/calendar-service";
import { leadProfilePath } from "../../services/leads/lead-profile-service";
import { CALENDAR_CONTEXT } from "./calendar-config";

const statusLabels = { scheduled: "Programado", completed: "Completado", cancelled: "Cancelado" };
const linkLabels = { lead: "Lead / cliente", sales_order: "Orden de venta", note: "Nota" };
const whenFormat = new Intl.DateTimeFormat("es-CR", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Costa_Rica" });
const when = (value: string | null) => (value ? whenFormat.format(new Date(value)) : "—");
function linkedRecordPath(link: CalendarCrmDetail["links"][number]): string | null {
    if (!link.canOpen) return null;
    if (link.entityType === "lead") return leadProfilePath(link);
    if (link.entityType === "sales_order") return `/home/formalization?${new URLSearchParams({ orderSource: link.source, orderId: link.id })}`;
    return null;
}
/** Datos del registro vinculado, ya autorizados por recurso en el servidor. */
export function CalendarCrmDetails({ event }: { readonly event: CalendarEvent }) {
    if (!event.crmDetail)
        return (
            <section className="event-card calendar-crm-detail" aria-label="Datos CRM">
                <h2>Datos CRM</h2>
                <p>{event.source === "outlook" ? "Sin registro CRM vinculado." : "No hay detalles CRM adicionales disponibles."}</p>
            </section>
        );
    return event.crmDetail.loaded ? <CrmContent crm={event.crmDetail} outlookBody={event.description} eventId={event.id} /> : <CrmLoader event={event} />;
}
function CrmLoader({ event }: { readonly event: CalendarEvent }) {
    const [revision, setRevision] = useState(0);
    const key = `${event.id}:${String(event.version)}:${String(revision)}`;
    const [snapshot, setSnapshot] = useState<{ key: string; detail: CalendarCrmDetail | null } | null>(null);
    useEffect(() => {
        const controller = new AbortController();
        void getCalendarCrmDetail(event.id)
            .then((detail) => {
                if (!controller.signal.aborted) setSnapshot({ key, detail });
            })
            .catch(() => {
                if (!controller.signal.aborted) setSnapshot({ key, detail: null });
            });
        return () => {
            controller.abort();
        };
    }, [event.id, key]);
    if (snapshot?.key !== key)
        return (
            <section className="event-card calendar-crm-detail" role="status" aria-label="Cargando datos CRM">
                <Skeleton active paragraph={{ rows: 5 }} />
            </section>
        );
    if (!snapshot.detail)
        return (
            <section className="event-card calendar-crm-detail" aria-label="Datos CRM">
                <h2>Datos CRM</h2>
                <p role="status">No se pudieron consultar los datos CRM actuales.</p>
                <button
                    type="button"
                    onClick={() => {
                        setRevision((value) => value + 1);
                    }}
                >
                    Reintentar
                </button>
            </section>
        );
    return <CrmContent crm={snapshot.detail} outlookBody={event.description} eventId={event.id} />;
}
/** The note already shows in the event card when the Outlook body carries it, so it is not printed twice. */
const alreadyShown = (crm: CalendarCrmDetail, outlookBody: string | null): boolean => Boolean(crm.description) && Boolean(outlookBody) && (outlookBody ?? "").includes((crm.description ?? "").trim());
function CrmLinks({ crm }: { readonly crm: CalendarCrmDetail }) {
    return (
        <>
            <h3>Registros vinculados</h3>
            {crm.links.length ? (
                <ul>
                    {crm.links.map((link) => (
                        <li key={`${link.entityType}:${link.source}:${link.id}`}>
                            <strong>{linkLabels[link.entityType]}:</strong>{" "}
                            {linkedRecordPath(link) ? (
                                <a href={linkedRecordPath(link) ?? undefined} target="_blank" rel="noopener noreferrer" aria-label={`Ver ${linkLabels[link.entityType]} ${link.label} (nueva pestaña)`}>
                                    {link.label} ↗
                                </a>
                            ) : (
                                link.label
                            )}
                            {link.secondary && <small> · {link.secondary}</small>}
                        </li>
                    ))}
                </ul>
            ) : (
                <p>Sin vínculos visibles.</p>
            )}
            {crm.restrictedLinks && <p>Hay vínculos restringidos por tus permisos.</p>}
        </>
    );
}
function CrmParticipants({ crm }: { readonly crm: CalendarCrmDetail }) {
    return (
        <>
            <h3>Participantes registrados en CRM</h3>
            {crm.participants.length ? (
                <ul>
                    {crm.participants.map((person, index) => (
                        <li key={`${person.email ?? person.label}:${String(index)}`}>
                            {person.label}
                            {person.email && person.email !== person.label && <small> · {person.email}</small>}
                        </li>
                    ))}
                </ul>
            ) : (
                <p>Sin participantes registrados.</p>
            )}
        </>
    );
}
function CrmContent({ crm, outlookBody, eventId }: { readonly crm: CalendarCrmDetail; readonly outlookBody: string | null; readonly eventId: string }) {
    useEffect(() => {
        // Un fallo del acuse no bloquea el detalle ni borra avisos sin confirmación del servidor.
        void markCalendarEventRead(eventId).catch(() => undefined);
    }, [eventId]);
    return (
        <section className="event-card calendar-crm-detail" aria-label="Datos CRM">
            <h2>Datos CRM</h2>
            <p className="calendar-crm-detail__type">
                <span aria-hidden="true" style={{ backgroundColor: crm.typeColor ?? "#64748b" }} />
                {crm.typeLabel}
                {crm.typeColor && <small>{crm.typeColor}</small>}
            </p>
            {crm.colorOverride && (
                <p>
                    Color del evento: <span className="calendar-crm-detail__color" style={{ backgroundColor: crm.colorOverride }} /> {crm.colorOverride}
                </p>
            )}
            <CrmValues crm={crm} version={crm.version} showDescription={!alreadyShown(crm, outlookBody)} />
            <hr className="calendar-crm-detail__rule" />
            <CrmLinks crm={crm} />
            <hr className="calendar-crm-detail__rule" />
            <CrmParticipants crm={crm} />
        </section>
    );
}

type Field = readonly [label: string, value: string | null | undefined, optional?: boolean];
function FieldGroup({ title, fields }: { readonly title: string; readonly fields: readonly Field[] }) {
    // Optional fields that hold nothing are left out instead of printing a row of dashes.
    const shown = fields.filter(([, value, optional]) => !optional || Boolean(value));
    if (shown.length === 0) return null;
    return (
        <>
            <hr className="calendar-crm-detail__rule" />
            <div className="calendar-crm-detail__group">
                <h3>{title}</h3>
                <dl>
                    {shown.map(([label, value]) => (
                        <div key={label}>
                            <dt>{label}</dt>
                            <dd>{value || "—"}</dd>
                        </div>
                    ))}
                </dl>
            </div>
        </>
    );
}
function CrmValues({ crm, version, showDescription }: { readonly crm: CalendarCrmDetail; readonly version: number; readonly showDescription: boolean }) {
    return (
        <>
            <FieldGroup
                title="Resumen"
                fields={[
                    ["Módulo", CALENDAR_CONTEXT[crm.moduleCode].label],
                    ["Estado", statusLabels[crm.status]],
                    ["Nombre en CRM", crm.title],
                    ["Referencia interna", crm.reference, true],
                    ["Organizador", crm.organizerName],
                ]}
            />
            <FieldGroup
                title="Programación"
                fields={[
                    ["Inicio", when(crm.start)],
                    ["Fin", when(crm.end)],
                    ["Día completo", crm.allDay ? "Sí" : "No"],
                    ["Zona horaria", crm.timezone],
                    ["Lugar", crm.location, true],
                    ["Sala / recurso", crm.roomAddress, true],
                    ["Reunión Teams solicitada", crm.teamsRequested ? "Sí" : "No"],
                ]}
            />
            <FieldGroup
                title="Auditoría"
                fields={[
                    ["Creado", when(crm.createdAt)],
                    ["Última actualización", when(crm.updatedAt)],
                    ["Versión", String(version)],
                    ["Versión de invitación", crm.invitationVersion === null ? null : String(crm.invitationVersion), true],
                    ["Motivo de cancelación", crm.cancellationReason, true],
                ]}
            />
            {showDescription && (
                <>
                    <hr className="calendar-crm-detail__rule" />
                    <div className="calendar-crm-detail__group">
                        <h3>Descripción guardada en CRM</h3>
                        <p className="calendar-crm-detail__description">{crm.description || "Sin descripción."}</p>
                    </div>
                </>
            )}
        </>
    );
}
