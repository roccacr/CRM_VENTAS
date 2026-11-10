import { createHash } from "node:crypto";

import { BadRequestException } from "@nestjs/common";

/**
 * Proyección de negocio sin pérdida. La identidad y los vínculos de proyecto o proveedor viven aparte.
 * `source` es el nombre guardado, con su ortografía: `precioVentaUncio_exp`, `areaDeMezzanieM2_exp`, `areacomunLibe_exp`.
 */
export const UNIT_FIELDS = {
    code: { source: "codigo_exp", length: 100 },
    projectNameSnapshot: { source: "proyectoPrincipal_exp", length: 50 },
    housingType: { source: "tipoDeVivienda_exp", length: 200 },
    lotArea: { source: "loteM2_exp", length: 100 },
    sourceStatus: { source: "estado_exp", length: 250 },
    advertisedSalePrice: { source: "precioVentaUncio_exp", length: 250 },
    habitableArea: { source: "m2Habitables_exp", length: 250 },
    totalArea: { source: "areaTotalM2_exp", length: 250 },
    approximateMaintenanceFee: { source: "cuotaMantenimientoAprox_exp", length: 250 },
    unitPlans: { source: "planosDeUnidad_exp", length: "TEXT" },
    estimatedDelivery: { source: "entregaEstimada", length: "TEXT" },
    storageArea: { source: "areaDeBodegaM2_exp", length: 250 },
    mezzanineArea: { source: "areaDeMezzanieM2_exp", length: 250 },
    balconyArea: { source: "areaDeBalconM2_exp", length: 250 },
    groundFloorArea: { source: "areaDePlantaBaja_exp", length: 250 },
    upperFloorArea: { source: "areaDePlantaAlta_exp", length: 250 },
    extensionArea: { source: "areaDeAmpliacion_exp", length: 250 },
    terraceArea: { source: "areaDeTerraza_exp", length: 250 },
    pricePerSquareMeter: { source: "precioPorM2_exp", length: 250 },
    thirdLevelBasementArea: { source: "tercerNivelSotano_exp", length: 250 },
    approximateParkingArea: { source: "areaDeParqueoAprox", length: 250 },
    externalGardenArea: { source: "areaExternaJardin_exp", length: 250 },
    slopedGardenArea: { source: "jardinConTalud_exp", length: 250 },
    openCommonArea: { source: "areacomunLibe_exp", length: 250 },
    minimumSalePrice: { source: "precioDeVentaMinimo", length: 250 },
    modifiedAt: { source: "fecha_mod", length: 35 },
    cronValue: { source: "cron_value", length: 20 },
} as const;

export type UnitValues = Record<keyof typeof UNIT_FIELDS, string | null>;
export interface UnitProject {
    id: string;
    name: string;
}
export interface UnitSummary {
    id: string;
    nativeCode: string | null;
    legacyId: number | null;
    project: UnitProject;
    code: string | null;
    housingType: string | null;
    status: string;
    sourceStatus: string | null;
    advertisedSalePrice: string | null;
    habitableArea: string | null;
    estimatedDelivery: string | null;
    totalArea: string | null;
    lotArea: string | null;
    approximateParkingArea: string | null;
    updatedAt: string | null;
}
export interface UnitDetail extends UnitSummary {
    values: UnitValues;
    sourceMetadata: { projectReference: string | null };
    externalReferences: { systemCode: string; externalId: string; status: string }[];
}
export interface UnitFilter {
    projectIds: string[];
    moduleCode: string;
    limit: number;
    status?: string;
    housingType?: string;
    code?: string;
    codeMatch?: string;
    cursor?: string;
    codes?: string[];
    housingTypes?: string[];
    statuses?: string[];
    paneProjectIds?: string[];
}
export type UnitFacetKind = "code" | "projectIds" | "housingType" | "status";
export interface UnitFacetFilter extends UnitFilter {
    kind: UnitFacetKind;
    after?: string;
}
export interface UnitFacet {
    value: string;
    count: number;
}
/** Los grupos nativos y los viejos no migrados no se pisan, así que el conteo de una misma etiqueta se suma. */
export function mergeUnitFacets(rows: UnitFacet[], limit: number) {
    const counts = new Map<string, number>();
    for (const row of rows) counts.set(row.value, (counts.get(row.value) ?? 0) + row.count);
    const all = [...counts].sort(([a], [b]) => Buffer.compare(Buffer.from(a), Buffer.from(b)));
    const items = all.slice(0, limit).map(([value, count]) => ({ value, count }));
    return { items, nextAfter: all.length > limit ? (items.at(-1)?.value ?? null) : null };
}
export interface UnitCursor {
    key: string;
    phase: "native" | "legacy";
    after: number;
}
export interface UnitOptionFilter extends UnitFilter {
    kind: "housingType" | "code";
    search?: string;
    after?: string;
}
export interface UnitPage {
    items: UnitSummary[];
    pagination: { limit: number; returned: number; hasNext: boolean; nextCursor: string | null };
}
/**
 * Devuelve uno de los siete códigos conocidos. Un texto que no está en esa lista queda `unknown`.
 * El texto original sigue en `sourceStatus`.
 */
export function unitStatus(value: string | null): string {
    const statuses: Record<string, string> = { "0. No Disponible": "unavailable", "1. Disponible para Venta": "available", "2. Pre-Reservada": "pre_reserved", "3. Reservado": "reserved", "4. Vendida": "sold", "5. Entregada": "delivered", "6. Traspasada": "transferred" };
    return statuses[value ?? ""] ?? "unknown";
}
/** La clave del cursor ata el módulo, los proyectos, el límite y el criterio. No guarda secretos. */
export function unitFilterKey(filter: UnitFilter): string {
    return createHash("sha256")
        .update(JSON.stringify([filter.moduleCode, [...filter.projectIds].sort(), filter.limit, filter.status ?? "", filter.housingType ?? "", filter.code ?? "", filter.codeMatch ?? "", ...[filter.codes, filter.housingTypes, filter.statuses, filter.paneProjectIds].map((values) => [...(values ?? [])].sort())]))
        .digest("hex");
}
/** Posición opaca de la página. No concede permiso. */
export function encodeUnitCursor(cursor: UnitCursor): string {
    return Buffer.from(JSON.stringify(cursor)).toString("base64url");
}
/** La fase solo puede ser nativa o vieja, y la posición un entero seguro mayor o igual que cero. */
function validSeek(item: UnitCursor): boolean {
    return ["native", "legacy"].includes(item.phase) && Number.isSafeInteger(item.after) && item.after >= 0;
}
/**
 * El cursor llega sin confianza. Si falta, empieza en nativo y en cero.
 * Otra búsqueda, otra fase o una posición inválida comparten el mismo rechazo, antes de consultar.
 */
export function decodeUnitCursor(cursor: string | undefined, key: string): UnitCursor {
    if (!cursor) return { key, phase: "native", after: 0 };
    try {
        const value: unknown = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8"));
        if (!value || typeof value !== "object") throw new Error();
        const item = value as UnitCursor;
        if (item.key !== key || !validSeek(item)) throw new Error();
        return { key, phase: item.phase, after: item.after };
    } catch {
        throw new BadRequestException("Cursor de expedientes invalido o de otra busqueda.");
    }
}
