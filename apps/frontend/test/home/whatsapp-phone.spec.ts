import { expect, it } from "vitest";

import { normalizeWhatsAppPhone } from "../../src/services/formalization/whatsapp-phone";

it.each([
    ["84398049", null, "50684398049"],
    ["8439-8049", "CR", "50684398049"],
    ["84398049", "506", "50684398049"],
    ["+506 8439-8049", "CR", "50684398049"],
    ["00506 8439 8049", null, "50684398049"],
    ["50684398049", null, "50684398049"],
    ["+1 (212) 555-0123", "US", "12125550123"],
    ["0044 20 7946 0958", "CR", "442079460958"],
] as const)("normalizes only one unambiguous phone %s with country %s", (phone, country, expected) => {
    expect(normalizeWhatsAppPhone(phone, country)).toBe(expected);
});
it.each([null, "", "Sin dato", "84398049 ext123", "84398049 x123", "84398049 / 88887777", "84398049, 88887777", "+50684398049;+50688887777", "abc84398049", "84398049#12", "+506 (84398049", "++50684398049", "+50600000000", "00084398049", "506843980498888", "84398049 88887777", "+01234567890", "+1234567890123456"])("rejects missing or ambiguous phones without guessing another recipient: %s", (phone) => {
    expect(normalizeWhatsAppPhone(phone)).toBeNull();
});
it("does not assume Costa Rica for a foreign national number", () => {
    expect(normalizeWhatsAppPhone("84398049", "US")).toBeNull();
    expect(normalizeWhatsAppPhone("2125550123", "US")).toBeNull();
});
