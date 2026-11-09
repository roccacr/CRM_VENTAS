import CheckCircleOutlined from "@ant-design/icons/CheckCircleOutlined";
import ClockCircleOutlined from "@ant-design/icons/ClockCircleOutlined";
import EnvironmentOutlined from "@ant-design/icons/EnvironmentOutlined";
import LinkOutlined from "@ant-design/icons/LinkOutlined";
import TeamOutlined from "@ant-design/icons/TeamOutlined";
import VideoCameraOutlined from "@ant-design/icons/VideoCameraOutlined";
import Button from "antd/es/button";
import Drawer from "antd/es/drawer";
import type { ReactNode } from "react";

import type { CalendarEvent, CalendarModule, OutlookEventDetail } from "../../services/calendar/calendar-service";
import { ADMINISTRATION_DRAWER_CLOSE_PLACEMENT, ADMINISTRATION_DRAWER_PROPS } from "../administration/administration-theme";
import { agendaWhen } from "./calendar-agenda";
import { type OutlookDescription, parseOutlookDescription } from "./calendar-outlook-detail";
import { outlookTags } from "./calendar-outlook-facts";
import { acceptedSummary, RESPONSE_LABEL, whoLine } from "./calendar-outlook-people";
import { CALENDAR_TIME_ZONE, calendarToday } from "./calendar-time";
import { CalendarCrmDetails } from "./CalendarCrmDetails";
import { CalendarEventActions } from "./CalendarEventActions";
import { OutlookAttendeesPanel } from "./OutlookAttendeesPanel";
import { OutlookEventEdit } from "./OutlookEventEdit";

const endFormat = new Intl.DateTimeFormat("es-CR", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: CALENDAR_TIME_ZONE });

function whenLabel(event: CalendarEvent): string {
    const when = agendaWhen(event, calendarToday());
    const end = !event.allDay && event.end ? ` — ${endFormat.format(new Date(event.end))}` : "";
    return `${when.day} · ${when.hour}${end}`;
}
function Row({ icon, children }: { readonly icon: ReactNode; readonly children: ReactNode }) {
    return (
        <p className="outlook-popover__row">
            {icon}
            <span>{children}</span>
        </p>
    );
}
function Tags({ detail }: { readonly detail: OutlookEventDetail | undefined }) {
    const tags = outlookTags(detail);
    if (tags.length === 0) return null;
    return (
        <ul className="outlook-tags" aria-label="Características del evento">
            {tags.map((tag) => (
                <li key={tag}>{tag}</li>
            ))}
        </ul>
    );
}
function PeopleRows({ detail }: { readonly detail: OutlookEventDetail | undefined }) {
    if (!detail) return null;
    const accepted = acceptedSummary(detail);
    const mine = detail.myResponse && !detail.isOrganizer && detail.myResponse !== "none" ? RESPONSE_LABEL[detail.myResponse] : "";
    return (
        <>
            {whoLine(detail) && (
                <Row icon={<TeamOutlined aria-hidden="true" />}>
                    {whoLine(detail)}
                    {accepted ? ` · ${accepted}` : ""}
                </Row>
            )}
            {mine && <Row icon={<CheckCircleOutlined aria-hidden="true" />}>Tu respuesta: {mine}</Row>}
        </>
    );
}
function TeamsBlock({ description, joinUrl }: { readonly description: OutlookDescription; readonly joinUrl: string | null }) {
    if (!joinUrl) return null;
    const credentials = [description.meetingId ? `ID: ${description.meetingId}` : "", description.passcode ? `Código: ${description.passcode}` : ""].filter(Boolean).join(" · ");
    return (
        <div className="outlook-detail__teams">
            <VideoCameraOutlined aria-hidden="true" />
            <div>
                <strong>Reunión de Microsoft Teams</strong>
                {credentials && <small>{credentials}</small>}
            </div>
            <Button type="primary" href={joinUrl} target="_blank" rel="noopener noreferrer">
                Unirse
            </Button>
        </div>
    );
}
function SummarySection({ description }: { readonly description: OutlookDescription }) {
    if (!description.summary && !description.reference) return null;
    return (
        <>
            <hr className="outlook-detail__rule" />
            <div className="outlook-detail__section">
                <h3>Descripción</h3>
                {description.summary && <p className="outlook-detail__summary">{description.summary}</p>}
                {description.reference && (
                    <p className="outlook-detail__reference">
                        Referencia: <code>{description.reference}</code>
                    </p>
                )}
            </div>
        </>
    );
}
function EventCard({ event, description, joinUrl }: { readonly event: CalendarEvent; readonly description: OutlookDescription; readonly joinUrl: string | null }) {
    return (
        <section className="event-card outlook-detail__card" aria-label="Datos del evento">
            <h2>{event.title}</h2>
            <Tags detail={event.outlookDetail} />
            <div className="outlook-detail__meta">
                <PeopleRows detail={event.outlookDetail} />
                <Row icon={<ClockCircleOutlined aria-hidden="true" />}>{whenLabel(event)}</Row>
                {event.location && <Row icon={<EnvironmentOutlined aria-hidden="true" />}>{event.location}</Row>}
            </div>
            <SummarySection description={description} />
            {joinUrl && <hr className="outlook-detail__rule" />}
            <TeamsBlock description={description} joinUrl={joinUrl} />
        </section>
    );
}
/** Full detail of an Outlook event on the right, laid out like Outlook's own window: the event, its facts and description, and "Seguimiento" with organizer and replies. */
interface Props {
    readonly event: CalendarEvent;
    readonly onClose: () => void;
    readonly moduleCode?: CalendarModule | undefined;
    readonly onSaved?: (() => void) | undefined;
    readonly onEditCrm?: (() => void) | undefined;
}
function EditActions({ event, moduleCode, onSaved, onEditCrm }: Omit<Props, "onClose">) {
    return (
        <>
            {moduleCode && onSaved && event.source === "outlook" && <OutlookEventEdit event={event} moduleCode={moduleCode} onSaved={onSaved} />}
            {[event.source === "native", event.canEdit, onEditCrm].every(Boolean) && <Button onClick={onEditCrm}>Editar evento Habita</Button>}
        </>
    );
}
/**
 *
 */
export function OutlookEventDrawer({ event, onClose, moduleCode, onSaved, onEditCrm }: Props) {
    const detail = event.outlookDetail;
    const description = parseOutlookDescription(event.description);
    const joinUrl = detail?.joinUrl ?? description.joinUrl;
    return (
        <Drawer
            {...ADMINISTRATION_DRAWER_PROPS}
            size="min(1080px, 100vw)"
            closable={{ placement: ADMINISTRATION_DRAWER_CLOSE_PLACEMENT }}
            className="user-detail-drawer shared-calendar-drawer"
            open
            title={event.crmDetail ? "Detalle del evento · Outlook y Habita" : "Evento de Outlook"}
            extra={
                detail?.webLink ? (
                    <Button type="primary" href={detail.webLink} target="_blank" rel="noopener noreferrer" icon={<LinkOutlined aria-hidden="true" />}>
                        Abrir en Outlook
                    </Button>
                ) : null
            }
            onClose={onClose}
        >
            <div className="outlook-detail" data-with-people={Boolean(detail)}>
                <div className="outlook-detail__main">
                    <EditActions event={event} moduleCode={moduleCode} onSaved={onSaved} onEditCrm={onEditCrm} />
                    <CalendarEventActions event={event} onChanged={onSaved} />
                    <EventCard event={event} description={description} joinUrl={joinUrl} />
                    <CalendarCrmDetails event={event} />
                </div>
                {detail && <OutlookAttendeesPanel detail={detail} />}
            </div>
        </Drawer>
    );
}
