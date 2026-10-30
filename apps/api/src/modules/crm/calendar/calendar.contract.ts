import { z } from "zod";

export const CALENDAR_MODULES = ["formalizacion", "mercadeo", "ventas", "contabilidad"] as const;
export type CalendarModuleCode = (typeof CALENDAR_MODULES)[number];
export const CALENDAR_MODULE_LABELS: Readonly<Record<CalendarModuleCode, string>> = { formalizacion: "Formalización", mercadeo: "Mercadeo", ventas: "Ventas", contabilidad: "Contabilidad" };
export const CALENDAR_COLORS: Readonly<Record<CalendarModuleCode, string>> = { formalizacion: "#496180", mercadeo: "#7c4a9e", ventas: "#147849", contabilidad: "#a86308" };
const publicId = z.string().regex(/^[0-7][0-9A-HJKMNP-TV-Z]{25}$/);
const instant = z.iso.datetime().refine((value) => Number.isFinite(Date.parse(value)));
const text = (length: number) => z.string().trim().max(length);
export const calendarParticipant = z.strictObject({ userId: publicId.optional(), email: z.string().trim().toLowerCase().pipe(z.email().max(254)).optional() }).refine((value) => Boolean(value.userId) !== Boolean(value.email), "Exactly one participant identity is required");
export const calendarLink = z.strictObject({ entityType: z.enum(["note", "lead", "sales_order"]), source: z.enum(["native", "legacy"]), id: text(160).min(1) }).refine((link) => (link.source === "native" ? /^[0-7][0-9A-HJKMNP-TV-Z]{25}$/.test(link.id) : link.entityType !== "note" && /^[1-9][0-9]{0,19}$/.test(link.id)), "Invalid source identity");
export type CalendarParticipant = z.infer<typeof calendarParticipant>;
export type CalendarLink = z.infer<typeof calendarLink>;
export interface CalendarSelectionOption {
    id: string;
    source: "native" | "legacy";
    label: string;
    secondary?: string;
}
export type CalendarSelectionOptions = Partial<Record<"users" | "notes" | "leads" | "orders", CalendarSelectionOption[]>>;
export const calendarEventInput = z.strictObject({
    moduleCode: z.enum(CALENDAR_MODULES),
    typeId: publicId,
    title: text(250).min(1),
    description: text(4000).nullable().optional(),
    location: text(500).nullable().optional(),
    start: instant,
    end: instant,
    allDay: z.boolean(),
    participants: z.array(calendarParticipant).max(100).optional(),
    links: z.array(calendarLink).max(100).optional(),
    details: z.strictObject({ reference: text(160).optional(), teamsRequested: z.boolean().optional() }).default({}),
    operationId: z.uuid(),
});
export const calendarEventUpdate = calendarEventInput.extend({ expectedVersion: z.number().int().min(1).max(4294967294) });
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
export interface CalendarEvent {
    id: string;
    source: "native" | "legacy";
    originModule: CalendarModuleCode;
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
    formKey: string;
    details: { reference?: string; teamsRequested?: boolean };
    participants?: CalendarParticipant[] | undefined;
    links?: CalendarLink[] | undefined;
    /** False when existing relations cannot be exposed or replaced by this actor. */
    linksEditable?: boolean;
    /** Authorized presentation labels; never trusted as command data. */
    selectionOptions?: CalendarSelectionOptions | undefined;
}
/** Internal fields never reach HTTP; ownership is checked before projecting a row. */
export interface CalendarRow extends Omit<CalendarEvent, "canEdit" | "allDay" | "details"> {
    internalId: number;
    ownerPublicId: string;
    allDay: number;
    details: unknown;
}
export const CALENDAR_LEGACY_READER = Symbol("CALENDAR_LEGACY_READER");
