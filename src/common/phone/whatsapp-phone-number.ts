/**
 * Resultado de normalizar un telefono al formato que Kapso espera:
 * solo digitos, con codigo de pais, sin `+`.
 */
export type NormalizedWhatsappPhoneNumber = {
    /** `CR` si se aplico la regla local de 8 digitos; `INTL` en el resto valido. */
    readonly country: "CR" | "INTL" | null;
    /** Digitos E.164 sin `+`. `null` cuando `isValid` es false. */
    readonly e164Digits: string | null;
    readonly isValid: boolean;
};

const COSTA_RICA_COUNTRY_CODE = "506";

/** 8 digitos CR: fijo (2) o movil (4, 6, 7, 8). El 9 no es un prefijo local valido. */
const COSTA_RICA_LOCAL_NUMBER = /^[24678]\d{7}$/;

/** E.164 sin `+`: 8–15 digitos, sin cero inicial (ITU-T E.164). */
const INTERNATIONAL_NUMBER = /^[1-9]\d{7,14}$/;

/**
 * Normaliza telefonos al formato que Kapso espera para WhatsApp.
 *
 * Costa Rica puede venir local de 8 digitos; se antepone `506`.
 * Internacionales deben traer prefijo (`+` / `00`) o un largo claramente
 * internacional (>= 11) para no confundir un local extranjero con CR.
 *
 * Placeholders tipo `00000000` / `88888888` se rechazan: no deben enviarse
 * a Kapso ni abrir conversaciones.
 *
 * @param value - Telefono crudo del CRM (puede venir con guiones, espacios, `+`)
 */
export function normalizeWhatsappPhoneNumber(value: string | null | undefined): NormalizedWhatsappPhoneNumber {
    const rawValue = value?.trim();

    if (!rawValue) {
        return invalidPhoneNumber();
    }

    const { digits, hadInternationalPrefix } = extractDigits(rawValue);

    if (!digits || isPlaceholderNumber(digits)) {
        return invalidPhoneNumber();
    }

    return tryNormalizeCostaRica(digits) ?? tryNormalizeInternational(digits, hadInternationalPrefix) ?? invalidPhoneNumber();
}

/**
 * Recuerda si el valor traia `+` o `00` ANTES de strippear no-digitos:
 * sin esa senal, un numero de 8–10 digitos no-CR se rechaza en vez de
 * inventarle un pais.
 */
function extractDigits(rawValue: string): {
    readonly digits: string;
    readonly hadInternationalPrefix: boolean;
} {
    const hadInternationalPrefix = rawValue.startsWith("+") || rawValue.startsWith("00");
    const digits = rawValue.replace(/\D/g, "").replace(/^00/, "");

    return { digits, hadInternationalPrefix };
}

/**
 * Si ya trae `506`, el resto DEBE ser un local CR valido: no se cae al
 * branch internacional (un `506` + basura no es un E.164 de otro pais).
 * Si no trae `506` pero coincide con 8 digitos locales, se antepone el codigo.
 */
function tryNormalizeCostaRica(digits: string): NormalizedWhatsappPhoneNumber | null {
    if (digits.startsWith(COSTA_RICA_COUNTRY_CODE)) {
        const localNumber = digits.slice(COSTA_RICA_COUNTRY_CODE.length);

        return COSTA_RICA_LOCAL_NUMBER.test(localNumber) ? validPhoneNumber("CR", `${COSTA_RICA_COUNTRY_CODE}${localNumber}`) : invalidPhoneNumber();
    }

    if (COSTA_RICA_LOCAL_NUMBER.test(digits)) {
        return validPhoneNumber("CR", `${COSTA_RICA_COUNTRY_CODE}${digits}`);
    }

    return null;
}

function tryNormalizeInternational(digits: string, hadInternationalPrefix: boolean): NormalizedWhatsappPhoneNumber | null {
    const looksInternational = hadInternationalPrefix || digits.length >= 11;

    if (looksInternational && INTERNATIONAL_NUMBER.test(digits)) {
        return validPhoneNumber("INTL", digits);
    }

    return null;
}

function validPhoneNumber(country: Exclude<NormalizedWhatsappPhoneNumber["country"], null>, e164Digits: string): NormalizedWhatsappPhoneNumber {
    return { country, e164Digits, isValid: true };
}

function invalidPhoneNumber(): NormalizedWhatsappPhoneNumber {
    return { country: null, e164Digits: null, isValid: false };
}

/** `00000000`, `88888888`, etc. suelen ser placeholders de ficha, no telefonos. */
function isPlaceholderNumber(value: string): boolean {
    return /^(\d)\1+$/.test(value);
}
