import { z } from "zod";

import { noteIdSchema } from "./notes.contract.js";

const operationId = z.string().regex(/^[A-Za-z0-9_-]{16,100}$/);
// El sufijo UTC explícito evita tomar el reloj de pared del navegador como hora del servidor. La fecha cabe entre el año 1000 y cinco años adelante.
export const workflowDateSchema = z.iso.datetime({ offset: false }).refine((v) => v.endsWith("Z") && Date.parse(v) >= Date.UTC(1000, 0, 1) && Date.parse(v) < Date.now() + 5 * 366 * 86400000);
export const taskSchema = z.object({ operationId, expectedVersion: z.number().int().min(0).max(4294967294), assigneeUserId: noteIdSchema.nullable(), dueAt: workflowDateSchema.nullable() }).strict();
export const reminderSchema = z.object({ operationId, remindAt: workflowDateSchema.nullable() }).strict();
export const workflowOverviewSchema = z
    .object({
        timeZone: z
            .string()
            .min(1)
            .max(100)
            .default("UTC")
            .refine((timeZone) => {
                try {
                    new Intl.DateTimeFormat("en", { timeZone }).format();
                    return true;
                } catch {
                    return false;
                }
            }),
    })
    .strict();
export type WorkflowCommand = ({ kind: "task" } & z.infer<typeof taskSchema>) | ({ kind: "reminder" } & z.infer<typeof reminderSchema>);
export interface NoteWorkflow {
    schemaVersion: 1;
    version: number;
    assignee: { publicId: string; displayName: string } | null;
    dueAt: string | null;
    reminder: { remindAt: string | null; status: "pending" | "delivered" | "cancelled" | "suppressed" } | null;
    canManage: boolean;
}
export interface WorkflowResult extends NoteWorkflow {
    noteId: string;
    replayed: boolean;
}
export interface ClaimedWorkflowEvent {
    id: number;
    attempt: number;
    noteId: string;
    userId: string;
    kind: "assigned" | "reminder" | "due";
}
