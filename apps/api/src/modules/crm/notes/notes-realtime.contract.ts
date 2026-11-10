import { z } from "zod";

import { noteIdSchema } from "./notes.contract.js";
/** Solo metadatos. El objeto estricto evita serializar por accidente el texto privado o campos del recurso. */
export const notesRealtimeActivitySchema = z
    .object({
        schemaVersion: z.literal(1),
        eventId: noteIdSchema,
        kind: z.enum(["notification.created", "notifications.changed", "note.changed", "note.access_revoked", "sync.required"]),
        occurredAt: z.iso.datetime(),
        noteId: noteIdSchema.optional(),
        notificationId: noteIdSchema.optional(),
        version: z.number().int().positive().optional(),
        collaborationVersion: z.number().int().positive().optional(),
    })
    .strict();
export type NotesRealtimeActivity = z.infer<typeof notesRealtimeActivitySchema>;
export const notesRealtimeSubscriptionSchema = z.object({ noteId: noteIdSchema }).strict();
export const notesRealtimeAuthSchema = z.object({ csrfToken: z.string().min(1).max(256) }).strict();
