/**
 * Normalizacion unica de identificadores que no distinguen mayusculas.
 *
 * Validacion, auditoria y rate limit tienen que producir la misma llave. Si
 * cada capa recorta o no por su cuenta, el mismo correo abre dos cupos de
 * bloqueo y dos HMAC de auditoria.
 */

/** Recorta extremos y pasa a minusculas. No elimina caracteres invisibles: eso lo exige el patron de abajo. */
export const normalizeCaseInsensitiveIdentifier = (value: string): string => value.trim().toLowerCase();

/**
 * Adaptador de `class-transformer`. Lo que no es string se deja igual para que
 * el validador rechace el tipo, en lugar de coerccionarlo a una identidad.
 */
export const transformCaseInsensitiveIdentifier = ({ value }: { value: unknown }): unknown => (typeof value === "string" ? normalizeCaseInsensitiveIdentifier(value) : value);

/**
 * Rechaza controles y formatos Unicode dentro del identificador: zero-width,
 * marcas bidi y BOM. `trim()` no los quita y `@IsEmail()` los acepta. Sin este
 * filtro, un correo con U+200B al final es otra llave de rate limit y otro HMAC
 * de auditoria, indistinguible a la vista.
 */
export const NO_INVISIBLE_CHARACTERS = /^[^\p{Cc}\p{Cf}]*$/u;
