import { z } from "zod";

import { noteIdSchema } from "./notes.contract.js";
export const notificationRecipientSchema = z.object({ publicId: noteIdSchema, kind: z.enum(["shared", "reply", "mention", "assigned", "reminder", "due"]) }).strict();
export type NoteNotificationRecipient = z.infer<typeof notificationRecipientSchema>;
export const notificationEventSchema = z.object({ noteId: noteIdSchema, moduleCode: z.enum(["ventas", "mercadeo", "formalizacion", "contabilidad", "administration"]), actorPublicId: noteIdSchema, version: z.number().int().positive(), recipients: z.array(notificationRecipientSchema).max(500) }).strict();
export type NoteNotificationEvent = z.infer<typeof notificationEventSchema>;
const integer = (max: number, fallback: number) => z.preprocess((v) => (v === undefined ? fallback : typeof v === "string" && /^[1-9][0-9]*$/.test(v) ? Number(v) : v), z.number().int().min(1).max(max));
export const notificationsListSchema = z.object({ filter: z.enum(["all", "unread", "mentions"]).default("all"), page: integer(1000, 1), pageSize: integer(50, 25) }).strict();
export const notificationReadAllSchema = z.object({ through: z.iso.datetime({ precision: 3 }) }).strict();
export type NotificationsList = z.infer<typeof notificationsListSchema>;
export interface NoteNotification {
    id: string;
    kind: NoteNotificationRecipient["kind"];
    actor: { publicId: string; displayName: string };
    noteId: string;
    /** Which note the notice is about; lets the bell say "sobre «título»" without opening it. */
    note: { title: string | null; excerpt: string };
    /** What was written for a reply or mention: the actor's latest live reply up to the notice. Null for invitations. */
    replyExcerpt: string | null;
    moduleCode: string;
    createdAt: string;
    readAt: string | null;
}
/** One delivery per recipient: the most specific reason wins and authors never notify themselves. */
export function deduplicateNoteRecipients(actor: string, recipients: readonly NoteNotificationRecipient[]): NoteNotificationRecipient[] {
    const priority = { reply: 0, shared: 1, mention: 2, assigned: 3, reminder: 0, due: 0 };
    const result = new Map<string, NoteNotificationRecipient>();
    for (const recipient of recipients) {
        const previous = result.get(recipient.publicId);
        if (recipient.publicId !== actor && (!previous || priority[recipient.kind] > priority[previous.kind])) result.set(recipient.publicId, recipient);
    }
    return [...result.values()];
}
