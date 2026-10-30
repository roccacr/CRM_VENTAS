import { z } from "zod";

import { type relatedRecordsSchema } from "./note-related-records.contract.js";
import { legacyNoteOrderIdSchema, noteIdSchema } from "./notes.contract.js";
const operationId = z.string().regex(/^[A-Za-z0-9_-]{16,100}$/);
const version = z.number().int().min(1).max(4294967294);
const users = z
    .array(noteIdSchema)
    .max(100)
    .refine((v) => new Set(v).size === v.length);
const text = z
    .string()
    .min(1)
    .max(10000)
    .refine(
        (v) =>
            v.trim().length > 0 &&
            !Array.from(v).some((c) => {
                const n = c.charCodeAt(0);
                return (n < 32 && ![9, 10, 13].includes(n)) || n === 127;
            }),
    );
const page = (max: number, fallback: number) => z.preprocess((v) => (v === undefined ? fallback : typeof v === "string" && /^[1-9][0-9]*$/.test(v) ? Number(v) : v), z.number().int().min(1).max(max));
export const collaborationInboxSchema = z
    .object({
        kind: z.enum(["all", "created", "shared", "mentions", "assigned"]).default("created"),
        status: z.enum(["open", "completed", "archived", "all"]).default("open"),
        search: z.string().trim().max(200).optional(),
        authorUserId: noteIdSchema.optional(),
        recordId: z.string().max(26).optional(),
        createdFrom: z.iso.datetime().optional(),
        createdTo: z.iso.datetime().optional(),
        recordSource: z.enum(["native", "legacy"]).optional(),
        moduleCode: z.enum(["ventas", "mercadeo", "formalizacion", "contabilidad", "administration"]).optional(),
        page: page(1000, 1),
        pageSize: page(50, 25),
    })
    .strict()
    .refine((q) => !q.recordId || Boolean(q.recordSource && (q.recordSource === "legacy" ? legacyNoteOrderIdSchema : noteIdSchema).safeParse(q.recordId).success))
    .refine((q) => !q.createdFrom || !q.createdTo || Date.parse(q.createdFrom) <= Date.parse(q.createdTo));
export const collaborationThreadSchema = z.object({ replyPage: page(1000, 1) }).strict();
export const collaborationSearchSchema = z.object({ search: z.string().trim().max(100).default(""), page: page(1000, 1) }).strict();
export const participantsSchema = z
    .object({ operationId, expectedCollaborationVersion: version, participants: z.array(z.object({ userId: noteIdSchema, access: z.enum(["read", "reply"]) }).strict()).max(100) })
    .strict()
    .refine((v) => new Set(v.participants.map((p) => p.userId)).size === v.participants.length);
export const noteLocationSchema = z.object({ moduleCode: z.enum(["ventas", "mercadeo", "formalizacion", "contabilidad", "administration"]), code: z.string().regex(/^[a-z][a-z0-9-]{0,99}$/) }).strict();
export const locationsSchema = z
    .object({ operationId, expectedCollaborationVersion: version, locations: z.array(noteLocationSchema).max(5) })
    .strict()
    .refine((v) => new Set(v.locations.map((item) => `${item.moduleCode}:${item.code}`)).size === v.locations.length);
export type NoteLocation = z.infer<typeof noteLocationSchema>;
export const mentionsSchema = z.object({ operationId, expectedCollaborationVersion: version, userIds: users }).strict();
export const replySchema = z.object({ operationId, text, mentionUserIds: users.default([]), quotedReplyId: noteIdSchema.optional() }).strict();
export const editReplySchema = z.object({ operationId, expectedVersion: version, text, mentionUserIds: users.default([]) }).strict();
export const withdrawReplySchema = z.object({ operationId, expectedVersion: version }).strict();
export const followingSchema = z.object({ operationId, following: z.boolean() }).strict();
export type CollaborationInbox = z.infer<typeof collaborationInboxSchema>;
export type CollaborationCommand =
    | { kind: "relatedRecords"; operationId: string; expectedCollaborationVersion: number; relatedRecords: z.infer<typeof relatedRecordsSchema>; preservedLinkIds?: number[]; persistedRelatedRecords?: z.infer<typeof relatedRecordsSchema> }
    | ({ kind: "locations"; editableModules?: z.infer<typeof noteLocationSchema>["moduleCode"][] } & z.infer<typeof locationsSchema>)
    | ({ kind: "participants" } & z.infer<typeof participantsSchema>)
    | ({ kind: "mentions" } & z.infer<typeof mentionsSchema>)
    | ({ kind: "reply" } & z.infer<typeof replySchema>)
    | ({ kind: "editReply"; replyId: string } & z.infer<typeof editReplySchema>)
    | ({ kind: "withdrawReply"; replyId: string } & z.infer<typeof withdrawReplySchema>)
    | ({ kind: "following" } & z.infer<typeof followingSchema>);
export interface CollaborationResult {
    noteId: string;
    version: number;
    collaborationVersion: number;
    replayed: boolean;
    replyId?: string;
    replyVersion?: number;
}
export interface NoteParticipant {
    status?: "active" | "inactive" | "pending";
    active?: boolean;
    userId: string;
    displayName: string;
    access: "read" | "reply";
    following: boolean;
}
export interface NoteReply {
    id: string;
    internalId: number;
    authorId: number;
    authorPublicId: string;
    authorName: string;
    text: string | null;
    version: number;
    createdAt: string;
    updatedAt: string;
    withdrawn: number;
    mentionUserIds: string[];
}
