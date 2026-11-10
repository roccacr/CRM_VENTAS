import ClockCircleOutlined from "@ant-design/icons/ClockCircleOutlined";
import CloseOutlined from "@ant-design/icons/CloseOutlined";
import EnvironmentOutlined from "@ant-design/icons/EnvironmentOutlined";
import ExpandAltOutlined from "@ant-design/icons/ExpandAltOutlined";
import LinkOutlined from "@ant-design/icons/LinkOutlined";
import TeamOutlined from "@ant-design/icons/TeamOutlined";
import VideoCameraOutlined from "@ant-design/icons/VideoCameraOutlined";
import { type ReactNode, type RefObject, useEffect, useLayoutEffect, useRef, useState } from "react";

import type { CalendarEvent } from "../../services/calendar/calendar-service";
import { agendaWhen } from "./calendar-agenda";
import { parseOutlookDescription } from "./calendar-outlook-detail";
import { peopleLine } from "./calendar-outlook-people";
import { CARD_WIDTH, placeOutlookPopover } from "./calendar-popover-placement";
import { CALENDAR_TIME_ZONE, calendarToday } from "./calendar-time";

interface Props {
    readonly event: CalendarEvent;
    /** Rectángulo del evento en la ventana. La tarjeta se abre a su lado. */
    readonly anchor: DOMRect | null;
    readonly onClose: () => void;
    /** Abre el panel de detalle completo a la derecha. */
    readonly onExpand: () => void;
}

const endFormat = new Intl.DateTimeFormat("es-CR", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: CALENDAR_TIME_ZONE });

/** Mantiene la tarjeta junto a su evento y la cierra con Esc, con un clic afuera o si cambia el tamaño de la ventana. */
function useFloatingCard(anchor: DOMRect | null, event: CalendarEvent, onClose: () => void): { card: RefObject<HTMLDivElement | null>; position: { top: number; left: number } } {
    const card = useRef<HTMLDivElement>(null);
    const [position, setPosition] = useState(() => placeOutlookPopover(anchor, 220));
    useLayoutEffect(() => {
        if (card.current) setPosition(placeOutlookPopover(anchor, card.current.offsetHeight));
    }, [anchor, event]);
    useEffect(() => {
        card.current?.focus();
        const close = (action: Event) => {
            if (action instanceof KeyboardEvent && action.key !== "Escape") return;
            if (action instanceof MouseEvent && card.current?.contains(action.target as Node)) return;
            onClose();
        };
        document.addEventListener("keydown", close);
        document.addEventListener("mousedown", close);
        window.addEventListener("resize", onClose);
        return () => {
            document.removeEventListener("keydown", close);
            document.removeEventListener("mousedown", close);
            window.removeEventListener("resize", onClose);
        };
    }, [onClose]);
    return { card, position };
}
function Row({ icon, children }: { readonly icon: ReactNode; readonly children: ReactNode }) {
    return (
        <p className="outlook-popover__row">
            {icon}
            <span>{children}</span>
        </p>
    );
}
function whenText(event: CalendarEvent): string {
    const when = agendaWhen(event, calendarToday());
    const end = !event.allDay && event.end ? ` — ${endFormat.format(new Date(event.end))}` : "";
    return `${when.day} · ${when.hour}${end}`;
}
function CardBody({ event }: { readonly event: CalendarEvent }) {
    const parsed = parseOutlookDescription(event.description);
    const joinUrl = event.outlookDetail?.joinUrl ?? parsed.joinUrl;
    const people = peopleLine(event.outlookDetail);
    return (
        <div className="outlook-popover__body">
            <h2>{event.title}</h2>
            <Row icon={<ClockCircleOutlined aria-hidden="true" />}>{whenText(event)}</Row>
            {people && <Row icon={<TeamOutlined aria-hidden="true" />}>{people}</Row>}
            {event.location && <Row icon={<EnvironmentOutlined aria-hidden="true" />}>{event.location}</Row>}
            {parsed.summary && <p className="outlook-popover__summary">{parsed.summary}</p>}
            {joinUrl && (
                <a className="outlook-popover__join" href={joinUrl} target="_blank" rel="noopener noreferrer">
                    <VideoCameraOutlined aria-hidden="true" /> Unirse a la reunión
                </a>
            )}
        </div>
    );
}

/** Vista rápida de un evento de Outlook: una tarjeta al lado, de solo lectura, que se cierra con Esc, la X o un clic afuera. */
export function OutlookEventPopover({ event, anchor, onClose, onExpand }: Props) {
    const { card, position } = useFloatingCard(anchor, event, onClose);
    const webLink = event.outlookDetail?.webLink;
    return (
        <>
            <div className="outlook-scrim" aria-hidden="true" />
            <div ref={card} className="outlook-popover" role="dialog" aria-label="Evento de Outlook" tabIndex={-1} style={{ top: position.top, left: position.left, width: CARD_WIDTH }}>
                <header className="outlook-popover__head">
                    <span>Evento de Outlook</span>
                    <span className="outlook-popover__tools">
                        <button type="button" aria-label="Ver detalle completo" title="Ver detalle completo" onClick={onExpand}>
                            <ExpandAltOutlined aria-hidden="true" />
                        </button>
                        <button type="button" aria-label="Cerrar" onClick={onClose}>
                            <CloseOutlined aria-hidden="true" />
                        </button>
                    </span>
                </header>
                <CardBody event={event} />
                {webLink && (
                    <a className="outlook-popover__open" href={webLink} target="_blank" rel="noopener noreferrer">
                        <LinkOutlined aria-hidden="true" /> Abrir en Outlook para responder
                    </a>
                )}
                <footer className="outlook-popover__foot">{event.canEdit ? "Puedes editar tu evento desde el detalle completo." : "Este evento está disponible para consulta."}</footer>
            </div>
        </>
    );
}
