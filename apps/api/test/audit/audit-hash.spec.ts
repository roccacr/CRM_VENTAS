import { createHmac } from "node:crypto";

import { describe, expect, it } from "vitest";

import { AUDIT_HASH_KEY_VERSION, createAuditIdentifierHmac, normalizeAuditIdentifier } from "../../src/modules/crm/audit/audit-hash.js";

const FIRST_SECRET = "first-audit-hash-secret-32-chars";
const SECOND_SECRET = "second-audit-hash-secret-32-char";

/**
 * Calcula el HMAC esperado sin reutilizar la implementacion productiva.
 */
const expectedHmac = (value: string, secret: string): string => createHmac("sha256", secret).update(value.trim().toLowerCase()).digest("hex");

describe("audit-hash", () => {
    it("normaliza identificadores antes de correlacionarlos", () => {
        expect(normalizeAuditIdentifier(" Usuario@RoccaCR.com ")).toBe("usuario@roccacr.com");
    });

    it("genera el mismo HMAC para el mismo correo y secreto", () => {
        expect(createAuditIdentifierHmac(" Usuario@RoccaCR.com ", FIRST_SECRET)).toBe(expectedHmac("usuario@roccacr.com", FIRST_SECRET));
    });

    it("genera HMAC distinto cuando cambia el secreto", () => {
        const first = createAuditIdentifierHmac("usuario@roccacr.com", FIRST_SECRET);
        const second = createAuditIdentifierHmac("usuario@roccacr.com", SECOND_SECRET);

        expect(first).not.toBe(second);
        expect(AUDIT_HASH_KEY_VERSION).toBe(1);
    });
});
