import { z } from "zod";
export const DOCUMENT_READ = "formalizacion.orders.documents.read";
export const DOCUMENT_WRITE = "formalizacion.orders.documents.write";
export const DOCUMENT_CHUNK_SIZE = 327680;
export const documentName = z
    .string()
    .min(1)
    .max(180)
    .refine((name) => name === name.trim() && !Array.from(name).some((character) => character.charCodeAt(0) < 32) && !/[\\/:*?"<>|#%]/u.test(name) && !/[. ]$/u.test(name) && name !== "." && name !== "..", "Nombre de archivo inválido");
export const uploadInput = z
    .object({
        name: documentName,
        size: z
            .number()
            .int()
            .min(1)
            .max(250 * 1024 * 1024),
        conflict: z.enum(["fail", "rename", "replace"]).default("fail"),
    })
    .strict();
export const chunkInput = z
    .object({
        ticket: z.string().min(20).max(12000),
        offset: z.number().int().min(0),
        content: z
            .string()
            .min(4)
            .max(436908)
            .regex(/^[A-Za-z0-9+/]+={0,2}$/u),
    })
    .strict();
export const itemInput = z.object({ itemId: z.string().regex(/^[A-Za-z0-9!_-]{1,200}$/u), action: z.enum(["preview", "download"]) }).strict();
export interface DocumentItem {
    id: string;
    name: string;
    size: number;
    modifiedAt: string | null;
}
