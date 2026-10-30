import { apiRequest } from "../api/api-client";
import { type NoteModule } from "./notes-service";

export interface NoteNotification {
    id: string;
    kind: "shared" | "reply" | "mention" | "assigned" | "reminder" | "due";
    actor: { publicId: string; displayName: string };
    noteId: string;
    /** Which note the notice is about. */
    note: { title: string | null; excerpt: string };
    /** What the actor wrote, for replies and mentions; null for invitations. */
    replyExcerpt: string | null;
    moduleCode: NoteModule;
    createdAt: string;
    readAt: string | null;
}
export interface NoteNotifications {
    schemaVersion: 1;
    items: NoteNotification[];
    page: { number: number; size: number; total: number };
    unreadCount: number;
    observedAt: string;
}
export interface NoteUnreadCount {
    count: number;
    countIsLowerBound: boolean;
}
const invalid = (): never => {
    throw new Error("Invalid note notifications response");
};
const record = (v: unknown): Record<string, unknown> => (v !== null && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : invalid());
const string = (v: unknown, max: number): string => (typeof v === "string" && v.length <= max ? v : invalid());
const id = (v: unknown): string => (/^[0-7][0-9A-HJKMNP-TV-Z]{25}$/.test(string(v, 26)) ? (v as string) : invalid());
const integer = (v: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): number => (typeof v === "number" && Number.isSafeInteger(v) && v >= min && v <= max ? v : invalid());
const timestamp = (v: unknown): string => (/^\d{4}-\d{2}-\d{2}T/.test(string(v, 40)) && Number.isFinite(Date.parse(v as string)) ? (v as string) : invalid());
const optionalText = (v: unknown, max: number): string | null => (v === undefined || v === null ? null : string(v, max));
const choice = <T extends string>(v: unknown, options: readonly T[]): T => (options.includes(v as T) ? (v as T) : invalid());
function parseNotification(value: unknown): NoteNotification {
    const n = record(value),
        actor = record(n.actor),
        note = n.note === undefined ? {} : record(n.note);
    return {
        id: id(n.id),
        kind: choice(n.kind, ["shared", "reply", "mention", "assigned", "reminder", "due"]),
        actor: { publicId: id(actor.publicId), displayName: string(actor.displayName, 200) },
        noteId: id(n.noteId),
        note: { title: optionalText(note.title, 300), excerpt: optionalText(note.excerpt, 400) ?? "" },
        replyExcerpt: optionalText(n.replyExcerpt, 400),
        moduleCode: choice(n.moduleCode, ["ventas", "mercadeo", "formalizacion", "contabilidad", "administration"]),
        createdAt: timestamp(n.createdAt),
        readAt: n.readAt === null ? null : timestamp(n.readAt),
    };
}
function validatePage(pagination: NoteNotifications["page"], page: number, items: NoteNotification[]): void {
    if (pagination.number !== page || new Set(items.map((n) => n.id)).size !== items.length) invalid();
    if (items.length && (pagination.number - 1) * pagination.size + items.length > pagination.total) invalid();
}
/** Reads metadata only; opening the bell never marks notifications read. */
export async function getNoteNotifications(filter: "all" | "unread" | "mentions" = "all", page = 1): Promise<NoteNotifications> {
    const query = new URLSearchParams({ filter, page: String(integer(page, 1, 1000)), pageSize: "25" });
    const r = record(await apiRequest<unknown>(`/notifications?${query}`)),
        p = record(r.page);
    if (r.schemaVersion !== 1 || !Array.isArray(r.items) || r.items.length > 25) invalid();
    const items = (r.items as unknown[]).map(parseNotification);
    const pagination = { number: integer(p.number, 1, 1000), size: integer(p.size, 25, 25), total: integer(p.total) };
    validatePage(pagination, page, items);
    return { schemaVersion: 1, items, page: pagination, unreadCount: integer(r.unreadCount), observedAt: timestamp(r.observedAt) };
}
/** The optional server flag explicitly identifies a bounded lower-bound count. */
export async function getNoteUnreadCount(): Promise<NoteUnreadCount> {
    const r = record(await apiRequest<unknown>("/notifications/unread-count"));
    const flag = r.countIsLowerBound === undefined ? false : r.countIsLowerBound;
    if (typeof flag !== "boolean") invalid();
    return { count: integer(r.count), countIsLowerBound: flag as boolean };
}
/** Marks one current-recipient notification read only after explicit user action. */
export async function markNoteNotificationRead(notificationId: string): Promise<void> {
    await apiRequest<unknown>(`/notifications/${id(notificationId)}/read`, { method: "PUT", retryOnUnauthorized: false });
}
/** Uses the list's observedAt cutoff so later events cannot be marked read accidentally. */
export async function markAllNoteNotificationsRead(through: string): Promise<void> {
    await apiRequest<unknown>("/notifications/read-all", { method: "PUT", body: { through: timestamp(through) }, retryOnUnauthorized: false });
}
