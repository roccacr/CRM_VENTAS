/**
 * @file View_calendario_outlook.jsx
 * @description Vista principal del calendario estilo Outlook dentro del CRM.
 *              Fusiona eventos del backend CRM con eventos de Microsoft 365 (Graph API)
 *              y los renderiza con FullCalendar. Incluye mini-calendario lateral,
 *              popover de detalle y modal expandido.
 */

// --- Hooks de React para estado, efectos, memoización y referencias al DOM ---
import { useEffect, useMemo, useRef, useState } from "react";

// --- FullCalendar: motor de renderizado del calendario y plugins de vista ---
import esLocale from "@fullcalendar/core/locales/es"; // Localización en español (días, meses)
import dayGridPlugin from "@fullcalendar/daygrid"; // Plugin vista mensual (rejilla de días)
import interactionPlugin from "@fullcalendar/interaction"; // Plugin drag/drop y resize
import FullCalendar from "@fullcalendar/react"; // Wrapper React de FullCalendar
import timeGridPlugin from "@fullcalendar/timegrid"; // Plugin vistas diaria/semanal con horas
import Swal from "sweetalert2";

// --- MSAL: autenticación silenciosa contra Microsoft para leer calendario ---
import { InteractionRequiredAuthError } from "@azure/msal-browser"; // Error cuando hace falta login interactivo
import { useMsal } from "@azure/msal-react"; // Hook que expone instancia MSAL y cuentas activas

// --- Material UI: componentes de UI para popover, modal y tipografía ---
import {
    Avatar, // Avatar circular para asistentes/organizador
    Box, // Contenedor flexible con sistema de estilos MUI
    Checkbox, // Casilla para "notificar al organizador"
    CircularProgress, // Indicador de carga del calendario principal
    Dialog, // Modal expandido al hacer clic en expandir evento
    DialogContent, // Cuerpo del modal
    Divider, // Línea separadora visual
    Popover, // Tarjeta flotante al hacer clic en un evento
    Typography, // Texto con variantes tipográficas
} from "@mui/material";

// --- Redux: leer sesión del usuario autenticado en el CRM ---
import { useDispatch, useSelector } from "react-redux";

// --- React Router: enlazar al perfil del lead desde el popover ---
import { Link } from "react-router-dom";

// --- API interna: eventos pendientes del CRM filtrados por rango de fechas ---
import {
    getPendingActionCalendarEvents,
    processOutlookCalendarSync,
    registerOutlookCalendarSync,
    updateOutlookCalendarEventSchedule,
} from "../../../../store/calendar/Api_calendar_Providers";
import {
    createOutlookEventForLead,
    updateOutlookEventForLeadDetails,
    updateStatusEvent,
} from "../../../../store/calendar/thunkscalendar";
import { loginRequest } from "../../../../config/msalConfig";
import { getDataSelectProyect, getLeadsComplete } from "../../../../store/leads/thunksLeads";
import { renderOutlookCalendarEventContent } from "./components/OutlookCalendarEventContent";
import { OutlookCreateEventModal } from "./components/OutlookCreateEventModal";
import { OutlookFilterMenuSection } from "./components/OutlookFilterMenuSection";
import {
    buildCalendarMoveBlockedMessage,
    canAuthenticatedUserMoveCalendarEvent,
} from "./outlookCalendarUtils";

// --- Estilos scoped de la vista (layout Outlook, eventos, sidebar) ---
import "./View_calendario_outlook.css";

/**
 * Opciones de filtro lateral "Mis calendarios".
 * Cada value coincide con la categoría asignada en extendedProps.category.
 * Nota: actualmente son labels visuales; el filtrado activo no está cableado.
 */
const CRM_FILTER_OPTIONS = [
    { value: "categoria1", label: "Contactos" },
    { value: "categoria2", label: "Tareas" },
    { value: "categoria3", label: "Reunión" },
    { value: "categoria4", label: "Seguimientos" },
    { value: "categoria5", label: "Primeras Citas" },
];

const ORIGIN_FILTER_OPTIONS = [
    { value: "crm", label: "Solo eventos CRM" },
    { value: "outlook", label: "Solo eventos Outlook" },
];

/**
 * Mapeo entre modos de vista de la UI y configuración de FullCalendar.
 * - calendarView: identificador interno de FullCalendar
 * - buttonLabel: texto del botón segmentado en toolbar
 * - metaLabel: descripción en el encabezado del calendario principal
 */
const VIEW_CONFIG = {
    day: {
        calendarView: "timeGridDay", // Una columna con franjas horarias
        buttonLabel: "Día",
        buttonIcon: "ti-layout-day",
        metaLabel: "Vista diaria",
    },
    workweek: {
        calendarView: "timeGridWeek", // Misma vista que semana; weekends=false la diferencia
        buttonLabel: "Semana laboral",
        buttonIcon: "ti-calendar-week",
        metaLabel: "Vista semanal laboral",
    },
    week: {
        calendarView: "timeGridWeek",
        buttonLabel: "Semana",
        buttonIcon: "ti-table",
        metaLabel: "Vista semanal",
    },
    month: {
        calendarView: "dayGridMonth", // Rejilla mensual sin franjas horarias
        buttonLabel: "Mes",
        buttonIcon: "ti-calendar-month",
        metaLabel: "Vista mensual",
    },
};

/**
 * Traduce el tipo de actividad del CRM (tipo_calendar) a categoría visual.
 * Soporta variantes con/sin tilde para evitar eventos sin categoría por typo de datos.
 */
const CRM_CATEGORY_BY_TYPE = {
    Whatsapp: "categoria1",
    Correo: "categoria1",
    Tarea: "categoria2",
    Llamada: "categoria3",
    Reunion: "categoria3",
    Reunión: "categoria3",
    Seguimientos: "categoria4",
    Seguimiento: "categoria4",
    Cita: "categoria5",
};

/** Categoría asignada a eventos que existen solo en Outlook (sin registro CRM). */
/** Color por defecto cuando el CRM no define color_calendar. Alineado con paleta Outlook/CRM. */
const OUTLOOK_DEFAULT_COLOR = "#2a5f79";
const DEFAULT_CRM_FILTERS = CRM_FILTER_OPTIONS.reduce((accumulator, option) => ({
    ...accumulator,
    [option.value]: true,
}), {});
const DEFAULT_ORIGIN_FILTERS = {
    crm: false,
    outlook: false,
};

const OUTLOOK_PEOPLE_SCOPE = "User.ReadBasic.All";
const OUTLOOK_PLACE_SCOPE = "Place.Read.All";
const OUTLOOK_SCHEDULE_SCOPE = "Calendars.Read";
const OUTLOOK_CREATE_EVENT_SCOPE = "Calendars.ReadWrite";
const OUTLOOK_REQUIRED_SCOPES = [...new Set([
    ...loginRequest.scopes,
    OUTLOOK_PEOPLE_SCOPE,
    OUTLOOK_PLACE_SCOPE,
    OUTLOOK_SCHEDULE_SCOPE,
    OUTLOOK_CREATE_EVENT_SCOPE,
])];
const PEOPLE_PAGE_SIZE = 25;
const PEOPLE_SEARCH_MIN_LENGTH = 2;
const ROOM_SUGGESTION_LIMIT = 6;
const OUTLOOK_TIMEZONE = "Central America Standard Time";
const SCHEDULE_INTERVAL_MINUTES = 30;
const CREATE_EVENT_PREVIEW_START_HOUR = 7;
const CREATE_EVENT_PREVIEW_END_HOUR = 22;
const CREATE_EVENT_AVAILABLE_START_HOUR = 7;
const CREATE_EVENT_AVAILABLE_END_HOUR = 22;
const CREATE_EVENT_DEFAULT_START_HOUR = 9;
const CREATE_EVENT_DEFAULT_START_MINUTE = 0;
const CREATE_EVENT_DEFAULT_DURATION_MINUTES = 60;
const CREATE_EVENT_SUGGESTION_LIMIT = 6;
const CREATE_EVENT_TYPE_OPTIONS = [
    { value: "", label: "Seleccionar tipo de evento..." },
    { value: "Llamada", label: "Llamada" },
    { value: "Tarea", label: "Tarea" },
    { value: "Reunion", label: "Reunión" },
    { value: "Correo", label: "Correo" },
    { value: "Whatsapp", label: "Whatsapp" },
    { value: "Seguimientos", label: "Seguimientos" },
    { value: "Cita", label: "Asignar Cita" },
];
const CREATE_EVENT_COLOR_BY_TYPE = {
    Llamada: "#808080",
    Whatsapp: "#808080",
    Correo: "#808080",
    Tarea: "#343a40",
    Reunion: "#34c38f",
    Seguimientos: "#f46a6a",
    Cita: "#f1b44c",
};
const SCHEDULE_STATUS_META = {
    free: { label: "Disponible", isAvailable: true },
    workingElsewhere: { label: "En otro lugar", isAvailable: true },
    tentative: { label: "Tentativo", isAvailable: false },
    busy: { label: "Ocupado", isAvailable: false },
    oof: { label: "Fuera de oficina", isAvailable: false },
    unknown: { label: "Desconocido", isAvailable: false },
};

const escapeODataValue = (value) => value.replace(/'/g, "''");

const normalizeDirectoryUser = (userItem) => {
    const primaryEmail = userItem.mail || userItem.userPrincipalName || "";
    const displayName = userItem.displayName || primaryEmail || "Sin nombre";

    return {
        id: userItem.id || primaryEmail || displayName,
        displayName,
        email: primaryEmail,
    };
};

const normalizeParticipantEmail = (value) => (typeof value === "string" ? value.trim().toLowerCase() : "");

const buildManualAttendeeOption = (emailValue) => {
    const normalizedEmail = normalizeParticipantEmail(emailValue);

    if (!normalizedEmail) {
        return null;
    }

    return {
        id: normalizedEmail,
        displayName: normalizedEmail,
        email: normalizedEmail,
        source: "manual",
    };
};

const buildGraphAttendeeOption = (attendeeItem) => {
    const attendeeEmail = normalizeParticipantEmail(attendeeItem?.emailAddress?.address);

    if (!attendeeEmail) {
        return null;
    }

    return {
        id: attendeeItem?.emailAddress?.address || attendeeEmail,
        displayName: attendeeItem?.emailAddress?.name || attendeeEmail,
        email: attendeeEmail,
        type: attendeeItem?.type || "required",
        source: "outlook",
    };
};

const normalizeCreateEventTypeValue = (eventTypeValue) => {
    if (typeof eventTypeValue !== "string") {
        return "";
    }

    const normalizedValue = eventTypeValue
        .trim()
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");
    const matchedOption = CREATE_EVENT_TYPE_OPTIONS.find(
        (option) => option.value
            && option.value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "") === normalizedValue,
    );

    return matchedOption?.value || "";
};

const getCreateEventColor = (eventType) => CREATE_EVENT_COLOR_BY_TYPE[eventType] || OUTLOOK_DEFAULT_COLOR;

const deleteOutlookEventById = async (accessToken, outlookEventId) => {
    if (!accessToken || !outlookEventId) {
        return false;
    }

    const response = await fetch(`https://graph.microsoft.com/v1.0/me/events/${encodeURIComponent(outlookEventId)}`, {
        method: "DELETE",
        headers: {
            Authorization: `Bearer ${accessToken}`,
        },
    });

    return response.ok;
};

const updateOutlookEventScheduleById = async (accessToken, outlookEventId, rangeValue) => {
    if (!accessToken || !outlookEventId || !rangeValue?.start || !rangeValue?.end) {
        return false;
    }

    const response = await fetch(`https://graph.microsoft.com/v1.0/me/events/${encodeURIComponent(outlookEventId)}`, {
        method: "PATCH",
        headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
            Prefer: `outlook.timezone="${OUTLOOK_TIMEZONE}"`,
        },
        body: JSON.stringify({
            start: {
                dateTime: toGraphDateTime(rangeValue.start),
                timeZone: OUTLOOK_TIMEZONE,
            },
            end: {
                dateTime: toGraphDateTime(rangeValue.end),
                timeZone: OUTLOOK_TIMEZONE,
            },
        }),
    });

    return response.ok;
};

const updateOutlookEventById = async (accessToken, outlookEventId, payload) => {
    if (!accessToken || !outlookEventId || !payload) {
        return false;
    }

    const response = await fetch(`https://graph.microsoft.com/v1.0/me/events/${encodeURIComponent(outlookEventId)}`, {
        method: "PATCH",
        headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
            Prefer: `outlook.timezone="${OUTLOOK_TIMEZONE}"`,
        },
        body: JSON.stringify(payload),
    });

    return response.ok;
};

const respondToOutlookEventById = async (accessToken, outlookEventId, action, payload) => {
    if (!accessToken || !outlookEventId || !action) {
        return false;
    }

    const response = await fetch(
        `https://graph.microsoft.com/v1.0/me/events/${encodeURIComponent(outlookEventId)}/${action}`,
        {
            method: "POST",
            headers: {
                Authorization: `Bearer ${accessToken}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify(payload || {}),
        },
    );

    return response.ok;
};

const normalizeRoomPlace = (roomItem) => {
    const displayName = roomItem.displayName || roomItem.name || roomItem.emailAddress || "Sala";
    const email = roomItem.emailAddress || "";
    const building = roomItem.building || "";
    const floorLabel = roomItem.floorLabel || roomItem.floor || "";
    const floorNumber = roomItem.floorNumber ?? null;
    const capacity = Number.isFinite(Number(roomItem.capacity)) ? Number(roomItem.capacity) : null;

    return {
        id: roomItem.id || email || displayName,
        displayName,
        email,
        building,
        floorLabel,
        floorNumber,
        capacity,
    };
};

const matchesRoomSearch = (roomItem, searchValue) => {
    if (!searchValue) {
        return true;
    }

    const normalizedSearch = searchValue.trim().toLowerCase();

    if (!normalizedSearch) {
        return true;
    }

    return [
        roomItem.displayName,
        roomItem.email,
        roomItem.building,
        roomItem.floorLabel,
    ].some((value) => value?.toLowerCase().includes(normalizedSearch));
};

/**
 * Infiere el modo de vista activo a partir del tipo de vista de FullCalendar.
 * Usado en datesSet cuando el usuario navega con flechas del calendario.
 *
 * @param {string} calendarView - Tipo de vista FC (timeGridDay, timeGridWeek, dayGridMonth)
 * @returns {"day"|"week"|"month"} Modo simplificado para estado React
 */
const getViewModeFromCalendarView = (calendarView) => {
    if (calendarView === "timeGridDay") {
        return "day";
    }

    if (calendarView === "timeGridWeek") {
        return "week"; // workweek y week comparten timeGridWeek; workweek se preserva en datesSet
    }

    return "month";
};

/** Clona un Date sin mutar el original (evita efectos colaterales en cálculos de rango). */
const cloneDate = (value) => new Date(value.getTime());

/** Normaliza una fecha a medianoche local (00:00:00.000). */
const startOfDay = (value) => {
    const date = cloneDate(value);
    date.setHours(0, 0, 0, 0);
    return date;
};

/** Suma días preservando hora (útil para ventanas [start, endExclusive)). */
const addDays = (value, days) => {
    const date = cloneDate(value);
    date.setDate(date.getDate() + days);
    return date;
};

/** Suma meses; JS ajusta día si el mes destino tiene menos días (ej. 31 ene + 1 mes). */
const addMonths = (value, months) => {
    const date = cloneDate(value);
    date.setMonth(date.getMonth() + months);
    return date;
};

/** Primer día del mes a medianoche. */
const startOfMonth = (value) => {
    const date = startOfDay(value);
    date.setDate(1);
    return date;
};

/**
 * Inicio de semana en lunes (convención europea/LatAm).
 * Domingo (0) retrocede 6 días; resto retrocede hasta el lunes anterior.
 */
const startOfWeekMonday = (value) => {
    const date = startOfDay(value);
    const weekDay = date.getDay();
    const diff = weekDay === 0 ? -6 : 1 - weekDay;
    date.setDate(date.getDate() + diff);
    return date;
};

/** Compara solo componente calendario (año/mes/día), ignora hora. */
const sameDay = (left, right) =>
    left.getFullYear() === right.getFullYear()
    && left.getMonth() === right.getMonth()
    && left.getDate() === right.getDate();

/**
 * Formato ISO date-only para query params del backend CRM.
 * @param {Date} value
 * @returns {string} YYYY-MM-DD
 */
const formatDateOnly = (value) => {
    const year = value.getFullYear();
    const month = `${value.getMonth() + 1}`.padStart(2, "0");
    const day = `${value.getDate()}`.padStart(2, "0");

    return `${year}-${month}-${day}`;
};

/**
 * Calcula la ventana visible según el modo de vista.
 * Devuelve start, endExclusive (para Graph API) y endInclusive (para CRM).
 *
 * @param {"day"|"week"|"workweek"|"month"} viewMode
 * @param {Date} baseDate - Fecha ancla (día seleccionado o visible)
 */
const buildVisibleWindow = (viewMode, baseDate) => {
    const anchorDate = startOfDay(baseDate);

    // Vista día: un solo día [00:00, 00:00 del día siguiente)
    if (viewMode === "day") {
        const start = startOfDay(anchorDate);
        const endExclusive = addDays(start, 1);

        return {
            start,
            endExclusive,
            endInclusive: start, // CRM usa rango inclusivo en ambos extremos
        };
    }

    // Vista mes: del día 1 al último día del mes
    if (viewMode === "month") {
        const start = startOfMonth(anchorDate);
        const endExclusive = startOfMonth(addMonths(start, 1));

        return {
            start,
            endExclusive,
            endInclusive: addDays(endExclusive, -1),
        };
    }

    // Vista semana / semana laboral: 7 días desde el lunes de la semana ancla
    const start = startOfWeekMonday(anchorDate);
    const endExclusive = addDays(start, 7);

    return {
        start,
        endExclusive,
        endInclusive: addDays(endExclusive, -1),
    };
};

/**
 * Cuenta asistentes que respondieron "accepted" en el payload de Graph.
 * @param {Array} attendees - Lista attendees de Microsoft Graph
 */
const countAcceptedAttendees = (attendees = []) =>
    attendees.filter(
        (attendee) => attendee?.status?.response?.toLowerCase() === "accepted",
    ).length;

/**
 * Normaliza strings de display evitando placeholders sucios del CRM/Graph.
 * @param {*} value - Valor crudo (puede no ser string)
 * @param {string} fallback - Texto si el valor es inválido
 */
const toDisplayName = (value, fallback) => {
    if (typeof value !== "string") {
        return fallback;
    }

    const normalizedValue = value.trim();

    // El CRM a veces envía "0", "null" o vacío como string
    if (!normalizedValue || normalizedValue === "0" || normalizedValue === "null") {
        return fallback;
    }

    return normalizedValue;
};

/**
 * Une eventos CRM y Outlook por outlook_event_id.
 * Produce estructura unificada para debug y mapeo a FullCalendar.
 *
 * Estrategia:
 * 1. Indexar Outlook por id
 * 2. Por cada CRM, buscar match → source "merged" o "crm"
 * 3. Outlook sin match CRM → source "outlook"
 *
 * @param {Array} crmEvents - Registros del backend
 * @param {Array} microsoftEvents - Eventos de Graph calendarView
 */
const buildUnifiedDebugPayload = (crmEvents, microsoftEvents) => {
    // Map para lookup O(1) y para detectar eventos solo-Outlook al final
    const outlookEventsById = new Map(
        microsoftEvents
            .filter((eventItem) => typeof eventItem?.id === "string" && eventItem.id.trim() !== "")
            .map((eventItem) => [eventItem.id, eventItem]),
    );

    // Cruzar CRM con Outlook; los emparejados se eliminan del Map
    const mergedEvents = crmEvents.map((crmEvent) => {
        const outlookEventId = typeof crmEvent?.outlook_event_id === "string"
            ? crmEvent.outlook_event_id.trim()
            : "";
        const matchedOutlookEvent = outlookEventId ? outlookEventsById.get(outlookEventId) : null;

        if (matchedOutlookEvent) {
            outlookEventsById.delete(outlookEventId);
        }

        return {
            source: matchedOutlookEvent ? "merged" : "crm",
            crm: crmEvent,
            outlook: matchedOutlookEvent || null,
        };
    });

    // Lo que quedó en el Map son eventos de Outlook sin registro CRM
    const outlookOnlyEvents = Array.from(outlookEventsById.values()).map((outlookEvent) => ({
        source: "outlook",
        crm: null,
        outlook: outlookEvent,
    }));

    return [...mergedEvents, ...outlookOnlyEvents];
};

/**
 * Transforma eventos unificados al formato que FullCalendar espera.
 * Prioriza fechas de Outlook cuando existen; CRM como fallback.
 *
 * @param {Array} unifiedEvents - Salida de buildUnifiedDebugPayload
 * @returns {Array} Eventos FC con extendedProps enriquecidos
 */
const mapUnifiedEventsToCalendarEvents = (unifiedEvents) =>
    unifiedEvents.map((item) => {
        const crmEvent = item.crm;
        const outlookEvent = item.outlook;

        // Métricas y listas derivadas del payload Graph
        const acceptedCount = countAcceptedAttendees(outlookEvent?.attendees);
        const attendees = (outlookEvent?.attendees || [])
            .map((attendee) => attendee?.emailAddress?.name)
            .filter(Boolean);
        const attendeeEmails = (outlookEvent?.attendees || [])
            .map((attendee) => attendee?.emailAddress?.address)
            .filter(Boolean);

        // Extraer enlaces Teams del body o del campo onlineMeeting
        const outlookDescription = getOutlookDescriptionValue(outlookEvent);
        const descriptionLinks = extractUrls(outlookEvent?.body?.content || outlookEvent?.bodyPreview || "");
        const teamsLink = outlookEvent?.onlineMeeting?.joinUrl
            || descriptionLinks.find((link) => link.includes("teams.microsoft.com"))
            || "";
        const organizerEmail = outlookEvent?.organizer?.emailAddress?.address || "";
        const teamsChatLink = buildTeamsChatLink(
            attendeeEmails.length ? attendeeEmails : [organizerEmail],
        );

        // Resolución de etiquetas con cascada CRM → Outlook → default
        const organizer = toDisplayName(
            outlookEvent?.organizer?.emailAddress?.name,
            toDisplayName(crmEvent?.name_admin, "Sin organizador"),
        );
        const adminEmail = (
            crmEvent?.email_admin
            || outlookEvent?.organizer?.emailAddress?.address
            || organizerEmail
            || ""
        ).trim().toLowerCase();
        const adminFilterKey = adminEmail
            ? `admin-email-${adminEmail}`
            : crmEvent?.id_admin
                ? `crm-admin-${crmEvent.id_admin}`
                : organizer
                    ? `outlook-admin-${organizer.toLowerCase()}`
                    : "";
        const adminFilterLabel = toDisplayName(crmEvent?.name_admin, organizer);
        const leadName = toDisplayName(
            crmEvent?.nombre_lead,
            attendees[0] || organizer,
        );
        const attendee = toDisplayName(
            crmEvent?.name_admin,
            organizer,
        );
        const title = toDisplayName(
            outlookEvent?.subject,
            toDisplayName(crmEvent?.nombre_calendar, "Evento sin título"),
        );
        const responseValue = crmEvent?.accion_calendar
            ? toDisplayName(crmEvent?.accion_calendar, "Sin respuesta")
            : humanizeOutlookResponse(outlookEvent?.responseStatus?.response, "Sin respuesta");
        const eventColor = crmEvent?.color_calendar || OUTLOOK_DEFAULT_COLOR;
        const meetingType = outlookEvent?.isOnlineMeeting || teamsLink ? "teams" : "standard";

        // Outlook devuelve dateTime en zona Prefer; CRM puede venir como string ISO
        const start = outlookEvent?.start?.dateTime || crmEvent?.fechaIni_calendar;
        const end = outlookEvent?.end?.dateTime || crmEvent?.fechaFin_calendar || start;

        return {
            // Prefijo evita colisión de ids entre fuentes
            id: crmEvent?.id_calendar
                ? `crm-${crmEvent.id_calendar}`
                : `outlook-${outlookEvent.id}`,
            title,
            start,
            end,
            allDay: false, // El CRM opera con hora; no hay eventos de día completo por ahora
            classNames: item.source === "outlook" ? ["is-secondary"] : [], // Estilo visual distinto
            extendedProps: {
                source: item.source,
                category: crmEvent
                    ? CRM_CATEGORY_BY_TYPE[crmEvent.tipo_calendar] || "categoria1"
                    : null,
                eventColor,
                crm: crmEvent,
                outlook: outlookEvent,
                adminFilterKey,
                adminFilterLabel,
                adminFilterEmail: adminEmail,
                adminFilterSource: item.source,
                location: toDisplayName(
                    outlookEvent?.location?.displayName,
                    toDisplayName(crmEvent?.tipo_calendar, "Sin ubicación"),
                ),
                attendee,
                leadName: item.source === "outlook" ? "" : leadName, // Sin lead en eventos solo-Outlook
                leadInternalId: crmEvent?.idinterno_lead || null,
                eventType: toDisplayName(
                    crmEvent?.tipo_calendar,
                    outlookEvent?.isOnlineMeeting ? "Reunión" : "Evento",
                ),
                projectName: toDisplayName(crmEvent?.nombre_proyecto, ""),
                response: responseValue,
                status: humanizeOutlookResponse(
                    outlookEvent?.responseStatus?.response,
                    responseValue,
                ),
                acceptedCount,
                organizer,
                sentAt: outlookEvent?.lastModifiedDateTime
                    ? `Actualizado ${new Date(outlookEvent.lastModifiedDateTime).toLocaleString("es-CR")}`
                    : "Sin marca de envío",
                teamsLink,
                teamsChatLink,
                meetingId: outlookEvent?.id || crmEvent?.outlook_event_id || null,
                accessCode: null, // Graph no expone código de acceso en el select actual
                attendees: attendees.length ? attendees : [attendee],
                meetingType,
                description: crmEvent?.decrip_calendar || outlookDescription,
                summaryText: crmEvent?.decrip_calendar || outlookDescription,
                descriptionLinks,
                webLink: outlookEvent?.webLink || null,
            },
        };
    });

/** Título del mes para sidebar y header (ej. "Junio 2026"). */
const getMonthTitle = (value) =>
    new Intl.DateTimeFormat("es-CR", {
        month: "long",
        year: "numeric",
    }).format(value).replace(/^\w/, (char) => char.toUpperCase()); // Capitalizar primera letra

const CREATE_EVENT_PREVIEW_HOURS = Array.from(
    { length: CREATE_EVENT_PREVIEW_END_HOUR - CREATE_EVENT_PREVIEW_START_HOUR },
    (_, hourIndex) => CREATE_EVENT_PREVIEW_START_HOUR + hourIndex,
);

const formatCreateEventPreviewTitle = (value) =>
    new Intl.DateTimeFormat("es-CR", {
        weekday: "short",
        day: "2-digit",
        month: "short",
        year: "numeric",
    }).format(value).replace(/^\w/, (char) => char.toUpperCase());

const formatDateInputValue = (value) => {
    const yearValue = value.getFullYear();
    const monthValue = `${value.getMonth() + 1}`.padStart(2, "0");
    const dayValue = `${value.getDate()}`.padStart(2, "0");

    return `${yearValue}-${monthValue}-${dayValue}`;
};

const parseLocalDateOnlyValue = (value) => {
    if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        return null;
    }

    const [yearValue, monthValue, dayValue] = value.split("-").map((part) => Number.parseInt(part, 10));

    if (!yearValue || !monthValue || !dayValue) {
        return null;
    }

    return new Date(yearValue, monthValue - 1, dayValue, 0, 0, 0, 0);
};

const parseTimeValueToParts = (value) => {
    const [hourValue = "0", minuteValue = "0"] = `${value || ""}`.split(":");

    return {
        hour: Number.parseInt(hourValue, 10) || 0,
        minute: Number.parseInt(minuteValue, 10) || 0,
    };
};

const formatTimeValue = (hourValue, minuteValue) =>
    `${`${hourValue}`.padStart(2, "0")}:${`${minuteValue}`.padStart(2, "0")}`;

const addMinutesToTimeValue = (timeValue, minutesToAdd) => {
    const { hour, minute } = parseTimeValueToParts(timeValue);
    const normalizedDate = new Date(2026, 0, 1, hour, minute, 0, 0);
    normalizedDate.setMinutes(normalizedDate.getMinutes() + minutesToAdd);
    const maximumEndMinutes = CREATE_EVENT_AVAILABLE_END_HOUR * 60;
    const normalizedMinutes = (normalizedDate.getHours() * 60) + normalizedDate.getMinutes();

    if (normalizedMinutes > maximumEndMinutes) {
        return formatTimeValue(CREATE_EVENT_AVAILABLE_END_HOUR, 0);
    }

    return formatTimeValue(normalizedDate.getHours(), normalizedDate.getMinutes());
};

const roundDateToNextScheduleSlot = (value) => {
    const normalizedDate = new Date(value.getTime());
    normalizedDate.setSeconds(0, 0);

    const currentMinutes = normalizedDate.getMinutes();
    const nextSlotMinutes = Math.ceil(currentMinutes / SCHEDULE_INTERVAL_MINUTES) * SCHEDULE_INTERVAL_MINUTES;

    if (nextSlotMinutes >= 60) {
        normalizedDate.setHours(normalizedDate.getHours() + 1, 0, 0, 0);
        return normalizedDate;
    }

    normalizedDate.setMinutes(nextSlotMinutes, 0, 0);
    return normalizedDate;
};

const getCreateEventMinimumDate = () => {
    const minimumDate = startOfDay(new Date());
    minimumDate.setDate(minimumDate.getDate() - 1);
    return minimumDate;
};

const clampCreateEventDateValue = (dateValue) => {
    const minimumDateValue = formatDateInputValue(getCreateEventMinimumDate());

    if (!dateValue || dateValue < minimumDateValue) {
        return minimumDateValue;
    }

    return dateValue;
};

const getDefaultCreateEventStartDate = () => {
    const now = new Date();
    const roundedNow = roundDateToNextScheduleSlot(now);
    const minimumStartMinutes = CREATE_EVENT_AVAILABLE_START_HOUR * 60;
    const maximumStartMinutes = (CREATE_EVENT_AVAILABLE_END_HOUR * 60) - SCHEDULE_INTERVAL_MINUTES;
    const roundedMinutes = (roundedNow.getHours() * 60) + roundedNow.getMinutes();

    if (roundedMinutes < minimumStartMinutes) {
        roundedNow.setHours(CREATE_EVENT_AVAILABLE_START_HOUR, 0, 0, 0);
    } else if (roundedMinutes > maximumStartMinutes) {
        roundedNow.setHours(
            Math.floor(maximumStartMinutes / 60),
            maximumStartMinutes % 60,
            0,
            0,
        );
    }

    return roundedNow;
};

const buildDateFromInputParts = (dateValue, timeValue) => {
    const [yearValue, monthValue, dayValue] = `${dateValue || ""}`.split("-").map((partValue) => Number.parseInt(partValue, 10) || 0);
    const { hour, minute } = parseTimeValueToParts(timeValue);
    const normalizedDate = new Date(
        yearValue || 2026,
        Math.max((monthValue || 1) - 1, 0),
        dayValue || 1,
        hour,
        minute,
        0,
        0,
    );

    return normalizedDate;
};

const formatCreateEventDateTimeLabel = (rangeValue) => {
    const dateLabel = new Intl.DateTimeFormat("es-CR", {
        weekday: "short",
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
    }).format(rangeValue.start);

    return `${dateLabel}, de ${formatHourMinuteLabel(
        rangeValue.start.getHours(),
        rangeValue.start.getMinutes(),
    )} a ${formatHourMinuteLabel(
        rangeValue.end.getHours(),
        rangeValue.end.getMinutes(),
    )}`;
};

const formatCalendarDayPopoverTitle = (value) => new Intl.DateTimeFormat("es-CR", {
    day: "numeric",
    month: "long",
    year: "numeric",
}).format(value);

const formatHourMinuteLabel = (hourValue, minuteValue) => {
    const normalizedDate = new Date(2026, 0, 1, 0, 0, 0, 0);
    normalizedDate.setHours(hourValue, minuteValue, 0, 0);

    return new Intl.DateTimeFormat("es-CR", {
        hour: "numeric",
        minute: "2-digit",
        hour12: false,
    }).format(normalizedDate);
};

const buildCreateEventScheduleRange = (dateValue, startTimeValue, endTimeValue) => {
    const startDate = buildDateFromInputParts(dateValue, startTimeValue);
    const endDate = buildDateFromInputParts(dateValue, endTimeValue);

    if (endDate <= startDate) {
        endDate.setMinutes(endDate.getMinutes() + CREATE_EVENT_DEFAULT_DURATION_MINUTES);
    }

    return {
        start: startDate,
        end: endDate,
    };
};

const buildMeetingDurationIso = (rangeValue) => {
    const durationMinutes = Math.max(
        SCHEDULE_INTERVAL_MINUTES,
        Math.round((rangeValue.end.getTime() - rangeValue.start.getTime()) / 60000),
    );

    return `PT${durationMinutes}M`;
};

const buildSuggestionSearchWindow = (rangeValue) => {
    const startDate = startOfDay(rangeValue.start);
    startDate.setHours(CREATE_EVENT_PREVIEW_START_HOUR, 0, 0, 0);

    const endDate = startOfDay(rangeValue.start);
    endDate.setHours(CREATE_EVENT_PREVIEW_END_HOUR, 0, 0, 0);

    return {
        start: startDate,
        end: endDate,
    };
};

const buildEventTransactionId = () => {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
        return crypto.randomUUID();
    }

    return `crm-ventas-${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

const formatMeetingSuggestionLabel = (rangeValue) => {
    const dateLabel = new Intl.DateTimeFormat("es-CR", {
        weekday: "short",
        day: "2-digit",
        month: "2-digit",
    }).format(rangeValue.start);
    const durationMinutes = Math.max(0, Math.round((rangeValue.end.getTime() - rangeValue.start.getTime()) / 60000));

    return `${dateLabel} ${formatHourMinuteLabel(rangeValue.start.getHours(), rangeValue.start.getMinutes())} - ${formatHourMinuteLabel(
        rangeValue.end.getHours(),
        rangeValue.end.getMinutes(),
    )} (${durationMinutes} min)`;
};

const toGraphDateTime = (value) => {
    const yearValue = value.getFullYear();
    const monthValue = `${value.getMonth() + 1}`.padStart(2, "0");
    const dayValue = `${value.getDate()}`.padStart(2, "0");
    const hourValue = `${value.getHours()}`.padStart(2, "0");
    const minuteValue = `${value.getMinutes()}`.padStart(2, "0");
    const secondValue = `${value.getSeconds()}`.padStart(2, "0");

    return `${yearValue}-${monthValue}-${dayValue}T${hourValue}:${minuteValue}:${secondValue}`;
};

const normalizeScheduleStatus = (statusValue) => {
    if (!statusValue) {
        return "unknown";
    }

    if (statusValue === "workingElsewhere") {
        return "workingElsewhere";
    }

    if (statusValue === "tentative" || statusValue === "busy" || statusValue === "oof" || statusValue === "free") {
        return statusValue;
    }

    return "unknown";
};

const intersectsScheduleRange = (rangeStart, rangeEnd, itemStart, itemEnd) =>
    itemStart < rangeEnd && itemEnd > rangeStart;

const getScheduleStatusPriority = (statusValue) => {
    const priorities = {
        free: 0,
        workingElsewhere: 1,
        tentative: 2,
        busy: 3,
        oof: 4,
        unknown: 5,
    };

    return priorities[statusValue] ?? priorities.unknown;
};

const getParticipantAvailabilityStatus = (scheduleInfo, rangeValue) => {
    if (!scheduleInfo || scheduleInfo.error) {
        return "unknown";
    }

    const scheduleItems = Array.isArray(scheduleInfo.scheduleItems) ? scheduleInfo.scheduleItems : [];
    const overlappingStatuses = scheduleItems
        .filter((scheduleItem) => {
            const itemStart = new Date(scheduleItem?.start?.dateTime || "");
            const itemEnd = new Date(scheduleItem?.end?.dateTime || "");

            if (Number.isNaN(itemStart.getTime()) || Number.isNaN(itemEnd.getTime())) {
                return false;
            }

            return intersectsScheduleRange(rangeValue.start, rangeValue.end, itemStart, itemEnd);
        })
        .map((scheduleItem) => normalizeScheduleStatus(scheduleItem.status));

    if (!overlappingStatuses.length) {
        return "free";
    }

    return overlappingStatuses.sort((leftValue, rightValue) => (
        getScheduleStatusPriority(rightValue) - getScheduleStatusPriority(leftValue)
    ))[0];
};

const buildPreviewBusyBlocks = (scheduleCollection, rangeValue, focusEmail = "") => {
    const previewDayStart = startOfDay(rangeValue.start);
    previewDayStart.setHours(CREATE_EVENT_PREVIEW_START_HOUR, 0, 0, 0);

    const previewDayEnd = startOfDay(rangeValue.start);
    previewDayEnd.setHours(CREATE_EVENT_PREVIEW_END_HOUR, 0, 0, 0);

    const normalizedFocusEmails = Array.isArray(focusEmail)
        ? focusEmail
            .map((emailValue) => emailValue?.trim().toLowerCase())
            .filter(Boolean)
        : [focusEmail.trim().toLowerCase()].filter(Boolean);

    return scheduleCollection
        .filter((scheduleInfo) => {
            if (!normalizedFocusEmails.length) {
                return true;
            }

            const scheduleEmail = (scheduleInfo?.requestedEmail || scheduleInfo?.scheduleId || "").toLowerCase();

            return normalizedFocusEmails.includes(scheduleEmail);
        })
        .flatMap((scheduleInfo, scheduleIndex) => {
            const scheduleItems = Array.isArray(scheduleInfo?.scheduleItems) ? scheduleInfo.scheduleItems : [];

            return scheduleItems
                .map((scheduleItem, scheduleItemIndex) => {
                    const normalizedStatus = normalizeScheduleStatus(scheduleItem.status);

                    if (SCHEDULE_STATUS_META[normalizedStatus]?.isAvailable) {
                        return null;
                    }

                    const itemStart = new Date(scheduleItem?.start?.dateTime || "");
                    const itemEnd = new Date(scheduleItem?.end?.dateTime || "");

                    if (Number.isNaN(itemStart.getTime()) || Number.isNaN(itemEnd.getTime())) {
                        return null;
                    }

                    const clampedStart = new Date(Math.max(itemStart.getTime(), previewDayStart.getTime()));
                    const clampedEnd = new Date(Math.min(itemEnd.getTime(), previewDayEnd.getTime()));

                    if (clampedEnd <= clampedStart) {
                        return null;
                    }

                    const totalMinutes = (previewDayEnd.getTime() - previewDayStart.getTime()) / 60000;
                    const startMinutes = (clampedStart.getTime() - previewDayStart.getTime()) / 60000;
                    const durationMinutes = (clampedEnd.getTime() - clampedStart.getTime()) / 60000;
                    const scheduleLocation = typeof scheduleItem?.location === "string"
                        ? scheduleItem.location.trim()
                        : scheduleItem?.location?.displayName?.trim() || "";
                    const scheduleSubject = scheduleItem?.isPrivate
                        ? "Evento privado"
                        : (scheduleItem?.subject || "").trim();
                    const previewLabel = scheduleSubject || scheduleLocation || (SCHEDULE_STATUS_META[normalizedStatus]?.label || "No disponible");
                    const timeLabel = `${formatHourMinuteLabel(itemStart.getHours(), itemStart.getMinutes())} - ${formatHourMinuteLabel(itemEnd.getHours(), itemEnd.getMinutes())}`;

                    return {
                        id: `${scheduleInfo.scheduleId}-${scheduleItem.start?.dateTime}-${scheduleItem.end?.dateTime}-${normalizedStatus}-${scheduleIndex}-${scheduleItemIndex}`,
                        label: SCHEDULE_STATUS_META[normalizedStatus]?.label || "No disponible",
                        participant: scheduleInfo.scheduleId,
                        previewLabel,
                        timeLabel,
                        status: normalizedStatus,
                        topPercent: (startMinutes / totalMinutes) * 100,
                        heightPercent: (durationMinutes / totalMinutes) * 100,
                    };
                })
                .filter(Boolean);
        });
};

const isExpectedLocalWebhookSyncError = (error) => {
    const message = typeof error?.message === "string" ? error.message : "";

    return message.includes("No hay URL pública de webhook configurada para este entorno");
};

const buildSuggestionItemFromRange = (rangeValue, participantStatuses = {}, suggestionReason = "") => {
    const availableCount = Object.values(participantStatuses).filter(
        (statusValue) => SCHEDULE_STATUS_META[statusValue]?.isAvailable,
    ).length;

    return {
        id: `${toGraphDateTime(rangeValue.start)}-${toGraphDateTime(rangeValue.end)}`,
        start: rangeValue.start,
        end: rangeValue.end,
        label: formatMeetingSuggestionLabel(rangeValue),
        availableCount,
        participantStatuses,
        suggestionReason,
    };
};

const buildLocalMeetingSuggestions = (scheduleCollection, baseRange, participantEmails) => {
    const previewWindow = buildSuggestionSearchWindow(baseRange);
    const suggestionItems = [];
    const maxSuggestions = CREATE_EVENT_SUGGESTION_LIMIT;
    const durationMinutes = Math.max(
        SCHEDULE_INTERVAL_MINUTES,
        Math.round((baseRange.end.getTime() - baseRange.start.getTime()) / 60000),
    );

    for (
        let cursorDate = new Date(previewWindow.start.getTime());
        cursorDate.getTime() + (durationMinutes * 60000) <= previewWindow.end.getTime() && suggestionItems.length < maxSuggestions;
        cursorDate = new Date(cursorDate.getTime() + (SCHEDULE_INTERVAL_MINUTES * 60000))
    ) {
        const nextEndDate = new Date(cursorDate.getTime() + (durationMinutes * 60000));
        const nextRange = { start: new Date(cursorDate.getTime()), end: nextEndDate };
        const participantStatuses = Object.fromEntries(
            participantEmails.map((participantEmail) => {
                const scheduleInfo = scheduleCollection.find((item) =>
                    (item?.requestedEmail || item?.scheduleId || "").toLowerCase() === participantEmail,
                );

                return [
                    participantEmail,
                    getParticipantAvailabilityStatus(scheduleInfo, nextRange),
                ];
            }),
        );
        const everyoneAvailable = Object.values(participantStatuses).every(
            (statusValue) => SCHEDULE_STATUS_META[statusValue]?.isAvailable,
        );

        if (everyoneAvailable) {
            suggestionItems.push(
                buildSuggestionItemFromRange(
                    nextRange,
                    participantStatuses,
                    "Sugerido porque todos los asistentes están disponibles.",
                ),
            );
        }
    }

    return suggestionItems;
};

/**
 * Número de semana ISO 8601 para la columna de números del mini-calendario.
 * @param {Date} value
 */
const getIsoWeekNumber = (value) => {
    const date = startOfDay(value);
    // Jueves de la semana define el año ISO
    date.setDate(date.getDate() + 4 - (date.getDay() || 7));
    const yearStart = new Date(date.getFullYear(), 0, 1);

    return Math.ceil((((date - yearStart) / 86400000) + 1) / 7);
};

/**
 * Construye 5 filas × 7 días para el mini-calendario lateral.
 * Siempre 5 semanas para altura estable del sidebar.
 */
const buildMiniCalendarWeeks = (value) => {
    const monthStart = startOfMonth(value);
    const gridStart = startOfWeekMonday(monthStart); // Puede incluir días del mes anterior
    const weeks = [];

    for (let weekIndex = 0; weekIndex < 5; weekIndex += 1) {
        const rowStart = addDays(gridStart, weekIndex * 7);
        const days = [];

        for (let dayIndex = 0; dayIndex < 7; dayIndex += 1) {
            days.push(addDays(rowStart, dayIndex));
        }

        weeks.push({
            weekNumber: getIsoWeekNumber(rowStart),
            days,
        });
    }

    return weeks;
};

/**
 * Etiqueta legible de inicio-fin para popover y modal.
 * @param {{ start: Date|string, end?: Date|string }} event - Evento FC o objeto con fechas
 */
const getEventDateLabel = (event) => {
    if (!event?.start) {
        return "";
    }

    const startDate = event.start instanceof Date ? event.start : new Date(event.start);

    if (Number.isNaN(startDate.getTime())) {
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

    const startLabel = formatter.format(startDate);

    if (!event.end) {
        return startLabel;
    }

    const endDate = event.end instanceof Date ? event.end : new Date(event.end);

    if (Number.isNaN(endDate.getTime())) {
        return startLabel;
    }

    const endFormatter = new Intl.DateTimeFormat("es-CR", {
        hour: "numeric",
        minute: "2-digit",
    });

    return `${startLabel} a ${endFormatter.format(endDate)}`;
};

/** Badge de origen del evento en la UI de sincronización. */
const getSourceStatusLabel = (source) => {
    if (source === "merged") {
        return "Sincronizado";
    }

    if (source === "outlook") {
        return "Solo Outlook";
    }

    return "Solo CRM";
};

/**
 * Traduce códigos de respuesta de Outlook Graph a español.
 * @param {string} value - accepted, declined, tentativelyAccepted, etc.
 * @param {string} fallback
 */
const humanizeOutlookResponse = (value, fallback = "Sin respuesta") => {
    const normalizedValue = typeof value === "string" ? value.trim() : "";

    if (!normalizedValue) {
        return fallback;
    }

    const responseMap = {
        accepted: "Aceptado",
        declined: "Rechazado",
        none: "Sin respuesta",
        notResponded: "Sin respuesta",
        organizer: "Organizador",
        tentativelyAccepted: "Aceptado provisional",
    };

    return responseMap[normalizedValue] || normalizedValue;
};

/**
 * Evita mostrar eventType si es redundante con location (mismo texto).
 * Reduce ruido visual en el popover.
 */
const shouldRenderEventType = (eventType, location) => {
    if (!eventType) {
        return false;
    }

    if (!location) {
        return true;
    }

    return eventType.trim().toLowerCase() !== location.trim().toLowerCase();
};

/** Extrae URLs http(s) de un texto plano o HTML preview. */
const extractUrls = (value) => {
    if (typeof value !== "string") {
        return [];
    }

    return Array.from(value.matchAll(/https?:\/\/[^\s>]+/gi), (match) => match[0]);
};

const getOutlookDescriptionValue = (outlookEvent) => {
    const fullBodyDescription = sanitizeEventDescription(outlookEvent?.body?.content || "");

    if (fullBodyDescription) {
        return fullBodyDescription;
    }

    return sanitizeEventDescription(outlookEvent?.bodyPreview || "");
};

/**
 * Limpia bodyPreview de Outlook para mostrar resumen sin links ni markup.
 * Quita URLs, tags HTML y separadores repetidos.
 */
const sanitizeEventDescription = (value) => {
    if (typeof value !== "string") {
        return "";
    }

    return value
        .replace(/https?:\/\/[^\s>]+/gi, "")
        .replace(/<[^>]+>/g, " ")
        .replace(/[_-]{5,}/g, " ")
        .replace(/\s+/g, " ")
        .trim();
};

/**
 * Genera deep link de chat grupal en Teams con lista de emails.
 * @param {string[]} emails
 */
const buildTeamsChatLink = (emails = []) => {
    const validEmails = emails
        .filter((email) => typeof email === "string" && email.trim() !== "")
        .map((email) => email.trim());

    if (!validEmails.length) {
        return "";
    }

    return `https://teams.microsoft.com/l/chat/0/0?users=${encodeURIComponent(validEmails.join(","))}`;
};

/**
 * Texto de resumen para el popover según origen del evento.
 * Outlook lleva prefijo "Resumen:" para distinguir del CRM.
 */
const getEventSummaryText = (eventItem) => {
    const description = eventItem?.extendedProps?.summaryText || eventItem?.extendedProps?.description;

    if (!description) {
        return "";
    }

    if (eventItem?.extendedProps?.source === "outlook") {
        return `Resumen: ${description}`;
    }

    return description;
};

const shouldKeepEventByOrigin = (source, originFilters) => {
    const showOnlyCrm = originFilters.crm;
    const showOnlyOutlook = originFilters.outlook;

    if (!showOnlyCrm && !showOnlyOutlook) {
        return true;
    }

    if (showOnlyCrm && !showOnlyOutlook) {
        return source === "crm" || source === "merged";
    }

    if (!showOnlyCrm && showOnlyOutlook) {
        return source === "outlook";
    }

    return true;
};

const shouldKeepEventByCategory = (eventItem, crmFilters) => {
    const source = eventItem?.extendedProps?.source;

    if (source === "outlook") {
        return true;
    }

    const category = eventItem?.extendedProps?.category;

    if (!category) {
        return true;
    }

    return crmFilters[category] !== false;
};

const shouldKeepEventByAdmin = (eventItem, selectedAdmins) => {
    const hasActiveAdminFilter = Object.values(selectedAdmins).some(Boolean);

    if (!hasActiveAdminFilter) {
        return true;
    }

    const eventAdminKey = eventItem?.extendedProps?.adminFilterKey;

    if (!eventAdminKey) {
        return false;
    }

    return selectedAdmins[eventAdminKey] === true;
};

const buildVisibleCrmFilterOptions = (events) => {
    const availableCategories = new Set(
        events
            .map((eventItem) => eventItem?.extendedProps?.category)
            .filter(Boolean),
    );

    return CRM_FILTER_OPTIONS.filter((option) => availableCategories.has(option.value));
};

const buildAdminFilterOptions = (events) => {
    const adminMap = new Map();

    events.forEach((eventItem) => {
        const adminKey = eventItem?.extendedProps?.adminFilterKey;
        const adminLabel = eventItem?.extendedProps?.adminFilterLabel;
        const adminEmail = eventItem?.extendedProps?.adminFilterEmail || "";
        const adminSource = eventItem?.extendedProps?.adminFilterSource || "";

        if (!adminKey || !adminLabel) {
            return;
        }

        const currentAdmin = adminMap.get(adminKey);

        if (!currentAdmin) {
            adminMap.set(adminKey, {
                value: adminKey,
                label: adminLabel,
                email: adminEmail,
                sourceSet: new Set(adminSource ? [adminSource] : []),
            });
            return;
        }

        if (!currentAdmin.email && adminEmail) {
            currentAdmin.email = adminEmail;
        }

        if (adminSource) {
            currentAdmin.sourceSet.add(adminSource);
        }
    });

    return Array.from(adminMap.values())
        .map((adminItem) => {
            const normalizedSources = Array.from(adminItem.sourceSet);
            const subtitle = normalizedSources.includes("merged")
                ? "CRM · Outlook"
                : normalizedSources.includes("crm") && normalizedSources.includes("outlook")
                    ? "CRM · Outlook"
                    : normalizedSources.includes("crm")
                        ? "CRM"
                        : normalizedSources.includes("outlook")
                            ? "Outlook"
                            : "";

            return {
                value: adminItem.value,
                label: adminItem.label,
                subtitle,
            };
        })
        .sort((left, right) => left.label.localeCompare(right.label, "es"));
};

const countActiveFilters = (crmFilters, originFilters, selectedAdmins, visibleCrmOptions) => {
    const visibleCrmFilterValues = new Set(visibleCrmOptions.map((option) => option.value));
    const disabledCrmFilterCount = Object.entries(crmFilters).filter(
        ([filterKey, isSelected]) => visibleCrmFilterValues.has(filterKey) && !isSelected,
    ).length;

    return disabledCrmFilterCount
        + Object.values(originFilters).filter(Boolean).length
        + Object.values(selectedAdmins).filter(Boolean).length;
};

/**
 * Vista Outlook con navegación real y carga de eventos CRM + Microsoft 365 por rango visible.
 *
 * Flujo principal:
 * 1. currentWindow define rango según vista activa
 * 2. useEffect carga CRM (API) y Outlook (Graph) en paralelo lógico
 * 3. Unifica, mapea y setCalendarEvents
 * 4. FullCalendar renderiza; clic abre Popover; expand abre Dialog
 *
 * @returns {JSX.Element} Calendario operativo.
 */
export const View_calendario_outlook = () => {
    const dispatch = useDispatch();

    // --- Estado global de autenticación CRM (Redux) ---
    const {
        idnetsuite_admin,
        microsoftUser,
        rol_admin,
        email_admin,
        name_admin,
    } = useSelector((state) => state.auth);

    // --- MSAL: cuenta Microsoft vinculada al usuario CRM ---
    const { accounts, inProgress, instance } = useMsal();

    // Ref al componente FullCalendar para invocar API imperativa (gotoDate, changeView)
    const calendarRef = useRef(null);

    // Timeout para abrir modal tras cerrar popover (evita conflicto de foco MUI)
    const expandModalTimeoutRef = useRef(null);
    const attendeeSearchTimeoutRef = useRef(null);
    const microsoftReauthInFlightRef = useRef(false);

    // Modo de vista activo: day | workweek | week | month
    const [activeViewMode, setActiveViewMode] = useState("month");

    // Día ancla seleccionado (sincronizado con FullCalendar vía datesSet)
    const [calendarDate, setCalendarDate] = useState(startOfDay(new Date()));

    // Título que FullCalendar genera (ej. rango semanal); distinto de getMonthTitle
    const [calendarTitle, setCalendarTitle] = useState(getMonthTitle(new Date()));

    // Eventos ya mapeados al formato FullCalendar
    const [calendarEvents, setCalendarEvents] = useState([]);
    const [isLoadingCalendarEvents, setIsLoadingCalendarEvents] = useState(false);

    // Evento seleccionado al hacer clic (objeto Event de FullCalendar)
    const [selectedEvent, setSelectedEvent] = useState(null);
    const [selectedDayEvents, setSelectedDayEvents] = useState([]);
    const [selectedDayEventsTitle, setSelectedDayEventsTitle] = useState("");
    const [selectedDayEventsPosition, setSelectedDayEventsPosition] = useState(null);

    // Copia del evento al expandir modal (se setea antes de cerrar popover)
    const [expandedEvent, setExpandedEvent] = useState(null);

    // Coordenadas del clic para anclar el Popover (anchorPosition)
    const [selectedPosition, setSelectedPosition] = useState(null);

    // Panel de respuesta RSVP (Aceptar/Rechazar) en popover Teams
    const [showResponseActions, setShowResponseActions] = useState(false);

    // Checkbox "notificar al organizador" en panel de respuesta
    const [notifyOrganizer, setNotifyOrganizer] = useState(true);
    const [responseComment, setResponseComment] = useState("");
    const [isSubmittingResponseAction, setIsSubmittingResponseAction] = useState(false);

    // Control de apertura del Dialog expandido
    const [isExpandedModalOpen, setIsExpandedModalOpen] = useState(false);
    const [isCreateEventModalOpen, setIsCreateEventModalOpen] = useState(false);
    const [editingEventContext, setEditingEventContext] = useState(null);
    const [isCreateTeamsMeeting, setIsCreateTeamsMeeting] = useState(false);
    const [isScheduleEditorOpen, setIsScheduleEditorOpen] = useState(false);
    const [createEventTitle, setCreateEventTitle] = useState("");
    const [createEventType, setCreateEventType] = useState("");
    const [createEventLocation, setCreateEventLocation] = useState("");
    const [roomSearchText, setRoomSearchText] = useState("");
    const [createEventDescription, setCreateEventDescription] = useState("");
    const [isCreateEventLeadEnabled, setIsCreateEventLeadEnabled] = useState(false);
    const [createEventLeadId, setCreateEventLeadId] = useState("");
    const [isLeadInvitationEnabled, setIsLeadInvitationEnabled] = useState(false);
    const [createEventLeadOptions, setCreateEventLeadOptions] = useState([]);
    const [isLoadingCreateEventLeadOptions, setIsLoadingCreateEventLeadOptions] = useState(false);
    const [createEventLeadOptionsError, setCreateEventLeadOptionsError] = useState("");
    const [createEventProjectId, setCreateEventProjectId] = useState("");
    const [createEventProjectOptions, setCreateEventProjectOptions] = useState([]);
    const [isLoadingCreateEventProjectOptions, setIsLoadingCreateEventProjectOptions] = useState(false);
    const [createEventProjectOptionsError, setCreateEventProjectOptionsError] = useState("");
    const [createEventDateValue, setCreateEventDateValue] = useState(formatDateInputValue(calendarDate));
    const [createEventStartTimeValue, setCreateEventStartTimeValue] = useState(
        formatTimeValue(CREATE_EVENT_DEFAULT_START_HOUR, CREATE_EVENT_DEFAULT_START_MINUTE),
    );
    const [createEventEndTimeValue, setCreateEventEndTimeValue] = useState(
        formatTimeValue(CREATE_EVENT_DEFAULT_START_HOUR, CREATE_EVENT_DEFAULT_START_MINUTE + CREATE_EVENT_DEFAULT_DURATION_MINUTES),
    );
    const [hasTouchedCreateEventTitle, setHasTouchedCreateEventTitle] = useState(false);
    const [attendeeDirectoryOptions, setAttendeeDirectoryOptions] = useState([]);
    const [selectedAttendees, setSelectedAttendees] = useState([]);
    const [attendeeSearchText, setAttendeeSearchText] = useState("");
    const [isLoadingAttendeeDirectory, setIsLoadingAttendeeDirectory] = useState(false);
    const [attendeeDirectoryError, setAttendeeDirectoryError] = useState("");
    const [roomDirectoryOptions, setRoomDirectoryOptions] = useState([]);
    const [selectedRoomOption, setSelectedRoomOption] = useState(null);
    const [isRoomSuggestionsOpen, setIsRoomSuggestionsOpen] = useState(false);
    const [hasLoadedRoomDirectory, setHasLoadedRoomDirectory] = useState(false);
    const [showAllRoomSuggestions, setShowAllRoomSuggestions] = useState(false);
    const [isLoadingRoomDirectory, setIsLoadingRoomDirectory] = useState(false);
    const [isLoadingRoomAvailability, setIsLoadingRoomAvailability] = useState(false);
    const [roomDirectoryError, setRoomDirectoryError] = useState("");
    const [roomAvailabilityByEmail, setRoomAvailabilityByEmail] = useState({});
    const [scheduleAvailability, setScheduleAvailability] = useState([]);
    const [isLoadingScheduleAvailability, setIsLoadingScheduleAvailability] = useState(false);
    const [scheduleAvailabilityError, setScheduleAvailabilityError] = useState("");
    const [meetingSuggestions, setMeetingSuggestions] = useState([]);
    const [isLoadingMeetingSuggestions, setIsLoadingMeetingSuggestions] = useState(false);
    const [meetingSuggestionsError, setMeetingSuggestionsError] = useState("");
    const [isSavingCreateEvent, setIsSavingCreateEvent] = useState(false);
    const [isUpdatingEventStatus, setIsUpdatingEventStatus] = useState(false);
    const [createEventSubmitError, setCreateEventSubmitError] = useState("");
    const [eventsReloadToken, setEventsReloadToken] = useState(0);

    // Feedback visual "Copiado" al copiar enlace Teams
    const [copiedLinkEventId, setCopiedLinkEventId] = useState("");
    const [crmFilters, setCrmFilters] = useState(DEFAULT_CRM_FILTERS);
    const [originFilters, setOriginFilters] = useState(DEFAULT_ORIGIN_FILTERS);
    const [selectedAdmins, setSelectedAdmins] = useState({});
    const [filterMenuAnchor, setFilterMenuAnchor] = useState(null);

    // Ventana de fechas derivada; recalcula al cambiar vista o fecha ancla
    const currentWindow = useMemo(
        () => buildVisibleWindow(activeViewMode, calendarDate),
        [activeViewMode, calendarDate],
    );

    // Filas del mini-calendario lateral (memoizado por mes visible)
    const miniCalendarWeeks = useMemo(
        () => buildMiniCalendarWeeks(calendarDate),
        [calendarDate],
    );

    const originScopedCalendarEvents = useMemo(
        () => calendarEvents.filter(
            (eventItem) => shouldKeepEventByOrigin(eventItem.extendedProps?.source, originFilters),
        ),
        [calendarEvents, originFilters],
    );

    const visibleCrmFilterOptions = useMemo(
        () => buildVisibleCrmFilterOptions(originScopedCalendarEvents),
        [originScopedCalendarEvents],
    );

    const adminFilterOptions = useMemo(
        () => buildAdminFilterOptions(originScopedCalendarEvents),
        [originScopedCalendarEvents],
    );

    const selectedCreateEventLeadOption = useMemo(
        () => createEventLeadOptions.find(
            (leadOption) => String(leadOption.value) === String(createEventLeadId),
        ) || null,
        [createEventLeadId, createEventLeadOptions],
    );
    const selectedCreateEventLeadEmail = normalizeParticipantEmail(selectedCreateEventLeadOption?.email || "");
    const selectedCreateEventLeadStatus = selectedCreateEventLeadOption?.valueStatus || "";

    const selectedCreateEventProjectOption = useMemo(
        () => createEventProjectOptions.find(
            (projectOption) => String(projectOption.value) === String(createEventProjectId),
        ) || null,
        [createEventProjectId, createEventProjectOptions],
    );

    const filteredCalendarEvents = useMemo(
        () => originScopedCalendarEvents.filter(
            (eventItem) => shouldKeepEventByCategory(eventItem, crmFilters),
        ),
        [crmFilters, originScopedCalendarEvents],
    );

    const adminScopedCalendarEvents = useMemo(
        () => filteredCalendarEvents.filter(
            (eventItem) => shouldKeepEventByAdmin(eventItem, selectedAdmins),
        ),
        [filteredCalendarEvents, selectedAdmins],
    );

    const activeFilterCount = useMemo(
        () => countActiveFilters(crmFilters, originFilters, selectedAdmins, visibleCrmFilterOptions),
        [crmFilters, originFilters, selectedAdmins, visibleCrmFilterOptions],
    );
    const expectedMicrosoftEmail = useMemo(
        () => (microsoftUser?.email || email_admin || "").trim().toLowerCase(),
        [email_admin, microsoftUser?.email],
    );

    const activeMicrosoftAccount = useMemo(() => {
        if (!accounts?.length || !expectedMicrosoftEmail) {
            return null;
        }

        return accounts.find(
            (account) => account.username?.toLowerCase() === expectedMicrosoftEmail,
        ) || null;
    }, [accounts, expectedMicrosoftEmail]);

    const createEventCalendarLabel =
        activeMicrosoftAccount?.username || microsoftUser?.email || email_admin || "sin-correo";
    const createEventMode = editingEventContext ? "edit" : "create";
    const createEventWindowTitle = createEventMode === "edit"
        ? "Editar evento: Calendario"
        : "Nuevo evento: Calendario";
    const createEventSubmitLabel = createEventMode === "edit"
        ? "Guardar cambios"
        : "Guardar";
    const createEventMinimumDateValue = useMemo(
        () => formatDateInputValue(getCreateEventMinimumDate()),
        [],
    );
    const createEventScheduleRange = useMemo(
        () => buildCreateEventScheduleRange(
            clampCreateEventDateValue(createEventDateValue),
            createEventStartTimeValue,
            createEventEndTimeValue,
        ),
        [createEventDateValue, createEventEndTimeValue, createEventStartTimeValue],
    );
    const createEventHeaderLabel = formatCreateEventPreviewTitle(createEventScheduleRange.start);
    const createEventDateTimeLabel = formatCreateEventDateTimeLabel(createEventScheduleRange);
    const createEventWeekLabel = `semana ${getIsoWeekNumber(createEventScheduleRange.start)}`;
    const hasCreateEventTitle = createEventTitle.trim().length > 0;
    const requiresCreateEventLeadAssignment = createEventType === "Cita" || isCreateEventLeadEnabled;
    const shouldShowCreateEventLeadSelect = requiresCreateEventLeadAssignment;
    const shouldShowCreateEventProjectSelect = createEventType === "Cita";
    const shouldOpenAttendeeSuggestions = attendeeSearchText.trim().length >= PEOPLE_SEARCH_MIN_LENGTH;
    const createEventScheduleLabel = useMemo(
        () => `${formatHourMinuteLabel(createEventScheduleRange.start.getHours(), createEventScheduleRange.start.getMinutes())} - ${formatHourMinuteLabel(
            createEventScheduleRange.end.getHours(),
            createEventScheduleRange.end.getMinutes(),
        )}`,
        [createEventScheduleRange.end, createEventScheduleRange.start],
    );
    const scheduleRequestWindow = useMemo(
        () => buildSuggestionSearchWindow(createEventScheduleRange),
        [createEventScheduleRange],
    );
    const roomSearchValue = roomSearchText.trim();
    const matchingRoomOptions = useMemo(
        () => roomDirectoryOptions.filter((roomItem) => matchesRoomSearch(roomItem, roomSearchValue)),
        [roomDirectoryOptions, roomSearchValue],
    );

    useEffect(() => {
        if (inProgress === "startup" || !expectedMicrosoftEmail || activeMicrosoftAccount || microsoftReauthInFlightRef.current) {
            return;
        }

        let isCancelled = false;

        const forceExpectedMicrosoftAccount = async () => {
            microsoftReauthInFlightRef.current = true;

            try {
                const loginResult = await instance.loginPopup({
                    scopes: OUTLOOK_REQUIRED_SCOPES,
                    loginHint: expectedMicrosoftEmail,
                    prompt: "select_account",
                });
                const authenticatedAccount = loginResult?.account || null;

                if (!authenticatedAccount) {
                    throw new Error("No se pudo obtener cuenta Microsoft.");
                }

                if (authenticatedAccount.username?.toLowerCase() !== expectedMicrosoftEmail) {
                    throw new Error(`Debe autenticarse con ${expectedMicrosoftEmail}.`);
                }

                if (!isCancelled) {
                    instance.setActiveAccount(authenticatedAccount);
                }
            } catch (error) {
                console.error("[outlook-calendar] cuenta Microsoft no coincide con usuario CRM", error);

                if (!isCancelled) {
                    await Swal.fire(
                        "Reautenticación requerida",
                        `Debe iniciar sesión con ${expectedMicrosoftEmail} para operar eventos de Outlook.`,
                        "warning",
                    );
                }
            } finally {
                microsoftReauthInFlightRef.current = false;
            }
        };

        forceExpectedMicrosoftAccount();

        return () => {
            isCancelled = true;
        };
    }, [activeMicrosoftAccount, expectedMicrosoftEmail, inProgress, instance]);
    const hasMoreRoomSuggestions = matchingRoomOptions.length > ROOM_SUGGESTION_LIMIT;
    const visibleRoomOptions = useMemo(
        () => (showAllRoomSuggestions ? matchingRoomOptions : matchingRoomOptions.slice(0, ROOM_SUGGESTION_LIMIT)),
        [matchingRoomOptions, showAllRoomSuggestions],
    );
    const roomSuggestionEmails = useMemo(
        () => visibleRoomOptions
            .map((roomItem) => roomItem.email?.trim().toLowerCase())
            .filter(Boolean),
        [visibleRoomOptions],
    );
    const roomSuggestionOptions = useMemo(
        () => visibleRoomOptions.map((roomItem) => {
            const roomEmail = roomItem.email?.trim().toLowerCase() || "";
            const availabilityStatus = roomAvailabilityByEmail[roomEmail] || "unknown";

            return {
                ...roomItem,
                availabilityStatus,
            };
        }),
        [roomAvailabilityByEmail, visibleRoomOptions],
    );
    const createEventTimeOptions = useMemo(
        () => {
            const startMinutes = CREATE_EVENT_AVAILABLE_START_HOUR * 60;
            const endMinutes = (CREATE_EVENT_AVAILABLE_END_HOUR * 60) - SCHEDULE_INTERVAL_MINUTES;
            const optionsLength = ((endMinutes - startMinutes) / SCHEDULE_INTERVAL_MINUTES) + 1;

            return Array.from({ length: optionsLength }, (_, index) => {
                const totalMinutes = startMinutes + (index * SCHEDULE_INTERVAL_MINUTES);
                const hourValue = Math.floor(totalMinutes / 60);
                const minuteValue = totalMinutes % 60;
                const value = formatTimeValue(hourValue, minuteValue);

                return {
                    value,
                    label: formatHourMinuteLabel(hourValue, minuteValue),
                };
            });
        },
        [],
    );
    const createEventAllTimeOptions = useMemo(
        () => {
            const startMinutes = CREATE_EVENT_AVAILABLE_START_HOUR * 60;
            const endMinutes = CREATE_EVENT_AVAILABLE_END_HOUR * 60;
            const optionsLength = ((endMinutes - startMinutes) / SCHEDULE_INTERVAL_MINUTES) + 1;

            return Array.from({ length: optionsLength }, (_, index) => {
                const totalMinutes = startMinutes + (index * SCHEDULE_INTERVAL_MINUTES);
                const hourValue = Math.floor(totalMinutes / 60);
                const minuteValue = totalMinutes % 60;
                const value = formatTimeValue(hourValue, minuteValue);

                return {
                    value,
                    label: formatHourMinuteLabel(hourValue, minuteValue),
                };
            });
        },
        [],
    );
    const createEventEndTimeOptions = useMemo(
        () => {
            const startDate = buildDateFromInputParts(createEventDateValue, createEventStartTimeValue);

            return createEventAllTimeOptions.filter((option) => (
                buildDateFromInputParts(createEventDateValue, option.value) > startDate
            ));
        },
        [createEventAllTimeOptions, createEventDateValue, createEventStartTimeValue],
    );
    const scheduleParticipantEmails = useMemo(() => {
        const participantEmailSet = new Set();
        const ownerEmail = activeMicrosoftAccount?.username || microsoftUser?.email || email_admin || "";

        if (ownerEmail) {
            participantEmailSet.add(ownerEmail.toLowerCase());
        }

        selectedAttendees.forEach((attendeeItem) => {
            const attendeeEmail = attendeeItem?.email?.trim().toLowerCase();

            if (attendeeEmail) {
                participantEmailSet.add(attendeeEmail);
            }
        });

        const roomEmail = selectedRoomOption?.email?.trim().toLowerCase();

        if (roomEmail) {
            participantEmailSet.add(roomEmail);
        }

        return Array.from(participantEmailSet);
    }, [activeMicrosoftAccount?.username, email_admin, microsoftUser?.email, selectedAttendees, selectedRoomOption]);
    const scheduleAvailabilityByEmail = useMemo(
        () => Object.fromEntries(
            scheduleAvailability
                .filter((scheduleInfo) => scheduleInfo?.requestedEmail || scheduleInfo?.scheduleId)
                .map((scheduleInfo) => [
                    (scheduleInfo.requestedEmail || scheduleInfo.scheduleId).toLowerCase(),
                    scheduleInfo,
                ]),
        ),
        [scheduleAvailability],
    );
    const attendeeAvailabilityStatuses = useMemo(
        () => Object.fromEntries(
            scheduleParticipantEmails.map((participantEmail) => [
                participantEmail,
                getParticipantAvailabilityStatus(scheduleAvailabilityByEmail[participantEmail], createEventScheduleRange),
            ]),
        ),
        [createEventScheduleRange, scheduleAvailabilityByEmail, scheduleParticipantEmails],
    );
    const currentOwnerEmail = (activeMicrosoftAccount?.username || microsoftUser?.email || email_admin || "").toLowerCase();
    const selectedEventEditPermission = useMemo(
        () => canAuthenticatedUserMoveCalendarEvent({
            crmEvent: selectedEvent?.extendedProps?.crm || null,
            outlookEvent: selectedEvent?.extendedProps?.outlook || null,
            currentAdminId: idnetsuite_admin,
            currentUserEmail: currentOwnerEmail,
        }),
        [currentOwnerEmail, idnetsuite_admin, selectedEvent],
    );
    const canEditSelectedEvent = Boolean(selectedEvent && selectedEventEditPermission.canMove);
    const canShowEditStatusActions = Boolean(
        createEventMode === "edit"
        && editingEventContext?.crmEventId
        && editingEventContext?.crmStatus === "Pendiente",
    );
    const canShowReactivateAction = Boolean(
        createEventMode === "edit"
        && editingEventContext?.crmEventId
        && ["Completado", "Cancelado"].includes(editingEventContext?.crmStatus || ""),
    );
    const ownerAvailabilityStatus = attendeeAvailabilityStatuses[currentOwnerEmail] || "unknown";
    const selectedRoomEmail = selectedRoomOption?.email?.trim().toLowerCase() || "";
    const selectedRoomAvailabilityStatus = selectedRoomEmail
        ? attendeeAvailabilityStatuses[selectedRoomEmail] || "unknown"
        : "unknown";
    const isRoomAvailable = !selectedRoomEmail || (SCHEDULE_STATUS_META[selectedRoomAvailabilityStatus]?.isAvailable ?? true);
    const previewBusyBlocks = useMemo(
        () => buildPreviewBusyBlocks(
            scheduleAvailability,
            createEventScheduleRange,
            selectedRoomEmail ? [currentOwnerEmail, selectedRoomEmail] : currentOwnerEmail,
        ),
        [createEventScheduleRange, currentOwnerEmail, scheduleAvailability, selectedRoomEmail],
    );
    const createEventPreviewPosition = useMemo(() => {
        const previewDayStart = startOfDay(createEventScheduleRange.start);
        previewDayStart.setHours(CREATE_EVENT_PREVIEW_START_HOUR, 0, 0, 0);

        const previewDayEnd = startOfDay(createEventScheduleRange.start);
        previewDayEnd.setHours(CREATE_EVENT_PREVIEW_END_HOUR, 0, 0, 0);

        const totalMinutes = (previewDayEnd.getTime() - previewDayStart.getTime()) / 60000;
        const startMinutes = (createEventScheduleRange.start.getTime() - previewDayStart.getTime()) / 60000;
        const durationMinutes = (createEventScheduleRange.end.getTime() - createEventScheduleRange.start.getTime()) / 60000;

        return {
            topPercent: (startMinutes / totalMinutes) * 100,
            heightPercent: (durationMinutes / totalMinutes) * 100,
        };
    }, [createEventScheduleRange.end, createEventScheduleRange.start]);
    const isOwnerAvailable = SCHEDULE_STATUS_META[ownerAvailabilityStatus]?.isAvailable ?? true;
    const isPrimaryScheduleAvailable = isOwnerAvailable && isRoomAvailable;
    const areAllParticipantsAvailable = useMemo(
        () => scheduleParticipantEmails.every((participantEmail) => SCHEDULE_STATUS_META[attendeeAvailabilityStatuses[participantEmail]]?.isAvailable),
        [attendeeAvailabilityStatuses, scheduleParticipantEmails],
    );
    const previewParticipants = useMemo(
        () => scheduleParticipantEmails.map((participantEmail) => {
            const selectedAttendee = selectedAttendees.find(
                (attendeeItem) => attendeeItem?.email?.trim().toLowerCase() === participantEmail,
            );

            if (participantEmail === currentOwnerEmail) {
                return {
                    id: participantEmail,
                    displayName: createEventCalendarLabel,
                    email: participantEmail,
                    status: attendeeAvailabilityStatuses[participantEmail] || "unknown",
                    isOwner: true,
                    type: "owner",
                };
            }

            if (participantEmail === selectedRoomEmail) {
                return {
                    id: selectedRoomOption?.id || participantEmail,
                    displayName: selectedRoomOption?.displayName || participantEmail,
                    email: participantEmail,
                    status: attendeeAvailabilityStatuses[participantEmail] || "unknown",
                    isOwner: false,
                    type: "room",
                };
            }

            return {
                id: selectedAttendee?.id || participantEmail,
                displayName: selectedAttendee?.displayName || participantEmail,
                email: participantEmail,
                status: attendeeAvailabilityStatuses[participantEmail] || "unknown",
                isOwner: false,
                type: "attendee",
            };
        }),
        [attendeeAvailabilityStatuses, createEventCalendarLabel, currentOwnerEmail, scheduleParticipantEmails, selectedAttendees, selectedRoomEmail, selectedRoomOption],
    );
    const loadAttendeeDirectory = async (searchValue = "") => {
        const normalizedSearch = searchValue.trim();

        if (normalizedSearch.length < PEOPLE_SEARCH_MIN_LENGTH) {
            setIsLoadingAttendeeDirectory(false);
            setAttendeeDirectoryError("");
            setAttendeeDirectoryOptions([...selectedAttendees]);
            return;
        }

        if (!activeMicrosoftAccount) {
            setAttendeeDirectoryOptions([]);
            setAttendeeDirectoryError("No hay cuenta Microsoft activa.");
            return;
        }

        setIsLoadingAttendeeDirectory(true);
        setAttendeeDirectoryError("");

        try {
            let tokenResponse;

            try {
                tokenResponse = await instance.acquireTokenSilent({
                    scopes: [OUTLOOK_PEOPLE_SCOPE],
                    account: activeMicrosoftAccount,
                });
            } catch (error) {
                if (!(error instanceof InteractionRequiredAuthError)) {
                    throw error;
                }

                tokenResponse = await instance.acquireTokenPopup({
                    scopes: [OUTLOOK_PEOPLE_SCOPE],
                    account: activeMicrosoftAccount,
                });
            }

            const searchParams = new URLSearchParams();
            searchParams.set("$select", "id,displayName,mail,userPrincipalName");
            searchParams.set("$top", String(PEOPLE_PAGE_SIZE));
            searchParams.set("$orderby", "displayName");
            searchParams.set("$count", "true");

            const escapedSearch = escapeODataValue(normalizedSearch);
            searchParams.set(
                "$search",
                `"displayName:${escapedSearch}" OR "mail:${escapedSearch}" OR "userPrincipalName:${escapedSearch}"`,
            );

            const response = await fetch(
                "https://graph.microsoft.com/v1.0/users?" + searchParams.toString(),
                {
                    headers: {
                        Authorization: "Bearer " + tokenResponse.accessToken,
                        "Content-Type": "application/json",
                        ConsistencyLevel: "eventual",
                    },
                },
            );

            if (!response.ok) {
                throw new Error("Graph /users respondió " + response.status);
            }

            const directoryData = await response.json();
            const nextOptions = Array.isArray(directoryData?.value)
                ? directoryData.value.map(normalizeDirectoryUser)
                : [];

            const mergedOptionsMap = new Map();

            [...selectedAttendees, ...nextOptions].forEach((option) => {
                mergedOptionsMap.set(option.id, option);
            });

            setAttendeeDirectoryOptions(Array.from(mergedOptionsMap.values()));
        } catch (error) {
            setAttendeeDirectoryOptions([...selectedAttendees]);
            setAttendeeDirectoryError("No se pudieron cargar usuarios de Outlook.");
        } finally {
            setIsLoadingAttendeeDirectory(false);
        }
    };

    const loadRoomDirectory = async () => {
        if (!activeMicrosoftAccount) {
            setRoomDirectoryOptions([]);
            setRoomDirectoryError("No hay cuenta Microsoft activa.");
            return;
        }

        setIsLoadingRoomDirectory(true);
        setRoomDirectoryError("");

        try {
            let tokenResponse;

            try {
                tokenResponse = await instance.acquireTokenSilent({
                    scopes: [OUTLOOK_PLACE_SCOPE],
                    account: activeMicrosoftAccount,
                });
            } catch (error) {
                if (!(error instanceof InteractionRequiredAuthError)) {
                    throw error;
                }

                tokenResponse = await instance.acquireTokenPopup({
                    scopes: [OUTLOOK_PLACE_SCOPE],
                    account: activeMicrosoftAccount,
                });
            }

            const searchParams = new URLSearchParams();
            searchParams.set("$select", "id,displayName,emailAddress,capacity,building,floorLabel,floorNumber");
            searchParams.set("$top", "100");

            const response = await fetch(
                "https://graph.microsoft.com/v1.0/places/microsoft.graph.room?" + searchParams.toString(),
                {
                    headers: {
                        Authorization: "Bearer " + tokenResponse.accessToken,
                        "Content-Type": "application/json",
                    },
                },
            );

            if (!response.ok) {
                throw new Error("Graph /places respondió " + response.status);
            }

            const roomData = await response.json();
            const nextOptions = Array.isArray(roomData?.value)
                ? roomData.value
                    .map(normalizeRoomPlace)
                    .filter((roomItem) => roomItem.email)
                    .sort((leftValue, rightValue) => leftValue.displayName.localeCompare(rightValue.displayName, "es"))
                : [];

            setRoomDirectoryOptions(nextOptions);
            setHasLoadedRoomDirectory(true);
        } catch (error) {
            console.error("[outlook-calendar] no se pudieron cargar salas Outlook", error);
            setRoomDirectoryOptions([]);
            setRoomDirectoryError("No se pudieron cargar salas de Outlook.");
        } finally {
            setIsLoadingRoomDirectory(false);
        }
    };

    const openRoomSuggestions = async () => {
        setIsRoomSuggestionsOpen(true);

        if (showAllRoomSuggestions) {
            setShowAllRoomSuggestions(false);
        }

        if (hasLoadedRoomDirectory || isLoadingRoomDirectory) {
            return;
        }

        await loadRoomDirectory();
    };

    const closeRoomSuggestions = () => {
        setIsRoomSuggestionsOpen(false);
        setShowAllRoomSuggestions(false);
    };

    const handleCreateEventLocationChange = (nextLocationValue) => {
        setRoomSearchText(nextLocationValue);
        setCreateEventLocation(nextLocationValue);
        setIsRoomSuggestionsOpen(true);

        if (showAllRoomSuggestions) {
            setShowAllRoomSuggestions(false);
        }

        if (
            selectedRoomOption
            && nextLocationValue.trim().toLowerCase() !== selectedRoomOption.displayName.trim().toLowerCase()
        ) {
            setSelectedRoomOption(null);
        }
    };

    const handleSelectRoomOption = (roomItem) => {
        setSelectedRoomOption(roomItem);
        setCreateEventLocation(roomItem.displayName);
        setRoomSearchText("");
        setIsRoomSuggestionsOpen(false);
        setShowAllRoomSuggestions(false);
    };

    const clearSelectedRoomOption = () => {
        setSelectedRoomOption(null);
        setCreateEventLocation("");
        setRoomSearchText("");
        setRoomAvailabilityByEmail({});
        setIsRoomSuggestionsOpen(false);
    };

    useEffect(() => {
        if (!isCreateEventModalOpen) {
            return undefined;
        }

        const normalizedSearch = attendeeSearchText.trim();

        if (attendeeSearchTimeoutRef.current) {
            clearTimeout(attendeeSearchTimeoutRef.current);
        }

        if (normalizedSearch.length < PEOPLE_SEARCH_MIN_LENGTH) {
            setIsLoadingAttendeeDirectory(false);
            setAttendeeDirectoryError("");
            setAttendeeDirectoryOptions([...selectedAttendees]);
            return undefined;
        }

        attendeeSearchTimeoutRef.current = setTimeout(() => {
            loadAttendeeDirectory(normalizedSearch);
        }, 500);

        return () => {
            if (attendeeSearchTimeoutRef.current) {
                clearTimeout(attendeeSearchTimeoutRef.current);
            }
        };
    }, [attendeeSearchText, isCreateEventModalOpen, activeMicrosoftAccount, selectedAttendees]);

    useEffect(() => {
        const loadRoomAvailability = async () => {
            if (!isCreateEventModalOpen || !isRoomSuggestionsOpen) {
                setRoomAvailabilityByEmail({});
                setIsLoadingRoomAvailability(false);
                return;
            }

            if (!activeMicrosoftAccount || !roomSuggestionEmails.length) {
                setRoomAvailabilityByEmail({});
                setIsLoadingRoomAvailability(false);
                return;
            }

            setIsLoadingRoomAvailability(true);

            try {
                let tokenResponse;

                try {
                    tokenResponse = await instance.acquireTokenSilent({
                        scopes: [OUTLOOK_SCHEDULE_SCOPE],
                        account: activeMicrosoftAccount,
                    });
                } catch (error) {
                    if (!(error instanceof InteractionRequiredAuthError)) {
                        throw error;
                    }

                    tokenResponse = await instance.acquireTokenPopup({
                        scopes: [OUTLOOK_SCHEDULE_SCOPE],
                        account: activeMicrosoftAccount,
                    });
                }

                const response = await fetch("https://graph.microsoft.com/v1.0/me/calendar/getSchedule", {
                    method: "POST",
                    headers: {
                        Authorization: `Bearer ${tokenResponse.accessToken}`,
                        "Content-Type": "application/json",
                        Prefer: `outlook.timezone="${OUTLOOK_TIMEZONE}"`,
                    },
                    body: JSON.stringify({
                        schedules: roomSuggestionEmails,
                        startTime: {
                            dateTime: toGraphDateTime(createEventScheduleRange.start),
                            timeZone: OUTLOOK_TIMEZONE,
                        },
                        endTime: {
                            dateTime: toGraphDateTime(createEventScheduleRange.end),
                            timeZone: OUTLOOK_TIMEZONE,
                        },
                        availabilityViewInterval: SCHEDULE_INTERVAL_MINUTES,
                    }),
                });

                if (!response.ok) {
                    throw new Error(`Graph getSchedule rooms HTTP ${response.status}`);
                }

                const scheduleResponse = await response.json();
                const nextAvailability = Array.isArray(scheduleResponse?.value)
                    ? scheduleResponse.value.reduce((accumulator, scheduleInfo, scheduleIndex) => {
                        const requestedEmail = roomSuggestionEmails[scheduleIndex] || "";

                        if (!requestedEmail) {
                            return accumulator;
                        }

                        return {
                            ...accumulator,
                            [requestedEmail]: getParticipantAvailabilityStatus(scheduleInfo, createEventScheduleRange),
                        };
                    }, {})
                    : {};

                setRoomAvailabilityByEmail(nextAvailability);
            } catch (error) {
                console.error("[outlook-calendar] no se pudo cargar disponibilidad de salas", error);
                setRoomAvailabilityByEmail({});
            } finally {
                setIsLoadingRoomAvailability(false);
            }
        };

        loadRoomAvailability();
    }, [
        activeMicrosoftAccount,
        createEventScheduleRange,
        instance,
        isCreateEventModalOpen,
        isRoomSuggestionsOpen,
        roomSuggestionEmails,
    ]);

    useEffect(() => {
        const loadScheduleAvailability = async () => {
            if (!isCreateEventModalOpen) {
                return;
            }

            if (!activeMicrosoftAccount || !scheduleParticipantEmails.length) {
                setScheduleAvailability([]);
                setScheduleAvailabilityError("");
                setIsLoadingScheduleAvailability(false);
                return;
            }

            setIsLoadingScheduleAvailability(true);
            setScheduleAvailabilityError("");

            try {
                let tokenResponse;

                try {
                    tokenResponse = await instance.acquireTokenSilent({
                        scopes: [OUTLOOK_SCHEDULE_SCOPE],
                        account: activeMicrosoftAccount,
                    });
                } catch (error) {
                    if (!(error instanceof InteractionRequiredAuthError)) {
                        throw error;
                    }

                    tokenResponse = await instance.acquireTokenPopup({
                        scopes: [OUTLOOK_SCHEDULE_SCOPE],
                        account: activeMicrosoftAccount,
                    });
                }

                const response = await fetch("https://graph.microsoft.com/v1.0/me/calendar/getSchedule", {
                    method: "POST",
                    headers: {
                        Authorization: `Bearer ${tokenResponse.accessToken}`,
                        "Content-Type": "application/json",
                        Prefer: `outlook.timezone="${OUTLOOK_TIMEZONE}"`,
                    },
                    body: JSON.stringify({
                        schedules: scheduleParticipantEmails,
                        startTime: {
                            dateTime: toGraphDateTime(scheduleRequestWindow.start),
                            timeZone: OUTLOOK_TIMEZONE,
                        },
                        endTime: {
                            dateTime: toGraphDateTime(scheduleRequestWindow.end),
                            timeZone: OUTLOOK_TIMEZONE,
                        },
                        availabilityViewInterval: SCHEDULE_INTERVAL_MINUTES,
                    }),
                });

                if (!response.ok) {
                    throw new Error(`Graph getSchedule HTTP ${response.status}`);
                }

                const scheduleResponse = await response.json();
                const normalizedSchedules = Array.isArray(scheduleResponse?.value)
                    ? scheduleResponse.value.map((scheduleInfo, scheduleIndex) => ({
                        ...scheduleInfo,
                        requestedEmail: scheduleParticipantEmails[scheduleIndex] || "",
                    }))
                    : [];

                setScheduleAvailability(normalizedSchedules);
            } catch (error) {
                console.error("[outlook-calendar] no se pudo cargar disponibilidad de asistentes", error);
                setScheduleAvailability([]);
                setScheduleAvailabilityError("No se pudo consultar disponibilidad.");
            } finally {
                setIsLoadingScheduleAvailability(false);
            }
        };

        loadScheduleAvailability();
    }, [
        activeMicrosoftAccount,
        instance,
        isCreateEventModalOpen,
        scheduleParticipantEmails,
        scheduleRequestWindow.end,
        scheduleRequestWindow.start,
    ]);

    useEffect(() => {
        const loadMeetingSuggestions = async () => {
            if (!isCreateEventModalOpen) {
                return;
            }

            if (!activeMicrosoftAccount) {
                setMeetingSuggestions([]);
                setMeetingSuggestionsError("");
                setIsLoadingMeetingSuggestions(false);
                return;
            }

            const localFallback = () => {
                const localSuggestions = buildLocalMeetingSuggestions(
                    scheduleAvailability,
                    createEventScheduleRange,
                    scheduleParticipantEmails,
                );
                setMeetingSuggestions(localSuggestions);
            };

            if (!selectedAttendees.length) {
                localFallback();
                setMeetingSuggestionsError("");
                setIsLoadingMeetingSuggestions(false);
                return;
            }

            setIsLoadingMeetingSuggestions(true);
            setMeetingSuggestionsError("");

            try {
                let tokenResponse;

                try {
                    tokenResponse = await instance.acquireTokenSilent({
                        scopes: [OUTLOOK_SCHEDULE_SCOPE],
                        account: activeMicrosoftAccount,
                    });
                } catch (error) {
                    if (!(error instanceof InteractionRequiredAuthError)) {
                        throw error;
                    }

                    tokenResponse = await instance.acquireTokenPopup({
                        scopes: [OUTLOOK_SCHEDULE_SCOPE],
                        account: activeMicrosoftAccount,
                    });
                }

                const response = await fetch("https://graph.microsoft.com/v1.0/me/findMeetingTimes", {
                    method: "POST",
                    headers: {
                        Authorization: `Bearer ${tokenResponse.accessToken}`,
                        "Content-Type": "application/json",
                        Prefer: `outlook.timezone="${OUTLOOK_TIMEZONE}"`,
                    },
                    body: JSON.stringify({
                        attendees: selectedAttendees.map((attendeeItem) => ({
                            type: "required",
                            emailAddress: {
                                name: attendeeItem.displayName,
                                address: attendeeItem.email,
                            },
                        })),
                        timeConstraint: {
                            activityDomain: "work",
                            timeSlots: [
                                {
                                    start: {
                                        dateTime: toGraphDateTime(scheduleRequestWindow.start),
                                        timeZone: OUTLOOK_TIMEZONE,
                                    },
                                    end: {
                                        dateTime: toGraphDateTime(scheduleRequestWindow.end),
                                        timeZone: OUTLOOK_TIMEZONE,
                                    },
                                },
                            ],
                        },
                        meetingDuration: buildMeetingDurationIso(createEventScheduleRange),
                        returnSuggestionReasons: true,
                        minimumAttendeePercentage: 100,
                    }),
                });

                if (!response.ok) {
                    throw new Error(`Graph findMeetingTimes HTTP ${response.status}`);
                }

                const suggestionsResponse = await response.json();
                const normalizedSuggestions = Array.isArray(suggestionsResponse?.meetingTimeSuggestions)
                    ? suggestionsResponse.meetingTimeSuggestions
                        .slice(0, CREATE_EVENT_SUGGESTION_LIMIT)
                        .map((suggestionItem) => {
                            const startDate = new Date(suggestionItem?.meetingTimeSlot?.start?.dateTime || "");
                            const endDate = new Date(suggestionItem?.meetingTimeSlot?.end?.dateTime || "");

                            if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
                                return null;
                            }

                            const participantStatuses = Object.fromEntries(
                                (suggestionItem?.attendeeAvailability || []).map((availabilityItem) => [
                                    availabilityItem?.attendee?.emailAddress?.address?.toLowerCase() || "",
                                    normalizeScheduleStatus(availabilityItem?.availability?.toLowerCase()),
                                ]).filter(([emailValue]) => Boolean(emailValue)),
                            );

                            return buildSuggestionItemFromRange(
                                { start: startDate, end: endDate },
                                participantStatuses,
                                suggestionItem?.suggestionReason || "",
                            );
                        })
                        .filter(Boolean)
                    : [];

                if (normalizedSuggestions.length) {
                    setMeetingSuggestions(normalizedSuggestions);
                } else {
                    localFallback();
                }
            } catch (error) {
                console.error("[outlook-calendar] no se pudieron cargar sugerencias de horario", error);
                localFallback();
                setMeetingSuggestionsError("No se pudieron cargar sugerencias de horario.");
            } finally {
                setIsLoadingMeetingSuggestions(false);
            }
        };

        loadMeetingSuggestions();
    }, [
        activeMicrosoftAccount,
        createEventScheduleRange,
        instance,
        isCreateEventModalOpen,
        scheduleAvailability,
        scheduleParticipantEmails,
        scheduleRequestWindow.end,
        scheduleRequestWindow.start,
        selectedAttendees,
    ]);

    /** Cierra popover y resetea estado de interacción del evento. */
    const closeEventCard = () => {
        setSelectedEvent(null);
        setSelectedPosition(null);
        setShowResponseActions(false);
        setResponseComment("");
        setNotifyOrganizer(true);
    };

    const closeDayEventsPopover = () => {
        setSelectedDayEvents([]);
        setSelectedDayEventsTitle("");
        setSelectedDayEventsPosition(null);
    };

    const openEventCardAtPosition = (eventItem, positionValue) => {
        if (!eventItem || !positionValue) {
            return;
        }

        setSelectedEvent(eventItem);
        setSelectedPosition(positionValue);
        setShowResponseActions(false);
        setResponseComment("");
        setNotifyOrganizer(true);
    };

    const openEventCardFromElement = (eventItem, element) => {
        const rect = element?.getBoundingClientRect?.();

        if (!rect) {
            return;
        }

        openEventCardAtPosition(eventItem, {
            left: Math.min(rect.right + 18, window.innerWidth - 420),
            top: Math.max(rect.top + (rect.height / 2) - 48, 80),
        });
    };

    const handleDayEventsMoreClick = (moreLinkArg) => {
        const currentTarget = moreLinkArg?.jsEvent?.currentTarget || moreLinkArg?.jsEvent?.target || null;
        const rect = currentTarget?.getBoundingClientRect?.();
        const currentDayCell = currentTarget?.closest?.("[data-date]") || null;
        const dayCellDateValue = currentDayCell?.getAttribute?.("data-date") || "";
        const targetDate = parseLocalDateOnlyValue(dayCellDateValue)
            || (moreLinkArg?.date instanceof Date ? startOfDay(new Date(moreLinkArg.date.getTime())) : null);

        moreLinkArg?.jsEvent?.preventDefault?.();
        moreLinkArg?.jsEvent?.stopPropagation?.();

        if (!targetDate || !rect) {
            closeDayEventsPopover();
            closeEventCard();
            return true;
        }

        const segmentEventIds = new Set(
            (Array.isArray(moreLinkArg?.allSegs) ? moreLinkArg.allSegs : [])
                .map((segment) => segment?.eventRange?.def?.publicId || segment?.eventRange?.instance?.instanceId || "")
                .filter(Boolean),
        );

        const dayEvents = (
            segmentEventIds.size
                ? adminScopedCalendarEvents.filter((eventItem) => segmentEventIds.has(eventItem.id))
                : adminScopedCalendarEvents.filter((eventItem) => eventItem?.start && sameDay(new Date(eventItem.start), targetDate))
        ).sort((firstEvent, secondEvent) => {
            const firstStart = firstEvent?.start ? new Date(firstEvent.start).getTime() : 0;
            const secondStart = secondEvent?.start ? new Date(secondEvent.start).getTime() : 0;

            return firstStart - secondStart;
        });

        closeDayEventsPopover();
        closeEventCard();
        setSelectedDayEvents(dayEvents);
        setSelectedDayEventsTitle(formatCalendarDayPopoverTitle(targetDate));
        setSelectedDayEventsPosition({
            left: Math.min(rect.left + 8, window.innerWidth - 460),
            top: rect.bottom + 8,
        });

        return true;
    };

    /** Abre modal expandido. */
    const openExpandedModal = () => {
        setIsExpandedModalOpen(true);
    };

    /** Cierra modal y limpia evento expandido. */
    const closeExpandedModal = () => {
        setIsExpandedModalOpen(false);
        setExpandedEvent(null);
    };

    const handleCreateEventTypeChange = (nextEventType) => {
        setCreateEventType(nextEventType);

        if (nextEventType === "Cita") {
            setIsCreateEventLeadEnabled(true);
        }

        if (nextEventType !== "Cita") {
            setCreateEventProjectId("");
        }
    };

    const handleCreateEventLeadToggle = (isChecked) => {
        if (createEventType === "Cita" && !isChecked) {
            return;
        }

        setIsCreateEventLeadEnabled(isChecked);

        if (!isChecked) {
            setCreateEventLeadId("");
            setIsLeadInvitationEnabled(false);
        }
    };

    useEffect(() => {
        if (!isCreateEventModalOpen || !isCreateEventLeadEnabled || createEventLeadOptions.length) {
            return undefined;
        }

        let isMounted = true;

        const fetchCreateEventLeadOptions = async () => {
            setIsLoadingCreateEventLeadOptions(true);
            setCreateEventLeadOptionsError("");

            try {
                const leads = await dispatch(getLeadsComplete("2024-01-01", "2024-01-01", 0));
                const formattedLeads = Array.isArray(leads)
                    ? Array.from(
                        leads
                            .map((lead) => ({
                                value: lead.idinterno_lead,
                                label: lead.nombre_lead,
                                email: lead.email_lead || "",
                                valueStatus: lead.segimineto_lead || "",
                            }))
                            .filter((leadOption) => leadOption.value && leadOption.label)
                            .reduce((leadMap, leadOption) => {
                                leadMap.set(String(leadOption.value), leadOption);
                                return leadMap;
                            }, new Map())
                            .values(),
                    )
                    : [];

                if (!isMounted) {
                    return;
                }

                setCreateEventLeadOptions(formattedLeads);
            } catch (error) {
                if (!isMounted) {
                    return;
                }

                setCreateEventLeadOptions([]);
                setCreateEventLeadOptionsError("No se pudieron cargar leads.");
            } finally {
                if (isMounted) {
                    setIsLoadingCreateEventLeadOptions(false);
                }
            }
        };

        fetchCreateEventLeadOptions();

        return () => {
            isMounted = false;
        };
    }, [
        createEventLeadOptions.length,
        dispatch,
        isCreateEventLeadEnabled,
        isCreateEventModalOpen,
    ]);

    useEffect(() => {
        if (!isCreateEventModalOpen) {
            return;
        }

        if (!isLeadInvitationEnabled || !selectedCreateEventLeadEmail) {
            setSelectedAttendees((currentValue) => currentValue.filter((attendeeItem) => attendeeItem?.source !== "lead"));
            return;
        }

        setSelectedAttendees((currentValue) => {
            const nextAttendees = currentValue.filter((attendeeItem) => attendeeItem?.source !== "lead");
            const alreadyExists = nextAttendees.some(
                (attendeeItem) => normalizeParticipantEmail(attendeeItem?.email) === selectedCreateEventLeadEmail,
            );

            if (alreadyExists) {
                return nextAttendees;
            }

            return [
                ...nextAttendees,
                {
                    id: "lead-" + String(selectedCreateEventLeadOption?.value || selectedCreateEventLeadEmail),
                    displayName: selectedCreateEventLeadEmail,
                    email: selectedCreateEventLeadEmail,
                    source: "lead",
                },
            ];
        });
    }, [
        isCreateEventModalOpen,
        isLeadInvitationEnabled,
        selectedCreateEventLeadEmail,
        selectedCreateEventLeadOption,
    ]);

    useEffect(() => {
        if (!isCreateEventModalOpen || !shouldShowCreateEventProjectSelect || createEventProjectOptions.length) {
            return undefined;
        }

        let isMounted = true;

        const fetchCreateEventProjectOptions = async () => {
            setIsLoadingCreateEventProjectOptions(true);
            setCreateEventProjectOptionsError("");

            try {
                const resultProjects = await dispatch(getDataSelectProyect(1));
                const formattedProjects = Array.isArray(resultProjects)
                    ? resultProjects
                        .map((projectItem) => ({
                            value: projectItem.id_ProNetsuite,
                            label: projectItem.Nombre_proyecto,
                        }))
                        .filter((projectOption) => projectOption.value && projectOption.label)
                    : [];

                if (!isMounted) {
                    return;
                }

                setCreateEventProjectOptions(formattedProjects);
            } catch (error) {
                if (!isMounted) {
                    return;
                }

                setCreateEventProjectOptions([]);
                setCreateEventProjectOptionsError("No se pudieron cargar proyectos.");
            } finally {
                if (isMounted) {
                    setIsLoadingCreateEventProjectOptions(false);
                }
            }
        };

        fetchCreateEventProjectOptions();

        return () => {
            isMounted = false;
        };
    }, [
        createEventProjectOptions.length,
        dispatch,
        isCreateEventModalOpen,
        shouldShowCreateEventProjectSelect,
    ]);

    const resetCreateEventFormState = ({
        defaultDateValue = createEventMinimumDateValue,
        defaultStartTimeValue = createEventTimeOptions[0]?.value || "07:00",
        defaultEndTimeValue = addMinutesToTimeValue(
            createEventTimeOptions[0]?.value || "07:00",
            CREATE_EVENT_DEFAULT_DURATION_MINUTES,
        ),
    } = {}) => {
        setEditingEventContext(null);
        setIsCreateTeamsMeeting(false);
        setIsScheduleEditorOpen(false);
        setCreateEventTitle("");
        setCreateEventType("");
        setCreateEventLocation("");
        setRoomSearchText("");
        setCreateEventDescription("");
        setIsCreateEventLeadEnabled(false);
        setCreateEventLeadId("");
        setIsLeadInvitationEnabled(false);
        setCreateEventProjectId("");
        setCreateEventDateValue(defaultDateValue);
        setCreateEventStartTimeValue(defaultStartTimeValue);
        setCreateEventEndTimeValue(defaultEndTimeValue);
        setIsRoomSuggestionsOpen(false);
        setShowAllRoomSuggestions(false);
        setSelectedRoomOption(null);
        setRoomAvailabilityByEmail({});
        setRoomDirectoryError("");
        setHasTouchedCreateEventTitle(false);
        setSelectedAttendees([]);
        setAttendeeSearchText("");
        setAttendeeDirectoryOptions([]);
        setAttendeeDirectoryError("");
        setCreateEventLeadOptionsError("");
        setCreateEventProjectOptionsError("");
        setScheduleAvailability([]);
        setScheduleAvailabilityError("");
        setMeetingSuggestions([]);
        setMeetingSuggestionsError("");
        setIsUpdatingEventStatus(false);
        setCreateEventSubmitError("");
    };

    const openCreateEventModalAtDate = (startDateValue) => {
        const defaultStartDate = startDateValue instanceof Date && !Number.isNaN(startDateValue.getTime())
            ? new Date(startDateValue.getTime())
            : getDefaultCreateEventStartDate();
        const defaultDateValue = formatDateInputValue(defaultStartDate);
        const defaultStartTimeValue = formatTimeValue(
            defaultStartDate.getHours(),
            defaultStartDate.getMinutes(),
        );

        closeEventCard();
        closeDayEventsPopover();
        resetCreateEventFormState({
            defaultDateValue,
            defaultStartTimeValue,
            defaultEndTimeValue: addMinutesToTimeValue(defaultStartTimeValue, CREATE_EVENT_DEFAULT_DURATION_MINUTES),
        });
        setIsCreateEventModalOpen(true);
    };

    const openCreateEventModal = () => {
        openCreateEventModalAtDate(getDefaultCreateEventStartDate());
    };

    const handleCalendarDateClick = (dateInfo) => {
        const clickedDate = dateInfo?.date instanceof Date
            ? new Date(dateInfo.date.getTime())
            : null;

        if (!clickedDate || Number.isNaN(clickedDate.getTime())) {
            openCreateEventModal();
            return;
        }

        if (dateInfo?.allDay) {
            clickedDate.setHours(CREATE_EVENT_DEFAULT_START_HOUR, CREATE_EVENT_DEFAULT_START_MINUTE, 0, 0);
        } else {
            const roundedClickedDate = roundDateToNextScheduleSlot(clickedDate);
            clickedDate.setHours(
                roundedClickedDate.getHours(),
                roundedClickedDate.getMinutes(),
                0,
                0,
            );
        }

        openCreateEventModalAtDate(clickedDate);
    };

    const openEditEventModal = (eventItem) => {
        const crmEvent = eventItem?.extendedProps?.crm || null;
        const outlookEvent = eventItem?.extendedProps?.outlook || null;
        const startDate = eventItem?.start ? new Date(eventItem.start) : getDefaultCreateEventStartDate();
        const endDate = eventItem?.end
            ? new Date(eventItem.end)
            : new Date(startDate.getTime() + (CREATE_EVENT_DEFAULT_DURATION_MINUTES * 60000));
        const organizerEmail = normalizeParticipantEmail(outlookEvent?.organizer?.emailAddress?.address);
        const attendeeOptions = (outlookEvent?.attendees || [])
            .map(buildGraphAttendeeOption)
            .filter(Boolean);
        const resourceAttendee = attendeeOptions.find((attendeeItem) => attendeeItem.type === "resource") || null;
        const selectedAttendeeOptions = attendeeOptions.filter(
            (attendeeItem) => attendeeItem.type !== "resource"
                && attendeeItem.email !== organizerEmail,
        );
        const leadEmail = normalizeParticipantEmail(crmEvent?.email_lead);
        const shouldInviteLead = Boolean(
            leadEmail
            && selectedAttendeeOptions.some(
                (attendeeItem) => normalizeParticipantEmail(attendeeItem?.email) === leadEmail,
            ),
        );

        closeEventCard();
        closeDayEventsPopover();
        setEditingEventContext({
            id: eventItem.id,
            crmEventId: crmEvent?.id_calendar || null,
            crmLeadId: crmEvent?.idinterno_lead || crmEvent?.id_lead || 0,
            crmLeadStatus: crmEvent?.segimineto_lead || "",
            crmStatus: crmEvent?.accion_calendar || "",
            outlookEventId: outlookEvent?.id || crmEvent?.outlook_event_id || null,
            source: eventItem?.extendedProps?.source || "crm",
        });
        setCreateEventTitle(eventItem?.title || crmEvent?.nombre_calendar || "");
        setCreateEventType(normalizeCreateEventTypeValue(crmEvent?.tipo_calendar || eventItem?.extendedProps?.eventType));
        setCreateEventLocation(outlookEvent?.location?.displayName || "");
        setRoomSearchText("");
        setCreateEventDescription(crmEvent?.decrip_calendar || eventItem?.extendedProps?.description || "");
        setIsCreateEventLeadEnabled(Boolean(crmEvent?.id_lead));
        setCreateEventLeadId(crmEvent?.id_lead ? String(crmEvent.id_lead) : "");
        setIsLeadInvitationEnabled(shouldInviteLead);
        setCreateEventProjectId(crmEvent?.id_proyecto ? String(crmEvent.id_proyecto) : "");
        setCreateEventDateValue(formatDateInputValue(startDate));
        setCreateEventStartTimeValue(formatTimeValue(startDate.getHours(), startDate.getMinutes()));
        setCreateEventEndTimeValue(formatTimeValue(endDate.getHours(), endDate.getMinutes()));
        setHasTouchedCreateEventTitle(false);
        setIsCreateTeamsMeeting(Boolean(outlookEvent?.isOnlineMeeting || eventItem?.extendedProps?.teamsLink));
        setIsScheduleEditorOpen(false);
        setIsRoomSuggestionsOpen(false);
        setShowAllRoomSuggestions(false);
        setSelectedRoomOption(
            resourceAttendee
                ? {
                    id: resourceAttendee.id,
                    displayName: resourceAttendee.displayName,
                    email: resourceAttendee.email,
                }
                : null,
        );
        setRoomAvailabilityByEmail({});
        setRoomDirectoryError("");
        setSelectedAttendees(selectedAttendeeOptions.map((attendeeItem) => ({
            id: attendeeItem.id,
            displayName: attendeeItem.displayName,
            email: attendeeItem.email,
            source: attendeeItem.source || "outlook",
        })));
        setAttendeeSearchText("");
        setAttendeeDirectoryOptions(selectedAttendeeOptions);
        setAttendeeDirectoryError("");
        setCreateEventLeadOptionsError("");
        setCreateEventProjectOptionsError("");
        setScheduleAvailability([]);
        setScheduleAvailabilityError("");
        setMeetingSuggestions([]);
        setMeetingSuggestionsError("");
        setCreateEventSubmitError("");
        setIsCreateEventModalOpen(true);
    };

    const closeCreateEventModal = () => {
        setIsCreateEventModalOpen(false);
        resetCreateEventFormState();
    };

    const handleUpdateCalendarEventStatus = async (statusAction) => {
        const crmEventId = editingEventContext?.crmEventId || 0;

        if (!crmEventId) {
            return;
        }

        const statusConfig = statusAction === "complete"
            ? { newStatus: 0, actionLabel: "Completado" }
            : { newStatus: 0, actionLabel: "Cancelado" };

        setIsUpdatingEventStatus(true);
        setCreateEventSubmitError("");

        try {
            await dispatch(
                updateStatusEvent(
                    crmEventId,
                    statusAction === "complete" ? 1 : 0,
                    editingEventContext?.crmLeadId || 0,
                    editingEventContext?.crmLeadStatus || "",
                    0,
                    statusAction === "complete" ? 2 : 3,
                ),
            );

            closeCreateEventModal();
            setSelectedEvent(null);
            setSelectedPosition(null);
            setEventsReloadToken((currentValue) => currentValue + 1);
        } catch (error) {
            console.error("[outlook-calendar] no se pudo actualizar estado del evento", error);
            setCreateEventSubmitError(`No se pudo marcar el evento como ${statusConfig.actionLabel.toLowerCase()}.`);
        } finally {
            setIsUpdatingEventStatus(false);
        }
    };

    const handleCompleteCalendarEvent = () => handleUpdateCalendarEventStatus("complete");

    const handleCancelCalendarEvent = () => handleUpdateCalendarEventStatus("cancel");

    const handleReactivateCalendarEvent = async () => {
        const crmEventId = editingEventContext?.crmEventId || 0;

        if (!crmEventId) {
            return;
        }

        setIsUpdatingEventStatus(true);
        setCreateEventSubmitError("");

        try {
            await dispatch(
                updateStatusEvent(
                    crmEventId,
                    3,
                    editingEventContext?.crmLeadId || 0,
                    editingEventContext?.crmLeadStatus || "",
                    1,
                    1,
                ),
            );

            closeCreateEventModal();
            setSelectedEvent(null);
            setSelectedPosition(null);
            setEventsReloadToken((currentValue) => currentValue + 1);
        } catch (error) {
            console.error("[outlook-calendar] no se pudo reactivar el evento", error);
            setCreateEventSubmitError("No se pudo reactivar el evento.");
        } finally {
            setIsUpdatingEventStatus(false);
        }
    };

    const handleCreateEventDateChange = (nextDateValue) => {
        if (!nextDateValue) {
            return;
        }

        setCreateEventDateValue(clampCreateEventDateValue(nextDateValue));
    };

    const handleCreateEventStartTimeChange = (nextStartTimeValue) => {
        setCreateEventStartTimeValue(nextStartTimeValue);
        setCreateEventEndTimeValue(addMinutesToTimeValue(nextStartTimeValue, CREATE_EVENT_DEFAULT_DURATION_MINUTES));
    };

    const handleCreateEventEndTimeChange = (nextEndTimeValue) => {
        const nextRange = buildCreateEventScheduleRange(
            createEventDateValue,
            createEventStartTimeValue,
            nextEndTimeValue,
        );

        if (nextRange.end <= nextRange.start) {
            setCreateEventEndTimeValue(addMinutesToTimeValue(createEventStartTimeValue, CREATE_EVENT_DEFAULT_DURATION_MINUTES));
            return;
        }

        setCreateEventEndTimeValue(nextEndTimeValue);
    };

    const shiftCreateEventDate = (daysToMove) => {
        const nextDate = buildDateFromInputParts(createEventDateValue, createEventStartTimeValue);
        nextDate.setDate(nextDate.getDate() + daysToMove);
        setCreateEventDateValue(clampCreateEventDateValue(formatDateInputValue(nextDate)));
    };

    const applyMeetingSuggestion = (suggestionItem) => {
        setCreateEventDateValue(clampCreateEventDateValue(formatDateInputValue(suggestionItem.start)));
        setCreateEventStartTimeValue(
            formatTimeValue(suggestionItem.start.getHours(), suggestionItem.start.getMinutes()),
        );
        setCreateEventEndTimeValue(
            formatTimeValue(suggestionItem.end.getHours(), suggestionItem.end.getMinutes()),
        );
    };

    const handleSubmitOutlookEvent = async () => {
        if (!hasCreateEventTitle || !activeMicrosoftAccount) {
            setHasTouchedCreateEventTitle(true);
            return;
        }

        if (!createEventType) {
            setCreateEventSubmitError("Selecciona el tipo de evento.");
            return;
        }

        if (!idnetsuite_admin) {
            setCreateEventSubmitError("No se identificó el usuario autenticado del CRM.");
            return;
        }

        if (requiresCreateEventLeadAssignment && !createEventLeadId) {
            setCreateEventSubmitError("Selecciona el lead del evento.");
            return;
        }

        if (shouldShowCreateEventProjectSelect && !createEventProjectId) {
            setCreateEventSubmitError("Selecciona el proyecto a visitar.");
            return;
        }

        if (createEventDateValue < createEventMinimumDateValue) {
            setCreateEventSubmitError("No puedes crear eventos antes de ayer.");
            return;
        }

        setIsSavingCreateEvent(true);
        setCreateEventSubmitError("");

        try {
            let tokenResponse;

            try {
                tokenResponse = await instance.acquireTokenSilent({
                    scopes: [OUTLOOK_CREATE_EVENT_SCOPE],
                    account: activeMicrosoftAccount,
                });
            } catch (error) {
                if (!(error instanceof InteractionRequiredAuthError)) {
                    throw error;
                }

                tokenResponse = await instance.acquireTokenPopup({
                    scopes: [OUTLOOK_CREATE_EVENT_SCOPE],
                    account: activeMicrosoftAccount,
                });
            }

            const requiredAttendees = selectedAttendees
                .filter((attendeeItem) => attendeeItem?.email?.trim())
                .map((attendeeItem) => ({
                    emailAddress: {
                        address: attendeeItem.email.trim(),
                        name: attendeeItem.displayName || attendeeItem.email.trim(),
                    },
                    type: "required",
                }));

            const resourceAttendees = selectedRoomOption?.email?.trim()
                ? [{
                    emailAddress: {
                        address: selectedRoomOption.email.trim(),
                        name: selectedRoomOption.displayName || selectedRoomOption.email.trim(),
                    },
                    type: "resource",
                }]
                : [];
            const graphPayload = {
                subject: createEventTitle.trim(),
                body: {
                    contentType: "HTML",
                    content: createEventDescription.trim() || "Evento creado desde CRM Ventas.",
                },
                start: {
                    dateTime: toGraphDateTime(createEventScheduleRange.start),
                    timeZone: OUTLOOK_TIMEZONE,
                },
                end: {
                    dateTime: toGraphDateTime(createEventScheduleRange.end),
                    timeZone: OUTLOOK_TIMEZONE,
                },
            };

            if (createEventLocation.trim()) {
                graphPayload.location = {
                    displayName: createEventLocation.trim(),
                };
            }

            if (requiredAttendees.length || resourceAttendees.length) {
                graphPayload.attendees = [
                    ...requiredAttendees,
                    ...resourceAttendees,
                ];
            }

            if (createEventMode === "edit") {
                const outlookEventId = editingEventContext?.outlookEventId || null;
                const crmEventId = editingEventContext?.crmEventId || null;

                if (outlookEventId) {
                    const graphUpdateSucceeded = await updateOutlookEventById(
                        tokenResponse.accessToken,
                        outlookEventId,
                        graphPayload,
                    );

                    if (!graphUpdateSucceeded) {
                        throw new Error("Graph update event failed.");
                    }
                }

                if (crmEventId) {
                    const crmUpdateResponse = await dispatch(updateOutlookEventForLeadDetails({
                        id_calendar: crmEventId,
                        idnetsuite_admin,
                        nombreEvento: createEventTitle.trim(),
                        tipoEvento: createEventType,
                        descripcionEvento: createEventDescription.trim(),
                        formatdateIni: toGraphDateTime(createEventScheduleRange.start),
                        formatdateFin: toGraphDateTime(createEventScheduleRange.end),
                        horaInicio: createEventStartTimeValue,
                        horaFinal: createEventEndTimeValue,
                        leadId: requiresCreateEventLeadAssignment ? Number(createEventLeadId || 0) : 0,
                        colorEvento: getCreateEventColor(createEventType),
                        citaValue: createEventType === "Cita" ? 1 : 0,
                        id_proyecto: shouldShowCreateEventProjectSelect ? Number(createEventProjectId || 0) : 0,
                        nombre_proyecto: shouldShowCreateEventProjectSelect
                            ? (selectedCreateEventProjectOption?.label || "0")
                            : "0",
                        copiaJefe: 1,
                    }, editingEventContext?.crmLeadStatus || ""));

                    const crmUpdateSucceeded = crmUpdateResponse?.ok && crmUpdateResponse?.data?.ok !== false;

                    if (!crmUpdateSucceeded) {
                        throw new Error("CRM update event failed.");
                    }
                } else if (outlookEventId) {
                    const crmCreateResponse = await dispatch(createOutlookEventForLead({
                        idnetsuite_admin,
                        nombreEvento: createEventTitle.trim(),
                        tipoEvento: createEventType,
                        descripcionEvento: createEventDescription.trim(),
                        formatdateIni: toGraphDateTime(createEventScheduleRange.start),
                        formatdateFin: toGraphDateTime(createEventScheduleRange.end),
                        horaInicio: createEventStartTimeValue,
                        horaFinal: createEventEndTimeValue,
                        leadId: requiresCreateEventLeadAssignment ? Number(createEventLeadId || 0) : 0,
                        colorEvento: getCreateEventColor(createEventType),
                        citaValue: createEventType === "Cita" ? 1 : 0,
                        id_proyecto: shouldShowCreateEventProjectSelect ? Number(createEventProjectId || 0) : 0,
                        nombre_proyecto: shouldShowCreateEventProjectSelect
                            ? (selectedCreateEventProjectOption?.label || "0")
                            : "0",
                        copiaJefe: 1,
                        outlook_event_id: outlookEventId,
                    }, selectedCreateEventLeadStatus));

                    const crmCreateSucceeded = crmCreateResponse?.ok && crmCreateResponse?.data?.ok !== false;

                    if (!crmCreateSucceeded) {
                        throw new Error("CRM create event failed after Outlook update.");
                    }
                }
            } else {
                graphPayload.allowNewTimeProposals = true;
                graphPayload.transactionId = buildEventTransactionId();

                if (isCreateTeamsMeeting) {
                    graphPayload.isOnlineMeeting = true;
                    graphPayload.onlineMeetingProvider = "teamsForBusiness";
                }

                const response = await fetch("https://graph.microsoft.com/v1.0/me/events", {
                    method: "POST",
                    headers: {
                        Authorization: `Bearer ${tokenResponse.accessToken}`,
                        "Content-Type": "application/json",
                        Prefer: `outlook.timezone="${OUTLOOK_TIMEZONE}"`,
                    },
                    body: JSON.stringify(graphPayload),
                });

                if (!response.ok) {
                    throw new Error(`Graph create event HTTP ${response.status}`);
                }

                const createdOutlookEvent = await response.json();
                const createdOutlookEventId = createdOutlookEvent?.id || "";

                if (!createdOutlookEventId) {
                    throw new Error("Graph create event did not return id.");
                }

                const crmCreateResponse = await dispatch(createOutlookEventForLead({
                    idnetsuite_admin,
                    nombreEvento: createEventTitle.trim(),
                    tipoEvento: createEventType,
                    descripcionEvento: createEventDescription.trim(),
                    formatdateIni: toGraphDateTime(createEventScheduleRange.start),
                    formatdateFin: toGraphDateTime(createEventScheduleRange.end),
                    horaInicio: createEventStartTimeValue,
                    horaFinal: createEventEndTimeValue,
                    leadId: requiresCreateEventLeadAssignment ? Number(createEventLeadId || 0) : 0,
                    colorEvento: getCreateEventColor(createEventType),
                    citaValue: createEventType === "Cita" ? 1 : 0,
                    id_proyecto: shouldShowCreateEventProjectSelect ? Number(createEventProjectId || 0) : 0,
                    nombre_proyecto: shouldShowCreateEventProjectSelect
                        ? (selectedCreateEventProjectOption?.label || "0")
                        : "0",
                    copiaJefe: 1,
                    outlook_event_id: createdOutlookEventId,
                }, selectedCreateEventLeadStatus));

                const crmCreateSucceeded = crmCreateResponse?.ok && crmCreateResponse?.data?.ok !== false;

                if (!crmCreateSucceeded) {
                    const rollbackSucceeded = await deleteOutlookEventById(
                        tokenResponse.accessToken,
                        createdOutlookEventId,
                    );

                    throw new Error(
                        rollbackSucceeded
                            ? "CRM create failed after Outlook create. Outlook rollback applied."
                            : "CRM create failed after Outlook create. Outlook rollback failed.",
                    );
                }
            }

            closeCreateEventModal();
            setEventsReloadToken((currentValue) => currentValue + 1);
        } catch (error) {
            console.error("[outlook-calendar] no se pudo guardar evento Outlook", error);
            setCreateEventSubmitError(
                createEventMode === "edit"
                    ? "No se pudo actualizar el evento en Outlook y CRM."
                    : "No se pudo guardar el evento en Outlook y CRM.",
            );
        } finally {
            setIsSavingCreateEvent(false);
        }
    };

const handleCalendarEventScheduleChange = async (info) => {
        const crmEvent = info.event.extendedProps?.crm || null;
        const outlookEvent = info.event.extendedProps?.outlook || null;
        const nextStartDate = info.event.start ? new Date(info.event.start) : null;
        const nextEndDate = info.event.end ? new Date(info.event.end) : null;
        const previousStartDate = info.oldEvent?.start ? new Date(info.oldEvent.start) : null;
        const previousEndDate = info.oldEvent?.end ? new Date(info.oldEvent.end) : null;
        const crmEventId = crmEvent?.id_calendar || null;
        const linkedOutlookEventId = typeof crmEvent?.outlook_event_id === "string"
            ? crmEvent.outlook_event_id.trim()
            : "";
        const outlookEventId = outlookEvent?.id || linkedOutlookEventId || null;
        const shouldUpdateCrm = Boolean(crmEventId);
        const shouldUpdateOutlook = Boolean(outlookEventId);
        const currentUserEmail = activeMicrosoftAccount?.username || microsoftUser?.email || email_admin || "";
        const movePermission = canAuthenticatedUserMoveCalendarEvent({
            crmEvent,
            outlookEvent,
            currentAdminId: idnetsuite_admin,
            currentUserEmail,
        });

        if (!nextStartDate || !nextEndDate || (!shouldUpdateCrm && !shouldUpdateOutlook)) {
            info.revert();
            return;
        }

        if (!movePermission.canMove) {
            info.revert();
            await Swal.fire("No permitido", buildCalendarMoveBlockedMessage(movePermission.owner), "warning");
            return;
        }

        closeEventCard();

        try {
            let tokenResponse = null;

            if (shouldUpdateOutlook) {
                if (!activeMicrosoftAccount) {
                    throw new Error("No Microsoft account available for event move.");
                }

                try {
                    tokenResponse = await instance.acquireTokenSilent({
                        scopes: [OUTLOOK_CREATE_EVENT_SCOPE],
                        account: activeMicrosoftAccount,
                    });
                } catch (error) {
                    if (!(error instanceof InteractionRequiredAuthError)) {
                        throw error;
                    }

                    tokenResponse = await instance.acquireTokenPopup({
                        scopes: [OUTLOOK_CREATE_EVENT_SCOPE],
                        account: activeMicrosoftAccount,
                    });
                }

                const outlookUpdated = await updateOutlookEventScheduleById(
                    tokenResponse.accessToken,
                    outlookEventId,
                    {
                        start: nextStartDate,
                        end: nextEndDate,
                    },
                );

                if (!outlookUpdated) {
                    throw new Error("Outlook event update failed.");
                }
            }

            if (shouldUpdateCrm) {
                const crmResponse = await updateOutlookCalendarEventSchedule({
                    id_calendar: crmEventId,
                    formatdateIni: toGraphDateTime(nextStartDate),
                    formatdateFin: toGraphDateTime(nextEndDate),
                    horaInicio: formatTimeValue(nextStartDate.getHours(), nextStartDate.getMinutes()),
                    horaFinal: formatTimeValue(nextEndDate.getHours(), nextEndDate.getMinutes()),
                });
                const crmPayload = crmResponse?.data || null;
                const crmUpdated = crmResponse?.ok && crmPayload?.ok !== false;

                if (!crmUpdated) {
                    if (shouldUpdateOutlook && tokenResponse?.accessToken && previousStartDate && previousEndDate) {
                        await updateOutlookEventScheduleById(tokenResponse.accessToken, outlookEventId, {
                            start: previousStartDate,
                            end: previousEndDate,
                        });
                    }

                    const ownershipBlocked = crmPayload?.data?.code === "EVENT_OWNER_MISMATCH";
                    const notFoundBlocked = crmPayload?.data?.code === "EVENT_NOT_FOUND";
                    const backendMessage = crmPayload?.message || "CRM event update failed.";
                    const backendError = new Error(backendMessage);

                    if (ownershipBlocked || notFoundBlocked) {
                        backendError.code = crmPayload?.data?.code;
                    }

                    throw backendError;
                }
            }

            setEventsReloadToken((currentValue) => currentValue + 1);
        } catch (error) {
            console.error("[outlook-calendar] no se pudo mover evento", error);
            info.revert();

            if (error?.code === "EVENT_OWNER_MISMATCH" || error?.code === "EVENT_NOT_FOUND") {
                await Swal.fire("No permitido", error.message, "warning");
            }
        }
    };

    /**
     * Cambia vista segmentada (Día/Semana/Mes) y sincroniza FullCalendar.
     * @param {keyof VIEW_CONFIG} viewMode
     */
    const changeCalendarView = (viewMode) => {
        const calendarApi = calendarRef.current?.getApi();

        setActiveViewMode(viewMode);
        closeEventCard();

        if (calendarApi) {
            calendarApi.changeView(VIEW_CONFIG[viewMode].calendarView);
        }
    };

    /**
     * Navegación imperativa: prev | next | today.
     * @param {"prev"|"next"|"today"} action
     */
    const navigateCalendar = (action) => {
        const calendarApi = calendarRef.current?.getApi();

        if (!calendarApi) {
            return;
        }

        closeEventCard();
        calendarApi[action]();
    };

    /**
     * Salta a una fecha concreta (mini-calendario lateral).
     * @param {Date} dateValue
     */
    const gotoDate = (dateValue) => {
        const calendarApi = calendarRef.current?.getApi();

        if (!calendarApi) {
            return;
        }

        closeEventCard();
        calendarApi.gotoDate(dateValue);
    };

    const toggleCrmFilter = (filterValue) => {
        setCrmFilters((currentValue) => ({
            ...currentValue,
            [filterValue]: !currentValue[filterValue],
        }));
    };

    const toggleOriginFilter = (filterValue) => {
        setOriginFilters((currentValue) => ({
            ...currentValue,
            [filterValue]: !currentValue[filterValue],
        }));
    };

    const toggleAdminFilter = (adminKey) => {
        setSelectedAdmins((currentValue) => ({
            ...currentValue,
            [adminKey]: !currentValue[adminKey],
        }));
    };

    const openFilterMenu = (event) => {
        setFilterMenuAnchor(event.currentTarget);
    };

    const closeFilterMenu = () => {
        setFilterMenuAnchor(null);
    };

    const clearAllFilters = () => {
        setCrmFilters(DEFAULT_CRM_FILTERS);
        setOriginFilters(DEFAULT_ORIGIN_FILTERS);
        setSelectedAdmins({});
    };

    /**
     * Efecto principal de carga de datos.
     * Se dispara cuando cambia la ventana visible o credenciales MSAL/CRM.
     * Carga CRM y Microsoft en secuencia dentro del mismo async; fallos son independientes.
     */
    useEffect(() => {
        let isMounted = true;

        const loadVisibleEvents = async () => {
            const crmEvents = [];
            const microsoftEvents = [];
            let tokenResponse = null;

            setIsLoadingCalendarEvents(true);

            try {
                if (inProgress !== "startup" && microsoftUser && activeMicrosoftAccount) {
                    try {
                        tokenResponse = await instance.acquireTokenSilent({
                            scopes: ["Calendars.Read"],
                            account: activeMicrosoftAccount,
                        });

                        const registerSyncResponse = await registerOutlookCalendarSync({
                            accessToken: tokenResponse.accessToken,
                            outlook_user_email: activeMicrosoftAccount.username || microsoftUser?.email || "",
                            idnetsuite_admin,
                        });
                        const registerSyncPayload = registerSyncResponse?.data || null;

                        if (registerSyncPayload?.ok === false) {
                            throw new Error(registerSyncPayload?.message || "No se pudo registrar la suscripción Outlook.");
                        }

                        const processSyncResponse = await processOutlookCalendarSync({
                            accessToken: tokenResponse.accessToken,
                            outlook_user_email: activeMicrosoftAccount.username || microsoftUser?.email || "",
                            idnetsuite_admin,
                            forceSync: true,
                        });
                        const processSyncPayload = processSyncResponse?.data || null;

                        if (processSyncPayload?.ok === false) {
                            throw new Error(processSyncPayload?.message || "No se pudo procesar delta sync Outlook.");
                        }
                    } catch (error) {
                        if (error instanceof InteractionRequiredAuthError) {
                            console.log("[outlook-calendar] Microsoft requiere permisos interactivos. Se omite delta sync.");
                        } else if (isExpectedLocalWebhookSyncError(error)) {
                            // Local/pruebas sin webhook público: condición esperada, no ensuciar consola.
                        } else {
                            console.error("[outlook-calendar] error registrando o sincronizando delta Outlook -> CRM", error);
                        }
                    }
                }

                // --- Bloque CRM: requiere usuario NetSuite y rol ---
                if (idnetsuite_admin && rol_admin) {
                    try {
                        const crmResponse = await getPendingActionCalendarEvents({
                            dateStart: formatDateOnly(currentWindow.start),
                            dateEnd: formatDateOnly(currentWindow.endInclusive),
                        });

                        const responseEvents = Array.isArray(crmResponse?.data?.data)
                            ? crmResponse.data.data
                            : [];

                        crmEvents.push(...responseEvents);
                    } catch (error) {
                        console.error("[outlook-calendar] error cargando eventos CRM por rango", error);
                    }
                }

                // --- Bloque Microsoft 365: requiere MSAL listo y usuario Microsoft vinculado ---
                if (inProgress !== "startup" && microsoftUser && activeMicrosoftAccount) {
                    try {
                        if (!tokenResponse) {
                            tokenResponse = await instance.acquireTokenSilent({
                                scopes: ["Calendars.Read"],
                                account: activeMicrosoftAccount,
                            });
                        }

                        // Query OData para calendarView con rango ISO y campos selectivos
                        const searchParams = new URLSearchParams({
                            startDateTime: currentWindow.start.toISOString(),
                            endDateTime: currentWindow.endExclusive.toISOString(),
                            $top: "100",
                            $orderby: "start/dateTime",
                            $select: [
                                "id",
                                "subject",
                                "start",
                                "end",
                                "location",
                                "organizer",
                                "attendees",
                                "body",
                                "bodyPreview",
                                "webLink",
                                "responseStatus",
                                "lastModifiedDateTime",
                                "isOnlineMeeting",
                                "onlineMeeting",
                                "onlineMeetingProvider",
                            ].join(","),
                        });

                        let nextUrl = `https://graph.microsoft.com/v1.0/me/calendarView?${searchParams.toString()}`;

                        // Paginación: Graph puede devolver @odata.nextLink
                        while (nextUrl) {
                            const response = await fetch(nextUrl, {
                                method: "GET",
                                headers: {
                                    Authorization: `Bearer ${tokenResponse.accessToken}`,
                                    "Content-Type": "application/json",
                                    // Fuerza zona horaria Costa Rica en dateTime de respuesta
                                    Prefer: 'outlook.timezone="America/Costa_Rica"',
                                },
                            });

                            if (!response.ok) {
                                throw new Error(`Microsoft Graph HTTP ${response.status}`);
                            }

                            const data = await response.json();
                            const pageEvents = Array.isArray(data?.value) ? data.value : [];

                            microsoftEvents.push(...pageEvents);
                            nextUrl = data?.["@odata.nextLink"] || null;
                        }
                    } catch (error) {
                        if (error instanceof InteractionRequiredAuthError) {
                            // Usuario debe re-autenticarse; degradación graceful a solo CRM
                            console.log("[outlook-calendar] Microsoft requiere permisos interactivos. Se cargan solo eventos CRM.");
                        } else {
                            console.error("[outlook-calendar] error cargando eventos Microsoft 365 por rango", error);
                        }
                    }
                }

                // Unificar fuentes y transformar a eventos FullCalendar
                const unifiedEvents = buildUnifiedDebugPayload(crmEvents, microsoftEvents);
                const mappedEvents = mapUnifiedEventsToCalendarEvents(unifiedEvents);

                if (isMounted) {
                    setCalendarEvents(mappedEvents);
                }
            } finally {
                if (isMounted) {
                    setIsLoadingCalendarEvents(false);
                }
            }
        };

        loadVisibleEvents();

        return () => {
            isMounted = false;
        };
    }, [
        accounts,
        activeMicrosoftAccount,
        currentWindow.endExclusive,
        currentWindow.endInclusive,
        currentWindow.start,
        eventsReloadToken,
        idnetsuite_admin,
        inProgress,
        instance,
        microsoftUser,
        rol_admin,
    ]);

    // Cleanup del timeout al desmontar componente
    useEffect(() => () => {
        if (expandModalTimeoutRef.current) {
            clearTimeout(expandModalTimeoutRef.current);
        }
    }, []);

    useEffect(() => {
        const availableAdminKeys = new Set(adminFilterOptions.map((option) => option.value));

        setSelectedAdmins((currentValue) => {
            const nextValue = Object.fromEntries(
                Object.entries(currentValue).filter(([adminKey, isSelected]) => availableAdminKeys.has(adminKey) && isSelected),
            );

            if (Object.keys(nextValue).length === Object.keys(currentValue).length) {
                return currentValue;
            }

            return nextValue;
        });
    }, [adminFilterOptions]);

    // Derivados para condicionar UI Teams en popover y modal
    const isTeamsEvent = selectedEvent?.extendedProps?.meetingType === "teams";
    const modalEvent = expandedEvent || selectedEvent; // Modal usa copia expandida si existe
    const isTeamsModalEvent = modalEvent?.extendedProps?.meetingType === "teams";

    /**
     * Expande evento a modal full-screen.
     * setTimeout(0) separa cierre de Popover y apertura de Dialog (focus trap MUI).
     */
    const handleExpandModal = (event) => {
        const nextExpandedEvent = selectedEvent;

        if (!nextExpandedEvent) {
            return;
        }

        event.currentTarget.blur(); // Evita foco atrapado en botón del popover
        setExpandedEvent(nextExpandedEvent);
        closeEventCard();

        if (expandModalTimeoutRef.current) {
            clearTimeout(expandModalTimeoutRef.current);
        }

        expandModalTimeoutRef.current = setTimeout(() => {
            openExpandedModal();
            expandModalTimeoutRef.current = null;
        }, 0);
    };

    /**
     * Copia enlace (Teams u otro) al portapapeles con feedback temporal.
     * @param {string} eventId - Id del evento FC para estado "Copiado"
     * @param {string} linkValue
     */
    const handleCopyLink = async (eventId, linkValue) => {
        if (!linkValue || !navigator?.clipboard) {
            return;
        }

        try {
            await navigator.clipboard.writeText(linkValue);
            setCopiedLinkEventId(eventId);
            window.setTimeout(() => {
                setCopiedLinkEventId((currentValue) => (currentValue === eventId ? "" : currentValue));
            }, 1800);
        } catch (error) {
            console.error("[outlook-calendar] no se pudo copiar el link", error);
        }
    };

    const applyLocalEventResponseUpdate = (eventApi, responseValue) => {
        if (!eventApi || !responseValue) {
            return;
        }

        const responseLabel = humanizeOutlookResponse(responseValue, "Sin respuesta");
        const nextOutlookValue = {
            ...(eventApi.extendedProps?.outlook || {}),
            responseStatus: {
                ...(eventApi.extendedProps?.outlook?.responseStatus || {}),
                response: responseValue,
            },
        };

        eventApi.setExtendedProp("status", responseLabel);
        eventApi.setExtendedProp("outlook", nextOutlookValue);

        if (!eventApi.extendedProps?.crm?.accion_calendar) {
            eventApi.setExtendedProp("response", responseLabel);
        }

        setCalendarEvents((currentValue) => currentValue.map((eventItem) => {
            if (eventItem.id !== eventApi.id) {
                return eventItem;
            }

            return {
                ...eventItem,
                extendedProps: {
                    ...eventItem.extendedProps,
                    status: responseLabel,
                    response: eventItem.extendedProps?.crm?.accion_calendar
                        ? eventItem.extendedProps.response
                        : responseLabel,
                    outlook: nextOutlookValue,
                },
            };
        }));
    };

    const handleOutlookResponseAction = async (action) => {
        if (!selectedEvent || !activeMicrosoftAccount) {
            return;
        }

        const outlookEventId = selectedEvent.extendedProps?.outlook?.id || selectedEvent.extendedProps?.meetingId || "";

        if (!outlookEventId) {
            await Swal.fire("No disponible", "Este evento no tiene identificador Outlook para responder.", "warning");
            return;
        }

        const graphActionByResponse = {
            accepted: "accept",
            declined: "decline",
            tentativelyAccepted: "tentativelyAccept",
        };
        const graphAction = graphActionByResponse[action];

        if (!graphAction) {
            return;
        }

        setIsSubmittingResponseAction(true);

        try {
            let tokenResponse = null;

            try {
                tokenResponse = await instance.acquireTokenSilent({
                    scopes: [OUTLOOK_CREATE_EVENT_SCOPE],
                    account: activeMicrosoftAccount,
                });
            } catch (error) {
                if (!(error instanceof InteractionRequiredAuthError)) {
                    throw error;
                }

                tokenResponse = await instance.acquireTokenPopup({
                    scopes: [OUTLOOK_CREATE_EVENT_SCOPE],
                    account: activeMicrosoftAccount,
                });
            }

            const responseSucceeded = await respondToOutlookEventById(
                tokenResponse.accessToken,
                outlookEventId,
                graphAction,
                {
                    comment: responseComment.trim(),
                    sendResponse: notifyOrganizer,
                },
            );

            if (!responseSucceeded) {
                throw new Error("Outlook response action failed.");
            }

            applyLocalEventResponseUpdate(selectedEvent, action);
            setShowResponseActions(false);
            setResponseComment("");
        } catch (error) {
            console.error("[outlook-calendar] no se pudo responder invitación Outlook", error);
            await Swal.fire("Error", "No se pudo registrar la respuesta del evento en Outlook.", "error");
        } finally {
            setIsSubmittingResponseAction(false);
        }
    };

    /** Abre URL en nueva pestaña con rel noopener por seguridad. */
    const openExternalLink = (linkValue) => {
        if (!linkValue) {
            return;
        }

        window.open(linkValue, "_blank", "noopener,noreferrer");
    };

    // --- Render: layout Outlook (toolbar + sidebar + calendario + popover + modal) ---
    return (
        <section className="outlook-calendar-page">
            {/* Toolbar superior: acciones globales y selector de vista */}
            <div className="outlook-toolbar">
                <div className="outlook-toolbar-group is-compact">
                    {/* Botón placeholder; creación de evento aún no implementada */}
                    <div className="outlook-split-button">
                        <button
                            className="outlook-button outlook-button-primary"
                            onClick={openCreateEventModal}
                            type="button"
                        >
                            <span className="ti ti-calendar-plus"></span>
                            Nuevo evento
                        </button>
                        <button
                            aria-label="Más opciones de nuevo evento"
                            className="outlook-button outlook-button-primary outlook-button-primary-chevron"
                            onClick={openCreateEventModal}
                            type="button"
                        >
                            <span className="ti ti-chevron-down"></span>
                        </button>
                    </div>
                </div>

                <div className="outlook-toolbar-group">
                    {/* Control segmentado: Día / Semana laboral / Semana / Mes */}
                    <div className="outlook-segmented-control">
                        {Object.entries(VIEW_CONFIG).map(([viewMode, config]) => (
                            <button
                                className={`outlook-button is-segment ${activeViewMode === viewMode ? "is-active" : ""}`}
                                key={viewMode}
                                onClick={() => changeCalendarView(viewMode)}
                                type="button"
                            >
                                <span className={`ti ${config.buttonIcon}`}></span>
                                {config.buttonLabel}
                            </button>
                        ))}
                    </div>
                    <span className="outlook-toolbar-divider"></span>
                    <button
                        aria-expanded={Boolean(filterMenuAnchor)}
                        className={`outlook-button outlook-button-filter ${filterMenuAnchor ? "is-active" : ""}`}
                        onClick={openFilterMenu}
                        type="button"
                    >
                        <span className="ti ti-filter"></span>
                        {activeFilterCount ? `Filtro aplicado (${activeFilterCount})` : "Filtro aplicado"}
                        <span className="ti ti-chevron-down"></span>
                    </button>
                </div>
            </div>
            <OutlookCreateEventModal
                applyMeetingSuggestion={applyMeetingSuggestion}
                areAllParticipantsAvailable={areAllParticipantsAvailable}
                attendeeAvailabilityStatuses={attendeeAvailabilityStatuses}
                attendeeDirectoryError={attendeeDirectoryError}
                attendeeDirectoryOptions={attendeeDirectoryOptions}
                attendeeSearchText={attendeeSearchText}
                canShowEditStatusActions={canShowEditStatusActions}
                canShowReactivateAction={canShowReactivateAction}
                closeCreateEventModal={closeCreateEventModal}
                createEventCalendarLabel={createEventCalendarLabel}
                createEventDateValue={createEventDateValue}
                createEventDateTimeLabel={createEventDateTimeLabel}
                createEventDescription={createEventDescription}
                createEventEndTimeOptions={createEventEndTimeOptions}
                createEventEndTimeValue={createEventEndTimeValue}
                createEventHeaderLabel={createEventHeaderLabel}
                createEventLocation={createEventLocation}
                createEventMinimumDateValue={createEventMinimumDateValue}
                createEventMode={createEventMode}
                createEventPreviewPosition={createEventPreviewPosition}
                createEventScheduleLabel={createEventScheduleLabel}
                createEventScheduleRange={createEventScheduleRange}
                createEventStartTimeValue={createEventStartTimeValue}
                createEventSubmitError={createEventSubmitError}
                createEventSubmitLabel={createEventSubmitLabel}
                createEventTimeOptions={createEventTimeOptions}
                createEventTitle={createEventTitle}
                createEventType={createEventType}
                createEventTypeOptions={CREATE_EVENT_TYPE_OPTIONS}
                createEventWeekLabel={createEventWeekLabel}
                createEventWindowTitle={createEventWindowTitle}
                createEventLeadId={createEventLeadId}
                createEventLeadLabel={selectedCreateEventLeadOption?.label || ""}
                createEventLeadOptions={createEventLeadOptions}
                createEventLeadOptionsError={createEventLeadOptionsError}
                createEventLeadEmail={selectedCreateEventLeadEmail}
                createEventProjectId={createEventProjectId}
                createEventProjectLabel={selectedCreateEventProjectOption?.label || ""}
                createEventProjectOptions={createEventProjectOptions}
                createEventProjectOptionsError={createEventProjectOptionsError}
                handleCreateEventDateChange={handleCreateEventDateChange}
                handleCreateEventEndTimeChange={handleCreateEventEndTimeChange}
                handleCreateEventLeadToggle={handleCreateEventLeadToggle}
                handleCreateEventStartTimeChange={handleCreateEventStartTimeChange}
                handleCreateEventTypeChange={handleCreateEventTypeChange}
                handleCancelCalendarEvent={handleCancelCalendarEvent}
                handleCompleteCalendarEvent={handleCompleteCalendarEvent}
                handleReactivateCalendarEvent={handleReactivateCalendarEvent}
                handleSubmitOutlookEvent={handleSubmitOutlookEvent}
                hasCreateEventTitle={hasCreateEventTitle}
                hasTouchedCreateEventTitle={hasTouchedCreateEventTitle}
                isCreateEventLeadEnabled={isCreateEventLeadEnabled}
                isLeadInvitationEnabled={isLeadInvitationEnabled}
                isCreateEventModalOpen={isCreateEventModalOpen}
                isCreateTeamsMeeting={isCreateTeamsMeeting}
                isLoadingAttendeeDirectory={isLoadingAttendeeDirectory}
                isLoadingCreateEventLeadOptions={isLoadingCreateEventLeadOptions}
                isLoadingCreateEventProjectOptions={isLoadingCreateEventProjectOptions}
                isLoadingMeetingSuggestions={isLoadingMeetingSuggestions}
                isLoadingRoomAvailability={isLoadingRoomAvailability}
                isLoadingRoomDirectory={isLoadingRoomDirectory}
                isLoadingScheduleAvailability={isLoadingScheduleAvailability}
                isUpdatingEventStatus={isUpdatingEventStatus}
                isOwnerAvailable={isOwnerAvailable}
                isPrimaryScheduleAvailable={isPrimaryScheduleAvailable}
                isRoomAvailable={isRoomAvailable}
                isRoomSuggestionsOpen={isRoomSuggestionsOpen}
                isSavingCreateEvent={isSavingCreateEvent}
                isScheduleEditorOpen={isScheduleEditorOpen}
                roomDirectoryError={roomDirectoryError}
                roomSuggestionOptions={roomSuggestionOptions}
                roomSuggestionSearchValue={roomSearchValue}
                hasMoreRoomSuggestions={hasMoreRoomSuggestions && !showAllRoomSuggestions}
                meetingSuggestions={meetingSuggestions}
                meetingSuggestionsError={meetingSuggestionsError}
                openRoomSuggestions={openRoomSuggestions}
                closeRoomSuggestions={closeRoomSuggestions}
                openAttendeeSuggestions={shouldOpenAttendeeSuggestions}
                previewBusyBlocks={previewBusyBlocks}
                previewParticipants={previewParticipants}
                handleCreateEventLocationChange={handleCreateEventLocationChange}
                handleSelectRoomOption={handleSelectRoomOption}
                clearSelectedRoomOption={clearSelectedRoomOption}
                scheduleAvailabilityError={scheduleAvailabilityError}
                selectedAttendees={selectedAttendees}
                selectedRoomOption={selectedRoomOption}
                selectedRoomAvailabilityStatus={selectedRoomAvailabilityStatus}
                setAttendeeSearchText={setAttendeeSearchText}
                setCreateEventDescription={setCreateEventDescription}
                setCreateEventLeadId={setCreateEventLeadId}
                setCreateEventProjectId={setCreateEventProjectId}
                setCreateEventTitle={setCreateEventTitle}
                setHasTouchedCreateEventTitle={setHasTouchedCreateEventTitle}
                setIsLeadInvitationEnabled={setIsLeadInvitationEnabled}
                setIsCreateTeamsMeeting={setIsCreateTeamsMeeting}
                setIsScheduleEditorOpen={setIsScheduleEditorOpen}
                setSelectedAttendees={setSelectedAttendees}
                setShowAllRoomSuggestions={setShowAllRoomSuggestions}
                shouldShowCreateEventLeadSelect={shouldShowCreateEventLeadSelect}
                shouldShowCreateEventProjectSelect={shouldShowCreateEventProjectSelect}
                shiftCreateEventDate={shiftCreateEventDate}
                toGraphDateTime={toGraphDateTime}
                roomSearchText={roomSearchText}
            />

            <div className="outlook-body"> 
                {/* Sidebar izquierdo: mini-calendario y lista de calendarios */}
                <aside className="outlook-sidebar">
                    <div className="outlook-sidebar-month">
                        <div className="outlook-sidebar-month-header">
                            <h1>{getMonthTitle(calendarDate)}</h1>
                            <div className="outlook-nav-inline">
                                <button
                                    className="outlook-icon-button"
                                    onClick={() => navigateCalendar("prev")}
                                    type="button"
                                >
                                    <span className="ti ti-chevron-left"></span>
                                </button>
                                <button
                                    className="outlook-icon-button"
                                    onClick={() => navigateCalendar("next")}
                                    type="button"
                                >
                                    <span className="ti ti-chevron-right"></span>
                                </button>
                            </div>
                        </div>

                        {/* Mini-calendario: 5 semanas, L-D, número ISO de semana */}
                        <div className="outlook-mini-calendar">
                            <div className="outlook-mini-calendar-head">
                                <span></span> {/* Columna número de semana */}
                                <span>L</span>
                                <span>M</span>
                                <span>X</span>
                                <span>J</span>
                                <span>V</span>
                                <span>S</span>
                                <span>D</span>
                            </div>

                            {miniCalendarWeeks.map((week) => (
                                <div className="outlook-mini-calendar-row" key={`${calendarDate.getMonth()}-${week.weekNumber}`}>
                                    <span className="outlook-week-number">{week.weekNumber}</span>
                                    {week.days.map((dayValue) => (
                                        <button
                                            className={sameDay(dayValue, calendarDate) ? "is-selected" : ""}
                                            key={dayValue.toISOString()}
                                            onClick={() => gotoDate(dayValue)}
                                            type="button"
                                        >
                                            {dayValue.getDate()}
                                        </button>
                                    ))}
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Filtros visuales por categoría CRM (checkboxes decorativos por ahora) */}
                </aside>

                {/* Área principal: header de navegación + FullCalendar */}
                <div className="outlook-main">
                    <div className="outlook-main-shell">
                        <div className="outlook-main-header">
                            <div className="outlook-main-actions">
                                <button className="outlook-button" onClick={() => navigateCalendar("today")} type="button">Hoy</button>
                                <button className="outlook-icon-button" onClick={() => navigateCalendar("prev")} type="button">
                                    <span className="ti ti-chevron-left"></span>
                                </button>
                                <button className="outlook-icon-button" onClick={() => navigateCalendar("next")} type="button">
                                    <span className="ti ti-chevron-right"></span>
                                </button>
                            </div>

                            <div className="outlook-main-title">
                                <h2>{calendarTitle}</h2>
                                <span className="ti ti-chevron-down"></span>
                            </div>

                            <div className="outlook-main-meta">
                                <span>{VIEW_CONFIG[activeViewMode].metaLabel}</span>
                                <span className="outlook-meta-divider"></span>
                                <span>{adminScopedCalendarEvents.length} eventos programados</span>
                            </div>
                        </div>

                        <div className="outlook-calendar-frame">
                            {isLoadingCalendarEvents ? (
                                <div className="outlook-calendar-loading-overlay">
                                    <div className="outlook-calendar-loading-card">
                                        <CircularProgress size={26} thickness={4.6} />
                                        <div className="outlook-calendar-loading-copy">
                                            <strong>Cargando eventos</strong>
                                            <span>Sincronizando CRM y Outlook para esta vista.</span>
                                        </div>
                                    </div>

                                    <div className="outlook-calendar-loading-skeleton" aria-hidden="true">
                                        {Array.from({ length: 8 }).map((_, index) => (
                                            <span
                                                className={`outlook-calendar-loading-bar is-${(index % 4) + 1}`}
                                                key={`calendar-loading-bar-${index}`}
                                            ></span>
                                        ))}
                                    </div>
                                </div>
                            ) : null}
                            {/*
                              FullCalendar: motor principal.
                              - datesSet sincroniza estado React al navegar
                              - eventClick abre popover
                              - eventContent renderiza tarjeta custom por evento
                            */}
                            <FullCalendar
                                ref={calendarRef}
                                allDaySlot={false}
                                contentHeight="auto"
                                datesSet={(dateInfo) => {
                                    const calendarApi = calendarRef.current?.getApi();
                                    const nextDate = activeViewMode === "month"
                                        ? (dateInfo.view.currentStart || calendarApi?.getDate() || dateInfo.start)
                                        : (calendarApi?.getDate() || dateInfo.start);
                                    // Preservar workweek si ya estaba activo (FC solo reporta timeGridWeek)
                                    const nextViewMode = activeViewMode === "workweek"
                                        ? "workweek"
                                        : getViewModeFromCalendarView(dateInfo.view.type);

                                    setCalendarDate(startOfDay(nextDate));
                                    setCalendarTitle(dateInfo.view.title);
                                    setActiveViewMode(nextViewMode);
                                    closeEventCard();
                                    closeDayEventsPopover();
                                }}
                                dateClick={handleCalendarDateClick}
                                dayCellClassNames={(arg) => {
                                    if (sameDay(arg.date, calendarDate)) {
                                        return ["outlook-day-focus"];
                                    }

                                    if (arg.isOther) {
                                        return ["outlook-day-other-month"];
                                    }

                                    return [];
                                }}
                                dayMaxEvents={activeViewMode === "month" ? 3 : false}
                                moreLinkClick={handleDayEventsMoreClick}
                                eventClick={(info) => {
                                    closeDayEventsPopover();
                                    openEventCardAtPosition(info.event, {
                                        left: info.jsEvent.clientX + 18,
                                        top: info.jsEvent.clientY + 18,
                                    });
                                }}
                                eventContent={(eventInfo) => renderOutlookCalendarEventContent(eventInfo, {
                                    isSelected: selectedEvent?.id === eventInfo.event.id,
                                })}
                                eventDisplay="block"
                                eventChange={handleCalendarEventScheduleChange}
                                eventDurationEditable={false}
                                eventTimeFormat={{ hour: "2-digit", minute: "2-digit", hour12: false }}
                                events={adminScopedCalendarEvents}
                                editable={true}
                                firstDay={1}
                                fixedWeekCount={true}
                                headerToolbar={false}
                                height="auto"
                                initialDate={calendarDate}
                                initialView={VIEW_CONFIG[activeViewMode].calendarView}
                                locale={esLocale}
                                nowIndicator
                                plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
                                showNonCurrentDates={true}
                                slotMinTime="06:00:00"
                                weekends={activeViewMode !== "workweek"}
                            />
                        </div>
                    </div>
                </div>
            </div>

            {/* Popover de detalle rápido al hacer clic en un evento */}
            <Popover
                anchorEl={filterMenuAnchor}
                anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
                disableRestoreFocus
                onClose={closeFilterMenu}
                open={Boolean(filterMenuAnchor)}
                transformOrigin={{ vertical: "top", horizontal: "left" }}
                slotProps={{
                    paper: {
                        className: "outlook-filter-menu",
                    },
                }}
            >
                <div className="outlook-filter-menu-content">
                    <button className="outlook-filter-clear" onClick={clearAllFilters} type="button">
                        <span className="ti ti-x"></span>
                        Borrar filtros
                    </button>

                    <OutlookFilterMenuSection
                        onToggle={toggleCrmFilter}
                        options={visibleCrmFilterOptions}
                        selectedMap={crmFilters}
                        title="Mis calendarios"
                    />

                    <OutlookFilterMenuSection
                        onToggle={toggleOriginFilter}
                        options={ORIGIN_FILTER_OPTIONS}
                        selectedMap={originFilters}
                        title="Origen"
                    />

                    <OutlookFilterMenuSection
                        onToggle={toggleAdminFilter}
                        options={adminFilterOptions}
                        selectedMap={selectedAdmins}
                        title="Admins"
                    />
                </div>
            </Popover>

            <Popover
                anchorPosition={selectedDayEventsPosition || undefined}
                anchorReference="anchorPosition"
                disableAutoFocus
                disableEnforceFocus
                disableRestoreFocus
                onClose={closeDayEventsPopover}
                open={Boolean(selectedDayEvents.length && selectedDayEventsPosition)}
                slotProps={{
                    paper: {
                        className: "outlook-day-events-popover",
                    },
                }}
            >
                <Box className="outlook-day-events-popover-content">
                    <Box className="outlook-day-events-popover-header">
                        <Typography className="outlook-day-events-popover-title">
                            {selectedDayEventsTitle}
                        </Typography>
                        <button
                            className="outlook-day-events-popover-close"
                            onClick={closeDayEventsPopover}
                            type="button"
                        >
                            <span className="ti ti-x"></span>
                        </button>
                    </Box>

                    <Box className="outlook-day-events-popover-list">
                        {selectedDayEvents.map((eventItem) => {
                            const isSelectedDayEvent = selectedEvent?.id === eventItem.id;
                            const eventStartDate = eventItem?.start ? new Date(eventItem.start) : null;
                            const eventTimeLabel = eventItem.allDay
                                ? "Todo el día"
                                : (
                                    eventItem.extendedProps?.timeText
                                    || (
                                        eventStartDate && !Number.isNaN(eventStartDate.getTime())
                                            ? formatHourMinuteLabel(eventStartDate.getHours(), eventStartDate.getMinutes())
                                            : "00:00"
                                    )
                                );

                            return (
                                <button
                                    className={`outlook-day-events-popover-item ${isSelectedDayEvent ? "is-selected" : ""}`}
                                    key={`day-popover-${eventItem.id}`}
                                    onClick={(event) => openEventCardFromElement(eventItem, event.currentTarget)}
                                    type="button"
                                >
                                    <span
                                        className="outlook-day-events-popover-accent"
                                        style={{ background: eventItem.extendedProps?.eventColor || eventItem.backgroundColor || "#2a5f79" }}
                                    ></span>
                                    <span className="outlook-day-events-popover-time">
                                        {eventTimeLabel}
                                    </span>
                                    <span className="outlook-day-events-popover-name">
                                        {eventItem.title}
                                    </span>
                                    <span className="outlook-day-events-popover-arrow">
                                        <span className="ti ti-arrow-right"></span>
                                    </span>
                                </button>
                            );
                        })}
                    </Box>
                </Box>
            </Popover>

            <Popover
                anchorPosition={selectedPosition || undefined}
                anchorReference="anchorPosition" // Posición fija en coordenadas de pantalla
                disableAutoFocus
                disableEnforceFocus
                disableRestoreFocus // Evita saltos de foco al cerrar
                onClose={closeEventCard}
                open={Boolean(selectedEvent && selectedPosition)}
                slotProps={{
                    paper: {
                        className: `outlook-hover-card ${selectedDayEvents.length ? "has-day-list-arrow" : ""}`,
                    },
                }}
            >
                {selectedEvent && (
                    <Box className="outlook-hover-card-content">
                        {/* Badge Id CRM si el evento tiene registro interno */}
                        {!!selectedEvent.extendedProps.crm?.id_calendar && (
                            <Box className="outlook-hover-card-id-row">
                                <span className="outlook-hover-card-id-badge">
                                    Id# {selectedEvent.extendedProps.crm.id_calendar}
                                </span>
                                {canEditSelectedEvent && (
                                    <button
                                        className="outlook-hover-card-expand-button"
                                        onClick={() => openEditEventModal(selectedEvent)}
                                        type="button"
                                    >
                                        <span className="ti ti-pencil outlook-hover-card-expand"></span>
                                    </button>
                                )}
                            </Box>
                        )}

                        <Box className="outlook-hover-card-title-row">
                            <Typography className="outlook-hover-card-title">
                                {selectedEvent.title}
                            </Typography>
                            <Box className="outlook-hover-card-title-actions">
                                {canEditSelectedEvent && !selectedEvent.extendedProps.crm?.id_calendar && (
                                    <button
                                        className="outlook-hover-card-expand-button"
                                        onClick={() => openEditEventModal(selectedEvent)}
                                        type="button"
                                    >
                                        <span className="ti ti-pencil outlook-hover-card-expand"></span>
                                    </button>
                                )}
                                <button className="outlook-hover-card-expand-button" onClick={handleExpandModal} type="button">
                                    <span className="ti ti-arrow-up-right outlook-hover-card-expand"></span>
                                </button>
                            </Box>
                        </Box>

                        {/* Acciones rápidas Teams: Unirse y Chatear */}
                        {isTeamsEvent && (
                            <>
                                <Box className="outlook-hover-card-actions">
                                    <button
                                        className="outlook-primary-action"
                                        onClick={() => openExternalLink(selectedEvent.extendedProps.teamsLink)}
                                        type="button"
                                    >
                                        <span className="ti ti-video"></span>
                                        Unirse
                                    </button>
                                    <button className="outlook-square-action" type="button">
                                        <span className="ti ti-chevron-down"></span>
                                    </button>
                                    <button
                                        className="outlook-secondary-action"
                                        onClick={() => openExternalLink(
                                            selectedEvent.extendedProps.teamsChatLink || selectedEvent.extendedProps.webLink,
                                        )}
                                        type="button"
                                    >
                                        <span className="ti ti-message-circle"></span>
                                        Chatear
                                    </button>
                                </Box>
                                <Divider />
                            </>
                        )}

                        <Divider />

                        {/* Fecha y hora del evento */}
                        <Box className="outlook-hover-card-detail">
                            <span className="ti ti-clock outlook-hover-card-icon"></span>
                            <Typography className="outlook-hover-card-text">
                                {getEventDateLabel(selectedEvent)}
                            </Typography>
                        </Box>

                        {/* Ubicación o tipo CRM como fallback */}
                        <Box className="outlook-hover-card-detail">
                            <span className="ti ti-map-pin outlook-hover-card-icon"></span>
                            <Typography className="outlook-hover-card-text">
                                {selectedEvent.extendedProps.location}
                            </Typography>
                        </Box>

                        {/* Tipo de evento si no duplica la ubicación */}
                        {shouldRenderEventType(
                            selectedEvent.extendedProps.eventType,
                            selectedEvent.extendedProps.location,
                        ) && (
                            <Box className="outlook-hover-card-detail">
                                <span className="ti ti-shapes outlook-hover-card-icon"></span>
                                <Typography className="outlook-hover-card-text">
                                    {selectedEvent.extendedProps.eventType}
                                </Typography>
                            </Box>
                        )}

                        {/* Origen: Sincronizado / Solo CRM / Solo Outlook */}
                        <Box className="outlook-hover-card-detail">
                            <span className="ti ti-brand-microsoft outlook-hover-card-icon"></span>
                            <Typography className="outlook-hover-card-text is-strong">
                                {getSourceStatusLabel(selectedEvent.extendedProps.source)}
                            </Typography>
                        </Box>

                        <Divider />

                        {/* Bloque persona: asesor, lead (con link), respuesta, proyecto, resumen */}
                        <Box className="outlook-hover-card-person">
                            <Avatar className="outlook-hover-card-avatar">
                                {selectedEvent.extendedProps.attendee?.charAt(0) || "K"}
                            </Avatar>
                            <Box>
                                <Typography className="outlook-hover-card-text is-strong">
                                    Asesor: {selectedEvent.extendedProps.attendee}
                                </Typography>
                                {!!selectedEvent.extendedProps.leadName && (
                                    selectedEvent.extendedProps.leadInternalId ? (
                                        <Typography
                                            className="outlook-hover-card-text"
                                            component={Link}
                                            to={`/leads/perfil?data=${selectedEvent.extendedProps.leadInternalId}`}
                                        >
                                            Lead: {selectedEvent.extendedProps.leadName}
                                        </Typography>
                                    ) : (
                                        <Typography className="outlook-hover-card-text">
                                            Lead: {selectedEvent.extendedProps.leadName}
                                        </Typography>
                                    )
                                )}
                                <Typography className="outlook-hover-card-text is-soft">
                                    {selectedEvent.extendedProps.response}
                                </Typography>
                                {!!selectedEvent.extendedProps.projectName && (
                                    <Typography className="outlook-hover-card-text is-soft">
                                        {selectedEvent.extendedProps.projectName}
                                    </Typography>
                                )}
                                {!!getEventSummaryText(selectedEvent) && (
                                    <Typography className="outlook-hover-card-text is-soft">
                                        {getEventSummaryText(selectedEvent)}
                                    </Typography>
                                )}
                                {!!selectedEvent.extendedProps.teamsLink && (
                                    <Box className="outlook-hover-card-link-row">
                                        <a
                                            className="outlook-hover-card-link"
                                            href={selectedEvent.extendedProps.teamsLink}
                                            rel="noreferrer"
                                            target="_blank"
                                        >
                                            Abrir vínculo
                                        </a>
                                        <button
                                            className="outlook-hover-card-copy"
                                            onClick={() => handleCopyLink(selectedEvent.id, selectedEvent.extendedProps.teamsLink)}
                                            type="button"
                                        >
                                            {copiedLinkEventId === selectedEvent.id ? "Copiado" : "Copiar"}
                                        </button>
                                    </Box>
                                )}
                                {isTeamsEvent && (
                                    <Typography className="outlook-hover-card-text is-soft">
                                        Aceptados: {selectedEvent.extendedProps.acceptedCount}
                                    </Typography>
                                )}
                            </Box>
                        </Box>

                        {/* Panel RSVP expandible (UI preparada; acciones sin API aún) */}
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
                                                    marginRight: "10px",
                                                    padding: 0,
                                                }}
                                            />
                                            Enviar correo electrónico al organizador
                                        </label>

                                        <input
                                            className="outlook-message-input"
                                            disabled={isSubmittingResponseAction}
                                            onChange={(event) => setResponseComment(event.target.value)}
                                            placeholder="Agregar un mensaje (opcional)"
                                            type="text"
                                            value={responseComment}
                                        />

                                        <Box className="outlook-hover-response-actions">
                                            <button
                                                className="outlook-response-button is-accept"
                                                disabled={isSubmittingResponseAction}
                                                onClick={() => handleOutlookResponseAction("accepted")}
                                                type="button"
                                            >
                                                {isSubmittingResponseAction ? "Guardando..." : "Aceptar"}
                                            </button>
                                            <button
                                                className="outlook-response-button is-reject"
                                                disabled={isSubmittingResponseAction}
                                                onClick={() => handleOutlookResponseAction("declined")}
                                                type="button"
                                            >
                                                Rechazar
                                            </button>
                                            <button
                                                className="outlook-response-button is-follow"
                                                disabled={isSubmittingResponseAction}
                                                onClick={() => handleOutlookResponseAction("tentativelyAccepted")}
                                                type="button"
                                            >
                                                Seguir
                                            </button>
                                            <button
                                                className="outlook-response-button is-more"
                                                disabled={isSubmittingResponseAction}
                                                onClick={() => setShowResponseActions(false)}
                                                type="button"
                                            >
                                                ...
                                            </button>
                                        </Box>
                                    </Box>
                                )}
                            </>
                        )}
                    </Box>
                )}
            </Popover>

            {/* Modal expandido estilo ventana de reunión Outlook */}
            <Dialog
                disableRestoreFocus
                PaperProps={{ className: "outlook-expanded-modal" }}
                fullWidth
                maxWidth="xl"
                onClose={closeExpandedModal}
                open={isExpandedModalOpen && Boolean(modalEvent)}
            >
                {modalEvent && (
                    <DialogContent className="outlook-expanded-modal-content">
                        {/* Barra de título del modal */}
                        <Box className="outlook-expanded-topbar">
                            <Typography className="outlook-expanded-window-title">
                                {modalEvent.title}: reunión: Calendario
                            </Typography>
                            <Box className="outlook-expanded-window-actions">
                                <span className="ti ti-arrow-up-right"></span>
                                <button className="outlook-modal-close" onClick={closeExpandedModal} type="button">x</button>
                            </Box>
                        </Box>

                        {/* Toolbar del modal: chips de estado y acciones Teams */}
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
                            {/* Panel izquierdo: detalle del evento */}
                            <Box className="outlook-expanded-mainpanel">
                                <Box className="outlook-expanded-section">
                                    <Typography className="outlook-expanded-event-title">
                                        {modalEvent.title}
                                    </Typography>

                                    <Box className="outlook-expanded-row">
                                        <span className="ti ti-users"></span>
                                        <Typography>
                                            {modalEvent.extendedProps.organizer}; {modalEvent.extendedProps.attendees?.slice(0, 2).join("; ")}; y {modalEvent.extendedProps.acceptedCount} más
                                        </Typography>
                                    </Box>

                                    <Box className="outlook-expanded-row">
                                        <span className="ti ti-clock"></span>
                                        <Typography>{getEventDateLabel(modalEvent)}</Typography>
                                    </Box>

                                    <Box className="outlook-expanded-row">
                                        <span className="ti ti-map-pin"></span>
                                        <Box className="outlook-location-pill">
                                            <span>{modalEvent.extendedProps.location}</span>
                                        </Box>
                                    </Box>
                                </Box>

                                {/* Descripción: variante Teams vs evento estándar */}
                                <Box className="outlook-expanded-description">
                                    <Typography className="outlook-expanded-description-title">
                                        {isTeamsModalEvent ? "Reunión de Microsoft Teams" : "Detalle del evento"}
                                    </Typography>

                                    {isTeamsModalEvent ? (
                                        <>
                                            <Typography className="outlook-expanded-link">
                                                Unirse: {modalEvent.extendedProps.teamsLink || "Sin enlace disponible"}
                                            </Typography>
                                            <Typography className="outlook-expanded-meta">
                                                Id. de reunión: {modalEvent.extendedProps.meetingId || "Sin identificador"}
                                            </Typography>
                                            <Typography className="outlook-expanded-meta">
                                                Código de acceso: {modalEvent.extendedProps.accessCode || "No disponible"}
                                            </Typography>
                                        </>
                                    ) : (
                                        <>
                                            <Typography className="outlook-expanded-meta">
                                                Ubicación: {modalEvent.extendedProps.location}
                                            </Typography>
                                            <Typography className="outlook-expanded-meta">
                                                Responsable: {modalEvent.extendedProps.attendee}
                                            </Typography>
                                            <Typography className="outlook-expanded-meta">
                                                Estado: {modalEvent.extendedProps.description || modalEvent.extendedProps.response}
                                            </Typography>
                                        </>
                                    )}
                                </Box>
                            </Box>

                            {/* Panel derecho: organizador y lista de asistentes */}
                            <Box className="outlook-expanded-sidepanel">
                                <Typography className="outlook-expanded-side-title">Seguimiento</Typography>

                                <Box className="outlook-expanded-organizer">
                                    <Typography className="outlook-expanded-label">Organizador</Typography>
                                    <Box className="outlook-expanded-person">
                                        <Avatar className="outlook-hover-card-avatar">
                                            {modalEvent.extendedProps.organizer?.charAt(0) || "C"}
                                        </Avatar>
                                        <Box>
                                            <Typography className="outlook-hover-card-text is-strong">
                                                {modalEvent.extendedProps.organizer}
                                            </Typography>
                                            <Typography className="outlook-hover-card-text is-soft">
                                                {modalEvent.extendedProps.sentAt}
                                            </Typography>
                                        </Box>
                                    </Box>
                                </Box>

                                <Box className="outlook-expanded-attendees">
                                    <Typography className="outlook-expanded-label">
                                        {isTeamsModalEvent ? "Asistentes" : "Participantes"}
                                    </Typography>
                                    <Typography className="outlook-hover-card-text is-soft">
                                        {isTeamsModalEvent ? 'Su respuesta fue "Aceptar"' : "Detalle visual del evento"}
                                    </Typography>

                                    {isTeamsModalEvent && (
                                        <Typography className="outlook-expanded-accepted">
                                            Aceptado: {modalEvent.extendedProps.acceptedCount}
                                        </Typography>
                                    )}

                                    {(modalEvent.extendedProps.attendees || [modalEvent.extendedProps.attendee]).map((attendee) => (
                                        <Box className="outlook-expanded-attendee-row" key={attendee}>
                                            <Avatar className="outlook-expanded-attendee-avatar">
                                                {attendee.charAt(0)}
                                            </Avatar>
                                            <Box>
                                                <Typography className="outlook-hover-card-text is-strong">
                                                    {attendee}
                                                </Typography>
                                                <Typography className="outlook-hover-card-text is-soft">
                                                    {isTeamsModalEvent ? "Obligatorio" : "Relacionado"}
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
