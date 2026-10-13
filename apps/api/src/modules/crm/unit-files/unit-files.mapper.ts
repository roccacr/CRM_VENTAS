import { UNIT_FIELDS, type UnitDetail, unitStatus, type UnitSummary, type UnitValues } from "./unit-files.contract.js";

/** Database aliases isolate physical source columns from the public contract. */
export interface UnitReadRow extends Record<string, unknown> {
    position: number;
    id: string;
    nativeCode: string | null;
    legacyId: number | null;
    projectId: string;
    projectName: string;
    projectReference?: number | null;
}
/** Preserve unknown and placeholder values; never coerce invalid money to zero. */
export function unitText(value: unknown): string | null {
    if (value === null || value === undefined) return null;
    if (value instanceof Date) return value.toISOString();
    if (typeof value === "string" || typeof value === "number" || typeof value === "bigint" || typeof value === "boolean") return String(value);
    throw new TypeError("Unexpected structured Unit Files source value");
}
/** Lightweight table projection, without plans or full geometry. */
export function mapUnitSummary(row: UnitReadRow): UnitSummary {
    return {
        id: row.id,
        nativeCode: row.nativeCode,
        legacyId: row.legacyId,
        project: { id: row.projectId, name: row.projectName },
        code: unitText(row.code),
        housingType: unitText(row.housingType),
        status: unitStatus(unitText(row.sourceStatus)),
        sourceStatus: unitText(row.sourceStatus),
        advertisedSalePrice: unitText(row.advertisedSalePrice),
        habitableArea: unitText(row.habitableArea),
        estimatedDelivery: unitText(row.estimatedDelivery),
        totalArea: unitText(row.totalArea),
        lotArea: unitText(row.lotArea),
        approximateParkingArea: unitText(row.approximateParkingArea),
        updatedAt: unitText(row.modifiedAt),
    };
}
/** Every source business field is represented, including nulls and source metadata. */
export function mapUnitDetail(row: UnitReadRow, references: UnitDetail["externalReferences"]): UnitDetail {
    const values = Object.fromEntries(Object.keys(UNIT_FIELDS).map((key) => [key, unitText(row[key])])) as UnitValues;
    return { ...mapUnitSummary(row), values, sourceMetadata: { projectReference: unitText(row.projectReference) }, externalReferences: references };
}
