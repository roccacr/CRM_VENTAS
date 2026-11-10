import { UNIT_FIELDS, type UnitDetail, unitStatus, type UnitSummary, type UnitValues } from "./unit-files.contract.js";

/** Los alias de la base separan la columna física del contrato público. */
export interface UnitReadRow extends Record<string, unknown> {
    position: number;
    id: string;
    nativeCode: string | null;
    legacyId: number | null;
    projectId: string;
    projectName: string;
    projectReference?: number | null;
}
/**
 * Conserva el texto de origen, también un precio que no es número.
 * Una fecha pasa a ISO. Un objeto o un arreglo no se convierte en cero: es un error de tipo.
 */
export function unitText(value: unknown): string | null {
    if (value === null || value === undefined) return null;
    if (value instanceof Date) return value.toISOString();
    if (typeof value === "string" || typeof value === "number" || typeof value === "bigint" || typeof value === "boolean") return String(value);
    throw new TypeError("Unexpected structured Unit Files source value");
}
/** Proyección corta de la tabla. No trae planos ni el resto de las áreas. */
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
/** El detalle representa cada campo de negocio, nulo incluido, más el metadato de origen y las referencias. */
export function mapUnitDetail(row: UnitReadRow, references: UnitDetail["externalReferences"]): UnitDetail {
    const values = Object.fromEntries(Object.keys(UNIT_FIELDS).map((key) => [key, unitText(row[key])])) as UnitValues;
    return { ...mapUnitSummary(row), values, sourceMetadata: { projectReference: unitText(row.projectReference) }, externalReferences: references };
}
