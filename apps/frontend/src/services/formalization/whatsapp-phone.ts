/** Solo interpreta un teléfono completo; extensiones, listas o texto nunca se eliminan para fabricar un destinatario. */
export function normalizeWhatsAppPhone(raw: string | null | undefined, countryCode?: string | null): string | null {
    const phone = (raw ?? "").trim();
    if (![phone.length <= 60, /^(?:\+|00)?[\d -]*(?:\([\d -]+\)[\d -]*)?$/.test(phone)].every(Boolean)) return null;
    const international = /^(?:\+|00)/.test(phone);
    const digits = phone.replace(/[ ()-]/g, "").replace(/^(?:\+|00)/, "");
    if (international) return internationalPhone(digits);
    // Sin prefijo explícito, el negocio solo confirma números locales de Costa Rica.
    // Un país extranjero conocido exige el formato internacional; no se adivina su plan telefónico.
    if (!["", "0", "CR", "506", "+506", "00506"].includes((countryCode ?? "").trim().toUpperCase())) return null;
    const local = /^506\d{8}$/.test(digits) ? digits.slice(3) : digits;
    return /^[2-9]\d{7}$/.test(local) ? `506${local}` : null;
}

function internationalPhone(digits: string): string | null {
    if (digits.startsWith("506") && !/^506[2-9]\d{7}$/.test(digits)) return null;
    return /^[1-9]\d{7,14}$/.test(digits) ? digits : null;
}
