import { z } from "zod";

export const CALENDAR_MODULES = ["formalizacion", "mercadeo", "ventas"] as const;
export type CalendarModuleCode = (typeof CALENDAR_MODULES)[number];
export const CALENDAR_MODULE_LABELS: Readonly<Record<CalendarModuleCode, string>> = { formalizacion: "Formalización", mercadeo: "Mercadeo", ventas: "Ventas" };
export const CALENDAR_COLORS: Readonly<Record<CalendarModuleCode, string>> = { formalizacion: "#b4325a", mercadeo: "#7c4a9e", ventas: "#147849" };
const publicId = z.string().regex(/^[0-7][0-9A-HJKMNP-TV-Z]{25}$/);
const instant = z.iso.datetime().refine((value) => Number.isFinite(Date.parse(value)));
const text = (length: number) => z.string().trim().max(length);
/** Un participante es un usuario o un correo, no los dos ni ninguno. El objeto no admite campos de más. */
export const calendarParticipant = z.strictObject({ userId: publicId.optional(), email: z.string().trim().toLowerCase().pipe(z.email().max(254)).optional() }).refine((value) => Boolean(value.userId) !== Boolean(value.email), "Exactly one participant identity is required");
/** El nativo es un ULID. El legado no puede ser una nota y tiene que ser un entero positivo. */
export const calendarLink = z.strictObject({ entityType: z.enum(["note", "lead", "sales_order"]), source: z.enum(["native", "legacy"]), id: text(160).min(1) }).refine((link) => (link.source === "native" ? /^[0-7][0-9A-HJKMNP-TV-Z]{25}$/.test(link.id) : link.entityType !== "note" && /^[1-9][0-9]{0,19}$/.test(link.id)), "Invalid source identity");
export type CalendarParticipant = z.infer<typeof calendarParticipant>;
export type CalendarLink = z.infer<typeof calendarLink>;
export interface CalendarSelectionOption {
    id: string;
    source: "native" | "legacy";
    label: string;
    secondary?: string;
    lead?: { id: string; source: "native" | "legacy"; label: string };
}
export type CalendarSelectionOptions = Partial<Record<"users" | "notes" | "leads" | "orders", CalendarSelectionOption[]>>;
export const calendarEventInput = z.strictObject({
    moduleCode: z.enum(CALENDAR_MODULES),
    typeId: publicId,
    publishToCalendar: z.boolean().optional(),
    /** La versión de Outlook no admite `*` ni saltos de línea: no puede colarse en un encabezado. */
    expectedOutlookVersion: z
        .string()
        .min(1)
        .max(2048)
        .refine((value) => value !== "*" && !/[\r\n]/.test(value))
        .optional(),
    title: text(250).min(1),
    description: text(4000).nullable().optional(),
    location: text(500).nullable().optional(),
    start: instant,
    end: instant,
    allDay: z.boolean(),
    participants: z.array(calendarParticipant).max(100).optional(),
    links: z.array(calendarLink).max(100).optional(),
    details: z.strictObject({ reference: text(160).optional(), teamsRequested: z.boolean().optional(), roomAddress: z.email().max(254).optional() }).default({}),
    operationId: z.uuid(),
});
/** La versión esperada se detiene antes del tope de 32 bits: el siguiente valor todavía cabe. */
export const calendarEventUpdate = calendarEventInput.extend({ expectedVersion: z.number().int().min(1).max(4294967294) });
export const calendarStatusInput = z.strictObject({ moduleCode: z.enum(CALENDAR_MODULES), action: z.enum(["complete", "cancel", "reactivate"]), expectedStatus: z.enum(["scheduled", "completed", "cancelled"]), expectedVersion: z.number().int().min(1).max(4294967294), operationId: z.uuid(), expectedOutlookVersion: z.string().max(512).optional(), reason: text(1000).optional() }).refine((value) => value.action !== "cancel" || Boolean(value.reason?.trim()), "La cancelación requiere motivo.");
export type CalendarStatusInput = z.infer<typeof calendarStatusInput>;
export interface CalendarStatusTransition {
    status: "scheduled" | "completed" | "cancelled";
    expectedStatus: "scheduled" | "completed" | "cancelled";
    reason?: string | undefined;
}
export const calendarListQuery = z.strictObject({ moduleCodes: z.string().min(1).max(100), start: instant, end: instant, contextModule: z.enum(CALENDAR_MODULES) });
export type CalendarInput = z.infer<typeof calendarEventInput>;
export type CalendarUpdate = z.infer<typeof calendarEventUpdate>;
export interface CalendarType {
    id: string;
    moduleCode: CalendarModuleCode;
    code: string;
    label: string;
    color: string;
    formKey: string;
}
export type OutlookResponse = "accepted" | "declined" | "tentativelyAccepted" | "notResponded" | "organizer" | "none";
export interface OutlookPerson {
    name: string | null;
    email: string | null;
}
export interface OutlookAttendee extends OutlookPerson {
    kind: "required" | "optional" | "resource";
    response: OutlookResponse;
}
/** Hechos que Outlook ya tiene. No autorizan un registro del CRM ni una escritura de vuelta. */
export interface OutlookEventDetail {
    organizer: OutlookPerson | null;
    attendees: OutlookAttendee[];
    /** Total que reporta Outlook. `attendees` viene recortado y no es la lista completa. */
    attendeeCount: number;
    isOrganizer: boolean;
    myResponse: OutlookResponse | null;
    isOnlineMeeting: boolean;
    joinUrl: string | null;
    isRecurring: boolean;
    showAs: string | null;
    sensitivity: string | null;
    importance: "low" | "normal" | "high" | null;
    webLink: string | null;
}
export interface CalendarEvent {
    crmDetail?: CalendarCrmDetail | undefined;
    id: string;
    source: "native" | "legacy" | "outlook";
    originModule: CalendarModuleCode | null;
    outlookId?: string;
    outlookVersion?: string;
    /** Organizador, asistentes y reunión, tanto si el evento está sincronizado como si solo existe en Outlook. */
    outlookDetail?: OutlookEventDetail | undefined;
    typeId: string;
    typeCode: string;
    title: string;
    description: string | null;
    location: string | null;
    start: string;
    end: string;
    allDay: boolean;
    status: "scheduled" | "completed" | "cancelled";
    version: number;
    canEdit: boolean;
    canManageStatus?: boolean;
    formKey: string;
    details: { reference?: string; teamsRequested?: boolean; roomAddress?: string };
    participants?: CalendarParticipant[] | undefined;
    links?: CalendarLink[] | undefined;
    /** Falso cuando este actor no puede ver ni reemplazar las relaciones que ya tiene el evento. */
    linksEditable?: boolean;
    /** Bloqueo histórico de cliente y orden impuesto por el servidor al crear un Adéndum. */
    orderLinksLocked?: boolean;
    /** Rótulos para mostrar. No se aceptan como orden de escritura. */
    selectionOptions?: CalendarSelectionOptions | undefined;
}
/** Campos internos. No salen por HTTP. La propiedad se comprueba antes de proyectar la fila. */
export interface CalendarRow extends Omit<CalendarEvent, "canEdit" | "allDay" | "details" | "source" | "originModule"> {
    storedMetadata?: unknown;
    source: "native" | "legacy";
    originModule: CalendarModuleCode;
    internalId: number;
    ownerPublicId: string;
    allDay: number;
    details: unknown;
}
export const CALENDAR_LEGACY_READER = Symbol("CALENDAR_LEGACY_READER");
/** Datos de negocio CRM conservados aunque Outlook tenga otros valores. */
export interface CalendarCrmDetail {
    loaded: boolean;
    version: number;
    moduleCode: CalendarModuleCode;
    typeLabel: string;
    typeColor: string | null;
    colorOverride: string | null;
    title: string;
    description: string | null;
    location: string | null;
    start: string;
    end: string;
    allDay: boolean;
    status: CalendarEvent["status"];
    reference: string | null;
    teamsRequested: boolean;
    roomAddress: string | null;
    organizerName: string | null;
    timezone: string | null;
    cancellationReason: string | null;
    createdAt: string | null;
    updatedAt: string | null;
    invitationVersion: number | null;
    links: (CalendarLink & { label: string; secondary?: string; canOpen?: boolean })[];
    participants: { label: string; email: string | null }[];
    restrictedLinks: boolean;
}
