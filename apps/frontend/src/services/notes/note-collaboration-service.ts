import { apiRequest } from "../api/api-client";
import { normalizeNoteContext, type NoteContext, type NoteModule, parsePersonalNote, type PersonalNote } from "./notes-service";

export interface NoteParticipant {
    status?: "active" | "inactive" | "pending";
    userId: string;
    displayName: string;
    access: "read" | "reply";
}
export interface NoteReply {
    id: string;
    author: { publicId: string; displayName: string };
    text: string | null;
    version: number;
    createdAt: string;
    updatedAt: string;
    withdrawn: boolean;
    mentionUserIds: string[];
    canEdit: boolean;
    canWithdraw: boolean;
}
export interface NoteCollaborativeItem extends PersonalNote {
    moduleCode: NoteModule;
    context: NoteContext | null;
    capabilities: PersonalNote["capabilities"] & { canShare: boolean; canReply: boolean; canMention: boolean };
}
export interface NotePage {
    number: number;
    size: number;
    total: number;
}
export interface NoteThread {
    schemaVersion: 1;
    note: NoteCollaborativeItem;
    collaborationVersion: number;
    participants: NoteParticipant[];
    mentions: string[];
    replies: NoteReply[];
    replyPage: NotePage;
    following: boolean;
}
export interface NoteInbox {
    schemaVersion: 1;
    items: NoteCollaborativeItem[];
    page: NotePage;
}
export interface NoteEligibleUsers {
    items: { publicId: string; displayName: string; status?: "active" | "inactive" | "pending" }[];
}
export interface NoteCollaborationResult {
    noteId: string;
    version: number;
    collaborationVersion: number;
    replayed: boolean;
    replyId?: string;
    replyVersion?: number;
}
export interface NoteInboxFilters {
    search?: string;
    moduleCode?: NoteModule;
    recordSource?: "native" | "legacy";
    authorUserId?: string;
    recordId?: string;
    createdFrom?: string;
    createdTo?: string;
}
interface Operation {
    operationId: string;
}
export interface NoteParticipantsCommand extends Operation {
    expectedCollaborationVersion: number;
    participants: { userId: string; access: "read" | "reply" }[];
}
export interface NoteMentionsCommand extends Operation {
    expectedCollaborationVersion: number;
    userIds: string[];
}
export interface NoteReplyCommand extends Operation {
    text: string;
    mentionUserIds: string[];
    quotedReplyId?: string;
}
export interface NoteReplyEditCommand extends Operation {
    expectedVersion: number;
    text: string;
    mentionUserIds: string[];
}
export interface NoteReplyWithdrawCommand extends Operation {
    expectedVersion: number;
}
export interface NoteFollowingCommand extends Operation {
    following: boolean;
}
const invalid = (): never => {
    throw new Error("Invalid note collaboration response");
};
const record = (v: unknown): Record<string, unknown> => (v !== null && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : invalid());
const string = (v: unknown, max = 10000): string => (typeof v === "string" && v.length <= max ? v : invalid());
const id = (v: unknown): string => (/^[0-7][0-9A-HJKMNP-TV-Z]{25}$/.test(string(v, 26)) ? (v as string) : invalid());
const integer = (v: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): number => (typeof v === "number" && Number.isSafeInteger(v) && v >= min && v <= max ? v : invalid());
const boolean = (v: unknown): boolean => (typeof v === "boolean" ? v : invalid());
const timestamp = (v: unknown): string => (/^\d{4}-\d{2}-\d{2}T/.test(string(v, 40)) && Number.isFinite(Date.parse(v as string)) ? (v as string) : invalid());
const choice = <T extends string>(v: unknown, options: readonly T[]): T => (options.includes(v as T) ? (v as T) : invalid());
function array<T>(v: unknown, parse: (item: unknown) => T, maximum: number): T[] {
    return Array.isArray(v) && v.length <= maximum ? v.map(parse) : invalid();
}
function unique<T>(items: T[], key: (item: T) => string): T[] {
    if (new Set(items.map(key)).size !== items.length) invalid();
    return items;
}
function parsePage(value: unknown, expected: number, count: number): NotePage {
    const p = record(value);
    const result = { number: integer(p.number, 1, 1000), size: integer(p.size, 25, 25), total: integer(p.total) };
    if (result.number !== expected || count > result.size || ((result.number - 1) * result.size + count > result.total && count > 0)) invalid();
    return result;
}
function parseItem(value: unknown): NoteCollaborativeItem {
    const note = parsePersonalNote(value);
    const { canShare, canReply, canMention } = note.capabilities;
    if (note.moduleCode === undefined || note.context === undefined) invalid();
    return { ...note, moduleCode: note.moduleCode ?? invalid(), context: note.context === undefined ? invalid() : note.context, capabilities: { ...note.capabilities, canShare: boolean(canShare), canReply: boolean(canReply), canMention: boolean(canMention) } };
}
function parseParticipant(value: unknown): NoteParticipant {
    const p = record(value);
    return { userId: id(p.userId), displayName: string(p.displayName, 200), access: choice(p.access, ["read", "reply"]), ...(p.status === undefined ? {} : { status: choice(p.status, ["active", "inactive", "pending"]) }) };
}
function parseReply(value: unknown): NoteReply {
    const r = record(value),
        author = record(r.author),
        withdrawn = boolean(r.withdrawn);
    const text = r.text === null ? null : string(r.text);
    if (withdrawn ? text !== null : text === null || !text.trim()) invalid();
    return { id: id(r.id), author: { publicId: id(author.publicId), displayName: string(author.displayName, 200) }, text, version: integer(r.version, 1), createdAt: timestamp(r.createdAt), updatedAt: timestamp(r.updatedAt), withdrawn, mentionUserIds: unique(array(r.mentionUserIds, id, 100), String), canEdit: boolean(r.canEdit), canWithdraw: boolean(r.canWithdraw) };
}
function parseResult(value: unknown): NoteCollaborationResult {
    const r = record(value);
    if ((r.replyId === undefined) !== (r.replyVersion === undefined)) invalid();
    return { noteId: id(r.noteId), version: integer(r.version, 1), collaborationVersion: integer(r.collaborationVersion, 1), replayed: boolean(r.replayed), ...(r.replyId === undefined ? {} : { replyId: id(r.replyId), replyVersion: integer(r.replyVersion, 1) }) };
}
function parseUsers(value: unknown): NoteEligibleUsers {
    const r = record(value);
    return {
        items: unique(
            array(
                r.items,
                (v) => {
                    const u = record(v);
                    return { publicId: id(u.publicId), displayName: string(u.displayName, 200), ...(u.status === undefined ? {} : { status: choice(u.status, ["active", "inactive", "pending"]) }) };
                },
                100,
            ),
            (u) => u.publicId,
        ),
    };
}
const notePath = (noteId: string): string => `/note-collaboration/notes/${encodeURIComponent(id(noteId))}`;
async function mutate(noteId: string, suffix: string, method: "POST" | "PUT" | "PATCH", body: Operation): Promise<NoteCollaborationResult> {
    const result = parseResult(await apiRequest<unknown>(`${notePath(noteId)}/${suffix}`, { method, body, retryOnUnauthorized: false }));
    if (result.noteId !== noteId) invalid();
    return result;
}
/** Lee un hilo autorizado. Las respuestas usan una página acotada y explícita. */
export async function getNoteThread(noteId: string, replyPage = 1): Promise<NoteThread> {
    const r = record(await apiRequest<unknown>(`${notePath(noteId)}?replyPage=${String(integer(replyPage, 1, 1000))}`));
    if (r.schemaVersion !== 1) invalid();
    const note = parseItem(r.note),
        replies = unique(array(r.replies, parseReply, 25), (r) => r.id);
    if (note.id !== noteId) invalid();
    return { schemaVersion: 1, note, collaborationVersion: integer(r.collaborationVersion, 1), participants: unique(array(r.participants, parseParticipant, 100), (p) => p.userId), mentions: unique(array(r.mentions, id, 100), String), replies, replyPage: parsePage(r.replyPage, replyPage, replies.length), following: boolean(r.following) };
}
/** Lista solo las notas colaborativas que el servidor autorizó. No las persiste en el navegador. */
export async function getNoteInbox(kind: "all" | "created" | "shared" | "mentions" | "assigned" = "shared", status: PersonalNote["status"] | "all" = "open", page = 1, filters: NoteInboxFilters = {}): Promise<NoteInbox> {
    const query = new URLSearchParams({ kind, status, page: String(integer(page, 1, 1000)), pageSize: "25" });
    addInboxFilters(query, filters);
    addInboxRangeFilters(query, filters);
    const r = record(await apiRequest<unknown>(`/note-collaboration/inbox?${query.toString()}`));
    if (r.schemaVersion !== 1) invalid();
    const items = unique(array(r.items, parseItem, 25), (n) => n.id);
    return { schemaVersion: 1, items, page: parsePage(r.page, page, items.length) };
}
/** Busca en el directorio autorizado de usuarios para una nota que ya existe. */
export async function getEligibleNoteUsers(noteId: string, search: string): Promise<NoteEligibleUsers> {
    return readUserDirectory(`${notePath(noteId)}/eligible-users`, new URLSearchParams({ search }));
}
/** Busca invitados antes de crear una nota privada en su contexto explícito. */
export async function getEligibleUsersForNoteDraft(moduleCode: NoteModule, context: NoteContext, search: string): Promise<NoteEligibleUsers> {
    context = normalizeNoteContext(context);
    const query = new URLSearchParams({ moduleCode, contextType: context.kind, ...(context.kind === "view" && context.code !== undefined ? { viewCode: context.code } : {}), ...(context.kind === "sales_order" ? { recordId: context.id, ...(context.source === "legacy" ? { recordSource: context.source } : {}) } : {}), search });
    return readUserDirectory("/note-collaboration/eligible-users", query);
}
/** Reemplaza el uso compartido de forma atómica, contra la versión de colaboración que se mostró. */
export async function replaceNoteParticipants(noteId: string, command: NoteParticipantsCommand): Promise<NoteCollaborationResult> {
    return mutate(noteId, "participants", "PUT", command);
}
/** Reemplaza las menciones explícitas de la nota y no cambia el id de operación de quien llama. */
export async function replaceNoteMentions(noteId: string, command: NoteMentionsCommand): Promise<NoteCollaborationResult> {
    return mutate(noteId, "mentions", "PUT", command);
}
/** Agrega una respuesta de texto plano. Un fallo ambiguo sigue siendo el comando pendiente de quien llama. */
export async function addNoteReply(noteId: string, command: NoteReplyCommand): Promise<NoteCollaborationResult> {
    return mutate(noteId, "replies", "POST", command);
}
/** Edita la respuesta del autor contra la versión que se mostró. */
export async function editNoteReply(noteId: string, replyId: string, command: NoteReplyEditCommand): Promise<NoteCollaborationResult> {
    return mutate(noteId, `replies/${id(replyId)}`, "PATCH", command);
}
/** Retira una respuesta y no borra su historial. */
export async function withdrawNoteReply(noteId: string, replyId: string, command: NoteReplyWithdrawCommand): Promise<NoteCollaborationResult> {
    return mutate(noteId, `replies/${id(replyId)}/withdraw`, "POST", command);
}
/** Cambia solo la preferencia de seguimiento de la persona actual. */
export async function setNoteFollowing(noteId: string, command: NoteFollowingCommand): Promise<NoteCollaborationResult> {
    return mutate(noteId, "my-following", "PUT", command);
}

/** Trae todas las páginas acotadas del directorio. No recorta en silencio la lista de selección a los primeros 100 usuarios. */
async function readUserDirectory(path: string, query: URLSearchParams): Promise<NoteEligibleUsers> {
    const people = new Map<string, NoteEligibleUsers["items"][number]>();
    for (let page = 1; page <= 1000; page++) {
        if (page > 1) query.set("page", String(page));
        const response = record(await apiRequest<unknown>(`${path}?${query}`));
        for (const person of parseUsers(response).items) people.set(person.publicId, person);
        if (response.hasMore === undefined || !boolean(response.hasMore)) return { items: Array.from(people.values()) };
    }
    return invalid();
}

function addInboxFilters(query: URLSearchParams, filters: NoteInboxFilters): void {
    if (filters.search?.trim()) query.set("search", string(filters.search.trim(), 200));
    if (filters.moduleCode) query.set("moduleCode", filters.moduleCode);
    if (filters.recordSource) query.set("recordSource", filters.recordSource);
    if (filters.authorUserId) query.set("authorUserId", id(filters.authorUserId));
}

function addInboxRangeFilters(query: URLSearchParams, filters: NoteInboxFilters): void {
    if (filters.recordId) {
        if (!filters.recordSource) invalid();
        query.set("recordId", string(filters.recordId, 26));
    }
    if (filters.createdFrom) query.set("createdFrom", timestamp(filters.createdFrom));
    if (filters.createdTo) query.set("createdTo", timestamp(filters.createdTo));
}
/** Todos los autores de las notas autorizadas ahora. No depende de la página de bandeja elegida. */
export async function getNoteInboxAuthors(): Promise<{ publicId: string; displayName: string }[]> {
    const r = record(await apiRequest<unknown>("/note-collaboration/inbox/authors"));
    if (r.schemaVersion !== 1) invalid();
    return unique(
        array(
            r.items,
            (value) => {
                const person = record(value);
                return { publicId: id(person.publicId), displayName: string(person.displayName, 200) };
            },
            10000,
        ),
        (person) => person.publicId,
    );
}
