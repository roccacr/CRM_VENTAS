import { useEffect, useMemo, useState } from "react";

import { InteractionRequiredAuthError } from "@azure/msal-browser";
import { useMsal } from "@azure/msal-react";
import Swal from "sweetalert2";
import { useDispatch, useSelector } from "react-redux";

import { loginRequest } from "../../../../config/msalConfig";
import {
    getDataEevent,
    createOutlookEventForLead,
    deleteOutlookEventForLead,
    updateOutlookEventForLeadDetails,
    updateStatusEvent,
} from "../../../../store/calendar/thunkscalendar";
import {
    getDataSelectProyect,
    getLeadsComplete,
    getSpecificLead,
} from "../../../../store/leads/thunksLeads";
import { OutlookCreateEventModal } from "../../../views/calendars/outlook/components/OutlookCreateEventModal";
import {
    addMinutesToTimeValue,
    buildCreateEventScheduleRange,
    buildEventTransactionId,
    formatCreateEventDateTimeLabel,
    formatCreateEventPreviewTitle,
    formatDateInputValue,
    formatTimeValue,
    getIsoWeekNumber,
    OUTLOOK_CREATE_EVENT_SCOPE,
    toGraphDateTime,
    deleteOutlookEventById,
    plainTextToOutlookHtml,
} from "../../../views/calendars/outlook/outlookCalendarUtils";

import "../../../views/calendars/outlook/View_calendario_outlook.css";

const CREATE_EVENT_AVAILABLE_START_HOUR = 7;
const CREATE_EVENT_AVAILABLE_END_HOUR = 22;
const CREATE_EVENT_DEFAULT_DURATION_MINUTES = 60;
const OUTLOOK_PEOPLE_SCOPE = "User.ReadBasic.All";
const OUTLOOK_PLACE_SCOPE = "Place.Read.All";
const PEOPLE_PAGE_SIZE = 10;
const PEOPLE_SEARCH_MIN_LENGTH = 2;
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
    Llamada: "#2a5f79",
    Tarea: "#6a7a89",
    Reunion: "#2a5f79",
    Correo: "#e59f2a",
    Whatsapp: "#2f9e44",
    Seguimientos: "#2a5f79",
    Cita: "#ef6b73",
};
const OUTLOOK_TIMEZONE = "Central America Standard Time";

const normalizeEmail = (value) => (typeof value === "string" ? value.trim().toLowerCase() : "");
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

const buildGraphAttendeeOption = (attendeeItem) => {
    const attendeeEmail = normalizeEmail(attendeeItem?.emailAddress?.address);

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
    if (eventTypeValue === "Reunión") {
        return "Reunion";
    }

    return eventTypeValue || "";
};

const normalizeCreateEventTypeKeySafe = (value) => (typeof value === "string"
    ? value.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    : "");

const CREATE_EVENT_TYPE_ALIASES_SAFE = {
    reunion: "Reunion",
    reuniones: "Reunion",
    seguimiento: "Seguimientos",
    seguimientos: "Seguimientos",
    cita: "Cita",
    "asignar cita": "Cita",
};

const resolveCreateEventTypeValue = (eventTypeValue) => {
    const normalizedValue = normalizeCreateEventTypeKeySafe(eventTypeValue);

    if (!normalizedValue) {
        return "";
    }

    const aliasedValue = CREATE_EVENT_TYPE_ALIASES_SAFE[normalizedValue];

    if (aliasedValue) {
        return aliasedValue;
    }

    const matchedOption = CREATE_EVENT_TYPE_OPTIONS.find(
        (option) => option.value && normalizeCreateEventTypeKeySafe(option.value) === normalizedValue,
    );

    return matchedOption?.value || "";
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
        availabilityStatus: "unknown",
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

const getCreateEventColor = (eventType) => CREATE_EVENT_COLOR_BY_TYPE[eventType] || "#2a5f79";

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

const getCreateEventMinimumDate = () => {
    const minimumDate = new Date();
    minimumDate.setHours(0, 0, 0, 0);
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

const roundDateToNextSlot = (value) => {
    const roundedDate = new Date(value.getTime());
    const minutes = roundedDate.getMinutes();
    const remainder = minutes % 30;

    roundedDate.setSeconds(0, 0);

    if (remainder !== 0) {
        roundedDate.setMinutes(minutes + (30 - remainder));
    }

    return roundedDate;
};

const getDefaultCreateEventStartDate = () => {
    const roundedNow = roundDateToNextSlot(new Date());
    const roundedMinutes = (roundedNow.getHours() * 60) + roundedNow.getMinutes();
    const minimumStartMinutes = CREATE_EVENT_AVAILABLE_START_HOUR * 60;
    const maximumStartMinutes = (CREATE_EVENT_AVAILABLE_END_HOUR * 60) - 30;

    if (roundedMinutes < minimumStartMinutes) {
        roundedNow.setHours(CREATE_EVENT_AVAILABLE_START_HOUR, 0, 0, 0);
    } else if (roundedMinutes > maximumStartMinutes) {
        roundedNow.setHours(Math.floor(maximumStartMinutes / 60), maximumStartMinutes % 60, 0, 0);
    }

    return roundedNow;
};

const buildTimeOptions = (includeLastHour = false) => {
    const startMinutes = CREATE_EVENT_AVAILABLE_START_HOUR * 60;
    const endMinutes = (CREATE_EVENT_AVAILABLE_END_HOUR * 60) - (includeLastHour ? 0 : 30);
    const totalOptions = ((endMinutes - startMinutes) / 30) + 1;

    return Array.from({ length: totalOptions }, (_, index) => {
        const totalMinutes = startMinutes + (index * 30);
        const hours = Math.floor(totalMinutes / 60);
        const minutes = totalMinutes % 60;
        const value = formatTimeValue(hours, minutes);

        return {
            value,
            label: value,
        };
    });
};

const mapLeadToOption = (leadItem) => ({
    value: leadItem.idinterno_lead,
    label: leadItem.nombre_lead,
    email: leadItem.email_lead || "",
    valueStatus: leadItem.segimineto_lead || "",
});

/**
 * Modal puente para crear eventos Outlook desde el modal de leads.
 *
 * @param {Object} props - Props del modal.
 * @param {Object} props.initialLead - Lead origen seleccionado.
 * @param {boolean} props.isOpen - Control de apertura.
 * @param {Function} props.onClose - Cierre final.
 * @returns {JSX.Element|null} Modal renderizado.
 */
export const LeadOutlookCreateEventModal = ({
    initialLead,
    isOpen,
    onClose,
    mode = "create",
    initialEventId = 0,
    initialEventData = null,
}) => {
    const dispatch = useDispatch();
    const { accounts, instance } = useMsal();
    const { idnetsuite_admin, email_admin, microsoftUser } = useSelector((state) => state.auth);

    const [createEventTitle, setCreateEventTitle] = useState("");
    const [createEventType, setCreateEventType] = useState("");
    const [createEventLocation, setCreateEventLocation] = useState("");
    const [createEventDescription, setCreateEventDescription] = useState("");
    const [isCreateTeamsMeeting, setIsCreateTeamsMeeting] = useState(false);
    const [isScheduleEditorOpen, setIsScheduleEditorOpen] = useState(false);
    const [hasTouchedCreateEventTitle, setHasTouchedCreateEventTitle] = useState(false);
    const [createEventSubmitError, setCreateEventSubmitError] = useState("");
    const [isSavingCreateEvent, setIsSavingCreateEvent] = useState(false);
    const [isUpdatingEventStatus, setIsUpdatingEventStatus] = useState(false);
    const [currentCrmStatus, setCurrentCrmStatus] = useState(initialEventData?.accion_calendar || "");
    const [createEventLeadId, setCreateEventLeadId] = useState("");
    const [isCreateEventLeadEnabled, setIsCreateEventLeadEnabled] = useState(true);
    const [isLeadInvitationEnabled, setIsLeadInvitationEnabled] = useState(false);
    const [createEventLeadOptions, setCreateEventLeadOptions] = useState([]);
    const [isLoadingCreateEventLeadOptions, setIsLoadingCreateEventLeadOptions] = useState(false);
    const [createEventLeadOptionsError, setCreateEventLeadOptionsError] = useState("");
    const [createEventProjectId, setCreateEventProjectId] = useState("");
    const [createEventProjectOptions, setCreateEventProjectOptions] = useState([]);
    const [isLoadingCreateEventProjectOptions, setIsLoadingCreateEventProjectOptions] = useState(false);
    const [createEventProjectOptionsError, setCreateEventProjectOptionsError] = useState("");
    const [createEventDateValue, setCreateEventDateValue] = useState(formatDateInputValue(getDefaultCreateEventStartDate()));
    const [createEventStartTimeValue, setCreateEventStartTimeValue] = useState(formatTimeValue(getDefaultCreateEventStartDate().getHours(), getDefaultCreateEventStartDate().getMinutes()));
    const [createEventEndTimeValue, setCreateEventEndTimeValue] = useState(addMinutesToTimeValue(formatTimeValue(getDefaultCreateEventStartDate().getHours(), getDefaultCreateEventStartDate().getMinutes()), CREATE_EVENT_DEFAULT_DURATION_MINUTES));
    const [selectedAttendees, setSelectedAttendees] = useState([]);
    const [attendeeSearchText, setAttendeeSearchText] = useState("");
    const [attendeeDirectoryOptions, setAttendeeDirectoryOptions] = useState([]);
    const [attendeeDirectoryError, setAttendeeDirectoryError] = useState("");
    const [isLoadingAttendeeDirectory, setIsLoadingAttendeeDirectory] = useState(false);
    const [roomSearchText, setRoomSearchText] = useState("");
    const [roomDirectoryOptions, setRoomDirectoryOptions] = useState([]);
    const [selectedRoomOption, setSelectedRoomOption] = useState(null);
    const [isRoomSuggestionsOpen, setIsRoomSuggestionsOpen] = useState(false);
    const [isLoadingRoomDirectory, setIsLoadingRoomDirectory] = useState(false);
    const [roomDirectoryError, setRoomDirectoryError] = useState("");

    const expectedMicrosoftEmail = useMemo(
        () => (microsoftUser?.email || email_admin || "").trim().toLowerCase(),
        [email_admin, microsoftUser?.email],
    );
    const activeMicrosoftAccount = useMemo(
        () => accounts.find((account) => account.username?.toLowerCase() === expectedMicrosoftEmail) || null,
        [accounts, expectedMicrosoftEmail],
    );
    const createEventLeadLabel = useMemo(
        () => createEventLeadOptions.find((leadOption) => String(leadOption.value) === String(createEventLeadId))?.label || "",
        [createEventLeadId, createEventLeadOptions],
    );
    const createEventLeadEmail = useMemo(
        () => normalizeEmail(createEventLeadOptions.find((leadOption) => String(leadOption.value) === String(createEventLeadId))?.email || ""),
        [createEventLeadId, createEventLeadOptions],
    );
    const createEventLeadStatus = useMemo(
        () => createEventLeadOptions.find((leadOption) => String(leadOption.value) === String(createEventLeadId))?.valueStatus || "",
        [createEventLeadId, createEventLeadOptions],
    );
    const isEditMode = mode === "edit";
    const resolvedCalendarId = Number(initialEventId || initialEventData?.id_calendar || 0);
    const createEventProjectLabel = useMemo(() => {
        const selectedProjectOption = createEventProjectOptions.find(
            (projectOption) => String(projectOption.value) === String(createEventProjectId),
        );

        if (selectedProjectOption?.label) {
            return selectedProjectOption.label;
        }

        if (String(initialEventData?.id_proyecto || "") === String(createEventProjectId)) {
            return initialEventData?.nombre_proyecto && initialEventData.nombre_proyecto !== "0"
                ? initialEventData.nombre_proyecto
                : "";
        }

        return "";
    }, [createEventProjectId, createEventProjectOptions, initialEventData]);
    const createEventMinimumDateValue = useMemo(() => formatDateInputValue(getCreateEventMinimumDate()), []);
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
    const createEventScheduleLabel = `${createEventStartTimeValue} - ${createEventEndTimeValue}`;
    const isLeadAssignmentLocked = Boolean(initialLead?.idinterno_lead);
    const requiresCreateEventLeadAssignment = createEventType === "Cita" || isCreateEventLeadEnabled;
    const shouldShowCreateEventLeadSelect = requiresCreateEventLeadAssignment;
    const shouldShowCreateEventProjectSelect = createEventType === "Cita";
    const openAttendeeSuggestions = attendeeSearchText.trim().length >= PEOPLE_SEARCH_MIN_LENGTH;
    const roomSuggestionSearchValue = roomSearchText.trim();
    const roomSuggestionOptions = useMemo(
        () => roomDirectoryOptions.filter((roomItem) => matchesRoomSearch(roomItem, roomSuggestionSearchValue)),
        [roomDirectoryOptions, roomSuggestionSearchValue],
    );
    const createEventTimeOptions = useMemo(() => buildTimeOptions(false), []);
    const createEventAllTimeOptions = useMemo(() => buildTimeOptions(true), []);
    const createEventEndTimeOptions = useMemo(() => {
        const currentStartDate = new Date(`${createEventDateValue}T${createEventStartTimeValue}:00`);

        return createEventAllTimeOptions.filter((option) => new Date(`${createEventDateValue}T${option.value}:00`) > currentStartDate);
    }, [createEventAllTimeOptions, createEventDateValue, createEventStartTimeValue]);
    const createEventPreviewPosition = useMemo(() => {
        const startOfDay = new Date(createEventScheduleRange.start);
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(createEventScheduleRange.start);
        endOfDay.setHours(24, 0, 0, 0);
        const totalMinutes = (endOfDay.getTime() - startOfDay.getTime()) / 60000;
        const startMinutes = (createEventScheduleRange.start.getTime() - startOfDay.getTime()) / 60000;
        const durationMinutes = (createEventScheduleRange.end.getTime() - createEventScheduleRange.start.getTime()) / 60000;

        return {
            topPercent: (startMinutes / totalMinutes) * 100,
            heightPercent: (durationMinutes / totalMinutes) * 100,
        };
    }, [createEventScheduleRange]);
    const previewParticipants = useMemo(() => {
        const ownerEmail = expectedMicrosoftEmail || "sin-correo";
        const participants = [{
            id: ownerEmail,
            displayName: email_admin || microsoftUser?.email || ownerEmail,
            email: ownerEmail,
            status: "free",
            type: "owner",
        }];

        selectedAttendees.forEach((attendeeItem) => {
            const attendeeEmail = normalizeEmail(attendeeItem?.email);

            if (!attendeeEmail || attendeeEmail === ownerEmail) {
                return;
            }

            participants.push({
                id: attendeeItem.id || attendeeEmail,
                displayName: attendeeItem.displayName || attendeeEmail,
                email: attendeeEmail,
                status: "free",
                type: "attendee",
            });
        });

        return participants;
    }, [email_admin, expectedMicrosoftEmail, microsoftUser?.email, selectedAttendees]);
    const canShowEditStatusActions = Boolean(
        isEditMode
        && resolvedCalendarId
        && currentCrmStatus === "Pendiente",
    );
    const canShowReactivateAction = Boolean(
        isEditMode
        && resolvedCalendarId
        && ["Completado", "Cancelado"].includes(currentCrmStatus || ""),
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
        } catch (error) {
            setRoomDirectoryOptions([]);
            setRoomDirectoryError("No se pudieron cargar salas de Outlook.");
        } finally {
            setIsLoadingRoomDirectory(false);
        }
    };

    useEffect(() => {
        if (!isOpen) {
            return;
        }

        let isMounted = true;
        const defaultStartDate = getDefaultCreateEventStartDate();
        const defaultTimeValue = formatTimeValue(defaultStartDate.getHours(), defaultStartDate.getMinutes());
        const fallbackLeadId = initialLead?.idinterno_lead
            || initialEventData?.idinterno_lead
            || initialEventData?.id_lead
            || 0;

        setCreateEventTitle("");
        setCreateEventType("");
        setCreateEventLocation("");
        setCreateEventDescription("");
        setIsCreateTeamsMeeting(false);
        setIsScheduleEditorOpen(false);
        setHasTouchedCreateEventTitle(false);
        setCreateEventSubmitError("");
        setCurrentCrmStatus(initialEventData?.accion_calendar || "");
        setCreateEventProjectId("");
        setCreateEventProjectOptions([]);
        setCreateEventProjectOptionsError("");
        setCreateEventDateValue(formatDateInputValue(defaultStartDate));
        setCreateEventStartTimeValue(defaultTimeValue);
        setCreateEventEndTimeValue(addMinutesToTimeValue(defaultTimeValue, CREATE_EVENT_DEFAULT_DURATION_MINUTES));
        setSelectedAttendees([]);
        setAttendeeSearchText("");
        setRoomSearchText("");
        setRoomDirectoryOptions([]);
        setSelectedRoomOption(null);
        setIsRoomSuggestionsOpen(false);
        setRoomDirectoryError("");
        setIsCreateEventLeadEnabled(true);
        setIsLeadInvitationEnabled(false);

        const preloadLeadOptions = async () => {
            if (!fallbackLeadId) {
                setCreateEventLeadId("");
                setCreateEventLeadOptions([]);
                setIsLoadingCreateEventLeadOptions(false);
                setCreateEventLeadOptionsError("");
                return;
            }

            setIsLoadingCreateEventLeadOptions(true);
            setCreateEventLeadOptionsError("");

            try {
                const specificLead = await dispatch(getSpecificLead(fallbackLeadId));
                const baseLead = specificLead?.idinterno_lead
                    ? specificLead
                    : (initialLead || initialEventData);
                const initialLeadOption = baseLead?.idinterno_lead ? mapLeadToOption(baseLead) : null;

                if (!isMounted) {
                    return;
                }

                setCreateEventLeadId(String(initialLeadOption?.value || ""));
                setCreateEventLeadOptions(initialLeadOption?.value ? [initialLeadOption] : []);
                setIsLeadInvitationEnabled(false);

                const allLeads = await dispatch(getLeadsComplete("2024-01-01", "2024-01-01", 0));

                if (!isMounted) {
                    return;
                }

                const mergedLeadMap = new Map();

                [initialLeadOption, ...(Array.isArray(allLeads) ? allLeads.map(mapLeadToOption) : [])]
                    .filter((leadOption) => leadOption?.value && leadOption?.label)
                    .forEach((leadOption) => {
                        mergedLeadMap.set(String(leadOption.value), leadOption);
                    });

                setCreateEventLeadOptions(Array.from(mergedLeadMap.values()));
            } catch (error) {
                if (!isMounted) {
                    return;
                }

                setCreateEventLeadOptions([]);
                setCreateEventLeadOptionsError("No se pudo cargar el lead seleccionado.");
            } finally {
                if (isMounted) {
                    setIsLoadingCreateEventLeadOptions(false);
                }
            }
        };

        preloadLeadOptions();

        return () => {
            isMounted = false;
        };
    }, [dispatch, initialEventData, initialLead, isOpen]);

    useEffect(() => {
        if (!isOpen || !shouldShowCreateEventProjectSelect || createEventProjectOptions.length) {
            return;
        }

        let isMounted = true;

        const loadProjects = async () => {
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

                const currentProjectOption = (
                    createEventProjectId
                    && createEventProjectLabel
                    && !formattedProjects.some(
                        (projectOption) => String(projectOption.value) === String(createEventProjectId),
                    )
                ) ? [{
                    value: createEventProjectId,
                    label: createEventProjectLabel,
                }] : [];

                if (isMounted) {
                    setCreateEventProjectOptions([...currentProjectOption, ...formattedProjects]);
                }
            } catch (error) {
                if (isMounted) {
                    setCreateEventProjectOptions([]);
                    setCreateEventProjectOptionsError("No se pudieron cargar proyectos.");
                }
            } finally {
                if (isMounted) {
                    setIsLoadingCreateEventProjectOptions(false);
                }
            }
        };

        loadProjects();

        return () => {
            isMounted = false;
        };
    }, [
        createEventProjectId,
        createEventProjectLabel,
        createEventProjectOptions.length,
        dispatch,
        isOpen,
        shouldShowCreateEventProjectSelect,
    ]);

    useEffect(() => {
        if (!isOpen) {
            return undefined;
        }

        const normalizedSearch = attendeeSearchText.trim();

        if (normalizedSearch.length < PEOPLE_SEARCH_MIN_LENGTH) {
            setIsLoadingAttendeeDirectory(false);
            setAttendeeDirectoryError("");
            setAttendeeDirectoryOptions([...selectedAttendees]);
            return undefined;
        }

        const timeoutId = window.setTimeout(() => {
            loadAttendeeDirectory(normalizedSearch);
        }, 500);

        return () => window.clearTimeout(timeoutId);
    }, [activeMicrosoftAccount, attendeeSearchText, isOpen, selectedAttendees]);

    useEffect(() => {
        if (!isOpen) {
            return;
        }

        if (!isLeadInvitationEnabled || !createEventLeadEmail) {
            setSelectedAttendees((currentValue) => currentValue.filter((attendeeItem) => attendeeItem?.source !== "lead"));
            return;
        }

        setSelectedAttendees((currentValue) => {
            const nextAttendees = currentValue.filter((attendeeItem) => attendeeItem?.source !== "lead");
            const alreadyIncluded = nextAttendees.some((attendeeItem) => normalizeEmail(attendeeItem?.email) === createEventLeadEmail);

            if (alreadyIncluded) {
                return nextAttendees;
            }

            return [
                ...nextAttendees,
                {
                    id: `lead-${createEventLeadId || createEventLeadEmail}`,
                    displayName: createEventLeadEmail,
                    email: createEventLeadEmail,
                    source: "lead",
                },
            ];
        });
    }, [createEventLeadEmail, createEventLeadId, isLeadInvitationEnabled, isOpen]);

    useEffect(() => {
        if (!isOpen || !isEditMode || !resolvedCalendarId) {
            return;
        }

        let isMounted = true;

        const loadEditEvent = async () => {
            setCreateEventSubmitError("");

            try {
                const crmEvent = await dispatch(getDataEevent(resolvedCalendarId));

                if (!isMounted || !crmEvent) {
                    return;
                }

                const startDate = crmEvent?.fechaIni_calendar
                    ? new Date(crmEvent.fechaIni_calendar)
                    : getDefaultCreateEventStartDate();
                const endDate = crmEvent?.fechaFin_calendar
                    ? new Date(crmEvent.fechaFin_calendar)
                    : new Date(startDate.getTime() + (CREATE_EVENT_DEFAULT_DURATION_MINUTES * 60000));
                const normalizedLeadId = Number(crmEvent?.id_lead || 0);

                setCreateEventTitle(crmEvent?.nombre_calendar || "");
                setCreateEventType(resolveCreateEventTypeValue(crmEvent?.tipo_calendar));
                setCreateEventDescription(crmEvent?.decrip_calendar || "");
                setCurrentCrmStatus(crmEvent?.accion_calendar || initialEventData?.accion_calendar || "");
                setIsCreateEventLeadEnabled(Boolean(normalizedLeadId));
                setCreateEventLeadId(normalizedLeadId ? String(normalizedLeadId) : "");
                setCreateEventProjectId(crmEvent?.id_proyecto ? String(crmEvent.id_proyecto) : "");
                setCreateEventDateValue(formatDateInputValue(startDate));
                setCreateEventStartTimeValue(formatTimeValue(startDate.getHours(), startDate.getMinutes()));
                setCreateEventEndTimeValue(formatTimeValue(endDate.getHours(), endDate.getMinutes()));

                if (!crmEvent?.outlook_event_id || !activeMicrosoftAccount) {
                    setCreateEventLocation(crmEvent?.nombre_proyecto === "0" ? "" : "");
                    return;
                }

                let tokenResponse;

                try {
                    tokenResponse = await instance.acquireTokenSilent({
                        scopes: [...new Set([...loginRequest.scopes, OUTLOOK_CREATE_EVENT_SCOPE])],
                        account: activeMicrosoftAccount,
                    });
                } catch (error) {
                    if (!(error instanceof InteractionRequiredAuthError)) {
                        throw error;
                    }

                    tokenResponse = await instance.acquireTokenPopup({
                        scopes: [...new Set([...loginRequest.scopes, OUTLOOK_CREATE_EVENT_SCOPE])],
                        account: activeMicrosoftAccount,
                        loginHint: expectedMicrosoftEmail || undefined,
                        prompt: "select_account",
                    });
                }

                const outlookResponse = await fetch(
                    `https://graph.microsoft.com/v1.0/me/events/${encodeURIComponent(crmEvent.outlook_event_id)}?$select=id,subject,body,start,end,location,attendees,organizer,isOnlineMeeting,onlineMeeting`,
                    {
                        headers: {
                            Authorization: `Bearer ${tokenResponse.accessToken}`,
                            "Content-Type": "application/json",
                            Prefer: `outlook.timezone="${OUTLOOK_TIMEZONE}"`,
                        },
                    },
                );

                if (!outlookResponse.ok) {
                    return;
                }

                const outlookEvent = await outlookResponse.json();

                if (!isMounted) {
                    return;
                }

                const organizerEmail = normalizeEmail(outlookEvent?.organizer?.emailAddress?.address);
                const attendeeOptions = (outlookEvent?.attendees || [])
                    .map(buildGraphAttendeeOption)
                    .filter(Boolean);
                const resourceAttendee = attendeeOptions.find((attendeeItem) => attendeeItem.type === "resource") || null;
                const selectedAttendeeOptions = attendeeOptions.filter(
                    (attendeeItem) => attendeeItem.type !== "resource"
                        && attendeeItem.email !== organizerEmail,
                );
                const leadEmail = normalizeEmail(crmEvent?.email_lead);
                const shouldInviteLead = Boolean(
                    leadEmail
                    && selectedAttendeeOptions.some((attendeeItem) => normalizeEmail(attendeeItem?.email) === leadEmail),
                );

                setCreateEventTitle(outlookEvent?.subject || crmEvent?.nombre_calendar || "");
                setCreateEventLocation(outlookEvent?.location?.displayName || "");
                setRoomSearchText(outlookEvent?.location?.displayName || "");
                setSelectedRoomOption(
                    resourceAttendee
                        ? {
                            id: resourceAttendee.id,
                            displayName: resourceAttendee.displayName,
                            email: resourceAttendee.email,
                            availabilityStatus: "unknown",
                        }
                        : null,
                );
                setSelectedAttendees(selectedAttendeeOptions.map((attendeeItem) => ({
                    id: attendeeItem.id,
                    displayName: attendeeItem.displayName,
                    email: attendeeItem.email,
                    source: attendeeItem.source || "outlook",
                })));
                setAttendeeDirectoryOptions(selectedAttendeeOptions);
                setIsLeadInvitationEnabled(shouldInviteLead);
                setIsCreateTeamsMeeting(Boolean(outlookEvent?.isOnlineMeeting || outlookEvent?.onlineMeeting?.joinUrl));
            } catch (error) {
                if (isMounted) {
                    setCreateEventSubmitError("No se pudo cargar el evento para editar.");
                }
            }
        };

        loadEditEvent();

        return () => {
            isMounted = false;
        };
    }, [
        activeMicrosoftAccount,
        dispatch,
        expectedMicrosoftEmail,
        instance,
        isEditMode,
        isOpen,
        resolvedCalendarId,
    ]);

    const handleCreateEventDateChange = (nextDateValue) => {
        setCreateEventDateValue(clampCreateEventDateValue(nextDateValue));
    };

    const handleCreateEventStartTimeChange = (nextStartTimeValue) => {
        setCreateEventStartTimeValue(nextStartTimeValue);
        setCreateEventEndTimeValue(addMinutesToTimeValue(nextStartTimeValue, CREATE_EVENT_DEFAULT_DURATION_MINUTES));
    };

    const handleCreateEventEndTimeChange = (nextEndTimeValue) => {
        setCreateEventEndTimeValue(nextEndTimeValue);
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
        if (isLeadAssignmentLocked) {
            return;
        }

        if (createEventType === "Cita" && !isChecked) {
            return;
        }

        setIsCreateEventLeadEnabled(isChecked);

        if (!isChecked) {
            setCreateEventLeadId("");
            setIsLeadInvitationEnabled(false);
        }
    };

    const openRoomSuggestions = async () => {
        setIsRoomSuggestionsOpen(true);

        if (roomDirectoryOptions.length || isLoadingRoomDirectory) {
            return;
        }

        await loadRoomDirectory();
    };

    const closeRoomSuggestions = () => {
        setIsRoomSuggestionsOpen(false);
    };

    const handleCreateEventLocationChange = (nextLocationValue) => {
        setRoomSearchText(nextLocationValue);
        setCreateEventLocation(nextLocationValue);
        setIsRoomSuggestionsOpen(true);

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
        setRoomSearchText(roomItem.displayName);
        setIsRoomSuggestionsOpen(false);
    };

    const clearSelectedRoomOption = () => {
        setSelectedRoomOption(null);
        setCreateEventLocation("");
        setRoomSearchText("");
        setIsRoomSuggestionsOpen(false);
    };

    const shiftCreateEventDate = (daysToMove) => {
        const nextDate = new Date(`${createEventDateValue}T00:00:00`);
        nextDate.setDate(nextDate.getDate() + daysToMove);
        setCreateEventDateValue(clampCreateEventDateValue(formatDateInputValue(nextDate)));
    };

    const handleUpdateCalendarEventStatus = async (statusAction) => {
        if (!resolvedCalendarId) {
            return;
        }

        const leadStatusValue = createEventLeadStatus || initialEventData?.segimineto_lead || "";

        setIsUpdatingEventStatus(true);
        setCreateEventSubmitError("");

        try {
            const linkedOutlookEventId = typeof initialEventData?.outlook_event_id === "string"
                ? initialEventData.outlook_event_id.trim()
                : "";

            if (statusAction === "cancel" && linkedOutlookEventId) {
                if (!activeMicrosoftAccount) {
                    throw new Error("No Microsoft account available for event deletion.");
                }

                let tokenResponse;

                try {
                    tokenResponse = await instance.acquireTokenSilent({
                        scopes: [...new Set([...loginRequest.scopes, OUTLOOK_CREATE_EVENT_SCOPE])],
                        account: activeMicrosoftAccount,
                    });
                } catch (error) {
                    if (!(error instanceof InteractionRequiredAuthError)) {
                        throw error;
                    }

                    tokenResponse = await instance.acquireTokenPopup({
                        scopes: [...new Set([...loginRequest.scopes, OUTLOOK_CREATE_EVENT_SCOPE])],
                        account: activeMicrosoftAccount || undefined,
                        loginHint: expectedMicrosoftEmail || undefined,
                        prompt: "select_account",
                    });
                }

                const outlookDeleted = await deleteOutlookEventById(
                    tokenResponse.accessToken,
                    linkedOutlookEventId,
                );

                if (!outlookDeleted) {
                    throw new Error("Outlook event delete failed.");
                }

                const crmDeleteResponse = await dispatch(deleteOutlookEventForLead({
                    id_calendar: resolvedCalendarId,
                    leadId: Number(createEventLeadId || initialEventData?.idinterno_lead || initialEventData?.id_lead || 0),
                }, leadStatusValue));
                const crmDeleteSucceeded = crmDeleteResponse?.ok && crmDeleteResponse?.data?.ok !== false;

                if (!crmDeleteSucceeded) {
                    throw new Error("CRM linked Outlook event delete failed.");
                }
            } else {
                await dispatch(
                    updateStatusEvent(
                        resolvedCalendarId,
                        statusAction === "complete" ? 1 : 0,
                        Number(createEventLeadId || initialEventData?.idinterno_lead || initialEventData?.id_lead || 0),
                        leadStatusValue,
                        0,
                        statusAction === "complete" ? 2 : 3,
                    ),
                );
            }

            onClose();

            window.setTimeout(() => {
                Swal.fire({
                    title: statusAction === "complete" ? "Evento completado" : "Evento cancelado",
                    icon: "success",
                    target: document.body,
                });
            }, 180);
        } catch (error) {
            setCreateEventSubmitError(
                statusAction === "complete"
                    ? "No se pudo completar el evento."
                    : "No se pudo cancelar el evento.",
            );
        } finally {
            setIsUpdatingEventStatus(false);
        }
    };

    const handleCompleteCalendarEvent = () => handleUpdateCalendarEventStatus("complete");

    const handleCancelCalendarEvent = () => handleUpdateCalendarEventStatus("cancel");

    const handleReactivateCalendarEvent = async () => {
        if (!resolvedCalendarId) {
            return;
        }

        const leadStatusValue = createEventLeadStatus || initialEventData?.segimineto_lead || "";

        setIsUpdatingEventStatus(true);
        setCreateEventSubmitError("");

        try {
            await dispatch(
                updateStatusEvent(
                    resolvedCalendarId,
                    3,
                    Number(createEventLeadId || initialEventData?.idinterno_lead || initialEventData?.id_lead || 0),
                    leadStatusValue,
                    1,
                    1,
                ),
            );

            setCurrentCrmStatus("Pendiente");
            onClose();

            window.setTimeout(() => {
                Swal.fire({
                    title: "Evento reactivado",
                    icon: "success",
                    target: document.body,
                });
                window.location.reload();
            }, 180);
        } catch (error) {
            setCreateEventSubmitError("No se pudo reactivar el evento.");
        } finally {
            setIsUpdatingEventStatus(false);
        }
    };

    const handleSubmitOutlookEvent = async () => {
        if (!createEventTitle.trim()) {
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
                    scopes: [...new Set([...loginRequest.scopes, OUTLOOK_CREATE_EVENT_SCOPE])],
                    account: activeMicrosoftAccount || accounts[0],
                });
            } catch (error) {
                if (!(error instanceof InteractionRequiredAuthError)) {
                    throw error;
                }

                tokenResponse = await instance.acquireTokenPopup({
                    scopes: [...new Set([...loginRequest.scopes, OUTLOOK_CREATE_EVENT_SCOPE])],
                    account: activeMicrosoftAccount || undefined,
                    loginHint: expectedMicrosoftEmail || undefined,
                    prompt: "select_account",
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
            const graphPayload = {
                subject: createEventTitle.trim(),
                body: {
                    contentType: "HTML",
                    content: createEventDescription
                        ? plainTextToOutlookHtml(createEventDescription)
                        : "Evento creado desde CRM Ventas.",
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

            if (requiredAttendees.length) {
                graphPayload.attendees = requiredAttendees;
            }

            if (isEditMode) {
                const outlookEventId = initialEventData?.outlook_event_id || "";

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

                if (resolvedCalendarId) {
                    const crmUpdateResponse = await dispatch(updateOutlookEventForLeadDetails({
                        id_calendar: resolvedCalendarId,
                        idnetsuite_admin,
                        nombreEvento: createEventTitle.trim(),
                        tipoEvento: createEventType,
                        descripcionEvento: createEventDescription,
                        formatdateIni: toGraphDateTime(createEventScheduleRange.start),
                        formatdateFin: toGraphDateTime(createEventScheduleRange.end),
                        horaInicio: createEventStartTimeValue,
                        horaFinal: createEventEndTimeValue,
                        leadId: requiresCreateEventLeadAssignment ? Number(createEventLeadId || 0) : 0,
                        colorEvento: getCreateEventColor(createEventType),
                        citaValue: createEventType === "Cita" ? 1 : 0,
                        id_proyecto: shouldShowCreateEventProjectSelect ? Number(createEventProjectId || 0) : 0,
                        nombre_proyecto: shouldShowCreateEventProjectSelect ? (createEventProjectLabel || "0") : "0",
                        copiaJefe: 1,
                    }, createEventLeadStatus));

                    const crmUpdateSucceeded = crmUpdateResponse?.ok && crmUpdateResponse?.data?.ok !== false;

                    if (!crmUpdateSucceeded) {
                        throw new Error("CRM update event failed.");
                    }
                } else if (outlookEventId) {
                    const crmCreateResponse = await dispatch(createOutlookEventForLead({
                        idnetsuite_admin,
                        nombreEvento: createEventTitle.trim(),
                        tipoEvento: createEventType,
                        descripcionEvento: createEventDescription,
                        formatdateIni: toGraphDateTime(createEventScheduleRange.start),
                        formatdateFin: toGraphDateTime(createEventScheduleRange.end),
                        horaInicio: createEventStartTimeValue,
                        horaFinal: createEventEndTimeValue,
                        leadId: requiresCreateEventLeadAssignment ? Number(createEventLeadId || 0) : 0,
                        colorEvento: getCreateEventColor(createEventType),
                        citaValue: createEventType === "Cita" ? 1 : 0,
                        id_proyecto: shouldShowCreateEventProjectSelect ? Number(createEventProjectId || 0) : 0,
                        nombre_proyecto: shouldShowCreateEventProjectSelect ? (createEventProjectLabel || "0") : "0",
                        copiaJefe: 1,
                        outlook_event_id: outlookEventId,
                    }, createEventLeadStatus));

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

                const outlookResponse = await fetch("https://graph.microsoft.com/v1.0/me/events", {
                    method: "POST",
                    headers: {
                        Authorization: `Bearer ${tokenResponse.accessToken}`,
                        "Content-Type": "application/json",
                        Prefer: `outlook.timezone="${OUTLOOK_TIMEZONE}"`,
                    },
                    body: JSON.stringify(graphPayload),
                });

                if (!outlookResponse.ok) {
                    throw new Error(`Graph create event HTTP ${outlookResponse.status}`);
                }

                const createdOutlookEvent = await outlookResponse.json();
                const createdOutlookEventId = createdOutlookEvent?.id || "";

                if (!createdOutlookEventId) {
                    throw new Error("Graph create event did not return id.");
                }

                const crmCreateResponse = await dispatch(createOutlookEventForLead({
                    idnetsuite_admin,
                    nombreEvento: createEventTitle.trim(),
                    tipoEvento: createEventType,
                    descripcionEvento: createEventDescription,
                    formatdateIni: toGraphDateTime(createEventScheduleRange.start),
                    formatdateFin: toGraphDateTime(createEventScheduleRange.end),
                    horaInicio: createEventStartTimeValue,
                    horaFinal: createEventEndTimeValue,
                    leadId: requiresCreateEventLeadAssignment ? Number(createEventLeadId || 0) : 0,
                    colorEvento: getCreateEventColor(createEventType),
                    citaValue: createEventType === "Cita" ? 1 : 0,
                    id_proyecto: shouldShowCreateEventProjectSelect ? Number(createEventProjectId || 0) : 0,
                    nombre_proyecto: shouldShowCreateEventProjectSelect ? (createEventProjectLabel || "0") : "0",
                    copiaJefe: 1,
                    outlook_event_id: createdOutlookEventId,
                }, createEventLeadStatus));

                const crmCreateSucceeded = crmCreateResponse?.ok && crmCreateResponse?.data?.ok !== false;

                if (!crmCreateSucceeded) {
                    throw new Error("CRM create event failed.");
                }
            }

            onClose();

            window.setTimeout(() => {
                Swal.fire({
                    title: isEditMode ? "Evento actualizado" : "Evento creado",
                    text: "El evento se creó en Outlook y CRM.",
                    icon: "success",
                    target: document.body,
                });
            }, 180);
        } catch (error) {
            console.error("[lead-outlook-create-event] no se pudo guardar el evento", error);
            setCreateEventSubmitError(
                isEditMode
                    ? "No se pudo actualizar el evento en Outlook y CRM."
                    : "No se pudo guardar el evento en Outlook y CRM.",
            );
        } finally {
            setIsSavingCreateEvent(false);
        }
    };

    return (
        <OutlookCreateEventModal
            applyMeetingSuggestion={() => {}}
            areAllParticipantsAvailable
            attendeeAvailabilityStatuses={{}}
            attendeeDirectoryError={attendeeDirectoryError}
            attendeeDirectoryOptions={attendeeDirectoryOptions}
            attendeeSearchText={attendeeSearchText}
            canShowEditStatusActions={canShowEditStatusActions}
            canShowReactivateAction={canShowReactivateAction}
            clearSelectedRoomOption={clearSelectedRoomOption}
            closeCreateEventModal={onClose}
            closeRoomSuggestions={closeRoomSuggestions}
            createEventCalendarLabel={activeMicrosoftAccount?.username || microsoftUser?.email || email_admin || "sin-correo"}
            createEventDateTimeLabel={createEventDateTimeLabel}
            createEventDateValue={createEventDateValue}
            createEventDescription={createEventDescription}
            createEventEndTimeOptions={createEventEndTimeOptions}
            createEventEndTimeValue={createEventEndTimeValue}
            createEventHeaderLabel={createEventHeaderLabel}
            createEventLeadEmail={createEventLeadEmail}
            createEventLeadId={createEventLeadId}
            createEventLeadLabel={createEventLeadLabel}
            createEventLeadOptions={createEventLeadOptions}
            createEventLeadOptionsError={createEventLeadOptionsError}
            createEventLocation={createEventLocation}
            createEventMinimumDateValue={createEventMinimumDateValue}
            createEventMode={isEditMode ? "edit" : "create"}
            createEventPreviewPosition={createEventPreviewPosition}
            createEventProjectId={createEventProjectId}
            createEventProjectLabel={createEventProjectLabel}
            createEventProjectOptions={createEventProjectOptions}
            createEventProjectOptionsError={createEventProjectOptionsError}
            createEventScheduleLabel={createEventScheduleLabel}
            createEventScheduleRange={createEventScheduleRange}
            createEventStartTimeValue={createEventStartTimeValue}
            createEventSubmitError={createEventSubmitError}
            createEventSubmitLabel={isEditMode ? "Guardar cambios" : "Guardar"}
            createEventTimeOptions={createEventTimeOptions}
            createEventTitle={createEventTitle}
            createEventType={createEventType}
            createEventTypeOptions={CREATE_EVENT_TYPE_OPTIONS}
            createEventWeekLabel={createEventWeekLabel}
            createEventWindowTitle={isEditMode ? "Editar evento: Calendario" : "Nuevo evento: Calendario"}
            handleCancelCalendarEvent={handleCancelCalendarEvent}
            handleCompleteCalendarEvent={handleCompleteCalendarEvent}
            handleReactivateCalendarEvent={handleReactivateCalendarEvent}
            handleCreateEventDateChange={handleCreateEventDateChange}
            handleCreateEventEndTimeChange={handleCreateEventEndTimeChange}
            handleCreateEventLeadToggle={handleCreateEventLeadToggle}
            handleCreateEventLocationChange={handleCreateEventLocationChange}
            handleCreateEventStartTimeChange={handleCreateEventStartTimeChange}
            handleCreateEventTypeChange={handleCreateEventTypeChange}
            handleSelectRoomOption={handleSelectRoomOption}
            handleSubmitOutlookEvent={handleSubmitOutlookEvent}
            hasCreateEventTitle={Boolean(createEventTitle.trim())}
            hasMoreRoomSuggestions={false}
            hasTouchedCreateEventTitle={hasTouchedCreateEventTitle}
            isCreateEventLeadEnabled={isCreateEventLeadEnabled}
            isCreateEventModalOpen={isOpen}
            isCreateTeamsMeeting={isCreateTeamsMeeting}
            isLeadInvitationEnabled={isLeadInvitationEnabled}
            isLoadingAttendeeDirectory={isLoadingAttendeeDirectory}
            isLoadingCreateEventLeadOptions={isLoadingCreateEventLeadOptions}
            isLoadingCreateEventProjectOptions={isLoadingCreateEventProjectOptions}
            isLoadingMeetingSuggestions={false}
            isLoadingRoomAvailability={false}
            isLoadingRoomDirectory={isLoadingRoomDirectory}
            isLoadingScheduleAvailability={false}
            isOwnerAvailable
            isPrimaryScheduleAvailable
            isRoomAvailable
            isRoomSuggestionsOpen={isRoomSuggestionsOpen}
            isSavingCreateEvent={isSavingCreateEvent}
            isScheduleEditorOpen={isScheduleEditorOpen}
            isUpdatingEventStatus={isUpdatingEventStatus}
            meetingSuggestions={[]}
            meetingSuggestionsError=""
            openAttendeeSuggestions={openAttendeeSuggestions}
            openRoomSuggestions={openRoomSuggestions}
            previewBusyBlocks={[]}
            previewParticipants={previewParticipants}
            roomDirectoryError={roomDirectoryError}
            roomSearchText={roomSearchText}
            roomSuggestionOptions={roomSuggestionOptions}
            roomSuggestionSearchValue={roomSuggestionSearchValue}
            scheduleAvailabilityError=""
            selectedAttendees={selectedAttendees}
            selectedRoomOption={selectedRoomOption}
            setAttendeeSearchText={setAttendeeSearchText}
            setCreateEventDescription={setCreateEventDescription}
            setCreateEventLeadId={setCreateEventLeadId}
            setCreateEventProjectId={setCreateEventProjectId}
            setCreateEventTitle={setCreateEventTitle}
            setHasTouchedCreateEventTitle={setHasTouchedCreateEventTitle}
            setIsCreateTeamsMeeting={setIsCreateTeamsMeeting}
            setIsLeadInvitationEnabled={setIsLeadInvitationEnabled}
            setIsScheduleEditorOpen={setIsScheduleEditorOpen}
            setSelectedAttendees={setSelectedAttendees}
            setShowAllRoomSuggestions={() => {}}
            isLeadAssignmentLocked={isLeadAssignmentLocked}
            shouldShowCreateEventLeadSelect={shouldShowCreateEventLeadSelect}
            shouldShowCreateEventProjectSelect={shouldShowCreateEventProjectSelect}
            shiftCreateEventDate={shiftCreateEventDate}
            toGraphDateTime={toGraphDateTime}
        />
    );
};
