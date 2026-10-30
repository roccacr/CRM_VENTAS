import { apiRequest } from "../api/api-client";
import type { NoteModule } from "./notes-service";

export interface NoteWorkflow {
    schemaVersion: 1;
    version: number;
    assignee: { publicId: string; displayName: string } | null;
    dueAt: string | null;
    reminder: { remindAt: string; status: "pending" | "delivered" | "suppressed" | "cancelled" } | null;
    canManage: boolean;
}
export interface NoteLocation {
    moduleCode: NoteModule;
    code: string;
}
export interface NoteLocations {
    schemaVersion: 1;
    version: number;
    locations: NoteLocation[];
    availableLocations: NoteLocation[];
    canManage: boolean;
}
export interface NoteActivity {
    id: string;
    action: string;
    actor: { publicId: string; displayName: string } | null;
    createdAt: string;
    details: string | null;
}
const invalid = (): never => {
    throw new Error("Invalid note workflow response");
};
const record = (v: unknown): Record<string, unknown> => (v !== null && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : invalid());
const text = (v: unknown, max = 200): string => (typeof v === "string" && v.length <= max ? v : invalid());
const id = (v: unknown): string => (/^[0-7][0-9A-HJKMNP-TV-Z]{25}$/.test(text(v, 26)) ? (v as string) : invalid());
const integer = (v: unknown, minimum = 1): number => (typeof v === "number" && Number.isSafeInteger(v) && v >= minimum ? v : invalid());
const bool = (v: unknown): boolean => (typeof v === "boolean" ? v : invalid());
const time = (v: unknown): string => (/^\d{4}-\d{2}-\d{2}T/.test(text(v, 40)) && Number.isFinite(Date.parse(v as string)) ? (v as string) : invalid());
const nullableTime = (v: unknown) => (v === null ? null : time(v));
const actor = (v: unknown) => {
    const r = record(v);
    return { publicId: id(r.publicId), displayName: text(r.displayName) };
};
const path = (noteId: string) => `/note-workflow/notes/${id(noteId)}`;
function workflow(value: unknown): NoteWorkflow {
    const r = record(value);
    if (r.schemaVersion !== 1) invalid();
    const reminder = r.reminder === null ? null : record(r.reminder);
    if (reminder && !["pending", "delivered", "suppressed", "cancelled"].includes(text(reminder.status))) invalid();
    return { schemaVersion: 1, version: integer(r.version, 0), assignee: r.assignee === null ? null : actor(r.assignee), dueAt: nullableTime(r.dueAt), reminder: reminder ? { remindAt: time(reminder.remindAt), status: reminder.status as "pending" | "delivered" | "suppressed" | "cancelled" } : null, canManage: bool(r.canManage) };
}
/** Reads only the caller's reminder and authorized task metadata. */
export async function getNoteWorkflow(noteId: string): Promise<NoteWorkflow> {
    return workflow(await apiRequest<unknown>(path(noteId)));
}
/** The original operation key must survive uncertain responses. */
export async function saveNoteTask(noteId: string, body: { operationId: string; expectedVersion: number; assigneeUserId: string | null; dueAt: string | null }): Promise<void> {
    await apiRequest<unknown>(`${path(noteId)}/task`, { method: "PUT", body, retryOnUnauthorized: false });
}
/** Null cancels only the current reader's reminder. */
export async function saveNoteReminder(noteId: string, body: { operationId: string; remindAt: string | null }): Promise<void> {
    await apiRequest<unknown>(`${path(noteId)}/reminder`, { method: "PUT", body, retryOnUnauthorized: false });
}
/** Display locations never replace the note's canonical record identity or share access. */
export async function getNoteLocations(noteId: string): Promise<NoteLocations> {
    const r = record(await apiRequest<unknown>(`/note-collaboration/notes/${id(noteId)}/locations`));
    if (r.schemaVersion !== 1 || !Array.isArray(r.locations) || r.locations.length > 5) invalid();
    const locations = parseAvailableLocations(r.locations);
    const availableLocations = r.availableLocations === undefined ? [] : parseAvailableLocations(r.availableLocations);
    return { schemaVersion: 1, version: integer(r.version), locations, availableLocations, canManage: bool(r.canManage) };
}
/** Atomically replaces display references against the shown collaboration version. */
export async function saveNoteLocations(noteId: string, body: { operationId: string; expectedCollaborationVersion: number; locations: NoteLocation[] }): Promise<void> {
    await apiRequest<unknown>(`/note-collaboration/notes/${id(noteId)}/locations`, { method: "PUT", body, retryOnUnauthorized: false });
}
/** Reads sanitized event metadata; no previous note text is exposed. */
export async function getNoteActivity(noteId: string, page = 1): Promise<{ items: NoteActivity[]; page: { number: number; size: number; total: number } }> {
    const r = record(await apiRequest<unknown>(`/note-collaboration/notes/${id(noteId)}/activity?page=${String(integer(page))}`));
    if (r.schemaVersion !== 1 || !Array.isArray(r.items) || r.items.length > 100) invalid();
    const items = (r.items as unknown[]).map((v) => {
        const a = record(v);
        return { id: id(a.id), action: text(a.action, 100), actor: a.actor === null ? null : actor(a.actor), createdAt: time(a.createdAt), details: a.details === null ? null : text(a.details, 1000) };
    });
    const pagination = record(r.page);
    const total = pagination.total;
    validateActivityPage(pagination, page, items.length);
    return { items, page: { number: page, size: 100, total: total as number } };
}

function parseAvailableLocations(value: unknown): NoteLocation[] {
    if (!Array.isArray(value) || value.length > 5) invalid();
    const locations = (value as unknown[]).map((v) => {
        const r = record(v);
        const moduleCode = text(r.moduleCode);
        if (!["ventas", "mercadeo", "formalizacion", "contabilidad", "administration"].includes(moduleCode)) invalid();
        return { moduleCode: moduleCode as NoteModule, code: text(r.code, 80) };
    });
    if (new Set(locations.map((location) => `${location.moduleCode}:${location.code}`)).size !== locations.length) invalid();
    return locations;
}

function validateActivityPage(pagination: Record<string, unknown>, page: number, count: number): void {
    const total = pagination.total;
    integer(total, 0);
    if (pagination.number !== page || pagination.size !== 100 || count > 100) invalid();
    if (count > 0 && (page - 1) * 100 + count > (total as number)) invalid();
}

export interface NoteWorkflowOverview {
    counts: { assigned: number; dueToday: number; overdue: number };
    truncated: boolean;
    timeZone: string;
}
/** Counts use the requested IANA time zone returned by the server. */
export async function getNoteWorkflowOverview(timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone): Promise<NoteWorkflowOverview> {
    const r = record(await apiRequest<unknown>(`/note-workflow/overview?${new URLSearchParams({ timeZone })}`)),
        counts = record(r.counts);
    if (r.schemaVersion !== 1 || r.timeZone !== timeZone) invalid();
    const count = (v: unknown): number => (typeof v === "number" && Number.isSafeInteger(v) && v >= 0 ? v : invalid());
    return { counts: { assigned: count(counts.assigned), dueToday: count(counts.dueToday), overdue: count(counts.overdue) }, truncated: bool(r.truncated), timeZone };
}
