/**
 * @file outlookCalendarUtils.js
 * @description Utilidades puras del calendario Outlook del CRM.
 *              Centraliza constantes de configuración, helpers de fechas,
 *              integración con Microsoft Graph (disponibilidad, sugerencias)
 *              y reglas de filtrado de eventos. Sin dependencias de React.
 */

// =============================================================================
// CONSTANTES DE UI: filtros, vistas y categorías CRM
// =============================================================================

/**
 * Opciones del filtro lateral "Mis calendarios".
 * Cada `value` debe coincidir con `extendedProps.category` en eventos FullCalendar.
 */
export const CRM_FILTER_OPTIONS = [
    { value: "categoria1", label: "Contactos" }, // Whatsapp, Correo
    { value: "categoria2", label: "Tareas" },
    { value: "categoria3", label: "Reunión" }, // Llamada, Reunion
    { value: "categoria4", label: "Seguimientos" },
    { value: "categoria5", label: "Primeras Citas" }, // Cita
];

/** Opciones para filtrar eventos por fuente de datos (CRM vs Outlook). */
export const ORIGIN_FILTER_OPTIONS = [
    { value: "crm", label: "Solo eventos CRM" },
    { value: "outlook", label: "Solo eventos Outlook" },
];

/**
 * Mapeo entre modos de vista de la UI y configuración de FullCalendar.
 * - calendarView: identificador interno de FullCalendar
 * - buttonLabel: texto del botón segmentado en toolbar
 * - buttonIcon: clase Tabler Icons del segmento
 * - metaLabel: descripción en el encabezado del calendario principal
 */
export const VIEW_CONFIG = {
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
 * Traduce el tipo de actividad del CRM (`tipo_calendar`) a categoría visual.
 * Soporta variantes con/sin tilde para tolerar inconsistencias del backend.
 */
export const CRM_CATEGORY_BY_TYPE = {
    Whatsapp: "categoria1",
    Correo: "categoria1",
    Tarea: "categoria2",
    Llamada: "categoria3",
    Reunion: "categoria3", // Sin tilde: valor legacy del CRM
    "Reunión": "categoria3",
    Seguimientos: "categoria4",
    Seguimiento: "categoria4",
    Cita: "categoria5",
};

/** Color por defecto cuando el CRM no define `color_calendar`. Paleta Outlook/CRM. */
export const OUTLOOK_DEFAULT_COLOR = "#2a5f79";

/** Estado inicial de filtros CRM: todas las categorías activas. */
export const DEFAULT_CRM_FILTERS = CRM_FILTER_OPTIONS.reduce((accumulator, option) => ({
    ...accumulator,
    [option.value]: true,
}), {});

/** Estado inicial de filtros de origen: ninguno seleccionado (muestra todo). */
export const DEFAULT_ORIGIN_FILTERS = {
    crm: false,
    outlook: false,
};

// =============================================================================
// CONSTANTES DE INTEGRACIÓN MICROSOFT GRAPH
// =============================================================================

/** Scope MSAL para buscar usuarios en el directorio (autocompletado de asistentes). */
export const OUTLOOK_PEOPLE_SCOPE = "User.ReadBasic.All";
/** Scope MSAL mínimo para leer calendarios y consultar disponibilidad. */
export const OUTLOOK_SCHEDULE_SCOPE = "Calendars.Read";
/** Scope MSAL para crear eventos en el calendario del usuario. */
export const OUTLOOK_CREATE_EVENT_SCOPE = "Calendars.ReadWrite";
/** Tamaño de página al paginar resultados de `/users` en Graph. */
export const PEOPLE_PAGE_SIZE = 25;
/** Mínimo de caracteres antes de disparar búsqueda de asistentes. */
export const PEOPLE_SEARCH_MIN_LENGTH = 2;
/** Zona horaria IANA usada en payloads `dateTimeTimeZone` de Graph. */
export const OUTLOOK_TIMEZONE = "Central America Standard Time";
/** Granularidad del barrido local de sugerencias de horario (minutos). */
export const SCHEDULE_INTERVAL_MINUTES = 30;
/** Hora de inicio visible en la vista previa del modal de creación. */
export const CREATE_EVENT_PREVIEW_START_HOUR = 0;
/** Hora de fin visible en la vista previa del modal de creación. */
export const CREATE_EVENT_PREVIEW_END_HOUR = 24;
/** Hora por defecto al abrir el modal de nuevo evento. */
export const CREATE_EVENT_DEFAULT_START_HOUR = 9;
/** Minuto por defecto al abrir el modal de nuevo evento. */
export const CREATE_EVENT_DEFAULT_START_MINUTE = 0;
/** Duración fallback si el usuario define hora fin <= hora inicio. */
export const CREATE_EVENT_DEFAULT_DURATION_MINUTES = 30;
/** Máximo de sugerencias de horario mostradas en el programador. */
export const CREATE_EVENT_SUGGESTION_LIMIT = 6;

/** Etiquetas de hora para la columna izquierda de la vista previa (7:00 … 18:00). */
export const CREATE_EVENT_PREVIEW_HOURS = Array.from(
    { length: CREATE_EVENT_PREVIEW_END_HOUR - CREATE_EVENT_PREVIEW_START_HOUR },
    (_, index) => CREATE_EVENT_PREVIEW_START_HOUR + index,
);

/**
 * Metadatos de estados de disponibilidad devueltos por Graph `getSchedule`.
 * `isAvailable: true` significa que el slot sigue siendo elegible para reunión.
 */
export const SCHEDULE_STATUS_META = {
    free: { label: "Disponible", isAvailable: true },
    workingElsewhere: { label: "En otro lugar", isAvailable: true },
    tentative: { label: "Tentativo", isAvailable: false },
    busy: { label: "Ocupado", isAvailable: false },
    oof: { label: "Fuera de oficina", isAvailable: false },
    unknown: { label: "Desconocido", isAvailable: false },
};

// =============================================================================
// HELPERS DE DIRECTORIO Y ODATA
// =============================================================================

/**
 * Escapa comillas simples para filtros OData de Microsoft Graph.
 * @param {string} value - Valor crudo del término de búsqueda
 * @returns {string} Valor seguro para interpolar en `$filter`
 */
export const escapeODataValue = (value) => value.replace(/'/g, "''");

/**
 * Normaliza un usuario de Graph (`/users`) al shape usado por Autocomplete.
 * Prioriza `mail` sobre `userPrincipalName` como email canónico.
 *
 * @param {object} userItem - Registro crudo de Graph
 * @returns {{ id: string, displayName: string, email: string }}
 */
export const normalizeDirectoryUser = (userItem) => {
    const primaryEmail = userItem.mail || userItem.userPrincipalName || "";
    const displayName = userItem.displayName || primaryEmail || "Sin nombre";

    return {
        id: userItem.id || primaryEmail || displayName,
        displayName,
        email: primaryEmail,
    };
};

/**
 * Normaliza email para comparaciones de propiedad.
 *
 * @param {string|null|undefined} emailValue - Email bruto.
 * @returns {string} Email en minúscula o string vacío.
 */
export const normalizeComparableEmail = (emailValue) => (
    typeof emailValue === "string" ? emailValue.trim().toLowerCase() : ""
);

/**
 * Convierte texto plano del textarea al HTML requerido por Microsoft Graph.
 * Graph recibe el cuerpo como HTML y, sin estas etiquetas, colapsa espacios
 * consecutivos y saltos de línea al mostrar el evento en Outlook.
 */
export const plainTextToOutlookHtml = (value) => {
    if (typeof value !== "string") {
        return "";
    }

    return value
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;")
        .replace(/\r\n?/g, "\n")
        .replace(/ /g, "&nbsp;")
        .replace(/\t/g, "&nbsp;&nbsp;&nbsp;&nbsp;")
        .replace(/\n/g, "<br />");
};

/**
 * Genera el texto breve que se muestra en la tarjeta compacta del evento.
 * El detalle completo permanece disponible en el modal expandido.
 */
export const buildEventSummaryPreview = (value, maxLength = 180) => {
    if (typeof value !== "string") {
        return "";
    }

    const compactValue = value.replace(/\s+/g, " ").trim();

    if (compactValue.length <= maxLength) {
        return compactValue;
    }

    return compactValue.slice(0, maxLength).trimEnd() + "...";
};

/**
 * Normaliza ID numérico para comparaciones de propiedad.
 *
 * @param {number|string|null|undefined} idValue - ID bruto.
 * @returns {number|null} ID válido o `null`.
 */
export const normalizeComparableId = (idValue) => {
    const parsedId = Number(idValue);

    return Number.isFinite(parsedId) && parsedId > 0 ? parsedId : null;
};

/**
 * Resuelve dueño visible del evento combinando CRM y Outlook.
 *
 * @param {object|null} crmEvent - Evento local CRM.
 * @param {object|null} outlookEvent - Evento Microsoft Graph.
 * @returns {object} Datos normalizados del dueño.
 */
export const resolveCalendarEventOwner = (crmEvent, outlookEvent) => {
    const crmOwnerId = normalizeComparableId(crmEvent?.id_admin);
    const crmOwnerName = typeof crmEvent?.name_admin === "string" ? crmEvent.name_admin.trim() : "";
    const crmOwnerEmail = normalizeComparableEmail(crmEvent?.email_admin);
    const outlookOwnerName = typeof outlookEvent?.organizer?.emailAddress?.name === "string"
        ? outlookEvent.organizer.emailAddress.name.trim()
        : "";
    const outlookOwnerEmail = normalizeComparableEmail(outlookEvent?.organizer?.emailAddress?.address);
    const displayName = crmOwnerName
        || outlookOwnerName
        || crmOwnerEmail
        || outlookOwnerEmail
        || "otro usuario";

    return {
        crmOwnerId,
        crmOwnerName,
        crmOwnerEmail,
        outlookOwnerName,
        outlookOwnerEmail,
        displayName,
    };
};

/**
 * Determina si usuario autenticado puede mover evento.
 * Regla: basta con que sea dueño CRM por ID/email o dueño Outlook por organizer email.
 *
 * @param {object} params - Contexto de validación.
 * @param {object|null} params.crmEvent - Evento CRM.
 * @param {object|null} params.outlookEvent - Evento Outlook.
 * @param {number|string|null|undefined} params.currentAdminId - ID Netsuite del admin autenticado.
 * @param {string|null|undefined} params.currentUserEmail - Email autenticado.
 * @returns {{ canMove: boolean, owner: object }} Resultado de autorización.
 */
export const canAuthenticatedUserMoveCalendarEvent = ({
    crmEvent,
    outlookEvent,
    currentAdminId,
    currentUserEmail,
}) => {
    const owner = resolveCalendarEventOwner(crmEvent, outlookEvent);
    const normalizedCurrentAdminId = normalizeComparableId(currentAdminId);
    const normalizedCurrentEmail = normalizeComparableEmail(currentUserEmail);
    const isCrmOwnerById = owner.crmOwnerId !== null
        && normalizedCurrentAdminId !== null
        && owner.crmOwnerId === normalizedCurrentAdminId;
    const isCrmOwnerByEmail = Boolean(owner.crmOwnerEmail)
        && Boolean(normalizedCurrentEmail)
        && owner.crmOwnerEmail === normalizedCurrentEmail;
    const isOutlookOwner = Boolean(owner.outlookOwnerEmail)
        && Boolean(normalizedCurrentEmail)
        && owner.outlookOwnerEmail === normalizedCurrentEmail;

    return {
        canMove: isCrmOwnerById || isCrmOwnerByEmail || isOutlookOwner,
        owner,
    };
};

/**
 * Construye mensaje visible cuando evento no pertenece al usuario autenticado.
 *
 * @param {object} owner - Resultado de `resolveCalendarEventOwner`.
 * @returns {string} Mensaje listo para Swal.
 */
export const buildCalendarMoveBlockedMessage = (owner) =>
    `Este evento no se puede mover porque pertenece a ${owner?.displayName || "otro usuario"}.`;

/**
 * Elimina un evento existente en Microsoft Graph.
 *
 * @param {string} accessToken - Token válido del usuario autenticado.
 * @param {string} outlookEventId - ID del evento en Outlook.
 * @returns {Promise<boolean>} `true` cuando Graph responde ok.
 */
export const deleteOutlookEventById = async (accessToken, outlookEventId) => {
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

/**
 * Actualiza fecha/hora de un evento existente en Microsoft Graph.
 *
 * @param {string} accessToken - Token valido del usuario autenticado.
 * @param {string} outlookEventId - ID del evento en Outlook.
 * @param {{start: Date, end: Date}} rangeValue - Nuevo rango local del evento.
 * @returns {Promise<boolean>} `true` cuando Graph responde ok.
 */
export const updateOutlookEventScheduleById = async (accessToken, outlookEventId, rangeValue) => {
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

// =============================================================================
// HELPERS DE VISTA Y FECHAS
// =============================================================================

/**
 * Infiere el modo de vista activo a partir del tipo de vista de FullCalendar.
 * Usado en `datesSet` cuando el usuario navega con flechas del calendario.
 *
 * @param {string} calendarView - Tipo FC: timeGridDay | timeGridWeek | dayGridMonth
 * @returns {"day"|"week"|"month"} Modo simplificado para estado React
 */
export const getViewModeFromCalendarView = (calendarView) => {
    if (calendarView === "timeGridDay") {
        return "day";
    }

    if (calendarView === "timeGridWeek") {
        return "week"; // workweek y week comparten timeGridWeek
    }

    return "month";
};

/** Clona un Date sin mutar el original (evita efectos colaterales en cálculos de rango). */
export const cloneDate = (value) => new Date(value.getTime());

/** Normaliza una fecha a medianoche local (00:00:00.000). */
export const startOfDay = (value) => {
    const date = cloneDate(value);
    date.setHours(0, 0, 0, 0);
    return date;
};

/** Suma días preservando hora (útil para ventanas [start, endExclusive)). */
export const addDays = (value, days) => {
    const date = cloneDate(value);
    date.setDate(date.getDate() + days);
    return date;
};

/** Suma meses; JS ajusta día si el mes destino tiene menos días (ej. 31 ene + 1 mes). */
export const addMonths = (value, months) => {
    const date = cloneDate(value);
    date.setMonth(date.getMonth() + months);
    return date;
};

/** Primer día del mes a medianoche. */
export const startOfMonth = (value) => {
    const date = startOfDay(value);
    date.setDate(1);
    return date;
};

/**
 * Inicio de semana en lunes (convención europea/LatAm).
 * Domingo (0) retrocede 6 días; resto retrocede hasta el lunes anterior.
 */
export const startOfWeekMonday = (value) => {
    const date = startOfDay(value);
    const weekDay = date.getDay();
    const diff = weekDay === 0 ? -6 : 1 - weekDay;
    date.setDate(date.getDate() + diff);
    return date;
};

/** Fin exclusivo de la semana: lunes + 7 días (domingo 00:00 del día siguiente). */
export const endOfWeekSundayExclusive = (value) => addDays(startOfWeekMonday(value), 7);

/** Compara solo componente calendario (año/mes/día), ignora hora. */
export const sameDay = (leftValue, rightValue) =>
    leftValue.getFullYear() === rightValue.getFullYear()
    && leftValue.getMonth() === rightValue.getMonth()
    && leftValue.getDate() === rightValue.getDate();

/** Indica si la fecha cae en sábado (6) o domingo (0). */
export const isWeekend = (value) => {
    const weekDay = value.getDay();
    return weekDay === 0 || weekDay === 6;
};

/** Título del mes para sidebar y header (ej. "junio de 2026"). */
export const getMonthTitle = (value) => new Intl.DateTimeFormat("es-CR", {
    month: "long",
    year: "numeric",
}).format(value);

/** Etiqueta compacta de fecha para encabezados (ej. "mié, 10 jun 2026"). */
export const getHeaderDateLabel = (value) => new Intl.DateTimeFormat("es-CR", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
}).format(value);

/**
 * Formatea hora y minuto con cero a la izquierda (ej. 09:05).
 * @param {number} hours
 * @param {number} minutes
 */
export const formatHourMinuteLabel = (hours, minutes) =>
    `${`${hours}`.padStart(2, "0")}:${`${minutes}`.padStart(2, "0")}`;

/**
 * Calcula la ventana visible que FullCalendar debe renderizar según el modo.
 * El `end` es exclusivo: primer instante fuera del rango visible.
 *
 * @param {"day"|"week"|"workweek"|"month"} viewMode
 * @param {Date} anchorDate - Fecha ancla (día seleccionado o visible)
 * @returns {{ start: Date, end: Date }}
 */
export const buildVisibleWindow = (viewMode, anchorDate) => {
    // Vista día: un solo día [00:00, 00:00 del día siguiente)
    if (viewMode === "day") {
        const start = startOfDay(anchorDate);
        return { start, end: addDays(start, 1) };
    }

    // Vista semana / semana laboral: 7 días desde el lunes de la semana ancla
    if (viewMode === "workweek" || viewMode === "week") {
        const start = startOfWeekMonday(anchorDate);
        return { start, end: addDays(start, 7) };
    }

    // Vista mes: rejilla de 5 semanas (35 días) alineada al lunes del mes
    const start = startOfWeekMonday(startOfMonth(anchorDate));
    return { start, end: addDays(start, 35) };
};

/**
 * Formato ISO date-only para inputs `<input type="date">`.
 * @param {Date} value
 * @returns {string} YYYY-MM-DD
 */
export const formatDateInputValue = (value) => {
    const yearValue = value.getFullYear();
    const monthValue = `${value.getMonth() + 1}`.padStart(2, "0");
    const dayValue = `${value.getDate()}`.padStart(2, "0");

    return `${yearValue}-${monthValue}-${dayValue}`;
};

/**
 * Descompone un string "HH:mm" en partes numéricas.
 * Tolera valores vacíos devolviendo 0:0.
 *
 * @param {string} value
 * @returns {{ hours: number, minutes: number }}
 */
export const parseTimeValueToParts = (value) => {
    const [rawHours = "0", rawMinutes = "0"] = `${value || "0:0"}`.split(":");

    return {
        hours: Number(rawHours),
        minutes: Number(rawMinutes),
    };
};

/** Formatea horas y minutos al formato "HH:mm" usado por selects del programador. */
export const formatTimeValue = (hours, minutes) =>
    `${`${hours}`.padStart(2, "0")}:${`${minutes}`.padStart(2, "0")}`;

/**
 * Suma minutos a un valor "HH:mm" respetando overflow de hora.
 * Usa fecha ficticia 2000-01-01 para delegar aritmética a Date.
 *
 * @param {string} value - Hora base "HH:mm"
 * @param {number} minutesToAdd
 */
export const addMinutesToTimeValue = (value, minutesToAdd) => {
    const { hours, minutes } = parseTimeValueToParts(value);
    const baseDate = new Date(2000, 0, 1, hours, minutes, 0, 0);
    baseDate.setMinutes(baseDate.getMinutes() + minutesToAdd);

    return formatTimeValue(baseDate.getHours(), baseDate.getMinutes());
};

/**
 * Combina fecha (YYYY-MM-DD) y hora (HH:mm) en un Date local.
 * @param {string} dateValue
 * @param {string} timeValue
 */
export const buildDateFromInputParts = (dateValue, timeValue) => {
    const baseDate = new Date(`${dateValue}T00:00:00`);
    const { hours, minutes } = parseTimeValueToParts(timeValue);
    baseDate.setHours(hours, minutes, 0, 0);
    return baseDate;
};

/**
 * Construye el rango { start, end } del evento en creación a partir de inputs del formulario.
 * Si fin <= inicio, aplica duración por defecto para evitar rangos inválidos en Graph.
 *
 * @param {string} dateValue - YYYY-MM-DD
 * @param {string} startTimeValue - HH:mm
 * @param {string} endTimeValue - HH:mm
 */
export const buildCreateEventScheduleRange = (dateValue, startTimeValue, endTimeValue) => {
    const startDate = buildDateFromInputParts(dateValue, startTimeValue);
    let endDate = buildDateFromInputParts(dateValue, endTimeValue);

    if (endDate <= startDate) {
        endDate = new Date(startDate.getTime() + (CREATE_EVENT_DEFAULT_DURATION_MINUTES * 60000));
    }

    return {
        start: startDate,
        end: endDate,
    };
};

/** Título de la vista previa del modal (fecha con primera letra en mayúscula). */
export const formatCreateEventPreviewTitle = (value) => {
    const dateLabel = new Intl.DateTimeFormat("es-CR", {
        weekday: "short",
        day: "2-digit",
        month: "short",
        year: "numeric",
    }).format(value);

    return dateLabel.charAt(0).toUpperCase() + dateLabel.slice(1);
};

/**
 * Resumen legible del rango seleccionado en el formulario de creación.
 * Ej: "mié, 10/06/2026, de 09:00 a 09:30"
 */
export const formatCreateEventDateTimeLabel = (rangeValue) => {
    const dateLabel = new Intl.DateTimeFormat("es-CR", {
        weekday: "short",
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
    }).format(rangeValue.start);

    return `${dateLabel}, de ${formatHourMinuteLabel(
        rangeValue.start.getHours(),
        rangeValue.start.getMinutes(),
    )} a ${formatHourMinuteLabel(rangeValue.end.getHours(), rangeValue.end.getMinutes())}`;
};

/**
 * Genera un identificador único para idempotencia al crear eventos vía Graph.
 * Graph usa `transactionId` para evitar duplicados en reintentos de red.
 */
export const buildEventTransactionId = () =>
    `crm-ventas-${Date.now()}-${Math.random().toString(16).slice(2)}`;

/**
 * Etiqueta compacta para cada sugerencia de horario en el programador.
 * Incluye fecha, rango horario y duración en minutos.
 */
export const formatMeetingSuggestionLabel = (rangeValue) => {
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

/**
 * Serializa Date local al formato `dateTime` que espera Microsoft Graph.
 * No incluye offset; la zona se envía por separado en `timeZone`.
 *
 * @param {Date} value
 * @returns {string} YYYY-MM-DDTHH:mm:ss
 */
export const toGraphDateTime = (value) => {
    const yearValue = value.getFullYear();
    const monthValue = `${value.getMonth() + 1}`.padStart(2, "0");
    const dayValue = `${value.getDate()}`.padStart(2, "0");
    const hourValue = `${value.getHours()}`.padStart(2, "0");
    const minuteValue = `${value.getMinutes()}`.padStart(2, "0");
    const secondValue = `${value.getSeconds()}`.padStart(2, "0");

    return `${yearValue}-${monthValue}-${dayValue}T${hourValue}:${minuteValue}:${secondValue}`;
};

// =============================================================================
// DISPONIBILIDAD Y SUGERENCIAS DE HORARIO (Microsoft Graph getSchedule)
// =============================================================================

/**
 * Normaliza el status crudo de Graph a una clave conocida en SCHEDULE_STATUS_META.
 * Cualquier valor no reconocido cae en `unknown`.
 */
export const normalizeScheduleStatus = (statusValue) => {
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

/**
 * Determina si un bloque de agenda intersecta el rango candidato de reunión.
 * Convención de intervalo semiabierto: [rangeStart, rangeEnd).
 */
export const intersectsScheduleRange = (rangeStart, rangeEnd, itemStart, itemEnd) =>
    itemStart < rangeEnd && itemEnd > rangeStart;

/**
 * Prioridad de severidad del estado de disponibilidad.
 * Mayor número = más restrictivo; se usa para resolver conflictos superpuestos.
 */
export const getScheduleStatusPriority = (statusValue) => {
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

/**
 * Calcula el estado agregado de un participante para un rango dado.
 * Si hay varios bloques superpuestos, gana el más restrictivo (mayor prioridad).
 *
 * @param {object|null} scheduleInfo - Entrada de `getSchedule` para un email
 * @param {{ start: Date, end: Date }} rangeValue - Ventana candidata
 * @returns {keyof SCHEDULE_STATUS_META}
 */
export const getParticipantAvailabilityStatus = (scheduleInfo, rangeValue) => {
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

    // Sin bloques en conflicto: el participante está libre en ese slot
    if (!overlappingStatuses.length) {
        return "free";
    }

    // Resolver colisión múltiple quedándose con el estado más restrictivo
    return overlappingStatuses.sort((leftValue, rightValue) => (
        getScheduleStatusPriority(rightValue) - getScheduleStatusPriority(leftValue)
    ))[0];
};

/**
 * Convierte la respuesta de `getSchedule` en bloques visuales para la vista previa.
 * Solo renderiza ítems no disponibles, recortados al rango 7:00–18:00 del día seleccionado.
 *
 * @param {Array} scheduleCollection - Colección devuelta por Graph
 * @param {{ start: Date, end: Date }} rangeValue - Día ancla del evento
 * @param {string} [focusEmail] - Si se provee, filtra a un solo participante
 * @returns {Array} Bloques con posición porcentual para CSS absolute
 */
export const buildPreviewBusyBlocks = (scheduleCollection, rangeValue, focusEmail = "") => {
    const previewDayStart = startOfDay(rangeValue.start);
    previewDayStart.setHours(CREATE_EVENT_PREVIEW_START_HOUR, 0, 0, 0);

    const previewDayEnd = startOfDay(rangeValue.start);
    previewDayEnd.setHours(CREATE_EVENT_PREVIEW_END_HOUR, 0, 0, 0);

    const normalizedFocusEmail = focusEmail.trim().toLowerCase();

    return scheduleCollection
        .filter((scheduleInfo) => {
            if (!normalizedFocusEmail) {
                return true;
            }

            const scheduleEmail = (scheduleInfo?.requestedEmail || scheduleInfo?.scheduleId || "").toLowerCase();

            return scheduleEmail === normalizedFocusEmail;
        })
        .flatMap((scheduleInfo) => {
            const scheduleItems = Array.isArray(scheduleInfo?.scheduleItems) ? scheduleInfo.scheduleItems : [];

            return scheduleItems
                .map((scheduleItem) => {
                    const normalizedStatus = normalizeScheduleStatus(scheduleItem.status);

                    // Omitir bloques que no impiden agendar (libre / en otro lugar)
                    if (SCHEDULE_STATUS_META[normalizedStatus]?.isAvailable) {
                        return null;
                    }

                    const itemStart = new Date(scheduleItem?.start?.dateTime || "");
                    const itemEnd = new Date(scheduleItem?.end?.dateTime || "");

                    if (Number.isNaN(itemStart.getTime()) || Number.isNaN(itemEnd.getTime())) {
                        return null;
                    }

                    // Recortar al viewport de la vista previa para calcular % de altura/top
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
                        id: `${scheduleInfo.scheduleId}-${scheduleItem.start?.dateTime}-${scheduleItem.end?.dateTime}-${normalizedStatus}`,
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

/**
 * Construye el objeto de sugerencia listo para renderizar en el programador.
 * @param {{ start: Date, end: Date }} rangeValue
 * @param {Record<string, string>} participantStatuses - email → status
 * @param {string} suggestionReason - Texto explicativo opcional
 */
export const buildSuggestionItemFromRange = (rangeValue, participantStatuses = {}, suggestionReason = "") => {
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

/**
 * Ventana horaria del día usada para barrer sugerencias locales (7:00–18:00).
 * @param {{ start: Date, end: Date }} rangeValue
 */
export const buildSuggestionSearchWindow = (rangeValue) => {
    const start = startOfDay(rangeValue.start);
    start.setHours(CREATE_EVENT_PREVIEW_START_HOUR, 0, 0, 0);

    const end = startOfDay(rangeValue.start);
    end.setHours(CREATE_EVENT_PREVIEW_END_HOUR, 0, 0, 0);

    return { start, end };
};

/**
 * Genera sugerencias de horario en cliente cuando Graph no devuelve `findMeetingTimes`.
 * Recorre el día en pasos de SCHEDULE_INTERVAL_MINUTES y conserva slots donde
 * todos los asistentes están disponibles.
 *
 * @param {Array} scheduleCollection - Respuesta de getSchedule
 * @param {{ start: Date, end: Date }} baseRange - Duración deseada del evento
 * @param {string[]} participantEmails - Emails en minúsculas
 * @returns {Array} Hasta CREATE_EVENT_SUGGESTION_LIMIT sugerencias
 */
export const buildLocalMeetingSuggestions = (scheduleCollection, baseRange, participantEmails) => {
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

// =============================================================================
// MINI-CALENDARIO LATERAL
// =============================================================================

/**
 * Número de semana ISO 8601 para la columna de números del mini-calendario.
 * @param {Date} value
 */
export const getIsoWeekNumber = (value) => {
    const date = startOfDay(value);
    // Jueves de la semana define el año ISO
    date.setDate(date.getDate() + 4 - (date.getDay() || 7));
    const yearStart = new Date(date.getFullYear(), 0, 1);

    return Math.ceil((((date - yearStart) / 86400000) + 1) / 7);
};

/**
 * Construye 5 filas × 7 días para el mini-calendario lateral.
 * Siempre 5 semanas para altura estable del sidebar.
 *
 * @param {Date} value - Mes visible
 * @returns {Array<{ weekNumber: number, days: Date[] }>}
 */
export const buildMiniCalendarWeeks = (value) => {
    const monthStart = startOfMonth(value);
    const gridStart = startOfWeekMonday(monthStart); // Puede incluir días del mes anterior
    const weeks = [];

    for (let weekIndex = 0; weekIndex < 5; weekIndex += 1) {
        const weekStart = addDays(gridStart, weekIndex * 7);
        const days = [];

        for (let dayIndex = 0; dayIndex < 7; dayIndex += 1) {
            days.push(addDays(weekStart, dayIndex));
        }

        weeks.push({
            weekNumber: getIsoWeekNumber(weekStart),
            days,
        });
    }

    return weeks;
};

// =============================================================================
// CATEGORIZACIÓN Y FILTRADO DE EVENTOS
// =============================================================================

/**
 * Resuelve la categoría visual de un evento CRM a partir de `tipo_calendar`.
 * Fallback a seguimientos si el tipo no está mapeado.
 */
export const deriveCrmCategory = (tipoCalendar) => CRM_CATEGORY_BY_TYPE[tipoCalendar] || "categoria4";

/**
 * Devuelve solo las categorías CRM que tienen al menos un evento en el rango cargado.
 * Evita mostrar checkboxes vacíos en el menú de filtros.
 *
 * @param {Array} events - Eventos FullCalendar ya mapeados
 */
export const buildVisibleCrmFilterOptions = (events) => {
    const categoryMap = new Map();

    events.forEach((eventItem) => {
        const categoryValue = eventItem?.extendedProps?.category;
        const categoryOption = CRM_FILTER_OPTIONS.find((option) => option.value === categoryValue);

        if (!categoryOption || categoryMap.has(categoryOption.value)) {
            return;
        }

        categoryMap.set(categoryOption.value, categoryOption);
    });

    return CRM_FILTER_OPTIONS.filter((option) => categoryMap.has(option.value));
};

/**
 * Evalúa si un evento pasa el filtro de origen (crm | outlook | merged).
 * Sin selección activa se muestran todos los orígenes.
 */
export const shouldKeepEventByOrigin = (source, originFilters) => {
    const hasOriginSelection = Object.values(originFilters).some(Boolean);

    if (!hasOriginSelection) {
        return true;
    }

    return originFilters[source] === true;
};

/**
 * Evalúa si un evento pasa el filtro de categoría CRM.
 * Categorías desconocidas o no listadas no se excluyen.
 */
export const shouldKeepEventByCategory = (eventItem, crmFilters) => {
    const categoryKey = eventItem?.extendedProps?.category;

    if (!categoryKey || !(categoryKey in crmFilters)) {
        return true;
    }

    return crmFilters[categoryKey] === true;
};

/**
 * Evalúa si un evento pasa el filtro por admin/asesor.
 * Si hay admins seleccionados, eventos sin `adminFilterKey` se ocultan.
 */
export const shouldKeepEventByAdmin = (eventItem, selectedAdmins) => {
    const hasAdminSelection = Object.values(selectedAdmins).some(Boolean);

    if (!hasAdminSelection) {
        return true;
    }

    const adminKey = eventItem?.extendedProps?.adminFilterKey;

    if (!adminKey) {
        return false;
    }

    return selectedAdmins[adminKey] === true;
};

/**
 * Construye opciones únicas de filtro por admin a partir de los eventos cargados.
 * Orden alfabético en español para UX predecible.
 *
 * @param {Array} events
 * @returns {Array<{ value: string, label: string }>}
 */
export const buildAdminFilterOptions = (events) => {
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

/**
 * Cuenta filtros activos para el badge "Filtro aplicado (N)" del toolbar.
 * Suma categorías desmarcadas visibles + orígenes seleccionados + admins seleccionados.
 */
export const countActiveFilters = (crmFilters, originFilters, selectedAdmins, visibleCrmOptions) => {
    const visibleCrmFilterValues = new Set(visibleCrmOptions.map((option) => option.value));
    const disabledCrmFilterCount = Object.entries(crmFilters).filter(
        ([filterKey, isSelected]) => visibleCrmFilterValues.has(filterKey) && !isSelected,
    ).length;

    return disabledCrmFilterCount
        + Object.values(originFilters).filter(Boolean).length
        + Object.values(selectedAdmins).filter(Boolean).length;
};


