export const isTodayPendingEventsView = (dataParam) => dataParam === "1" || dataParam === 1;

export const getEventListRequestRange = ({
    dataParam,
    defaultStartDate,
    defaultEndDate,
    todayDate,
}) => {
    if (isTodayPendingEventsView(dataParam)) {
        return {
            dateStart: todayDate,
            dateEnd: todayDate,
        };
    }

    return {
        dateStart: defaultStartDate,
        dateEnd: defaultEndDate,
    };
};

export const filterTodayPendingEvents = (events, dataParam, todayDate) => {
    if (!Array.isArray(events)) {
        return [];
    }

    if (!isTodayPendingEventsView(dataParam)) {
        return events;
    }

    return events.filter((item) => {
        const itemDate = typeof item?.fechaIni_calendar === "string"
            ? item.fechaIni_calendar.split("T")[0]
            : "";

        return itemDate === todayDate && item.accion_calendar === "Pendiente";
    });
};
