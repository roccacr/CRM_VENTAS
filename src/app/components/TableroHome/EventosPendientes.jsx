import { useEffect, useState } from "react";
import { InteractionRequiredAuthError } from "@azure/msal-browser";
import { useMsal } from "@azure/msal-react";
import { useDispatch, useSelector } from "react-redux";
import Swal from "sweetalert2";

import { updateActionCalendar } from "../../../store/Home/HomeSlice";
import { selectListEventsPending } from "../../../store/Home/selectorsHome";
import {
    setGetEventsHome,
    updateEventDate,
    updateEventsStatusThunksHome,
} from "../../../store/Home/thunksHome";
import {
    deleteOutlookEventById,
    OUTLOOK_CREATE_EVENT_SCOPE,
    updateOutlookEventScheduleById,
} from "../../views/calendars/outlook/outlookCalendarUtils";
import { ButtonActions } from "../buttonAccions/buttonAccions";

const normalizeAdminName = (value) => (value || "").trim().toLowerCase();
const normalizeAdminEmail = (value) => (value || "").trim().toLowerCase();
const DEFAULT_EVENT_DURATION_MS = 30 * 60 * 1000;

const getAdminKey = (event) => {
    if (event?.id_admin !== undefined && event?.id_admin !== null && event?.id_admin !== "") {
        return `id:${event.id_admin}`;
    }

    if (event?.idnetsuite_admin !== undefined && event?.idnetsuite_admin !== null && event?.idnetsuite_admin !== "") {
        return `id:${event.idnetsuite_admin}`;
    }

    if (event?.admin_id_admin !== undefined && event?.admin_id_admin !== null && event?.admin_id_admin !== "") {
        return `id:${event.admin_id_admin}`;
    }

    if (normalizeAdminEmail(event?.email_admin)) {
        return `email:${normalizeAdminEmail(event.email_admin)}`;
    }

    return `name:${normalizeAdminName(event?.name_admin)}`;
};

const getDisplayValue = (value) => {
    if (value === 0 || value === "0" || value === null || value === undefined || value === "") {
        return "No aplica";
    }

    return value;
};

const getLinkedOutlookEventId = (event) => (
    typeof event?.outlook_event_id === "string" ? event.outlook_event_id.trim() : ""
);

const parseCalendarDate = (value) => {
    if (!value) {
        return null;
    }

    const normalizedValue = `${value}`.trim().replace(" ", "T");
    const parsedDate = new Date(normalizedValue);

    return Number.isNaN(parsedDate.getTime()) ? null : parsedDate;
};

const buildMovedOutlookRange = (calendarEvent, newDateValue) => {
    const currentStartDate = parseCalendarDate(calendarEvent?.fechaIni_calendar);

    if (!currentStartDate || !newDateValue) {
        return null;
    }

    const currentEndDate = parseCalendarDate(calendarEvent?.fechaFin_calendar);
    const durationMs = currentEndDate && currentEndDate > currentStartDate
        ? currentEndDate.getTime() - currentStartDate.getTime()
        : DEFAULT_EVENT_DURATION_MS;
    const [yearValue, monthValue, dayValue] = newDateValue.split("-").map(Number);

    if (!yearValue || !monthValue || !dayValue) {
        return null;
    }

    const nextStartDate = new Date(currentStartDate.getTime());
    nextStartDate.setFullYear(yearValue, monthValue - 1, dayValue);

    return {
        start: nextStartDate,
        end: new Date(nextStartDate.getTime() + durationMs),
    };
};

/**
 * Lista de eventos pendientes con filtro por asesor.
 *
 * @returns {JSX.Element} Tabla de eventos pendientes.
 */
export const EventosPendientes = () => {
    const dispatch = useDispatch();
    const { instance, accounts } = useMsal();
    const { rol_admin } = useSelector((state) => state.auth);
    const listEventsPending = useSelector(selectListEventsPending);

    const [selectedAdminKey, setSelectedAdminKey] = useState("");
    const [editedDates, setEditedDates] = useState({});

    const formatDate = (dateString) => {
        if (!dateString) {
            return "";
        }

        return `${dateString}`.split(/[T ]/)[0];
    };

    useEffect(() => {
        dispatch(setGetEventsHome());
    }, [dispatch]);

    const uniqueAdmins = Array.from(
        new Map(
            (listEventsPending || [])
                .filter((event) => normalizeAdminName(event?.name_admin))
                .map((event) => [
                    getAdminKey(event),
                    {
                        key: getAdminKey(event),
                        label: event.name_admin.trim(),
                    },
                ]),
        ).values(),
    );

    const filteredEvents = selectedAdminKey
        ? listEventsPending.filter((event) => getAdminKey(event) === selectedAdminKey)
        : listEventsPending;

    const sortedEvents = [...filteredEvents].sort((a, b) => {
        const dateA = new Date(formatDate(a.fechaIni_calendar));
        const dateB = new Date(formatDate(b.fechaIni_calendar));
        return dateB - dateA;
    });

    const acquireOutlookToken = async () => {
        const activeMicrosoftAccount = instance.getActiveAccount?.() || accounts?.[0] || null;

        if (!activeMicrosoftAccount) {
            throw new Error("No hay una cuenta Microsoft activa para actualizar Outlook.");
        }

        try {
            return await instance.acquireTokenSilent({
                scopes: [OUTLOOK_CREATE_EVENT_SCOPE],
                account: activeMicrosoftAccount,
            });
        } catch (error) {
            if (!(error instanceof InteractionRequiredAuthError)) {
                throw error;
            }

            return await instance.acquireTokenPopup({
                scopes: [OUTLOOK_CREATE_EVENT_SCOPE],
                account: activeMicrosoftAccount,
            });
        }
    };

    const handleSelectChange = async (event, calendarEvent) => {
        const selectedValue = event.target.value;
        const outlookEventId = getLinkedOutlookEventId(calendarEvent);

        if (selectedValue === "Cancelado" && outlookEventId) {
            try {
                const tokenResponse = await acquireOutlookToken();
                const outlookDeleted = await deleteOutlookEventById(tokenResponse.accessToken, outlookEventId);

                if (!outlookDeleted) {
                    throw new Error("Outlook no confirmó la cancelación del evento.");
                }
            } catch (error) {
                await Swal.fire(
                    "No se actualizó Outlook",
                    error?.message || "No fue posible cancelar el evento conectado en Outlook.",
                    "warning",
                );
                return;
            }
        }

        dispatch(updateActionCalendar({ id: calendarEvent.id_calendar, selectedValue }));
        dispatch(updateEventsStatusThunksHome(
            calendarEvent.id_calendar,
            selectedValue,
            calendarEvent.idinterno_lead,
            calendarEvent.segimineto_lead,
        ));
    };

    const handleDateChange = async (event, calendarEvent) => {
        const newDate = event.target.value;
        const eventId = calendarEvent.id_calendar;
        const previousInputDate = formatDate(calendarEvent.fechaIni_calendar);
        const outlookEventId = getLinkedOutlookEventId(calendarEvent);
        let tokenResponse = null;
        let nextOutlookRange = null;

        setEditedDates((prevDates) => ({
            ...prevDates,
            [eventId]: newDate,
        }));

        try {
            if (outlookEventId) {
                nextOutlookRange = buildMovedOutlookRange(calendarEvent, newDate);

                if (!nextOutlookRange) {
                    throw new Error("No fue posible calcular el nuevo rango del evento.");
                }

                tokenResponse = await acquireOutlookToken();

                const outlookUpdated = await updateOutlookEventScheduleById(
                    tokenResponse.accessToken,
                    outlookEventId,
                    nextOutlookRange,
                );

                if (!outlookUpdated) {
                    throw new Error("Outlook no confirmó la actualización de fecha.");
                }
            }

            const crmUpdateResult = await dispatch(updateEventDate(eventId, newDate, calendarEvent.fechaIni_calendar));

            if (crmUpdateResult !== "ok") {
                throw new Error("No fue posible guardar la nueva fecha en el CRM.");
            }
        } catch (error) {
            if (outlookEventId && tokenResponse?.accessToken && nextOutlookRange) {
                const previousOutlookRange = buildMovedOutlookRange(calendarEvent, previousInputDate);

                if (previousOutlookRange) {
                    await updateOutlookEventScheduleById(
                        tokenResponse.accessToken,
                        outlookEventId,
                        previousOutlookRange,
                    );
                }
            }

            setEditedDates((prevDates) => ({
                ...prevDates,
                [eventId]: previousInputDate,
            }));

            await Swal.fire(
                "No se actualizó el evento",
                error?.message || "No fue posible sincronizar la fecha con Outlook.",
                "warning",
            );
        }
    };

    return (
        <div className="col-12">
            {sortedEvents.length > 0 && (
                <div className="card table-card">
                    <div className="card-header d-flex align-items-center justify-content-between py-3">
                        <h5 className="mb-0">Eventos pendientes de acción.</h5>

                        {rol_admin === 1 && (
                            <select
                                className="form-select"
                                value={selectedAdminKey}
                                onChange={(e) => setSelectedAdminKey(e.target.value)}
                                style={{ width: "200px" }}
                            >
                                <option value="">Todos los Asesores</option>
                                {uniqueAdmins.map((admin) => (
                                    <option key={admin.key} value={admin.key}>
                                        {admin.label}
                                    </option>
                                ))}
                            </select>
                        )}
                    </div>
                    <div className="card-body">
                        <div className="table-responsive">
                            <table className="table table-striped table dt-responsive w-100 display" id="pc-dt-simple">
                                <thead>
                                    <tr>
                                        <th>Asesor</th>
                                        <th>Evento</th>
                                        <th>Cliente</th>
                                        <th>Fecha Inicial</th>
                                        <th>Estado</th>
                                        <th>Tipo</th>
                                        <th>Cita</th>
                                        <th>Proyecto</th>
                                        <th>Campaña</th>
                                        <th>Acción</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {sortedEvents.length > 0 ? (
                                        sortedEvents
                                            .filter((event) => event.accion_calendar === "Pendiente")
                                            .map((event) => (
                                                <tr key={event.id_calendar}>
                                                    <td>{event.name_admin}</td>
                                                    <td>{event.nombre_calendar}</td>
                                                    <td>{getDisplayValue(event.nombre_lead)}</td>
                                                    <td>
                                                        <input
                                                            className="form-control"
                                                            type="date"
                                                            value={editedDates[event.id_calendar] || formatDate(event.fechaIni_calendar)}
                                                            onChange={(e) => handleDateChange(e, event)}
                                                        />
                                                    </td>
                                                    <td>
                                                        <select
                                                            value={event.accion_calendar}
                                                            onChange={(e) => handleSelectChange(e, event)}
                                                            className="form-select"
                                                        >
                                                            <option value="Pendiente">Pendiente</option>
                                                            <option value="Completado">Completado</option>
                                                            <option value="Cancelado">Cancelado</option>
                                                        </select>
                                                    </td>
                                                    <td>{event.tipo_calendar}</td>
                                                    <td>{event.cita_lead === 1 ? "Cita" : "-"}</td>
                                                    <td>{getDisplayValue(event.proyecto_lead)}</td>
                                                    <td>{getDisplayValue(event.campana_lead)}</td>
                                                    <td>{event.id_lead > 0 ? <ButtonActions leadData={event} /> : "No aplica"}</td>
                                                </tr>
                                            ))
                                    ) : (
                                        <tr>
                                            <td colSpan="10">No hay eventos pendientes</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
