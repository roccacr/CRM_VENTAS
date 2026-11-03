import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from "node:crypto";

import { BadRequestException } from "@nestjs/common";
import { z } from "zod";
const ticketSchema = z.object({ user: z.string(), order: z.string(), folder: z.string(), name: z.string(), url: z.url(), size: z.number().int().positive(), expires: z.number() }).strict();
export type UploadTicket = z.infer<typeof ticketSchema>;
/** El uploadUrl concede acceso por sí solo: viaja únicamente cifrado, ligado a usuario y orden. */
export function sealUploadTicket(value: UploadTicket, secret: string): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", Buffer.from(hkdfSync("sha256", secret, "crm-order-documents", "upload-ticket-v1", 32)), iv);
    const encrypted = Buffer.concat([cipher.update(JSON.stringify(value), "utf8"), cipher.final()]);
    return Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString("base64url");
}
/** Rechaza tickets alterados, vencidos o de otro usuario y orden antes de usar su URL. */
export function openUploadTicket(value: string, secret: string, user: string, order: string): UploadTicket {
    try {
        const bytes = Buffer.from(value, "base64url");
        const decipher = createDecipheriv("aes-256-gcm", Buffer.from(hkdfSync("sha256", secret, "crm-order-documents", "upload-ticket-v1", 32)), bytes.subarray(0, 12));
        decipher.setAuthTag(bytes.subarray(12, 28));
        const ticket = ticketSchema.parse(JSON.parse(Buffer.concat([decipher.update(bytes.subarray(28)), decipher.final()]).toString("utf8")));
        if (ticket.user !== user || ticket.order !== order || ticket.expires <= Date.now()) throw new Error("invalid");
        return ticket;
    } catch {
        throw new BadRequestException("La carga expiró o no pertenece a esta orden y usuario. Consulta los archivos antes de iniciar otra carga.");
    }
}
