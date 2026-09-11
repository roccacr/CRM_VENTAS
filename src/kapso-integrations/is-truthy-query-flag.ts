/**
 * Query flags del CRM (`includeInactive=1` / `true`).
 * Cualquier otro valor (incluido ausente) es false.
 */
export function isTruthyQueryFlag(value: string | undefined): boolean {
    return value === "1" || value === "true";
}
