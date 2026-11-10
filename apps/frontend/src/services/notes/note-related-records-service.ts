import { apiRequest } from "../api/api-client";
import type { NoteModule } from "./notes-service";

export interface NoteRecordReference {
    kind: "lead" | "sales_order";
    source: "native" | "legacy";
    id: string;
}
export interface NoteRelatedRecord {
    kind: NoteRecordReference["kind"];
    reference?: NoteRecordReference;
    label: string | null;
    description: string | null;
    url: string | null;
    restricted: boolean;
    unavailable?: boolean;
    primary?: boolean;
    relatedLead?: { reference: NoteRecordReference; label: string; description: string | null };
}
export interface RelatedRecordOptions {
    items: NoteRelatedRecord[];
    page: { number: number; size: 25 };
    hasMore: boolean;
    partial: boolean;
}
export interface NoteRelatedRecords {
    version: number;
    items: NoteRelatedRecord[];
    canManage: boolean;
}
export interface RelatedRecordsCommand {
    operationId: string;
    expectedCollaborationVersion: number;
    relatedRecords: NoteRecordReference[];
}
const invalid = (): never => {
    throw new Error("Invalid note related-record response");
};
const record = (v: unknown): Record<string, unknown> => (v !== null && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : invalid());
const text = (v: unknown, max = 300): string => (typeof v === "string" && v.length <= max ? v : invalid());
const bool = (v: unknown): boolean => (typeof v === "boolean" ? v : invalid());
const integer = (v: unknown, min = 1): number => (typeof v === "number" && Number.isSafeInteger(v) && v >= min ? v : invalid());
const kind = (v: unknown): NoteRecordReference["kind"] => (v === "lead" || v === "sales_order" ? v : invalid());
const identifier = (v: unknown): string => (/^[0-7][0-9A-HJKMNP-TV-Z]{25}$/.test(text(v, 26)) ? (v as string) : invalid());
export const relatedRecordKey = (reference: NoteRecordReference): string => `${reference.kind}:${reference.source}:${reference.id}`;

/** La identidad de almacenamiento es dato de transporte. La persona elige un nombre de negocio, no una base de datos. */
export function parseRecordReference(value: unknown): NoteRecordReference {
    const r = record(value);
    const source = r.source === "native" || r.source === "legacy" ? r.source : invalid();
    const id = source === "native" ? identifier(r.id) : text(r.id, 10);
    if (source === "legacy" && (!/^[1-9][0-9]{0,9}$/.test(id) || Number(id) > 2147483647)) invalid();
    return { kind: kind(r.kind), source, id };
}
function parseRelatedRecord(value: unknown): NoteRelatedRecord {
    const r = record(value),
        type = kind(r.kind);
    const result = bool(r.restricted) ? parseRestrictedRecord(r, type) : parseAuthorizedRecord(r, type);
    return { ...result, ...(r.primary === undefined ? {} : { primary: bool(r.primary) }) };
}
function parseRestrictedRecord(r: Record<string, unknown>, type: NoteRecordReference["kind"]): NoteRelatedRecord {
    if (r.reference !== undefined || r.label !== null || r.description !== null || r.url !== null) invalid();
    return { kind: type, label: null, description: null, url: null, restricted: true, ...(r.unavailable === undefined ? {} : { unavailable: bool(r.unavailable) }) };
}
function parseAuthorizedRecord(r: Record<string, unknown>, type: NoteRecordReference["kind"]): NoteRelatedRecord {
    const reference = parseRecordReference(r.reference);
    const url = r.url === null ? null : text(r.url, 1000);
    if (reference.kind !== type || (url !== null && (!url.startsWith("/home/") || /[\\\r\n]/.test(url)))) invalid();
    return { kind: type, reference, label: text(r.label), description: r.description === null ? null : text(r.description), url, restricted: false, ...parseRelatedLead(r.relatedLead, type) };
}
function parseRelatedLead(value: unknown, type: NoteRecordReference["kind"]): Pick<NoteRelatedRecord, "relatedLead"> {
    if (value === undefined) return {};
    const r = record(value),
        reference = parseRecordReference(r.reference);
    if (type !== "sales_order" || reference.kind !== "lead") invalid();
    return { relatedLead: { reference, label: text(r.label), description: r.description === null ? null : text(r.description) } };
}
/** Un resumen restringido no trae id de origen ni metadatos comerciales. */
export function parseRelatedRecords(value: unknown): NoteRelatedRecord[] {
    if (!Array.isArray(value) || value.length > 100) invalid();
    return (value as unknown[]).map(parseRelatedRecord);
}
/** Busca una página acotada y autorizada del selector federado de registros. */
export async function getRelatedRecordOptions(moduleCode: NoteModule, type: NoteRecordReference["kind"], search: string, page = 1): Promise<RelatedRecordOptions> {
    const query = new URLSearchParams({ moduleCode, kind: type, search, page: String(integer(page)) });
    const r = record(await apiRequest<unknown>(`/notes/related-record-options?${query.toString()}`));
    const pagination = record(r.page);
    if (r.schemaVersion !== 1 || pagination.number !== page || pagination.size !== 25) invalid();
    return { items: parseRelatedRecords(r.items), page: { number: page, size: 25 }, hasMore: bool(r.hasMore), partial: bool(r.partial) };
}
/** Lee resúmenes y la versión actual de colaboración. No concede acceso al registro. */
export async function getNoteRelatedRecords(noteId: string): Promise<NoteRelatedRecords> {
    const r = record(await apiRequest<unknown>(`/note-collaboration/notes/${identifier(noteId)}/related-records`));
    if (r.schemaVersion !== 1) invalid();
    return { version: integer(r.version), items: parseRelatedRecords(r.items), canManage: bool(r.canManage) };
}
/** El editor conserva los ids exactos de operación cuando una mutación tiene un resultado incierto. */
export async function saveNoteRelatedRecords(noteId: string, command: RelatedRecordsCommand): Promise<{ noteId: string; version: number; collaborationVersion: number; replayed: boolean }> {
    const r = record(await apiRequest<unknown>(`/note-collaboration/notes/${identifier(noteId)}/related-records`, { method: "PUT", body: command, retryOnUnauthorized: false }));
    return { noteId: identifier(r.noteId), version: integer(r.version), collaborationVersion: integer(r.collaborationVersion), replayed: bool(r.replayed) };
}
