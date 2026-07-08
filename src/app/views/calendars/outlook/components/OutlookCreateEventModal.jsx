import React from "react";

import {
    Autocomplete,
    Box,
    CircularProgress,
    ClickAwayListener,
    Dialog,
    DialogContent,
    TextField,
    Typography,
} from "@mui/material";

import { SCHEDULE_STATUS_META } from "../outlookCalendarUtils";
import { OutlookCreateEventPreview } from "./OutlookCreateEventPreview";

const CREATE_EVENT_TYPE_ICON_MAP = {
    Cita: "ti ti-calendar-event",
    Correo: "ti ti-mail",
    Llamada: "ti ti-phone-call",
    Reunion: "ti ti-users",
    Seguimientos: "ti ti-history",
    Tarea: "ti ti-checks",
    Whatsapp: "ti ti-brand-whatsapp",
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;

const normalizeCustomAttendeeOption = (optionValue) => {
    if (typeof optionValue !== "string") {
        return optionValue;
    }

    const normalizedEmail = optionValue.trim().toLowerCase();

    if (!EMAIL_PATTERN.test(normalizedEmail)) {
        return null;
    }

    return {
        id: normalizedEmail,
        displayName: normalizedEmail,
        email: normalizedEmail,
        source: "manual",
    };
};

export const OutlookCreateEventModal = ({
    applyMeetingSuggestion,
    areAllParticipantsAvailable,
    attendeeAvailabilityStatuses,
    attendeeDirectoryError,
    attendeeDirectoryOptions,
    attendeeSearchText,
    canShowEditStatusActions,
    canShowReactivateAction,
    closeCreateEventModal,
    closeRoomSuggestions,
    createEventCalendarLabel,
    createEventDateValue,
    createEventDateTimeLabel,
    createEventDescription,
    createEventEndTimeOptions,
    createEventEndTimeValue,
    createEventHeaderLabel,
    createEventLeadId,
    createEventLeadEmail,
    createEventLeadLabel,
    createEventLeadOptions,
    createEventLeadOptionsError,
    createEventMode,
    createEventLocation,
    createEventMinimumDateValue,
    createEventPreviewPosition,
    createEventProjectId,
    createEventProjectLabel,
    createEventProjectOptions,
    createEventProjectOptionsError,
    createEventScheduleLabel,
    createEventScheduleRange,
    createEventStartTimeValue,
    createEventSubmitError,
    createEventSubmitLabel,
    createEventTimeOptions,
    createEventTitle,
    createEventType,
    createEventTypeOptions,
    createEventWeekLabel,
    createEventWindowTitle,
    handleCreateEventDateChange,
    handleCreateEventEndTimeChange,
    handleCreateEventLeadToggle,
    handleCreateEventLocationChange,
    handleCreateEventStartTimeChange,
    handleCreateEventTypeChange,
    handleCancelCalendarEvent,
    handleCompleteCalendarEvent,
    handleReactivateCalendarEvent,
    handleSubmitOutlookEvent,
    handleSelectRoomOption,
    clearSelectedRoomOption,
    hasCreateEventTitle,
    hasMoreRoomSuggestions,
    hasTouchedCreateEventTitle,
    isLeadAssignmentLocked,
    isCreateEventLeadEnabled,
    isLeadInvitationEnabled,
    isCreateEventModalOpen,
    isCreateTeamsMeeting,
    isLoadingAttendeeDirectory,
    isLoadingCreateEventLeadOptions,
    isLoadingCreateEventProjectOptions,
    isLoadingMeetingSuggestions,
    isLoadingRoomAvailability,
    isLoadingRoomDirectory,
    isLoadingScheduleAvailability,
    isUpdatingEventStatus,
    isOwnerAvailable,
    isPrimaryScheduleAvailable,
    isRoomAvailable,
    isRoomSuggestionsOpen,
    isSavingCreateEvent,
    isScheduleEditorOpen,
    meetingSuggestions,
    meetingSuggestionsError,
    openAttendeeSuggestions,
    openRoomSuggestions,
    previewBusyBlocks,
    previewParticipants,
    roomDirectoryError,
    roomSearchText,
    roomSuggestionOptions,
    roomSuggestionSearchValue,
    scheduleAvailabilityError,
    selectedAttendees,
    selectedRoomOption,
    setAttendeeSearchText,
    setCreateEventDescription,
    setCreateEventLeadId,
    setCreateEventProjectId,
    setCreateEventTitle,
    setHasTouchedCreateEventTitle,
    setIsCreateTeamsMeeting,
    setIsLeadInvitationEnabled,
    setIsScheduleEditorOpen,
    setSelectedAttendees,
    setShowAllRoomSuggestions,
    shouldShowCreateEventLeadSelect,
    shouldShowCreateEventProjectSelect,
    shiftCreateEventDate,
    toGraphDateTime,
}) => {
    const [isEventTypeDropdownOpen, setIsEventTypeDropdownOpen] = React.useState(false);
    const [isProjectDropdownOpen, setIsProjectDropdownOpen] = React.useState(false);
    const [isLeadDropdownOpen, setIsLeadDropdownOpen] = React.useState(false);
    const [leadSearchText, setLeadSearchText] = React.useState("");
    const [projectSearchText, setProjectSearchText] = React.useState("");

    const selectedEventTypeOption = createEventTypeOptions.find((option) => option.value === createEventType) || null;
    const selectedEventTypeLabel = selectedEventTypeOption?.label || "";
    const selectedEventTypeIconClass = CREATE_EVENT_TYPE_ICON_MAP[createEventType] || "ti ti-calendar-event";
    const filteredCreateEventLeadOptions = React.useMemo(() => {
        const normalizedSearch = leadSearchText.trim().toLowerCase();

        if (!normalizedSearch) {
            return createEventLeadOptions;
        }

        return createEventLeadOptions.filter((leadOption) => (
            leadOption.label?.toLowerCase().includes(normalizedSearch)
        ));
    }, [createEventLeadOptions, leadSearchText]);
    const filteredCreateEventProjectOptions = React.useMemo(() => {
        const normalizedSearch = projectSearchText.trim().toLowerCase();

        if (!normalizedSearch) {
            return createEventProjectOptions;
        }

        return createEventProjectOptions.filter((projectOption) => (
            projectOption.label?.toLowerCase().includes(normalizedSearch)
        ));
    }, [createEventProjectOptions, projectSearchText]);

    React.useEffect(() => {
        setLeadSearchText(createEventLeadLabel || "");
    }, [createEventLeadLabel, shouldShowCreateEventLeadSelect]);

    React.useEffect(() => {
        setProjectSearchText(createEventProjectLabel || "");
    }, [createEventProjectLabel, shouldShowCreateEventProjectSelect]);

    const handleSelectEventType = (nextEventType) => {
        handleCreateEventTypeChange(nextEventType);
        setIsEventTypeDropdownOpen(false);
    };

    const closeAllCreateEventDropdowns = () => {
        setIsEventTypeDropdownOpen(false);
        setIsProjectDropdownOpen(false);
        setIsLeadDropdownOpen(false);
    };

    return (
        <Dialog
        PaperProps={{ className: "outlook-create-modal" }}
        fullWidth
        maxWidth="xl"
        onClose={() => {
            closeAllCreateEventDropdowns();
            closeCreateEventModal();
        }}
        open={isCreateEventModalOpen}
    >
        <DialogContent className="outlook-create-modal-content">
            <Box className="outlook-create-topbar">
                <Typography className="outlook-create-window-title">
                    {createEventWindowTitle}
                </Typography>
                <Box className="outlook-create-window-actions">
                    <button className="outlook-create-window-icon" type="button">
                        <span className="ti ti-arrow-up-right"></span>
                    </button>
                    <button className="outlook-create-window-icon" onClick={closeCreateEventModal} type="button">
                        <span className="ti ti-x"></span>
                    </button>
                </Box>
            </Box>

            <Box className="outlook-create-toolbar">
                <Box className="outlook-create-toolbar-left">
                    <button
                        className="outlook-create-save"
                        disabled={!hasCreateEventTitle || isSavingCreateEvent || isUpdatingEventStatus}
                        onClick={handleSubmitOutlookEvent}
                        type="button"
                    >
                        <span className="ti ti-device-floppy"></span>
                        {isSavingCreateEvent
                            ? createEventMode === "edit" ? "Guardando cambios..." : "Guardando..."
                            : createEventSubmitLabel}
                    </button>

                    {canShowEditStatusActions && (
                        <>
                            <button
                                className="outlook-create-status-button is-cancel"
                                disabled={isSavingCreateEvent || isUpdatingEventStatus}
                                onClick={handleCancelCalendarEvent}
                                type="button"
                            >
                                {isUpdatingEventStatus ? "Procesando..." : "Cancelar Evento"}
                            </button>
                            <button
                                className="outlook-create-status-button is-complete"
                                disabled={isSavingCreateEvent || isUpdatingEventStatus}
                                onClick={handleCompleteCalendarEvent}
                                type="button"
                            >
                                {isUpdatingEventStatus ? "Procesando..." : "Completar Evento"}
                            </button>
                        </>
                    )}

                    {canShowReactivateAction && (
                        <button
                            className="outlook-create-status-button is-complete"
                            disabled={isSavingCreateEvent || isUpdatingEventStatus}
                            onClick={handleReactivateCalendarEvent}
                            type="button"
                        >
                            {isUpdatingEventStatus ? "Procesando..." : "Reactivar Evento"}
                        </button>
                    )}
                </Box>
            </Box>

            {createEventSubmitError ? (
                <span className="outlook-create-submit-error">{createEventSubmitError}</span>
            ) : null}

            <Box className="outlook-create-grid">
                <Box className="outlook-create-form-shell">
                    <Box className="outlook-create-form-card">
                        <Box className="outlook-create-field-row">
                            <span className="outlook-create-leading-dot"></span>
                            <button className="outlook-create-calendar-select" type="button">
                                Calendario ({createEventCalendarLabel})
                                <span className="ti ti-chevron-down"></span>
                            </button>
                        </Box>

                        <Box className="outlook-create-field-row is-title-row">
                            <button className="outlook-create-side-icon" type="button">
                                <span className="ti ti-target-arrow"></span>
                            </button>
                            <div className="outlook-create-line-field">
                                <input
                                    className={`outlook-create-title-input ${hasTouchedCreateEventTitle && !hasCreateEventTitle ? "is-invalid" : ""}`}
                                    onBlur={() => setHasTouchedCreateEventTitle(true)}
                                    onChange={(event) => setCreateEventTitle(event.target.value)}
                                    placeholder="Agregar título"
                                    required
                                    type="text"
                                    value={createEventTitle}
                                />
                                {hasTouchedCreateEventTitle && !hasCreateEventTitle ? (
                                    <span className="outlook-create-field-help">El título es obligatorio.</span>
                                ) : null}
                            </div>
                        </Box>

                        <Box className="outlook-create-field-row is-attendees-row">
                            <span className="ti ti-users outlook-create-row-icon"></span>
                            <div className="outlook-create-line-field outlook-create-attendees-field">
                                <Autocomplete
                                    blurOnSelect={false}
                                    clearOnBlur={false}
                                    disableCloseOnSelect
                                    freeSolo
                                    filterOptions={(options) => options}
                                    filterSelectedOptions
                                    getOptionLabel={(option) => option.displayName || option.email || ""}
                                    groupBy={() => "results"}
                                    includeInputInList
                                    inputValue={attendeeSearchText}
                                    isOptionEqualToValue={(option, value) => option.id === value.id}
                                    loading={isLoadingAttendeeDirectory}
                                    multiple
                                    noOptionsText={openAttendeeSuggestions ? attendeeDirectoryError || "Sin coincidencias" : ""}
                                    onChange={(event, newValue) => {
                                        const normalizedAttendees = (newValue || [])
                                            .map(normalizeCustomAttendeeOption)
                                            .filter(Boolean);

                                        setSelectedAttendees(normalizedAttendees);
                                        setAttendeeSearchText("");
                                    }}
                                    onInputChange={(event, newInputValue, reason) => {
                                        if (reason === "reset") {
                                            setAttendeeSearchText("");
                                            return;
                                        }

                                        setAttendeeSearchText(newInputValue || "");
                                    }}
                                    open={openAttendeeSuggestions}
                                    options={attendeeDirectoryOptions}
                                    slotProps={{
                                        paper: { className: "outlook-create-attendee-paper" },
                                        popper: { className: "outlook-create-attendee-popper" },
                                    }}
                                    renderInput={(params) => (
                                        <TextField
                                            {...params}
                                            placeholder="Invite a los asistentes obligatorios"
                                            variant="standard"
                                            InputProps={{
                                                ...params.InputProps,
                                                disableUnderline: true,
                                                endAdornment: (
                                                    <>
                                                        {isLoadingAttendeeDirectory ? <CircularProgress color="inherit" size={16} /> : null}
                                                        {params.InputProps.endAdornment}
                                                    </>
                                                ),
                                            }}
                                        />
                                    )}
                                    renderOption={(props, option) => (
                                        <li {...props} className="outlook-create-attendee-option-item" key={option.id}>
                                            <div className="outlook-create-attendee-option">
                                                <span className="outlook-create-attendee-option-avatar">
                                                    {(option.displayName || option.email || "?").charAt(0).toUpperCase()}
                                                </span>
                                                <div className="outlook-create-attendee-option-texts">
                                                    <span className="outlook-create-attendee-option-name">{option.displayName}</span>
                                                    <span className="outlook-create-attendee-option-email">{option.email}</span>
                                                </div>
                                            </div>
                                        </li>
                                    )}
                                    renderGroup={(params) => (
                                        <div key={params.key}>
                                            <ul className="outlook-create-attendee-options-list">{params.children}</ul>
                                        </div>
                                    )}
                                    renderTags={(value, getTagProps) =>
                                        value.map((option, index) => {
                                            const { key, onDelete, ...tagProps } = getTagProps({ index });
                                            const attendeeEmail = option?.email?.trim().toLowerCase() || "";
                                            const attendeeStatus = attendeeAvailabilityStatuses[attendeeEmail] || "unknown";

                                            return (
                                                <div
                                                    {...tagProps}
                                                    className={`outlook-create-attendee-tag is-${attendeeStatus}`}
                                                    key={key}
                                                >
                                                    <span className="outlook-create-attendee-tag-avatar">
                                                        {(option.displayName || option.email || "?").charAt(0).toUpperCase()}
                                                    </span>
                                                    <div className="outlook-create-attendee-tag-texts">
                                                        <span className="outlook-create-attendee-tag-name">{option.displayName}</span>
                                                        <span className={`outlook-create-attendee-tag-status is-${attendeeStatus}`}>
                                                            {SCHEDULE_STATUS_META[attendeeStatus]?.label || "Desconocido"}
                                                        </span>
                                                    </div>
                                                    <button
                                                        aria-label={`Quitar a ${option.displayName || option.email || "asistente"}`}
                                                        className="outlook-create-attendee-tag-remove"
                                                        onClick={onDelete}
                                                        type="button"
                                                    >
                                                        <span className="ti ti-x"></span>
                                                    </button>
                                                </div>
                                            );
                                        })
                                    }
                                    size="small"
                                    value={selectedAttendees}
                                />
                            </div>
                            <button className="outlook-create-inline-icon" type="button">
                                <span className="ti ti-user-plus"></span>
                            </button>
                            <button className="outlook-create-inline-icon" type="button">
                                <span className="ti ti-chevron-down"></span>
                            </button>
                        </Box>

                        <div className="outlook-create-scheduler-anchor">
                            <Box
                                className="outlook-create-field-row is-schedule-summary-row"
                                onClick={() => setIsScheduleEditorOpen((currentValue) => !currentValue)}
                            >
                                <span className="ti ti-clock outlook-create-row-icon"></span>
                                <div className="outlook-create-line-field">
                                    <span className="outlook-create-line-value">{createEventDateTimeLabel}</span>
                                </div>
                                <button
                                    className="outlook-create-inline-text"
                                    onClick={(event) => {
                                        event.stopPropagation();
                                        setIsScheduleEditorOpen((currentValue) => !currentValue);
                                    }}
                                    type="button"
                                >
                                    <span className="ti ti-calendar-time"></span>
                                    Programador
                                </button>
                            </Box>

                            {isScheduleEditorOpen ? (
                                <Box className="outlook-create-scheduler-panel">
                                    <div className="outlook-create-scheduler-panel-inner">
                                        <div className="outlook-create-scheduler-fields">
                                            <label className="outlook-create-scheduler-field">
                                                <span className="outlook-create-scheduler-label">Fecha de inicio</span>
                                                <input
                                            className="outlook-create-scheduler-input"
                                            min={createEventMinimumDateValue}
                                            onChange={(event) => handleCreateEventDateChange(event.target.value)}
                                            type="date"
                                            value={createEventDateValue}
                                                />
                                            </label>

                                            <label className="outlook-create-scheduler-field">
                                                <span className="outlook-create-scheduler-label">Hora de inicio</span>
                                                <select
                                                    className="outlook-create-scheduler-select"
                                                    onChange={(event) => handleCreateEventStartTimeChange(event.target.value)}
                                                    value={createEventStartTimeValue}
                                                >
                                                    {createEventTimeOptions.map((option) => (
                                                        <option key={option.value} value={option.value}>{option.label}</option>
                                                    ))}
                                                </select>
                                            </label>

                                            <label className="outlook-create-scheduler-field">
                                                <span className="outlook-create-scheduler-label">Hora de finalización</span>
                                                <select
                                                    className="outlook-create-scheduler-select"
                                                    onChange={(event) => handleCreateEventEndTimeChange(event.target.value)}
                                                    value={createEventEndTimeValue}
                                                >
                                                    {createEventEndTimeOptions.map((option) => (
                                                        <option key={option.value} value={option.value}>{option.label}</option>
                                                    ))}
                                                </select>
                                            </label>
                                        </div>

                                        <div className="outlook-create-scheduler-suggestions">
                                            <div className="outlook-create-scheduler-suggestions-header">
                                                <span className="ti ti-calendar-event"></span>
                                                <span>Sugerencias de hora</span>
                                            </div>

                                            {isLoadingMeetingSuggestions ? (
                                                <span className="outlook-create-scheduler-feedback">Buscando sugerencias...</span>
                                            ) : null}

                                            {!isLoadingMeetingSuggestions && meetingSuggestionsError ? (
                                                <span className="outlook-create-scheduler-feedback is-error">{meetingSuggestionsError}</span>
                                            ) : null}

                                            {!isLoadingMeetingSuggestions && !meetingSuggestions.length ? (
                                                <span className="outlook-create-scheduler-feedback">
                                                    No hay horarios sugeridos para ese rango.
                                                </span>
                                            ) : null}

                                            {!isLoadingMeetingSuggestions && meetingSuggestions.length ? (
                                                <div className="outlook-create-scheduler-suggestion-list">
                                                    {meetingSuggestions.map((suggestionItem) => {
                                                        const isSelectedSuggestion =
                                                            toGraphDateTime(suggestionItem.start) === toGraphDateTime(createEventScheduleRange.start)
                                                            && toGraphDateTime(suggestionItem.end) === toGraphDateTime(createEventScheduleRange.end);

                                                        return (
                                                            <button
                                                                className={`outlook-create-scheduler-suggestion ${isSelectedSuggestion ? "is-active" : ""}`}
                                                                key={suggestionItem.id}
                                                                onClick={() => applyMeetingSuggestion(suggestionItem)}
                                                                type="button"
                                                            >
                                                                <span className="outlook-create-scheduler-suggestion-label">
                                                                    {suggestionItem.label}
                                                                </span>
                                                                <span className="outlook-create-scheduler-suggestion-meta">
                                                                    <span className="ti ti-users"></span>
                                                                    {suggestionItem.availableCount}
                                                                </span>
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            ) : null}
                                        </div>
                                    </div>
                                </Box>
                            ) : null}
                        </div>

                        <ClickAwayListener onClickAway={closeRoomSuggestions}>
                            <div className="outlook-create-location-shell">
                                <Box className="outlook-create-field-row">
                                    <span className="ti ti-map-pin outlook-create-row-icon"></span>
                                    <div className="outlook-create-line-field outlook-create-location-field">
                                        {selectedRoomOption ? (
                                            <div className="outlook-create-room-tag">
                                                <span className="outlook-create-room-tag-avatar">
                                                    <span className="ti ti-door-enter"></span>
                                                </span>
                                                <div className="outlook-create-room-tag-texts">
                                                    <span className="outlook-create-room-tag-name">{selectedRoomOption.displayName}</span>
                                                    <span className={`outlook-create-room-tag-status is-${roomSuggestionOptions.find((roomItem) => roomItem.id === selectedRoomOption.id)?.availabilityStatus || "unknown"}`}>
                                                        {SCHEDULE_STATUS_META[roomSuggestionOptions.find((roomItem) => roomItem.id === selectedRoomOption.id)?.availabilityStatus || "unknown"]?.label || "Desconocido"}
                                                    </span>
                                                </div>
                                                <button
                                                    aria-label={`Quitar sala ${selectedRoomOption.displayName}`}
                                                    className="outlook-create-room-tag-remove"
                                                    onClick={clearSelectedRoomOption}
                                                    type="button"
                                                >
                                                    <span className="ti ti-x"></span>
                                                </button>
                                            </div>
                                        ) : null}
                                        <input
                                            className="outlook-create-line-input"
                                            onChange={(event) => handleCreateEventLocationChange(event.target.value)}
                                            onFocus={openRoomSuggestions}
                                            placeholder="Agregar una sala o ubicación"
                                            type="text"
                                            value={roomSearchText}
                                        />
                                    </div>
                                </Box>

                                {isRoomSuggestionsOpen ? (
                                    <div className="outlook-create-room-dropdown">
                                        <div className="outlook-create-room-dropdown-title">Sugerencias</div>

                                        {isLoadingRoomDirectory ? (
                                            <div className="outlook-create-room-feedback">
                                                <CircularProgress color="inherit" size={16} />
                                                Cargando salas...
                                            </div>
                                        ) : null}

                                        {!isLoadingRoomDirectory && roomDirectoryError ? (
                                            <div className="outlook-create-room-feedback is-error">
                                                {roomDirectoryError}
                                            </div>
                                        ) : null}

                                        {!isLoadingRoomDirectory && !roomDirectoryError && !roomSuggestionOptions.length ? (
                                            <div className="outlook-create-room-feedback">
                                                {roomSuggestionSearchValue
                                                    ? "No hay salas que coincidan."
                                                    : "No hay salas disponibles."}
                                            </div>
                                        ) : null}

                                        {!isLoadingRoomDirectory && !roomDirectoryError && roomSuggestionOptions.length ? (
                                            <div className="outlook-create-room-list">
                                                {roomSuggestionOptions.map((roomItem) => (
                                                    <button
                                                        className={`outlook-create-room-option ${selectedRoomOption?.id === roomItem.id ? "is-selected" : ""}`}
                                                        key={roomItem.id}
                                                        onClick={() => handleSelectRoomOption(roomItem)}
                                                        onMouseDown={(event) => event.preventDefault()}
                                                        type="button"
                                                    >
                                                        <span className="outlook-create-room-option-avatar">
                                                            <span className="ti ti-door-enter"></span>
                                                        </span>
                                                        <span className="outlook-create-room-option-texts">
                                                            <span className="outlook-create-room-option-name">{roomItem.displayName}</span>
                                                            <span className="outlook-create-room-option-meta">
                                                                <span className={`outlook-create-room-option-state is-${roomItem.availabilityStatus}`}>
                                                                    {SCHEDULE_STATUS_META[roomItem.availabilityStatus]?.label || "Desconocido"}
                                                                </span>
                                                                {typeof roomItem.capacity === "number" ? <span>· {roomItem.capacity}</span> : null}
                                                                {roomItem.floorLabel ? <span>· {roomItem.floorLabel}</span> : null}
                                                            </span>
                                                        </span>
                                                        {isLoadingRoomAvailability ? <CircularProgress color="inherit" size={14} /> : null}
                                                    </button>
                                                ))}
                                            </div>
                                        ) : null}

                                        {hasMoreRoomSuggestions ? (
                                            <button
                                                className="outlook-create-room-more"
                                                onClick={() => setShowAllRoomSuggestions(true)}
                                                type="button"
                                            >
                                                <span className="ti ti-layout-grid"></span>
                                                Examinar todas las salas
                                            </button>
                                        ) : null}
                                    </div>
                                ) : null}
                            </div>
                        </ClickAwayListener>

                        <Box className="outlook-create-field-row is-switch-row">
                            <span className="ti ti-video outlook-create-row-icon"></span>
                            <button
                                className={`outlook-create-switch ${isCreateTeamsMeeting ? "is-active" : ""}`}
                                onClick={() => setIsCreateTeamsMeeting((currentValue) => !currentValue)}
                                type="button"
                            >
                                <span className="outlook-create-switch-thumb"></span>
                            </button>
                            <Typography className="outlook-create-switch-label">
                                Reunión de Teams
                            </Typography>
                        </Box>

                    </Box>

                    <Box className="outlook-create-form-card outlook-create-extra-card">
                        <Box className="outlook-create-extra-section">
                            <ClickAwayListener onClickAway={() => setIsEventTypeDropdownOpen(false)}>
                                <div className="outlook-create-location-shell">
                                    <Box className="outlook-create-field-row">
                                        <span className={`${selectedEventTypeIconClass} outlook-create-row-icon`}></span>
                                        <div className="outlook-create-line-field outlook-create-location-field">
                                            <input
                                                className="outlook-create-line-input"
                                                onClick={() => setIsEventTypeDropdownOpen((currentValue) => !currentValue)}
                                                placeholder="Tipo de evento*"
                                                readOnly
                                                type="text"
                                                value={selectedEventTypeLabel}
                                            />
                                        </div>
                                    </Box>

                                    {isEventTypeDropdownOpen ? (
                                        <div className="outlook-create-room-dropdown">
                                            <div className="outlook-create-room-dropdown-title">Sugerencias</div>
                                            <div className="outlook-create-room-list">
                                                {createEventTypeOptions
                                                    .filter((option) => option.value)
                                                    .map((option) => (
                                                        <button
                                                            className={`outlook-create-room-option ${createEventType === option.value ? "is-selected" : ""}`}
                                                            key={option.value}
                                                            onClick={() => handleSelectEventType(option.value)}
                                                            onMouseDown={(event) => event.preventDefault()}
                                                            type="button"
                                                        >
                                                            <span className="outlook-create-room-option-avatar">
                                                                <span className={CREATE_EVENT_TYPE_ICON_MAP[option.value] || "ti ti-calendar-event"}></span>
                                                            </span>
                                                            <span className="outlook-create-room-option-texts">
                                                                <span className="outlook-create-room-option-name">{option.label}</span>
                                                            </span>
                                                        </button>
                                                    ))}
                                            </div>
                                        </div>
                                    ) : null}
                                </div>
                            </ClickAwayListener>

                            {shouldShowCreateEventProjectSelect ? (
                                <ClickAwayListener onClickAway={() => setIsProjectDropdownOpen(false)}>
                                    <div className="outlook-create-location-shell">
                                        <Box className="outlook-create-field-row">
                                            <span className="ti ti-home outlook-create-row-icon"></span>
                                            <div className="outlook-create-line-field outlook-create-location-field">
                                                <input
                                                    className="outlook-create-line-input"
                                                    onChange={(event) => {
                                                        setCreateEventProjectId("");
                                                        setProjectSearchText(event.target.value);
                                                        setIsProjectDropdownOpen(true);
                                                    }}
                                                    onFocus={() => setIsProjectDropdownOpen(true)}
                                                    placeholder="Seleccionar el proyecto a visitar*"
                                                    type="text"
                                                    value={projectSearchText}
                                                />
                                            </div>
                                        </Box>

                                        {isProjectDropdownOpen ? (
                                            <div className="outlook-create-room-dropdown">
                                                <div className="outlook-create-room-dropdown-title">Sugerencias</div>

                                                {isLoadingCreateEventProjectOptions ? (
                                                    <div className="outlook-create-room-feedback">
                                                        <CircularProgress color="inherit" size={16} />
                                                        Cargando proyectos...
                                                    </div>
                                                ) : null}

                                                {!isLoadingCreateEventProjectOptions && createEventProjectOptionsError ? (
                                                    <div className="outlook-create-room-feedback is-error">
                                                        {createEventProjectOptionsError}
                                                    </div>
                                                ) : null}

                                                {!isLoadingCreateEventProjectOptions && !createEventProjectOptionsError && !filteredCreateEventProjectOptions.length ? (
                                                    <div className="outlook-create-room-feedback">
                                                        No hay proyectos que coincidan.
                                                    </div>
                                                ) : null}

                                                {!isLoadingCreateEventProjectOptions && !createEventProjectOptionsError && filteredCreateEventProjectOptions.length ? (
                                                    <div className="outlook-create-room-list">
                                                        {filteredCreateEventProjectOptions.map((projectOption) => (
                                                            <button
                                                                className={`outlook-create-room-option ${String(createEventProjectId) === String(projectOption.value) ? "is-selected" : ""}`}
                                                                key={projectOption.value}
                                                                onClick={() => {
                                                                    setCreateEventProjectId(projectOption.value);
                                                                    setProjectSearchText(projectOption.label);
                                                                    setIsProjectDropdownOpen(false);
                                                                }}
                                                                onMouseDown={(event) => event.preventDefault()}
                                                                type="button"
                                                            >
                                                                <span className="outlook-create-room-option-avatar">
                                                                    <span className="ti ti-home"></span>
                                                                </span>
                                                                <span className="outlook-create-room-option-texts">
                                                                    <span className="outlook-create-room-option-name">{projectOption.label}</span>
                                                                </span>
                                                            </button>
                                                        ))}
                                                    </div>
                                                ) : null}
                                            </div>
                                        ) : null}
                                    </div>
                                </ClickAwayListener>
                            ) : null}

                            <Box className="outlook-create-field-row">
                                <span className="ti ti-user-plus outlook-create-row-icon"></span>
                                <label className="outlook-create-extra-checkbox" htmlFor="create-event-assign-lead">
                                    <input
                                        checked={isCreateEventLeadEnabled}
                                        disabled={isLeadAssignmentLocked}
                                        id="create-event-assign-lead"
                                        onChange={(event) => handleCreateEventLeadToggle(event.target.checked)}
                                        type="checkbox"
                                    />
                                    <span>Asignar un lead a este evento</span>
                                </label>
                            </Box>

                            {shouldShowCreateEventLeadSelect ? (
                                <>
                                    <ClickAwayListener onClickAway={() => setIsLeadDropdownOpen(false)}>
                                        <div className="outlook-create-location-shell">
                                            <Box className="outlook-create-field-row">
                                                <span className="ti ti-user-search outlook-create-row-icon"></span>
                                                <div className="outlook-create-line-field outlook-create-location-field">
                                                    <input
                                                        className="outlook-create-line-input"
                                                        disabled={isLeadAssignmentLocked}
                                                        onChange={(event) => {
                                                            if (isLeadAssignmentLocked) {
                                                                return;
                                                            }

                                                            setCreateEventLeadId("");
                                                            setLeadSearchText(event.target.value);
                                                            setIsLeadDropdownOpen(true);
                                                        }}
                                                        onFocus={() => {
                                                            if (isLeadAssignmentLocked) {
                                                                return;
                                                            }

                                                            setIsLeadDropdownOpen(true);
                                                        }}
                                                        placeholder="Seleccionar lead"
                                                        type="text"
                                                        value={leadSearchText}
                                                    />
                                                </div>
                                            </Box>

                                            {isLeadDropdownOpen ? (
                                                <div className="outlook-create-room-dropdown">
                                                    <div className="outlook-create-room-dropdown-title">Sugerencias</div>

                                                    {isLoadingCreateEventLeadOptions ? (
                                                        <div className="outlook-create-room-feedback">
                                                            <CircularProgress color="inherit" size={16} />
                                                            Cargando leads...
                                                        </div>
                                                    ) : null}

                                                    {!isLoadingCreateEventLeadOptions && createEventLeadOptionsError ? (
                                                        <div className="outlook-create-room-feedback is-error">
                                                            {createEventLeadOptionsError}
                                                        </div>
                                                    ) : null}

                                                    {!isLoadingCreateEventLeadOptions && !createEventLeadOptionsError && !filteredCreateEventLeadOptions.length ? (
                                                        <div className="outlook-create-room-feedback">
                                                            No hay leads que coincidan.
                                                        </div>
                                                    ) : null}

                                                    {!isLoadingCreateEventLeadOptions && !createEventLeadOptionsError && filteredCreateEventLeadOptions.length ? (
                                                        <div className="outlook-create-room-list">
                                                            {filteredCreateEventLeadOptions.map((leadOption) => (
                                                                <button
                                                                    className={`outlook-create-room-option ${String(createEventLeadId) === String(leadOption.value) ? "is-selected" : ""}`}
                                                                    key={leadOption.value}
                                                                    onClick={() => {
                                                                        setCreateEventLeadId(leadOption.value);
                                                                        setLeadSearchText(leadOption.label);
                                                                        setIsLeadDropdownOpen(false);
                                                                    }}
                                                                    onMouseDown={(event) => event.preventDefault()}
                                                                    type="button"
                                                                >
                                                                    <span className="outlook-create-room-option-avatar">
                                                                        <span className="ti ti-user"></span>
                                                                    </span>
                                                                    <span className="outlook-create-room-option-texts">
                                                                        <span className="outlook-create-room-option-name">{leadOption.label}</span>
                                                                    </span>
                                                                </button>
                                                            ))}
                                                        </div>
                                                    ) : null}
                                                </div>
                                            ) : null}
                                        </div>
                                    </ClickAwayListener>

                                    <Box className="outlook-create-field-row">
                                        <span className="ti ti-mail outlook-create-row-icon"></span>
                                        <label className="outlook-create-extra-checkbox" htmlFor="create-event-invite-lead">
                                            <input
                                                checked={isLeadInvitationEnabled}
                                                disabled={!createEventLeadEmail}
                                                id="create-event-invite-lead"
                                                onChange={(event) => setIsLeadInvitationEnabled(event.target.checked)}
                                                type="checkbox"
                                            />
                                            <span>Enviar invitación al lead del evento</span>
                                        </label>
                                    </Box>
                                </>
                            ) : null}
                        </Box>
                    </Box>

                    <Box className="outlook-create-editor-card">
                        <Box className="outlook-create-editor-icon">
                            <span className="ti ti-align-left"></span>
                        </Box>
                        <textarea
                            className="outlook-create-editor-surface outlook-create-editor-textarea"
                            onChange={(event) => setCreateEventDescription(event.target.value)}
                            placeholder="Agregar descripción o notas del evento"
                            value={createEventDescription}
                        ></textarea>
                    </Box>
                </Box>

                <OutlookCreateEventPreview
                    areAllParticipantsAvailable={areAllParticipantsAvailable}
                    createEventHeaderLabel={createEventHeaderLabel}
                    createEventPreviewPosition={createEventPreviewPosition}
                    createEventScheduleLabel={createEventScheduleLabel}
                    createEventWeekLabel={createEventWeekLabel}
                    isLoadingScheduleAvailability={isLoadingScheduleAvailability}
                    isOwnerAvailable={isOwnerAvailable}
                    isPrimaryScheduleAvailable={isPrimaryScheduleAvailable}
                    isRoomAvailable={isRoomAvailable}
                    previewBusyBlocks={previewBusyBlocks}
                    previewParticipants={previewParticipants}
                    scheduleAvailabilityError={scheduleAvailabilityError}
                    shiftCreateEventDate={shiftCreateEventDate}
                />
            </Box>
        </DialogContent>
    </Dialog>
    );
};
