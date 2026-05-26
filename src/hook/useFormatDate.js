const COSTA_RICA_TIME_ZONE = "America/Costa_Rica";

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
