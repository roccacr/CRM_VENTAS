import { normalizeWhatsappPhoneNumber } from "../../../src/common/phone/whatsapp-phone-number";

describe("normalizeWhatsappPhoneNumber", () => {
    it.each([
        ["8751-5938", "50687515938"],
        ["8751 5938", "50687515938"],
        ["+506 8751 5938", "50687515938"],
        ["00506 8751 5938", "50687515938"],
    ])("normalizes Costa Rica numbers from %s", (input, expected) => {
        expect(normalizeWhatsappPhoneNumber(input)).toEqual({
            country: "CR",
            e164Digits: expected,
            isValid: true,
        });
    });

    it.each([
        ["+1 (555) 123-4567", "15551234567"],
        ["0034 612 345 678", "34612345678"],
        ["+49 8383 1142", "4983831142"],
        ["974 1234 5678", "97412345678"],
    ])("keeps international numbers with country code from %s", (input, expected) => {
        expect(normalizeWhatsappPhoneNumber(input)).toEqual({
            country: "INTL",
            e164Digits: expected,
            isValid: true,
        });
    });

    it.each(["88888888", "00000000", "50600000000", "5058640540", "61698085.71259753", null])("rejects unsafe phone value %s", (input) => {
        expect(normalizeWhatsappPhoneNumber(input)).toEqual({
            country: null,
            e164Digits: null,
            isValid: false,
        });
    });

    it.each(["24715938", "44715938", "64715938", "74715938", "84715938"])("accepts Costa Rica local prefix from %s", (input) => {
        expect(normalizeWhatsappPhoneNumber(input)).toEqual({
            country: "CR",
            e164Digits: `506${input}`,
            isValid: true,
        });
    });

    it.each(["94715938", "50694715938", undefined, "", "   ", "5551234567", "1111", "999999999"])("rejects invalid, foreign-local or placeholder value %s", (input) => {
        expect(normalizeWhatsappPhoneNumber(input)).toEqual({
            country: null,
            e164Digits: null,
            isValid: false,
        });
    });
});
