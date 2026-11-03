import { useEffect, useState } from "react";

import { getIdentityProfile, startMicrosoftLogin } from "../../services/auth/auth-service";
import { closePopupIfOpen, openMicrosoftPopup, waitForMicrosoftPopupSession } from "../../services/auth/microsoft-popup-login";
import { type CalendarModule, getCalendarAvailability, getCalendarRooms, type OutlookAvailability, type OutlookResult, type OutlookRoom } from "../../services/calendar/calendar-service";
import { localToUtc } from "./calendar-time";
import type { CalendarFields } from "./useCalendarEventForm";
/** Un rango inválido mantiene las salas sin confirmación, nunca como libres. */
function roomInterval(fields: CalendarFields) {
    try {
        const start = localToUtc(fields.allDay ? `${fields.start.slice(0, 10)}T00:00` : fields.start);
        const end = localToUtc(fields.allDay ? `${fields.end.slice(0, 10)}T00:00` : fields.end);
        const duration = Date.parse(end) - Date.parse(start);
        return duration > 0 && duration <= 31 * 86400000 ? { start, end } : undefined;
    } catch {
        return undefined;
    }
}

/** Cada respuesta pertenece a su intervalo; una respuesta tardía nunca declara libre otro horario. */
export function useCalendarOutlook(fields: CalendarFields, moduleCode: CalendarModule, eventId: string | undefined, enabled: boolean) {
    const [snapshot, setSnapshot] = useState<{ key: string; result: OutlookResult<OutlookAvailability> } | null>(null);
    const [roomSnapshot, setRoomSnapshot] = useState<{ key: string; rooms: readonly OutlookRoom[]; status: string }>({ key: "", rooms: [], status: "" });
    const [revision, setRevision] = useState(0);
    const [connecting, setConnecting] = useState(false);
    const [connectionError, setConnectionError] = useState("");
    const userIds = JSON.stringify(fields.userIds);
    const key = JSON.stringify([moduleCode, fields.start, fields.end, fields.allDay, fields.roomAddress, userIds, eventId, revision]);
    const result = snapshot?.key === key ? snapshot.result : null;
    const roomsEnabled = enabled && Boolean(fields.typeId);
    const { start: roomStart, end: roomEnd } = roomInterval(fields) ?? {};
    const roomsKey = JSON.stringify([moduleCode, roomsEnabled, revision, roomStart, roomEnd]);
    const rooms = roomSnapshot.key === roomsKey ? roomSnapshot.rooms : [];
    const roomsStatus = roomSnapshot.key === roomsKey ? roomSnapshot.status : "";
    const roomsLoading = roomsEnabled && roomSnapshot.key !== roomsKey;
    useEffect(() => {
        if (!enabled || !fields.typeId) return;
        let active = true;
        const timer = setTimeout(() => {
            try {
                const start = localToUtc(fields.allDay ? `${fields.start.slice(0, 10)}T00:00` : fields.start);
                const end = localToUtc(fields.allDay ? `${fields.end.slice(0, 10)}T00:00` : fields.end);
                if (Date.parse(end) <= Date.parse(start)) return;
                void getCalendarAvailability({ moduleCode, start, end, userIds: JSON.parse(userIds) as string[], ...(fields.roomAddress ? { roomAddress: fields.roomAddress } : {}), ...(eventId ? { eventId } : {}) })
                    .then((value) => {
                        if (active) setSnapshot({ key, result: value });
                    })
                    .catch(() => {
                        if (active) setSnapshot({ key, result: { status: "unavailable" } });
                    });
            } catch {
                if (active) setSnapshot({ key, result: { status: "unavailable" } });
            }
        }, 500);
        return () => {
            active = false;
            clearTimeout(timer);
        };
    }, [enabled, fields.typeId, fields.start, fields.end, fields.allDay, fields.roomAddress, moduleCode, eventId, userIds, key]);
    useEffect(() => {
        if (!roomsEnabled) return;
        let active = true;
        const timer = setTimeout(() => {
            void getCalendarRooms(moduleCode, roomStart && roomEnd ? { start: roomStart, end: roomEnd } : undefined)
                .then((value) => {
                    if (!active) return;
                    setRoomSnapshot({ key: roomsKey, rooms: value.status === "connected" ? value.data : [], status: value.status === "connected" ? "" : "No se pudieron cargar las salas. Puedes escribir otra ubicación." });
                })
                .catch(() => {
                    if (active) {
                        setRoomSnapshot({ key: roomsKey, rooms: [], status: "No se pudieron cargar las salas. Puedes escribir otra ubicación." });
                    }
                });
        }, 350);
        return () => {
            active = false;
            clearTimeout(timer);
        };
    }, [roomsEnabled, roomsKey, moduleCode, roomStart, roomEnd]);
    const connect = async () => {
        if (connecting) return;
        const popup = openMicrosoftPopup();
        if (!popup && !window.confirm("Para conectar Microsoft se abrirá el inicio de sesión. El borrador no guardado se perderá. ¿Continuar?")) return;
        setConnecting(true);
        setConnectionError("");
        try {
            const before = await getIdentityProfile();
            const authorizationUrl = await startMicrosoftLogin(true);
            if (!popup) {
                window.location.assign(authorizationUrl);
                return;
            }
            popup.location.href = authorizationUrl;
            await waitForMicrosoftPopupSession(popup, before.session.publicId);
            const after = await getIdentityProfile();
            if (after.user.publicId !== before.user.publicId) {
                window.location.reload();
                return;
            }
            setRevision((value) => value + 1);
        } catch {
            closePopupIfOpen(popup);
            setConnectionError("No se completó la conexión. Inicia con la misma cuenta del CRM; los permisos pueden requerir aprobación del administrador.");
        } finally {
            setConnecting(false);
        }
    };
    return {
        result,
        rooms,
        roomsStatus,
        roomsLoading,
        connecting,
        connectionError,
        connect,
        retry: () => {
            setRevision((value) => value + 1);
        },
    };
}
