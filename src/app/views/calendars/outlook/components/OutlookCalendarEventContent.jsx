import React from "react";

import { OUTLOOK_DEFAULT_COLOR } from "../outlookCalendarUtils";

export const renderOutlookCalendarEventContent = (eventInfo) => {
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
