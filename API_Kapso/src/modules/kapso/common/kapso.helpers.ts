// ============================================================================
// IMPORTS
// ============================================================================

import { JsonRecord } from "./kapso.types";

// ============================================================================
// CONSTANTES DE APOYO
// ============================================================================

/** Longitud máxima por defecto al serializar payloads para logs. */
const DEFAULT_PAYLOAD_LOG_MAX_LENGTH = 2500;

/** Fragmento de error remoto que indica que el número aún no está disponible en Kapso. */
const KAPSO_PHONE_NUMBER_UNAVAILABLE_MARKER = "WhatsApp configuration not found";

// ============================================================================
// NORMALIZADORES GENERICOS
// ============================================================================

/**
 * Convierte un valor desconocido en objeto plano.
 * Si el valor no es un record válido, devuelve `{}` para evitar null checks repetidos.
 */
export function asRecord(value: unknown): JsonRecord {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as JsonRecord;
  }

  return {};
}

/** Normaliza un valor a array tipado; si no es array, devuelve `[]`. */
export function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

/**
 * Extrae un string útil desde un valor primitivo.
 * También convierte números y bigint a string para tolerar payloads heterogéneos.
 */
export function pickString(value: unknown): string | null {
  if (typeof value === "string") {
    const trimmedValue = value.trim();
    return trimmedValue.length > 0 ? trimmedValue : null;
  }

  if (typeof value === "number" || typeof value === "bigint") {
    return String(value);
  }

  return null;
}

/** Interpreta booleanos tolerando `1` como true, común en payloads JSON/API. */
export function pickBoolean(value: unknown, fallbackValue = false): boolean {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "number") {
    return value === 1;
  }

  return fallbackValue;
}

/**
 * Navega un objeto anidado por claves sucesivas.
 * Si la ruta se rompe en algún punto, devuelve `undefined` sin lanzar error.
 */
export function getNestedValue(source: JsonRecord, ...keys: string[]): unknown {
  let currentValue: unknown = source;

  for (const key of keys) {
    if (!currentValue || typeof currentValue !== "object" || Array.isArray(currentValue)) {
      return undefined;
    }

    currentValue = (currentValue as JsonRecord)[key];
  }

  return currentValue;
}

/**
 * Devuelve el primer string no nulo entre varios candidatos.
 * Sirve para tolerar snake_case, camelCase y variantes parciales del mismo payload.
 */
export function firstNonNullString(...values: unknown[]): string | null {
  for (const value of values) {
    const parsedValue = pickString(value);
    if (parsedValue) {
      return parsedValue;
    }
  }

  return null;
}

// ============================================================================
// LOGGING Y DIAGNOSTICO
// ============================================================================

/**
 * Serializa un valor para logging y lo trunca si supera `maxLength`.
 * Evita inundar la consola con payloads grandes o profundamente anidados.
 */
export function summarizePayload(value: unknown, maxLength = DEFAULT_PAYLOAD_LOG_MAX_LENGTH): string {
  try {
    const serializedValue = JSON.stringify(value, null, 2);
    if (serializedValue.length <= maxLength) {
      return serializedValue;
    }

    return `${serializedValue.slice(0, maxLength)}... [truncated]`;
  } catch {
    return "[unserializable-payload]";
  }
}

// ============================================================================
// REGLAS DE NEGOCIO PEQUENAS
// ============================================================================

/**
 * Detecta fallos transitorios cuando Kapso aún no expone el número recién conectado.
 * En ese caso el sync no se trata como fallo terminal: queda en `pending_remote_sync`
 * y el worker de reintentos puede completarlo después.
 */
export function isKapsoPhoneNumberAvailabilityError(message: string | null | undefined): boolean {
  if (!message) {
    return false;
  }

  return message.includes(KAPSO_PHONE_NUMBER_UNAVAILABLE_MARKER);
}
