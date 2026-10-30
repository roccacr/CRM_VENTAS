import { apiRequest } from "../api/api-client";
import { type NoteRecordReference, type NoteRelatedRecord, parseRelatedRecords } from "./note-related-records-service";

export type NoteModule = "ventas" | "mercadeo" | "formalizacion" | "contabilidad" | "administration";
export type NoteContext = { kind: "personal" } | { kind: "view"; code?: string } | { kind: "sales_order"; source: "native" | "legacy"; id: string };
export interface NotePlacement {
    viewportClass: "desktop" | "tablet" | "mobile";
    anchorMode: "context" | "viewport";
    x: number;
    y: number;
    width: number;
    height: number;
    collapsed: boolean;
    hidden: boolean;
    layoutVersion: number;
}
export interface NoteFields {
    title: string | null;
    text: string;
    color: string;
    priority: "low" | "normal" | "high";
}
export interface PersonalNote {
    id: string;
    title: string | null;
    content: { format: "plain_text"; text: string };
    color: string;
    priority: NoteFields["priority"];
    status: "open" | "completed" | "archived";
    version: number;
    createdAt: string;
    updatedAt: string;
    author: { publicId: string; displayName: string };
    capabilities: { canEdit: boolean; canComplete: boolean; canReopen: boolean; canArchive: boolean; canMove: boolean; canShare?: boolean; canReply?: boolean; canMention?: boolean };
    myPlacements: NotePlacement[];
    moduleCode?: NoteModule;
    context?: NoteContext | null;
    relatedRecords?: NoteRelatedRecord[];
}
export interface NoteCommandResult {
    noteId: string;
    version: number;
    layoutVersion?: number;
    replayed: boolean;
}
const invalid = (): never => {
    throw new Error("Invalid notes response");
};
const record = (value: unknown): Record<string, unknown> => (value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : invalid());
const string = (value: unknown): string => (typeof value === "string" ? value : invalid());
const boundedString = (value: unknown, maximum: number): string => (string(value).length <= maximum ? string(value) : invalid());
const identifier = (value: unknown): string => (/^[0-7][0-9A-HJKMNP-TV-Z]{25}$/.test(string(value)) ? string(value) : invalid());
const number = (value: unknown, min: number, max = 4294967295): number => (typeof value === "number" && Number.isFinite(value) && value >= min && value <= max ? value : invalid());
const integer = (value: unknown, min: number, max = 4294967295): number => (Number.isInteger(number(value, min, max)) ? (value as number) : invalid());
const boolean = (value: unknown): boolean => (typeof value === "boolean" ? value : invalid());
const choice = <T extends string>(value: unknown, choices: readonly T[]): T => (choices.includes(value as T) ? (value as T) : invalid());
const timestamp = (value: unknown): string => (Number.isFinite(Date.parse(string(value))) ? string(value) : invalid());
function parsePlacement(value: unknown): NotePlacement {
    const p = record(value);
    return { viewportClass: choice(p.viewportClass, ["desktop", "tablet", "mobile"]), anchorMode: choice(p.anchorMode, ["context", "viewport"]), x: number(p.x, 0, 100000), y: number(p.y, 0, 100000), width: integer(p.width, 160, 1600), height: integer(p.height, 80, 1600), collapsed: boolean(p.collapsed), hidden: boolean(p.hidden), layoutVersion: integer(p.layoutVersion, 0) };
}
function parseNoteContent(value: unknown): PersonalNote["content"] {
    const content = record(value);
    if (content.format !== "plain_text") invalid();
    const text = boundedString(content.text, 10000);
    if (!text.trim()) invalid();
    return { format: "plain_text", text };
}
/** Validates a plain-text note while retaining compatibility with private note responses. */
export function parsePersonalNote(value: unknown): PersonalNote {
    const n = record(value),
        content = parseNoteContent(n.content),
        author = record(n.author),
        c = record(n.capabilities);
    if (!/^#[0-9a-f]{6}$/i.test(string(n.color)) || !Array.isArray(n.myPlacements)) invalid();
    const title = n.title === null ? null : boundedString(n.title, 200);
    return {
        ...(n.relatedRecords === undefined ? {} : { relatedRecords: parseRelatedRecords(n.relatedRecords) }),
        id: identifier(n.id),
        title,
        content,
        color: string(n.color),
        priority: choice(n.priority, ["low", "normal", "high"]),
        status: choice(n.status, ["open", "completed", "archived"]),
        version: integer(n.version, 1),
        createdAt: timestamp(n.createdAt),
        updatedAt: timestamp(n.updatedAt),
        author: { publicId: identifier(author.publicId), displayName: string(author.displayName) },
        capabilities: { canEdit: boolean(c.canEdit), canComplete: boolean(c.canComplete), canReopen: boolean(c.canReopen), canArchive: boolean(c.canArchive), canMove: boolean(c.canMove), ...parseCollaborationCapabilities(c) },
        myPlacements: (n.myPlacements as unknown[]).map(parsePlacement),
        ...(n.moduleCode === undefined ? {} : { moduleCode: choice(n.moduleCode, ["ventas", "mercadeo", "formalizacion", "contabilidad", "administration"]) }),
        ...(n.context === undefined ? {} : { context: parseVisibleContext(n.context) }),
    };
}
function parseCollaborationCapabilities(c: Record<string, unknown>): Partial<PersonalNote["capabilities"]> {
    return { ...(c.canShare === undefined ? {} : { canShare: boolean(c.canShare) }), ...(c.canReply === undefined ? {} : { canReply: boolean(c.canReply) }), ...(c.canMention === undefined ? {} : { canMention: boolean(c.canMention) }) };
}
function parseContext(value: unknown): NoteContext {
    const c = record(value);
    const kind = choice(c.kind, ["personal", "view", "sales_order"]);
    if (kind === "personal") return { kind };
    if (kind === "view") return { kind, ...(c.code === undefined ? {} : { code: boundedString(c.code, 100) }) };
    const source = choice(c.source, ["native", "legacy"]);
    const id = string(c.id);
    if (source === "native") return { kind, source, id: identifier(id) };
    if (!/^[1-9][0-9]{0,9}$/.test(id) || Number(id) > 2147483647) invalid();
    return { kind, source, id };
}
function parseResult(value: unknown): NoteCommandResult {
    const r = record(value);
    return { noteId: identifier(r.noteId), version: integer(r.version, 1), ...(r.layoutVersion === undefined ? {} : { layoutVersion: integer(r.layoutVersion, 1) }), replayed: boolean(r.replayed) };
}
/** The legacy list uses a presentation alias; native public IDs and malformed IDs must never be rewritten. */
export function normalizeNoteContext(context: NoteContext): NoteContext {
    if (context.kind !== "sales_order" || context.source !== "legacy") return context;
    const id = /^legacy:([1-9][0-9]{0,9})$/.exec(context.id)?.[1];
    return id && context.id === `legacy:${id}` && Number(id) <= 2147483647 ? { ...context, id } : context;
}
/** Reads the authorized context, using bounded pages and validating all displayed fields. */
export async function getNotes(moduleCode: NoteModule, context: NoteContext, status: PersonalNote["status"] | "all" = "open", page = 1): Promise<{ items: PersonalNote[]; total: number }> {
    context = normalizeNoteContext(context);
    const query = new URLSearchParams({ moduleCode, contextType: context.kind, ...(context.kind === "view" && context.code !== undefined ? { viewCode: context.code } : {}), ...(context.kind === "sales_order" ? { recordId: context.id, ...(context.source === "legacy" ? { recordSource: context.source } : {}) } : {}), status, page: String(page), pageSize: "100" });
    const response = record(await apiRequest<unknown>(`/notes?${query.toString()}`));
    return parseList(response, page);
}
function parseList(response: Record<string, unknown>, page: number): { items: PersonalNote[]; total: number } {
    const pagination = record(response.page);
    if (response.schemaVersion !== 1 || !Array.isArray(response.items) || response.items.length > 100 || integer(pagination.number, 1, 1000) !== page || integer(pagination.size, 1, 100) !== 100) invalid();
    return { items: (response.items as unknown[]).map(parsePersonalNote), total: integer(pagination.total, 0, Number.MAX_SAFE_INTEGER) };
}
/** Creates a private note with an explicit operation identifier; ambiguous writes never replay automatically. */
// eslint-disable-next-line max-params -- Optional relations preserve the existing four-argument creation contract.
export async function createNote(moduleCode: NoteModule, context: NoteContext, fields: NoteFields, operationId: string, relatedRecords: NoteRecordReference[] = []): Promise<NoteCommandResult> {
    return parseResult(await apiRequest<unknown>("/notes", { method: "POST", body: { moduleCode, context: normalizeNoteContext(context), ...fields, operationId, ...(relatedRecords.length ? { relatedRecords: relatedRecords.map((reference) => ({ ...reference })) } : {}) }, retryOnUnauthorized: false }));
}
/** Edits only against the version displayed to the author. */
// eslint-disable-next-line max-params -- Preserve the agreed public client contract used by the notes UI.
export async function editNote(moduleCode: NoteModule, noteId: string, fields: NoteFields, expectedVersion: number, operationId: string): Promise<NoteCommandResult> {
    return parseResult(await apiRequest<unknown>(`/notes/${encodeURIComponent(noteId)}`, { method: "PATCH", body: { moduleCode, ...fields, expectedVersion, operationId }, retryOnUnauthorized: false }));
}
/** Applies a lifecycle transition without deleting persisted content. */
// eslint-disable-next-line max-params -- Preserve the agreed public client contract used by the notes UI.
export async function setNoteState(moduleCode: NoteModule, noteId: string, action: "complete" | "reopen" | "archive", expectedVersion: number, operationId: string): Promise<NoteCommandResult> {
    return parseResult(await apiRequest<unknown>(`/notes/${encodeURIComponent(noteId)}/${action}`, { method: "POST", body: { moduleCode, expectedVersion, operationId }, retryOnUnauthorized: false }));
}
/** Personal layout concurrency is independent of the note content version. */
export async function saveNotePlacement(moduleCode: NoteModule, noteId: string, placement: NotePlacement, operationId: string): Promise<NoteCommandResult> {
    const { layoutVersion, ...coordinates } = placement;
    return parseResult(await apiRequest<unknown>(`/notes/${encodeURIComponent(noteId)}/my-placement`, { method: "PUT", body: { moduleCode, ...coordinates, expectedLayoutVersion: layoutVersion, operationId }, retryOnUnauthorized: false }));
}

/** Null preserves server redaction; it never becomes a guessed record link. */
function parseVisibleContext(value: unknown): NoteContext | null {
    return value === null ? null : parseContext(value);
}
