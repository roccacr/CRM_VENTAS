import { createHmac } from "node:crypto";

/**
 * Firma HMAC-SHA256 en hex (misma primitiva que produce Kapso / nuestros guards).
 * Fuente única para unit, e2e y Playwright — no reimplementar createHmac en cada suite.
 */
export function signHmacSha256Hex(rawBody: string, secret: string): string {
    return createHmac("sha256", secret).update(rawBody).digest("hex");
}

/** Firma el JSON serializado de un payload (como llega en el wire de Nest/supertest). */
export function signJsonPayload(payload: unknown, secret: string): string {
    return signHmacSha256Hex(JSON.stringify(payload), secret);
}
