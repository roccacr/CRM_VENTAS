/**
 * Referencias de lead u orden, como máximo 20 y sin repetir la misma identidad.
 * El id nativo usa la forma pública de la nota. El id viejo es un entero de 1 a 2147483647. La búsqueda cabe en 120.
 */
import { z } from "zod";

import { CATALOG_CONTEXT_MODULES } from "../catalogs/catalogs.constants.js";

const publicId = z.string().regex(/^[0-7][0-9A-HJKMNP-TV-Z]{25}$/);
const legacyId = z
    .string()
    .regex(/^[1-9][0-9]{0,9}$/)
    .refine((id) => Number(id) <= 2147483647);
export const relatedReferenceSchema = z
    .object({ kind: z.enum(["lead", "sales_order"]), source: z.enum(["native", "legacy"]), id: z.string() })
    .strict()
    .refine((reference) => (reference.source === "native" ? publicId : legacyId).safeParse(reference.id).success);
export const relatedRecordsSchema = z
    .array(relatedReferenceSchema)
    .max(20)
    .refine((records) => new Set(records.map((record) => JSON.stringify([record.kind, record.source, record.id]))).size === records.length);
export const relatedOptionsQuerySchema = z
    .object({
        moduleCode: z.enum(CATALOG_CONTEXT_MODULES),
        kind: z.enum(["lead", "sales_order"]),
        search: z.string().trim().max(120).default(""),
        page: z.preprocess((value) => (value === undefined ? 1 : typeof value === "string" && /^[1-9][0-9]*$/.test(value) ? Number(value) : value), z.number().int().min(1).max(1000)),
    })
    .strict();

export type NoteRelatedReference = z.infer<typeof relatedReferenceSchema>;
export interface NoteRelatedSummary {
    kind: NoteRelatedReference["kind"];
    reference?: NoteRelatedReference;
    label: string | null;
    description: string | null;
    url: string | null;
    restricted: boolean;
    unavailable?: boolean;
    primary?: boolean;
    relatedLead?: { reference: NoteRelatedReference; label: string; description: string | null };
}
export interface NoteRelatedResolution {
    summary: NoteRelatedSummary;
    aliases: NoteRelatedReference[];
}
export interface NoteRelatedOptions {
    schemaVersion: 1;
    items: NoteRelatedSummary[];
    page: { number: number; size: 25 };
    hasMore: boolean;
    partial: boolean;
}
