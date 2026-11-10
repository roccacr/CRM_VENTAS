import { z } from "zod";

/** Permisos documentales, distintos del permiso de ruta. Un deny gana dentro del caso de uso. */
export const DOCUMENT_READ = "formalizacion.orders.documents.read";
export const DOCUMENT_WRITE = "formalizacion.orders.documents.write";
/** 320 KiB. Graph exige ese multiplo en cada fragmento, salvo el ultimo. */
export const DOCUMENT_CHUNK_SIZE = 327680;
/**
 * Nombre que SharePoint puede guardar. Tiene que venir recortado, sin controles,
 * sin los caracteres reservados, sin punto o espacio final, y no puede ser `.` ni `..`.
 */
export const documentName = z
    .string()
    .min(1)
    .max(180)
    .refine((name) => name === name.trim() && !Array.from(name).some((character) => character.charCodeAt(0) < 32) && !/[\\/:*?"<>|#%]/u.test(name) && !/[. ]$/u.test(name) && name !== "." && name !== "..", "Nombre de archivo inválido");
/** Como maximo 250 MB. Si el cliente no dice el conflicto, se falla: no se renombra ni se reemplaza. Un campo extra se rechaza. */
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
/** El contenido cabe en un fragmento codificado. 436908 es el base64 de 320 KiB. El alfabeto no acepta base64url ni espacios. */
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
/** El id no puede ser una ruta: solo el alfabeto que Graph usa en el item, con tope de 200. */
export const itemInput = z.object({ itemId: z.string().regex(/^[A-Za-z0-9!_-]{1,200}$/u), action: z.enum(["preview", "download"]) }).strict();
export interface DocumentItem {
    id: string;
    name: string;
    size: number;
    modifiedAt: string | null;
}
