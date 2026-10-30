import { z } from "zod";

import { CATALOG_CONTEXT_MODULES } from "../catalogs/catalogs.constants.js";
import { relatedRecordsSchema } from "./note-related-records.contract.js";

export const noteIdSchema = z.string().regex(/^[0-7][0-9A-HJKMNP-TV-Z]{25}$/);
const moduleCode = z.enum(CATALOG_CONTEXT_MODULES);
const operationId = z.string().regex(/^[A-Za-z0-9_-]{16,100}$/);
const text = z
    .string()
    .max(10000)
    .refine(
        (v) =>
            v.trim().length > 0 &&
            !Array.from(v).some((c) => {
                const code = c.charCodeAt(0);
                return (code < 32 && ![9, 10, 13].includes(code)) || code === 127;
            }),
    );
export const legacyNoteOrderIdSchema = z
    .string()
    .regex(/^[1-9][0-9]{0,9}$/)
    .refine((id) => Number(id) <= 2147483647);
const viewCode = z.string().regex(/^[a-z][a-z0-9-]{0,99}$/);
export const noteContextSchema = z.union([z.object({ kind: z.literal("personal") }).strict(), z.object({ kind: z.literal("view"), code: viewCode.optional() }).strict(), z.object({ kind: z.literal("sales_order"), source: z.literal("native"), id: noteIdSchema }).strict(), z.object({ kind: z.literal("sales_order"), source: z.literal("legacy"), id: legacyNoteOrderIdSchema }).strict()]);
const fields = {
    title: z.string().trim().max(200).nullable().default(null),
    text,
    color: z
        .string()
        .regex(/^#[0-9A-Fa-f]{6}$/)
        .default("#FFFF88"),
    priority: z.enum(["low", "normal", "high"]).default("normal"),
};
export const createNoteSchema = z.object({ moduleCode, operationId, ...fields, context: noteContextSchema.default({ kind: "view" }), relatedRecords: relatedRecordsSchema.optional() }).strict();
export const editNoteSchema = z.object({ moduleCode, operationId, expectedVersion: z.number().int().min(1).max(4294967294), ...fields }).strict();
export const noteStateSchema = z.object({ moduleCode, operationId, expectedVersion: z.number().int().min(1).max(4294967294) }).strict();
const integer = (maximum: number, fallback: number) => z.preprocess((v) => (v === undefined ? fallback : typeof v === "string" && /^[1-9][0-9]*$/.test(v) ? Number(v) : v), z.number().int().min(1).max(maximum));
export const noteReadSchema = z.object({ moduleCode }).strict();
export const listNotesSchema = z
    .object({ moduleCode, page: integer(1000, 1), pageSize: integer(100, 25), status: z.enum(["open", "completed", "archived", "all"]).default("open"), contextType: z.enum(["personal", "view", "sales_order"]).default("view"), viewCode: viewCode.optional(), recordSource: z.enum(["native", "legacy"]).optional(), recordId: z.string().optional() })
    .strict()
    .refine((q) => (q.contextType === "sales_order" ? !q.viewCode && (q.recordSource === "legacy" ? legacyNoteOrderIdSchema : noteIdSchema).safeParse(q.recordId).success : !q.recordId && !q.recordSource && (q.contextType === "view" || !q.viewCode)));
export const placementSchema = z
    .object({
        moduleCode,
        operationId,
        expectedLayoutVersion: z.number().int().min(0).max(4294967294),
        viewportClass: z.enum(["desktop", "tablet", "mobile"]).default("desktop"),
        anchorMode: z.enum(["context", "viewport"]).default("context"),
        x: z.number().min(0).max(100000).multipleOf(0.0001),
        y: z.number().min(0).max(100000).multipleOf(0.0001),
        width: z.number().int().min(160).max(1600),
        height: z.number().int().min(80).max(1600),
        collapsed: z.boolean().default(false),
        hidden: z.boolean().default(false),
    })
    .strict();
export type NoteContext = z.infer<typeof noteContextSchema>;
export type CreateNote = z.infer<typeof createNoteSchema>;
export type EditNote = z.infer<typeof editNoteSchema>;
export type NoteState = z.infer<typeof noteStateSchema>;
export type NoteList = z.infer<typeof listNotesSchema>;
export type NotePlacement = z.infer<typeof placementSchema>;
export type NoteStatus = "open" | "completed" | "archived";
export type NoteLifecycle = "complete" | "reopen" | "archive";
export interface NoteRecord {
    internalId: number;
    publicId: string;
    authorId: number;
    authorPublicId: string;
    authorName: string;
    moduleCode: CreateNote["moduleCode"];
    title: string | null;
    text: string;
    color: string;
    priority: CreateNote["priority"];
    status: NoteStatus;
    visibility: "private" | "shared";
    version: number;
    createdAt: string;
    updatedAt: string;
    completedAt: string | null;
    archivedAt: string | null;
}
export interface NoteAccess {
    actorPublicId: string;
    moduleCode: CreateNote["moduleCode"];
    ownOnly: boolean;
}
export interface NoteResult {
    noteId: string;
    version: number;
    layoutVersion?: number;
    replayed: boolean;
}
