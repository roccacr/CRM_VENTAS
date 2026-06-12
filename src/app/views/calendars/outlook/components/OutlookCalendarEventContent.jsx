import React from "react";

import { OUTLOOK_DEFAULT_COLOR } from "../outlookCalendarUtils";

const normalizeHexColor = (colorValue) => {
    if (typeof colorValue !== "string") {
        return OUTLOOK_DEFAULT_COLOR;
    }

    const normalizedColor = colorValue.trim();

    if (!/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(normalizedColor)) {
        return OUTLOOK_DEFAULT_COLOR;
    }

    if (normalizedColor.length === 4) {
        return "#" + normalizedColor.slice(1).split("").map((char) => char + char).join("");
    }

    return normalizedColor;
};

const getEventTextColor = (hexColor) => {
    const normalizedHex = normalizeHexColor(hexColor).replace("#", "");
    const red = Number.parseInt(normalizedHex.slice(0, 2), 16);
    const green = Number.parseInt(normalizedHex.slice(2, 4), 16);
    const blue = Number.parseInt(normalizedHex.slice(4, 6), 16);
    const luminance = ((0.299 * red) + (0.587 * green) + (0.114 * blue)) / 255;

    return luminance > 0.62 ? "#163142" : "#ffffff";
};

export const renderOutlookCalendarEventContent = (eventInfo) => {
    const eventColor = normalizeHexColor(eventInfo.event.extendedProps.eventColor || OUTLOOK_DEFAULT_COLOR);
    const eventTextColor = getEventTextColor(eventColor);

    return (
        <div
            className={`outlook-event-card ${eventInfo.event.classNames.join(" ")}`}
            style={{
                "--outlook-event-accent": eventColor,
                "--outlook-event-background": eventColor,
                "--outlook-event-text": eventTextColor,
            }}
        >
            <span className="outlook-event-stripe"></span>
            <span className="outlook-event-time">{eventInfo.timeText}</span>
            <span className="outlook-event-title">{eventInfo.event.title}</span>
        </div>
    );
};
