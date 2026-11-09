/**
 * Matcher para `toThrow` cuando un mismo caso puede fallar con varios mensajes controlados
 * (por ejemplo un `it.each` con entradas distintas). Escapa cada mensaje: nunca se interpreta como regex.
 *
 * Es mas estricto que `toThrow()` vacio, que acepta cualquier error (incluido un TypeError por un mock mal armado).
 */
export const anyOf = (...messages: string[]): RegExp => new RegExp(messages.map((message) => message.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&")).join("|"));
