import type { UnitDetail, UnitFacet, UnitFacetFilter, UnitFilter, UnitOptionFilter, UnitProject, UnitSummary } from "./unit-files.contract.js";

export const UNIT_FILES_LEGACY = Symbol("UNIT_FILES_LEGACY");
export interface UnitProjectBinding extends UnitProject {
    externalReferences: { systemCode: string; externalId: string }[];
}
export interface UnitSeekRow {
    position: number;
    item: UnitSummary;
}
/** Optional read boundary: native runtime has no concrete legacy dependency. */
export interface UnitFilesLegacy {
    enabled(): boolean;
    facets?(filter: UnitFacetFilter, take: number): Promise<UnitFacet[]>;
    options(filter: UnitOptionFilter, take: number): Promise<string[]>;
    list(filter: UnitFilter, projects: UnitProjectBinding[], after: number, take: number): Promise<UnitSeekRow[]>;
    detail(legacyId: number): Promise<UnitDetail | null>;
}
