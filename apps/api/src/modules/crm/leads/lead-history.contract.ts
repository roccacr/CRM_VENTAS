import { z } from "zod";

/** Business fields explicitly exposed by the timeline; arbitrary audit JSON is never returned. */
export const historyEntrySchema = z.object({
    actionCode: z.string().min(1).max(80),
    reason: z.object({ code: z.string(), name: z.string() }).nullable(),
    detail: z.string().nullable(),
    sourceReasonLabel: z.string().nullable().optional(),
    sourceActionLabel: z.string().nullable().optional(),
    stageObserved: z.string().nullable().optional(),
    fromStatusCode: z.string().nullable().optional(),
    toStatusCode: z.string().nullable().optional(),
    classification: z.string().optional(),
    occurredAt: z.string().nullable(),
    sourceDate: z.string().nullable().optional(),
    sourceTimeZone: z.string().nullable().optional(),
    evidence: z.enum(["legacy_observation", "native_event"]),
});

/** Read-only legacy adapter output. It must never be persisted in the native database. */
export interface HistoricalLeadEvidence {
    id: number;
    leadReference: string;
    sourceLeadId: number | null;
    reasonId: number | null;
    source: { schema: "crmdatabase-api"; entity: string; table: string; id: string };
    resolution: "matched" | "ambiguous" | "missing";
    hash: string;
    entry: z.infer<typeof historyEntrySchema>;
    actor: Record<string, unknown>;
    original: Record<string, unknown>;
}
