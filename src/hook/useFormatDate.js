const COSTA_RICA_TIME_ZONE = "America/Costa_Rica";
const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const DATETIME_PATTERN = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?$/;

/**
 * Convierte una hora de 24h a 12h.
 *
 * @param {string} hour - Hora en formato 24h.
 * @param {string} minute - Minuto.
 * @param {string} second - Segundo.
 * @returns {string} Hora en formato 12h.
 */
const formatTimeInTwelveHourClock = (hour, minute, second) => {
    const numericHour = Number(hour);
    const normalizedHour = numericHour % 12 || 12;
    const period = numericHour >= 12 ? "PM" : "AM";

    return `${String(normalizedHour).padStart(2, "0")}:${minute}:${second} ${period}`;
};

/**
 * Formatea fecha y hora en zona horaria de Costa Rica.
 *
 * @param {string | number | Date} dateString - Fecha origen.
 * @returns {{ formattedDate: string, formattedTime: string }}
 */
export const formatDate = (dateString) => {
    if (!dateString) {
        return { formattedDate: "", formattedTime: "" };
    }

    if (typeof dateString === "string") {
        const trimmedDate = dateString.trim();

        if (DATE_ONLY_PATTERN.test(trimmedDate)) {
            return { formattedDate: trimmedDate, formattedTime: "" };
        }

        const datetimeMatch = trimmedDate.match(DATETIME_PATTERN);

        if (datetimeMatch) {
            const [, year, month, day, hour, minute, second = "00"] = datetimeMatch;

            return {
                formattedDate: `${year}-${month}-${day}`,
                formattedTime: formatTimeInTwelveHourClock(hour, minute, second),
            };
        }
    }

    const date = new Date(dateString);

    if (Number.isNaN(date.getTime())) {
        return { formattedDate: "", formattedTime: "" };
    }

    const formatter = new Intl.DateTimeFormat("en-US", {
        timeZone: COSTA_RICA_TIME_ZONE,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: true,
    });

    const parts = formatter.formatToParts(date);
    const valueByType = Object.fromEntries(parts.map(({ type, value }) => [type, value]));

    return {
        formattedDate: `${valueByType.year}-${valueByType.month}-${valueByType.day}`,
        formattedTime: `${valueByType.hour}:${valueByType.minute}:${valueByType.second} ${valueByType.dayPeriod}`,
    };
};
