import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { normalizeWhatsAppPhone } from "../../src/services/formalization/whatsapp-phone";

const E164_DIGITS = /^[1-9]\d{7,14}$/;
const hostile = fc.oneof(fc.string(), fc.string({ unit: "binary" }), fc.constantFrom("", " ", "+", "00", "'; DROP TABLE x;--", "NaN", "9e999", "\u0000", "+506\u200b84398049", "８４３９８０４９"));
const country = fc.option(fc.oneof(fc.constantFrom("CR", "506", "+506", "00506", "US", "0", "", " cr "), fc.string()), { nil: undefined });

describe("normalizeWhatsAppPhone (propiedades)", () => {
    it("nunca lanza y devuelve null o solo dígitos internacionales válidos (E.164 sin '+')", () => {
        fc.assert(
            fc.property(fc.option(hostile, { nil: null }), country, (raw, code) => {
                const result = normalizeWhatsAppPhone(raw, code);
                if (result !== null) expect(result).toMatch(E164_DIGITS);
            }),
            { numRuns: 2000 },
        );
    });

    it("cualquier texto con letras, ';', ',', '/' o '#' se rechaza (nunca fabrica un destinatario)", () => {
        fc.assert(
            fc.property(fc.stringMatching(/^[0-9]{0,8}[a-zA-Z;,/#][0-9a-zA-Z ]{0,8}$/), (raw) => {
                expect(normalizeWhatsAppPhone(raw)).toBeNull();
                expect(normalizeWhatsAppPhone(raw, "CR")).toBeNull();
            }),
        );
    });

    it("un resultado válido es idempotente: normalizar '+resultado' devuelve el mismo número", () => {
        fc.assert(
            fc.property(fc.stringMatching(/^[2-9][0-9]{7}$/), (local) => {
                const first = normalizeWhatsAppPhone(local, "CR");
                expect(first).toBe(`506${local}`);
                expect(normalizeWhatsAppPhone(`+${first ?? ""}`)).toBe(first);
                expect(normalizeWhatsAppPhone(first)).toBe(first);
            }),
        );
    });

    it("los separadores permitidos (espacio, guion, paréntesis) no cambian el resultado", () => {
        fc.assert(
            fc.property(fc.stringMatching(/^[2-9][0-9]{7}$/), (local) => {
                const spaced = `${local.slice(0, 4)}-${local.slice(4)}`;
                expect(normalizeWhatsAppPhone(spaced, "CR")).toBe(normalizeWhatsAppPhone(local, "CR"));
                expect(normalizeWhatsAppPhone(`+506 ${spaced}`)).toBe(normalizeWhatsAppPhone(local, "CR"));
            }),
        );
    });

    it("un país extranjero sin prefijo internacional nunca se adivina como Costa Rica", () => {
        fc.assert(
            fc.property(fc.stringMatching(/^[2-9][0-9]{7}$/), fc.constantFrom("US", "MX", "PA", "ES"), (local, foreign) => {
                expect(normalizeWhatsAppPhone(local, foreign)).toBeNull();
            }),
        );
    });

    it("más de 60 caracteres se rechaza aunque sean dígitos", () => {
        expect(normalizeWhatsAppPhone("1".repeat(61))).toBeNull();
        expect(normalizeWhatsAppPhone(`+${"1".repeat(60)}`)).toBeNull();
    });
});
