import { useState } from "react";

import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import esLocale from "@fullcalendar/core/locales/es";
import { Avatar, Box, Checkbox, Dialog, DialogContent, Divider, Popover, Typography } from "@mui/material";

import "./View_calendario_outlook.css";

const MINI_CALENDAR_WEEKS = [
    ["25", "1", "2", "3", "4", "5", "6", "7"],
    ["24", "8", "9", "10", "11", "12", "13", "14"],
    ["25", "15", "16", "17", "18", "19", "20", "21"],
    ["26", "22", "23", "24", "25", "26", "27", "28"],
    ["27", "29", "30", "1", "2", "3", "4", "5"],
];

const FILTER_OPTIONS = [
    { value: "categoria1", label: "Contactos" },
    { value: "categoria2", label: "Tareas" },
    { value: "categoria3", label: "Reunion" },
    { value: "categoria4", label: "Seguimientos" },
    { value: "categoria5", label: "Primeras Citas" },
];

const OUTLOOK_EVENTS = [
    { id: "1", title: "Seguimiento Ticket Postventa", start: "2026-06-01T09:00:00", end: "2026-06-01T09:30:00", classNames: ["is-secondary"], extendedProps: { location: "Sala de Postventa", attendee: "Roberto Carlos Zuniga", response: "Katrina Bou Mansour Blonval le ha invitado." } },
    { id: "2", title: "Reunion TI - Roberto", start: "2026-06-01T14:00:00", end: "2026-06-01T14:45:00", classNames: ["is-secondary"], extendedProps: { location: "Sala de Tecnologia", attendee: "Roberto Carlos Zuniga", response: "Invitacion enviada al equipo TI." } },
    { id: "3", title: "Seguimientos varios", start: "2026-06-01T15:30:00", end: "2026-06-01T16:00:00", extendedProps: { location: "Llamada comercial", attendee: "Equipo comercial", response: "3 participantes confirmados." } },
    { id: "3b", title: "Llamada cliente Torre Norte", start: "2026-06-01T16:15:00", end: "2026-06-01T16:45:00", extendedProps: { meetingType: "teams", location: "Reunion de Microsoft Teams", attendee: "Cliente Torre Norte", response: "Pendiente confirmacion final.", status: "Aceptado", acceptedCount: 2, organizer: "Cliente Torre Norte", teamsLink: "https://teams.microsoft.com/meet/torre-norte", attendees: ["Cliente Torre Norte", "Equipo Comercial"] } },
    { id: "3c", title: "Revision contrato comercial", start: "2026-06-01T16:45:00", end: "2026-06-01T17:30:00", classNames: ["is-priority"], extendedProps: { location: "Sala Legal", attendee: "Equipo Legal", response: "Contrato en revision con observaciones." } },
    { id: "3d", title: "Seguimiento aprobacion interna", start: "2026-06-01T17:10:00", end: "2026-06-01T17:40:00", extendedProps: { location: "Backoffice", attendee: "Gerencia", response: "Aprobacion pendiente." } },
    { id: "3e", title: "Ajuste fechas de entrega", start: "2026-06-01T17:40:00", end: "2026-06-01T18:00:00", extendedProps: { location: "Mesa operativa", attendee: "Operaciones", response: "Fecha tentativa actualizada." } },
    { id: "3f", title: "Comite operativo Postventa", start: "2026-06-01T18:00:00", end: "2026-06-01T18:45:00", classNames: ["is-critical"], extendedProps: { location: "Sala ejecutiva", attendee: "Comite Postventa", response: "Se requiere seguimiento para la reunion." } },
    { id: "3g", title: "Confirmacion visita tecnica", start: "2026-06-01T18:30:00", end: "2026-06-01T19:00:00", extendedProps: { location: "WhatsApp", attendee: "Cliente final", response: "Visita tecnica confirmada." } },
    { id: "3h", title: "Resumen diario comercial", start: "2026-06-01T19:00:00", end: "2026-06-01T19:20:00", classNames: ["is-secondary"], extendedProps: { location: "Reporte interno", attendee: "Direccion comercial", response: "Resumen compartido con el equipo." } },
    { id: "4", title: "Seguimientos varios", start: "2026-06-03T15:30:00", end: "2026-06-03T16:00:00", extendedProps: { location: "Llamada comercial", attendee: "Equipo comercial", response: "Seguimiento agendado." } },
    { id: "5", title: "Revision Final global - POSTVEN", start: "2026-06-04T09:00:00", end: "2026-06-04T10:30:00", classNames: ["is-priority"], extendedProps: { location: "Sala de Diseno", attendee: "Katrina Bou Mansour Blonval", response: "Usted y Oscar Darce Reyes la aceptaron." } },
    { id: "6", title: "Seguimientos varios", start: "2026-06-05T15:30:00", end: "2026-06-05T16:00:00", extendedProps: { location: "Llamada comercial", attendee: "Equipo comercial", response: "Seguimiento agendado." } },
    { id: "7", title: "Seguimientos varios", start: "2026-06-08T15:30:00", end: "2026-06-08T16:00:00", extendedProps: { location: "Llamada comercial", attendee: "Equipo comercial", response: "Seguimiento agendado." } },
    { id: "8", title: "Servicio Postventa NetSuite y S", start: "2026-06-09T10:00:00", end: "2026-06-09T11:00:00", classNames: ["is-critical"], extendedProps: { location: "Sala de Proyecto", attendee: "Equipo NetSuite", response: "Sesion prioritaria confirmada." } },
    { id: "9", title: "INTEGRACION CRM - WHATSAPP", start: "2026-06-10T11:00:00", end: "2026-06-10T12:00:00", classNames: ["is-critical"], extendedProps: { meetingType: "teams", location: "Reunion de Microsoft Teams", attendee: "Claudio Cordoba Cordoba", response: "Claudio Cordoba Cordoba le ha invitado.", status: "Aceptado", acceptedCount: 5, organizer: "Claudio Cordoba Cordoba", sentAt: "Enviado el Viernes, 05/06/2026 a las 10:42", teamsLink: "https://teams.microsoft.com/meet/253603856566341", meetingId: "253 603 856 566 341", accessCode: "kT6Qx2Mt", attendees: ["Kenneth Martinez", "Eduardo Salazar Sanchez", "Karolina Benavides", "Fabian Mata Guzman", "Roberto Carlos Zuniga Altamirano"] } },
    { id: "10", title: "Seguimientos varios", start: "2026-06-10T15:30:00", end: "2026-06-10T16:00:00", extendedProps: { location: "Llamada comercial", attendee: "Equipo comercial", response: "Seguimiento agendado." } },
    { id: "11", title: "Seguimientos varios", start: "2026-06-12T15:30:00", end: "2026-06-12T16:00:00", extendedProps: { location: "Llamada comercial", attendee: "Equipo comercial", response: "Seguimiento agendado." } },
    { id: "12", title: "Seguimientos varios", start: "2026-06-15T15:30:00", end: "2026-06-15T16:00:00", extendedProps: { location: "Llamada comercial", attendee: "Equipo comercial", response: "Seguimiento agendado." } },
    { id: "13", title: "Seguimientos varios", start: "2026-06-17T15:30:00", end: "2026-06-17T16:00:00", extendedProps: { location: "Llamada comercial", attendee: "Equipo comercial", response: "Seguimiento agendado." } },
    { id: "14", title: "Seguimientos varios", start: "2026-06-19T15:30:00", end: "2026-06-19T16:00:00", extendedProps: { location: "Llamada comercial", attendee: "Equipo comercial", response: "Seguimiento agendado." } },
    { id: "15", title: "Seguimientos varios", start: "2026-06-22T15:30:00", end: "2026-06-22T16:00:00", extendedProps: { location: "Llamada comercial", attendee: "Equipo comercial", response: "Seguimiento agendado." } },
    { id: "16", title: "Seguimientos varios", start: "2026-06-24T15:30:00", end: "2026-06-24T16:00:00", extendedProps: { location: "Llamada comercial", attendee: "Equipo comercial", response: "Seguimiento agendado." } },
    { id: "17", title: "Seguimientos varios", start: "2026-06-26T15:30:00", end: "2026-06-26T16:00:00", extendedProps: { location: "Llamada comercial", attendee: "Equipo comercial", response: "Seguimiento agendado." } },
    { id: "18", title: "Seguimientos varios", start: "2026-06-29T15:30:00", end: "2026-06-29T16:00:00", extendedProps: { location: "Llamada comercial", attendee: "Equipo comercial", response: "Seguimiento agendado." } },
];

/**
 * Mock visual enterprise de calendario Outlook usando FullCalendar sin integraciones.
 * @returns {JSX.Element} Vista mensual sobria tipo enterprise.
 */
export const View_calendario_outlook = () => {
    const [selectedEvent, setSelectedEvent] = useState(null);
    const [selectedPosition, setSelectedPosition] = useState(null);
    const [showResponseActions, setShowResponseActions] = useState(false);
    const [notifyOrganizer, setNotifyOrganizer] = useState(true);
    const [isExpandedModalOpen, setIsExpandedModalOpen] = useState(false);

    const closeEventCard = () => {
        setSelectedEvent(null);
        setSelectedPosition(null);
        setShowResponseActions(false);
    };

    const getEventDateLabel = (event) => {
        if (!event?.start) {
            return "";
        }

        const formatter = new Intl.DateTimeFormat("es-CR", {
            weekday: "short",
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
            hour: "numeric",
            minute: "2-digit",
        });

        const startLabel = formatter.format(event.start);

        if (!event.end) {
            return startLabel;
        }

        const endFormatter = new Intl.DateTimeFormat("es-CR", {
            hour: "numeric",
            minute: "2-digit",
        });

        return `${startLabel} a ${endFormatter.format(event.end)}`;
    };

    const isTeamsEvent = selectedEvent?.extendedProps?.meetingType === "teams";

    const openExpandedModal = () => {
        setIsExpandedModalOpen(true);
    };

    const closeExpandedModal = () => {
        setIsExpandedModalOpen(false);
    };

    return (
        <section className="outlook-calendar-page">
            <div className="outlook-toolbar">
                <div className="outlook-toolbar-group is-compact">
                    <button className="outlook-button outlook-button-primary" type="button">
                        <span className="ti ti-plus"></span>
                        Nuevo evento
                    </button>
                </div>

                <div className="outlook-toolbar-group">
                    <div className="outlook-segmented-control">
                        <button className="outlook-button is-segment" type="button">Dia</button>
                        <button className="outlook-button is-segment" type="button">Semana laboral</button>
                        <button className="outlook-button is-segment" type="button">Semana</button>
                        <button className="outlook-button is-segment is-active" type="button">Mes</button>
                    </div>
                    <button className="outlook-button is-muted" type="button">Vista en dos paneles</button>
                </div>

            </div>

            <div className="outlook-body">
                <aside className="outlook-sidebar">
                    <div className="outlook-sidebar-month">
                        <div className="outlook-sidebar-month-header">
                            <h1>Junio 2026</h1>
                            <div className="outlook-nav-inline">
                                <button className="outlook-icon-button" type="button">
                                    <span className="ti ti-chevron-left"></span>
                                </button>
                                <button className="outlook-icon-button" type="button">
                                    <span className="ti ti-chevron-right"></span>
                                </button>
                            </div>
                        </div>

                        <div className="outlook-mini-calendar">
                            <div className="outlook-mini-calendar-head">
                                <span>L</span>
                                <span>M</span>
                                <span>X</span>
                                <span>J</span>
                                <span>V</span>
                                <span>S</span>
                                <span>D</span>
                            </div>

                            {MINI_CALENDAR_WEEKS.map((week) => (
                                <div className="outlook-mini-calendar-row" key={week.join("-")}>
                                    <span className="outlook-week-number">{week[0]}</span>
                                    {week.slice(1).map((day) => (
                                        <span className={day === "5" ? "is-selected" : ""} key={`${week[0]}-${day}`}>
                                            {day}
                                        </span>
                                    ))}
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="outlook-sidebar-section">
                        <h2>Mis calendarios</h2>
                        {FILTER_OPTIONS.map((option) => (
                            <label className="outlook-calendar-check" key={option.value}>
                                <span className="outlook-check-indicator">
                                    <span className="ti ti-check"></span>
                                </span>
                                {option.label}
                            </label>
                        ))}
                    </div>
                </aside>

                <div className="outlook-main">
                    <div className="outlook-main-shell">
                        <div className="outlook-main-header">
                            <div className="outlook-main-actions">
                                <button className="outlook-button" type="button">Hoy</button>
                                <button className="outlook-icon-button" type="button">
                                    <span className="ti ti-chevron-left"></span>
                                </button>
                                <button className="outlook-icon-button" type="button">
                                    <span className="ti ti-chevron-right"></span>
                                </button>
                            </div>

                            <div className="outlook-main-title">
                                <h2>Junio 2026</h2>
                                <span className="ti ti-chevron-down"></span>
                            </div>

                            <div className="outlook-main-meta">
                                <span>Vista mensual</span>
                                <span className="outlook-meta-divider"></span>
                                <span>28 eventos programados</span>
                            </div>
                        </div>

                        <div className="outlook-calendar-frame">
                            <FullCalendar
                                plugins={[dayGridPlugin]}
                                initialView="dayGridMonth"
                                initialDate="2026-06-01"
                                locale={esLocale}
                                headerToolbar={false}
                                fixedWeekCount={true}
                                showNonCurrentDates={true}
                                firstDay={1}
                                height="auto"
                                events={OUTLOOK_EVENTS}
                                eventDisplay="block"
                                dayMaxEvents={3}
                                eventTimeFormat={{ hour: "2-digit", minute: "2-digit", hour12: false }}
                                eventClick={(info) => {
                                    setSelectedEvent(info.event);
                                    setSelectedPosition({
                                        left: info.jsEvent.clientX + 18,
                                        top: info.jsEvent.clientY + 18,
                                    });
                                    setShowResponseActions(false);
                                }}
                                dayCellClassNames={(arg) => {
                                    if (arg.date.toISOString().slice(0, 10) === "2026-06-05") {
                                        return ["outlook-day-focus"];
                                    }

                                    if (arg.isOther) {
                                        return ["outlook-day-other-month"];
                                    }

                                    return [];
                                }}
                                eventContent={(eventInfo) => (
                                    <div className={`outlook-event-card ${eventInfo.event.classNames.join(" ")}`}>
                                        <span className="outlook-event-stripe"></span>
                                        <span className="outlook-event-time">{eventInfo.timeText}</span>
                                        <span className="outlook-event-title">{eventInfo.event.title}</span>
                                    </div>
                                )}
                            />
                        </div>
                    </div>
                </div>
            </div>

            <Popover
                open={Boolean(selectedEvent && selectedPosition)}
                anchorReference="anchorPosition"
                anchorPosition={selectedPosition || undefined}
                onClose={closeEventCard}
                disableRestoreFocus
                slotProps={{
                    paper: {
                        className: "outlook-hover-card",
                    },
                }}
            >
                {selectedEvent && (
                    <Box className="outlook-hover-card-content">
                        <Box className="outlook-hover-card-title-row">
                            <Typography className="outlook-hover-card-title">
                                {selectedEvent.title}
                            </Typography>
                            <button className="outlook-hover-card-expand-button" onClick={openExpandedModal} type="button">
                                <span className="ti ti-arrow-up-right outlook-hover-card-expand"></span>
                            </button>
                        </Box>

                        {isTeamsEvent && (
                            <>
                                <Box className="outlook-hover-card-actions">
                                    <button className="outlook-primary-action" type="button">
                                        <span className="ti ti-video"></span>
                                        Unirse
                                    </button>
                                    <button className="outlook-square-action" type="button">
                                        <span className="ti ti-chevron-down"></span>
                                    </button>
                                    <button className="outlook-secondary-action" type="button">
                                        <span className="ti ti-message-circle"></span>
                                        Chatear
                                    </button>
                                </Box>
                                <Divider />
                            </>
                        )}

                        <Divider />

                        <Box className="outlook-hover-card-detail">
                            <span className="ti ti-clock outlook-hover-card-icon"></span>
                            <Typography className="outlook-hover-card-text">
                                {getEventDateLabel(selectedEvent)}
                            </Typography>
                        </Box>

                        <Box className="outlook-hover-card-detail">
                            <span className="ti ti-map-pin outlook-hover-card-icon"></span>
                            <Typography className="outlook-hover-card-text">
                                {selectedEvent.extendedProps.location}
                            </Typography>
                        </Box>

                        <Divider />

                        <Box className="outlook-hover-card-person">
                            <Avatar className="outlook-hover-card-avatar">
                                {selectedEvent.extendedProps.attendee?.charAt(0) || "K"}
                            </Avatar>
                            <Box>
                                <Typography className="outlook-hover-card-text is-strong">
                                    {selectedEvent.extendedProps.attendee}
                                </Typography>
                                <Typography className="outlook-hover-card-text is-soft">
                                    {selectedEvent.extendedProps.response}
                                </Typography>
                                {isTeamsEvent && (
                                    <Typography className="outlook-hover-card-text is-soft">
                                        Aceptados: {selectedEvent.extendedProps.acceptedCount}
                                    </Typography>
                                )}
                            </Box>
                        </Box>

                        {isTeamsEvent && (
                            <>
                                <Divider />

                                <Box className="outlook-hover-status-row">
                                    <Box className="outlook-hover-status-left">
                                        <span className="ti ti-check outlook-hover-status-icon"></span>
                                        <Typography className="outlook-hover-card-text is-strong">
                                            {selectedEvent.extendedProps.status}
                                        </Typography>
                                    </Box>

                                    <button
                                        className="outlook-inline-link"
                                        onClick={() => setShowResponseActions((prev) => !prev)}
                                        type="button"
                                    >
                                        Cambiar
                                    </button>
                                </Box>

                                {showResponseActions && (
                                    <Box className="outlook-hover-response-panel">
                                        <label className="outlook-checkbox-row">
                                            <Checkbox
                                                checked={notifyOrganizer}
                                                onChange={(event) => setNotifyOrganizer(event.target.checked)}
                                                size="small"
                                                sx={{
                                                    color: "#2a5f79",
                                                    "&.Mui-checked": { color: "#2a5f79" },
                                                    padding: 0,
                                                    marginRight: "10px",
                                                }}
                                            />
                                            Enviar correo electronico al organizador
                                        </label>

                                        <input
                                            className="outlook-message-input"
                                            placeholder="Agregar un mensaje (opcional)"
                                            type="text"
                                        />

                                        <Box className="outlook-hover-response-actions">
                                            <button className="outlook-response-button is-accept" type="button">Aceptar</button>
                                            <button className="outlook-response-button is-reject" type="button">Rechazar</button>
                                            <button className="outlook-response-button is-follow" type="button">Seguir</button>
                                            <button className="outlook-response-button is-more" type="button">...</button>
                                        </Box>
                                    </Box>
                                )}
                            </>
                        )}
                    </Box>
                )}
            </Popover>

            <Dialog
                fullWidth
                maxWidth="xl"
                onClose={closeExpandedModal}
                open={isExpandedModalOpen && Boolean(selectedEvent)}
                PaperProps={{ className: "outlook-expanded-modal" }}
            >
                {selectedEvent && (
                    <DialogContent className="outlook-expanded-modal-content">
                        <Box className="outlook-expanded-topbar">
                            <Typography className="outlook-expanded-window-title">
                                {selectedEvent.title}: reunion: Calendario
                            </Typography>
                            <Box className="outlook-expanded-window-actions">
                                <span className="ti ti-arrow-up-right"></span>
                                <button className="outlook-modal-close" onClick={closeExpandedModal} type="button">×</button>
                            </Box>
                        </Box>

                        <Box className="outlook-expanded-toolbar">
                            <Box className="outlook-expanded-toolbar-left">
                                <button className="outlook-toolbar-chip is-accepted" type="button">Aceptado</button>
                                <button className="outlook-toolbar-ghost" type="button">Ocupado</button>
                                <button className="outlook-toolbar-ghost" type="button">Viva Insights</button>
                            </Box>
                            <Box className="outlook-expanded-toolbar-right">
                                <button className="outlook-primary-action" type="button">
                                    <span className="ti ti-video"></span>
                                    Unirse
                                </button>
                                <button className="outlook-secondary-action" type="button">
                                    <span className="ti ti-message-circle"></span>
                                    Chatear
                                </button>
                            </Box>
                        </Box>

                        <Box className="outlook-expanded-grid">
                            <Box className="outlook-expanded-mainpanel">
                                <Box className="outlook-expanded-section">
                                    <Typography className="outlook-expanded-event-title">
                                        {selectedEvent.title}
                                    </Typography>

                                    <Box className="outlook-expanded-row">
                                        <span className="ti ti-users"></span>
                                        <Typography>
                                            {selectedEvent.extendedProps.organizer}; {selectedEvent.extendedProps.attendees?.slice(0, 2).join("; ")}; y {selectedEvent.extendedProps.acceptedCount} mas
                                        </Typography>
                                    </Box>

                                    <Box className="outlook-expanded-row">
                                        <span className="ti ti-clock"></span>
                                        <Typography>{getEventDateLabel(selectedEvent)}</Typography>
                                    </Box>

                                <Box className="outlook-expanded-row">
                                    <span className="ti ti-map-pin"></span>
                                    <Box className="outlook-location-pill">
                                        <span>{selectedEvent.extendedProps.location}</span>
                                    </Box>
                                </Box>
                            </Box>

                            <Box className="outlook-expanded-description">
                                    <Typography className="outlook-expanded-description-title">
                                        {isTeamsEvent ? "Reunion de Microsoft Teams" : "Detalle del evento"}
                                    </Typography>

                                    {isTeamsEvent ? (
                                        <>
                                            <Typography className="outlook-expanded-link">
                                                Unirse: {selectedEvent.extendedProps.teamsLink}
                                            </Typography>
                                            <Typography className="outlook-expanded-meta">
                                                Id. de reunion: {selectedEvent.extendedProps.meetingId}
                                            </Typography>
                                            <Typography className="outlook-expanded-meta">
                                                Codigo de acceso: {selectedEvent.extendedProps.accessCode}
                                            </Typography>
                                        </>
                                    ) : (
                                        <>
                                            <Typography className="outlook-expanded-meta">
                                                Ubicacion: {selectedEvent.extendedProps.location}
                                            </Typography>
                                            <Typography className="outlook-expanded-meta">
                                                Responsable: {selectedEvent.extendedProps.attendee}
                                            </Typography>
                                            <Typography className="outlook-expanded-meta">
                                                Estado: {selectedEvent.extendedProps.response}
                                            </Typography>
                                        </>
                                    )}
                                </Box>
                            </Box>

                            <Box className="outlook-expanded-sidepanel">
                                <Typography className="outlook-expanded-side-title">Seguimiento</Typography>

                                <Box className="outlook-expanded-organizer">
                                    <Typography className="outlook-expanded-label">Organizador</Typography>
                                    <Box className="outlook-expanded-person">
                                        <Avatar className="outlook-hover-card-avatar">
                                            {selectedEvent.extendedProps.organizer?.charAt(0) || "C"}
                                        </Avatar>
                                        <Box>
                                            <Typography className="outlook-hover-card-text is-strong">
                                                {selectedEvent.extendedProps.organizer}
                                            </Typography>
                                            <Typography className="outlook-hover-card-text is-soft">
                                                {selectedEvent.extendedProps.sentAt}
                                            </Typography>
                                        </Box>
                                    </Box>
                                </Box>

                                <Box className="outlook-expanded-attendees">
                                    <Typography className="outlook-expanded-label">
                                        {isTeamsEvent ? "Asistentes" : "Participantes"}
                                    </Typography>
                                    <Typography className="outlook-hover-card-text is-soft">
                                        {isTeamsEvent ? 'Su respuesta fue "Aceptar"' : "Detalle visual del evento"}
                                    </Typography>

                                    {isTeamsEvent && (
                                        <Typography className="outlook-expanded-accepted">
                                            Aceptado: {selectedEvent.extendedProps.acceptedCount}
                                        </Typography>
                                    )}

                                    {(selectedEvent.extendedProps.attendees || [selectedEvent.extendedProps.attendee]).map((attendee) => (
                                        <Box className="outlook-expanded-attendee-row" key={attendee}>
                                            <Avatar className="outlook-expanded-attendee-avatar">
                                                {attendee.charAt(0)}
                                            </Avatar>
                                            <Box>
                                                <Typography className="outlook-hover-card-text is-strong">
                                                    {attendee}
                                                </Typography>
                                                <Typography className="outlook-hover-card-text is-soft">
                                                    {isTeamsEvent ? "Obligatorio" : "Relacionado"}
                                                </Typography>
                                            </Box>
                                        </Box>
                                    ))}
                                </Box>
                            </Box>
                        </Box>
                    </DialogContent>
                )}
            </Dialog>
        </section>
    );
};
