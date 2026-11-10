import type { CalendarRow, OutlookEventDetail } from "./calendar.contract.js";

export const EXTERNAL_CALENDAR = Symbol("EXTERNAL_CALENDAR");
export interface ExternalSlot {
    start: string;
    end: string;
}
export interface ExternalBusyEvent extends ExternalSlot {
    id: string;
    title: string;
    allDay: boolean;
}
export interface ExternalFeedEvent extends ExternalBusyEvent {
    uid?: string | undefined;
    version?: string | undefined;
    description: string | null;
    location: string | null;
    outlook?: OutlookEventDetail | undefined;
}
/** `unknown` no es libre: no se pudo confirmar el horario y la sala no se ofrece como disponible. */
export type RoomAvailability = "available" | "busy" | "unknown";
export interface ExternalRoom {
    address: string;
    label: string;
    capacity: number | null;
    availability?: RoomAvailability;
}
export interface ExternalAvailability {
    events: ExternalBusyEvent[];
    conflicts: { label: string; start: string; end: string }[];
    suggestions: ExternalSlot[];
    incomplete: boolean;
    suggestionsStatus?: "available" | "consent_required" | "unavailable";
}
export interface ExternalWrite {
    isOrganizer?: boolean;
    id: string;
    uid?: string | undefined;
    version: string;
    joinUrl: string | null;
    roomStatus: string | null;
}
export interface ExternalEventPatch extends ExternalSlot {
    title: string;
    location: string;
    allDay: boolean;
    expectedVersion: string;
}
/** El detalle del proveedor no cruza la frontera pública de errores. */
export class ExternalCalendarError extends Error {
    /** Solo conserva códigos sanitizados del proveedor. */
    constructor(readonly code: "consent_required" | "unavailable" | "conflict") {
        super(code);
    }
}
/** El adaptador recibe credenciales solo en memoria del servidor y devuelve datos canónicos. */
export interface ExternalCalendarPort {
    cancel(token: string, id: string, version: string | null, reason: string): Promise<void>;
    patchOwnEvent(token: string, id: string, input: ExternalEventPatch): Promise<ExternalWrite>;
    events(token: string, input: ExternalSlot): Promise<ExternalFeedEvent[]>;
    availability(token: string, input: ExternalSlot & { emails: string[]; roomAddress?: string; excludeId?: string }): Promise<ExternalAvailability>;
    suggestions(token: string, input: ExternalSlot & { emails: string[]; roomAddress?: string }): Promise<ExternalSlot[]>;
    read(token: string, id: string, roomAddress?: string): Promise<ExternalWrite>;
    rooms(token: string): Promise<ExternalRoom[]>;
    roomAvailability(token: string, input: ExternalSlot & { addresses: string[] }): Promise<Record<string, RoomAvailability>>;
    write(token: string, input: { event: CalendarRow; emails: string[]; remoteId: string | null; remoteVersion: string | null; transactionId: string; roomAddress?: string }): Promise<ExternalWrite>;
}
