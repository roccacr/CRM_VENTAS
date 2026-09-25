/**
 * Normaliza el header `Set-Cookie` que devuelve Fastify.
 *
 * Fastify puede exponer una sola cookie como string o varias como arreglo.
 * Las pruebas HTTP no deben depender de ese detalle ni del orden de emision.
 */
export const readSetCookieHeaders = (setCookieHeader: unknown): string[] => {
    if (Array.isArray(setCookieHeader)) {
        return setCookieHeader.map(String);
    }

    return typeof setCookieHeader === "string" ? [setCookieHeader] : [];
};

/**
 * Busca una cookie especifica dentro de los headers de respuesta.
 *
 * Falla de forma explicita para que una regresion de emision de cookies no se
 * confunda con una asercion vacia o con un orden distinto de `Set-Cookie`.
 */
export const findSetCookieHeader = (setCookieHeader: unknown, cookieName: string): string => {
    const cookie = readSetCookieHeaders(setCookieHeader).find((header) => header.startsWith(`${cookieName}=`));

    if (!cookie) {
        throw new Error(`No se encontro Set-Cookie para ${cookieName}.`);
    }

    return cookie;
};

/**
 * Extrae el valor principal de una cookie desde un header `Set-Cookie`.
 *
 * Solo corta en el primer `=` para conservar valores con relleno, como
 * `base64` estandar o futuros tokens que no usen `base64url`.
 */
export const readCookieValue = (setCookieHeader: string): string => {
    const cookiePair = setCookieHeader.split(";")[0] ?? "";
    const separatorIndex = cookiePair.indexOf("=");

    return separatorIndex === -1 ? "" : cookiePair.slice(separatorIndex + 1);
};

/**
 * Lee un atributo exacto de `Set-Cookie`.
 *
 * Se usa para evitar aserciones fragiles como `toContain("Path=/")`, porque
 * `Path=/identity/refresh` tambien contiene ese texto pero no representa la
 * ruta raiz. Los atributos sin valor, como `Secure` o `HttpOnly`, devuelven
 * `true` cuando existen.
 */
export const readCookieAttribute = (setCookieHeader: string, attributeName: string): string | true | undefined => {
    const normalizedAttributeName = attributeName.toLowerCase();
    const attribute = setCookieHeader
        .split(";")
        .map((part) => part.trim())
        .slice(1)
        .find((part) => {
            const normalizedPart = part.toLowerCase();
            return normalizedPart === normalizedAttributeName || normalizedPart.startsWith(`${normalizedAttributeName}=`);
        });

    if (!attribute) {
        return undefined;
    }

    const separatorIndex = attribute.indexOf("=");

    return separatorIndex === -1 ? true : attribute.slice(separatorIndex + 1);
};

/**
 * Indica si un atributo flag existe en `Set-Cookie`.
 */
export const hasCookieAttribute = (setCookieHeader: string, attributeName: string): boolean => readCookieAttribute(setCookieHeader, attributeName) !== undefined;
