import React, { useEffect, useRef } from "react";

import { Box, Typography } from "@mui/material";

import {
    CREATE_EVENT_PREVIEW_HOURS,
    SCHEDULE_STATUS_META,
} from "../outlookCalendarUtils";

export const OutlookCreateEventPreview = ({
    areAllParticipantsAvailable,
    createEventHeaderLabel,
    createEventPreviewPosition,
    createEventScheduleLabel,
    createEventWeekLabel,
    isLoadingScheduleAvailability,
    isOwnerAvailable,
    isPrimaryScheduleAvailable,
    isRoomAvailable,
    previewBusyBlocks,
    previewParticipants,
    scheduleAvailabilityError,
    shiftCreateEventDate,
}) => {
    const scrollContainerRef = useRef(null);

    useEffect(() => {
        const scrollNode = scrollContainerRef.current;

        if (!scrollNode) {
            return;
        }

        const previewOffset = (createEventPreviewPosition.topPercent / 100) * scrollNode.scrollHeight;
        const targetScrollTop = Math.max(previewOffset - (scrollNode.clientHeight * 0.35), 0);

        scrollNode.scrollTop = targetScrollTop;
    }, [createEventPreviewPosition.topPercent]);

    return (
        <Box className="outlook-create-preview-shell">
        <Box className="outlook-create-preview-header">
            <Box className="outlook-create-preview-nav">
                <button
                    className="outlook-create-preview-icon"
                    onClick={() => shiftCreateEventDate(-1)}
                    type="button"
                >
                    <span className="ti ti-chevron-left"></span>
                </button>
                <button className="outlook-create-preview-icon" type="button">
                    <span className="ti ti-device-desktop"></span>
                </button>
                <button
                    className="outlook-create-preview-icon"
                    onClick={() => shiftCreateEventDate(1)}
                    type="button"
                >
                    <span className="ti ti-chevron-right"></span>
                </button>
            </Box>
            <Typography className="outlook-create-preview-title">
                {createEventHeaderLabel} ({createEventWeekLabel})
            </Typography>
            <button className="outlook-create-preview-icon" type="button">
                <span className="ti ti-arrow-up-right"></span>
            </button>
        </Box>

        <Box className="outlook-create-preview-scroll" ref={scrollContainerRef}>
            <Box className="outlook-create-preview-grid">
            <Box className="outlook-create-preview-hours">
                {CREATE_EVENT_PREVIEW_HOURS.map((hourValue) => (
                    <div className="outlook-create-preview-hour" key={hourValue}>
                        <span>{hourValue}</span>
                    </div>
                ))}
            </Box>
            <Box className="outlook-create-preview-day">
                {CREATE_EVENT_PREVIEW_HOURS.map((hourValue) => (
                    <div className="outlook-create-preview-slot" key={`slot-${hourValue}`}></div>
                ))}

                {previewBusyBlocks.map((busyBlock) => (
                    <div
                        className={`outlook-create-preview-busy is-${busyBlock.status}`}
                        key={busyBlock.id}
                        style={{
                            top: `${busyBlock.topPercent}%`,
                            height: `${busyBlock.heightPercent}%`,
                        }}
                        title={`${busyBlock.timeLabel} · ${busyBlock.previewLabel}`}
                    >
                        <span className="outlook-create-preview-busy-time">{busyBlock.timeLabel}</span>
                        <span className="outlook-create-preview-busy-label">{busyBlock.previewLabel}</span>
                    </div>
                ))}

                <div
                    className={`outlook-create-preview-event ${isPrimaryScheduleAvailable ? "is-available" : "is-conflict"}`}
                    style={{
                        top: `${createEventPreviewPosition.topPercent}%`,
                        height: `${createEventPreviewPosition.heightPercent}%`,
                    }}
                >
                    <span className="outlook-create-preview-event-handle"></span>
                    <span className="outlook-create-preview-event-label">{createEventScheduleLabel}</span>
                    <span className="outlook-create-preview-event-meta">
                        {isLoadingScheduleAvailability
                            ? "Consultando..."
                            : !isOwnerAvailable
                                ? "Tienes conflicto"
                                : !isRoomAvailable
                                    ? "Sala no disponible"
                                    : "Está disponible"}
                    </span>
                    <span className="outlook-create-preview-event-handle"></span>
                </div>
            </Box>
        </Box>
        </Box>

        <Box className="outlook-create-preview-footer">
            {previewParticipants.map((participantItem) => (
                <div
                    className={`outlook-create-preview-participant is-${participantItem.status} is-${participantItem.type || "attendee"}`}
                    key={participantItem.id}
                    title={`${participantItem.displayName} · ${SCHEDULE_STATUS_META[participantItem.status]?.label || "Desconocido"}`}
                >
                    <span className="outlook-create-preview-participant-avatar">
                        {participantItem.type === "room"
                            ? <span className="ti ti-door-enter"></span>
                            : (participantItem.displayName || participantItem.email || "?").charAt(0).toUpperCase()}
                    </span>
                    <span className={`outlook-create-preview-participant-state is-${participantItem.status}`}></span>
                </div>
            ))}
        </Box>

        {scheduleAvailabilityError ? (
            <span className="outlook-create-preview-feedback is-error">{scheduleAvailabilityError}</span>
        ) : null}
        {!scheduleAvailabilityError && !isLoadingScheduleAvailability ? (
            <span className="outlook-create-preview-feedback">
                {!isOwnerAvailable
                    ? "Tienes eventos ocupados en ese horario."
                    : !isRoomAvailable
                        ? "La sala seleccionada no está disponible en ese horario."
                        : areAllParticipantsAvailable
                            ? "Todos disponibles en ese horario."
                            : "Tú estás libre, pero hay invitados no disponibles."}
            </span>
        ) : null}
        </Box>
    );
};
