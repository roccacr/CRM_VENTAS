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
import FullCalendar from "@fullcalendar/react"; // Wrapper React de FullCalendar
import timeGridPlugin from "@fullcalendar/timegrid"; // Plugin vistas diaria/semanal con horas

// --- MSAL: autenticación silenciosa contra Microsoft para leer calendario ---
import { InteractionRequiredAuthError } from "@azure/msal-browser"; // Error cuando hace falta login interactivo
import { useMsal } from "@azure/msal-react"; // Hook que expone instancia MSAL y cuentas activas

// --- Material UI: componentes de UI para popover, modal y tipografía ---
import {
    Avatar, // Avatar circular para asistentes/organizador
    Box, // Contenedor flexible con sistema de estilos MUI
    Checkbox, // Casilla para "notificar al organizador"
    Dialog, // Modal expandido al hacer clic en expandir evento
    DialogContent, // Cuerpo del modal
    Divider, // Línea separadora visual
    Popover, // Tarjeta flotante al hacer clic en un evento
    Typography, // Texto con variantes tipográficas
} from "@mui/material";

// --- Redux: leer sesión del usuario autenticado en el CRM ---
import { useSelector } from "react-redux";

// --- React Router: enlazar al perfil del lead desde el popover ---
import { Link } from "react-router-dom";

// --- API interna: eventos pendientes del CRM filtrados por rango de fechas ---
import {
    getPendingActionCalendarEvents,
} from "../../../../store/calendar/Api_calendar_Providers";

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
    { value: "categoria3", label: "Reunion" },
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
        buttonLabel: "Dia",
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
        const descriptionLinks = extractUrls(outlookEvent?.bodyPreview || "");
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
        const adminFilterKey = crmEvent?.id_admin
            ? `crm-admin-${crmEvent.id_admin}`
            : organizerEmail
                ? `outlook-admin-${organizerEmail.toLowerCase()}`
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
            toDisplayName(crmEvent?.nombre_calendar, "Evento sin titulo"),
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
                location: toDisplayName(
                    outlookEvent?.location?.displayName,
                    toDisplayName(crmEvent?.tipo_calendar, "Sin ubicacion"),
                ),
                attendee,
                leadName: item.source === "outlook" ? "" : leadName, // Sin lead en eventos solo-Outlook
                leadInternalId: crmEvent?.idinterno_lead || null,
                eventType: toDisplayName(
                    crmEvent?.tipo_calendar,
                    outlookEvent?.isOnlineMeeting ? "Reunion" : "Evento",
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
                    : "Sin marca de envio",
                teamsLink,
                teamsChatLink,
                meetingId: outlookEvent?.id || crmEvent?.outlook_event_id || null,
                accessCode: null, // Graph no expone código de acceso en el select actual
                attendees: attendees.length ? attendees : [attendee],
                meetingType,
                description: crmEvent?.decrip_calendar || outlookEvent?.bodyPreview || "",
                summaryText: crmEvent?.decrip_calendar || sanitizeEventDescription(outlookEvent?.bodyPreview || ""),
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

        if (!adminKey || !adminLabel || adminMap.has(adminKey)) {
            return;
        }

        adminMap.set(adminKey, {
            value: adminKey,
            label: adminLabel,
        });
    });

    return Array.from(adminMap.values()).sort((left, right) => left.label.localeCompare(right.label, "es"));
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

const FilterToggleButton = ({ label, selected, onClick }) => (
    <button
        aria-pressed={selected}
        className={`outlook-calendar-check ${selected ? "is-selected" : "is-unselected"}`}
        onClick={onClick}
        type="button"
    >
        <span className="outlook-check-indicator">
            {selected && <span className="ti ti-check"></span>}
        </span>
        <span className="outlook-check-label">{label}</span>
    </button>
);

const FilterMenuSection = ({ title, options, selectedMap, onToggle }) => {
    if (!options.length) {
        return null;
    }

    return (
        <div className="outlook-filter-menu-section">
            <h3>{title}</h3>
            {options.map((option) => (
                <FilterToggleButton
                    key={option.value}
                    label={option.label}
                    onClick={() => onToggle(option.value)}
                    selected={selectedMap[option.value] === true}
                />
            ))}
        </div>
    );
};

const renderCalendarEventContent = (eventInfo) => {
    const eventColor = eventInfo.event.extendedProps.eventColor || OUTLOOK_DEFAULT_COLOR;

    return (
        <div
            className={`outlook-event-card ${eventInfo.event.classNames.join(" ")}`}
            style={{ "--outlook-event-accent": eventColor }}
        >
            <span className="outlook-event-stripe"></span>
            <span className="outlook-event-time">{eventInfo.timeText}</span>
            <span className="outlook-event-title">{eventInfo.event.title}</span>
        </div>
    );
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
    // --- Estado global de autenticación CRM (Redux) ---
    const { idnetsuite_admin, microsoftUser, rol_admin } = useSelector((state) => state.auth);

    // --- MSAL: cuenta Microsoft vinculada al usuario CRM ---
    const { accounts, inProgress, instance } = useMsal();

    // Ref al componente FullCalendar para invocar API imperativa (gotoDate, changeView)
    const calendarRef = useRef(null);

    // Timeout para abrir modal tras cerrar popover (evita conflicto de foco MUI)
    const expandModalTimeoutRef = useRef(null);

    // Modo de vista activo: day | workweek | week | month
    const [activeViewMode, setActiveViewMode] = useState("month");

    // Día ancla seleccionado (sincronizado con FullCalendar vía datesSet)
    const [calendarDate, setCalendarDate] = useState(startOfDay(new Date()));

    // Título que FullCalendar genera (ej. rango semanal); distinto de getMonthTitle
    const [calendarTitle, setCalendarTitle] = useState(getMonthTitle(new Date()));

    // Eventos ya mapeados al formato FullCalendar
    const [calendarEvents, setCalendarEvents] = useState([]);

    // Evento seleccionado al hacer clic (objeto Event de FullCalendar)
    const [selectedEvent, setSelectedEvent] = useState(null);

    // Copia del evento al expandir modal (se setea antes de cerrar popover)
    const [expandedEvent, setExpandedEvent] = useState(null);

    // Coordenadas del clic para anclar el Popover (anchorPosition)
    const [selectedPosition, setSelectedPosition] = useState(null);

    // Panel de respuesta RSVP (Aceptar/Rechazar) en popover Teams
    const [showResponseActions, setShowResponseActions] = useState(false);

    // Checkbox "notificar al organizador" en panel de respuesta
    const [notifyOrganizer, setNotifyOrganizer] = useState(true);

    // Control de apertura del Dialog expandido
    const [isExpandedModalOpen, setIsExpandedModalOpen] = useState(false);

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

    /** Cierra popover y resetea estado de interacción del evento. */
    const closeEventCard = () => {
        setSelectedEvent(null);
        setSelectedPosition(null);
        setShowResponseActions(false);
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
        const loadVisibleEvents = async () => {
            const crmEvents = [];
            const microsoftEvents = [];

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
            if (inProgress !== "startup" && microsoftUser && accounts?.length) {
                try {
                    // Preferir cuenta cuyo email coincide con microsoftUser del CRM
                    const matchedAccount = accounts.find(
                        (account) => account.username?.toLowerCase() === microsoftUser.email?.toLowerCase(),
                    ) || accounts[0];

                    // Token silencioso; Calendars.Read es scope mínimo para calendarView
                    const tokenResponse = await instance.acquireTokenSilent({
                        scopes: ["Calendars.Read"],
                        account: matchedAccount,
                    });

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

            setCalendarEvents(mappedEvents);
        };

        loadVisibleEvents();
    }, [
        accounts,
        currentWindow.endExclusive,
        currentWindow.endInclusive,
        currentWindow.start,
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
                        <button className="outlook-button outlook-button-primary" type="button">
                            <span className="ti ti-calendar-plus"></span>
                            Nuevo evento
                        </button>
                        <button
                            aria-label="Mas opciones de nuevo evento"
                            className="outlook-button outlook-button-primary outlook-button-primary-chevron"
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
                                    const nextDate = calendarApi?.getDate() || dateInfo.start;
                                    // Preservar workweek si ya estaba activo (FC solo reporta timeGridWeek)
                                    const nextViewMode = activeViewMode === "workweek"
                                        ? "workweek"
                                        : getViewModeFromCalendarView(dateInfo.view.type);

                                    setCalendarDate(startOfDay(nextDate));
                                    setCalendarTitle(dateInfo.view.title);
                                    setActiveViewMode(nextViewMode);
                                    closeEventCard();
                                }}
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
                                eventClick={(info) => {
                                    setSelectedEvent(info.event);
                                    setSelectedPosition({
                                        left: info.jsEvent.clientX + 18,
                                        top: info.jsEvent.clientY + 18,
                                    });
                                    setShowResponseActions(false);
                                }}
                                eventContent={renderCalendarEventContent}
                                eventDisplay="block"
                                eventTimeFormat={{ hour: "2-digit", minute: "2-digit", hour12: false }}
                                events={adminScopedCalendarEvents}
                                firstDay={1}
                                fixedWeekCount={true}
                                headerToolbar={false}
                                height="auto"
                                initialDate={calendarDate}
                                initialView={VIEW_CONFIG[activeViewMode].calendarView}
                                locale={esLocale}
                                nowIndicator
                                plugins={[dayGridPlugin, timeGridPlugin]}
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

                    <FilterMenuSection
                        onToggle={toggleCrmFilter}
                        options={visibleCrmFilterOptions}
                        selectedMap={crmFilters}
                        title="Mis calendarios"
                    />

                    <FilterMenuSection
                        onToggle={toggleOriginFilter}
                        options={ORIGIN_FILTER_OPTIONS}
                        selectedMap={originFilters}
                        title="Origen"
                    />

                    <FilterMenuSection
                        onToggle={toggleAdminFilter}
                        options={adminFilterOptions}
                        selectedMap={selectedAdmins}
                        title="Admins"
                    />
                </div>
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
                        className: "outlook-hover-card",
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
                            </Box>
                        )}

                        <Box className="outlook-hover-card-title-row">
                            <Typography className="outlook-hover-card-title">
                                {selectedEvent.title}
                            </Typography>
                            <Box className="outlook-hover-card-title-actions">
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
                                            Abrir vinculo
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
                                {modalEvent.title}: reunion: Calendario
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
                                            {modalEvent.extendedProps.organizer}; {modalEvent.extendedProps.attendees?.slice(0, 2).join("; ")}; y {modalEvent.extendedProps.acceptedCount} mas
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
                                        {isTeamsModalEvent ? "Reunion de Microsoft Teams" : "Detalle del evento"}
                                    </Typography>

                                    {isTeamsModalEvent ? (
                                        <>
                                            <Typography className="outlook-expanded-link">
                                                Unirse: {modalEvent.extendedProps.teamsLink || "Sin enlace disponible"}
                                            </Typography>
                                            <Typography className="outlook-expanded-meta">
                                                Id. de reunion: {modalEvent.extendedProps.meetingId || "Sin identificador"}
                                            </Typography>
                                            <Typography className="outlook-expanded-meta">
                                                Codigo de acceso: {modalEvent.extendedProps.accessCode || "No disponible"}
                                            </Typography>
                                        </>
                                    ) : (
                                        <>
                                            <Typography className="outlook-expanded-meta">
                                                Ubicacion: {modalEvent.extendedProps.location}
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
