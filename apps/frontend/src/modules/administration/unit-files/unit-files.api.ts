import { apiRequest } from "../../../services/api/api-client";

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
    values: Record<string, string | null>;
    sourceMetadata: { projectReference: string | null };
    externalReferences: { systemCode: string; externalId: string; status: string }[];
}
export interface UnitFilter {
    projectIds: string[];
    limit: number;
    status?: string;
    housingType?: string;
    code?: string;
    codeMatch?: string;
    cursor?: string | undefined;
    codes?: string[];
    housingTypes?: string[];
    statuses?: string[];
    paneProjectIds?: string[];
}
export interface UnitPage {
    items: UnitSummary[];
    pagination: { limit: number; returned: number; hasNext: boolean; nextCursor: string | null };
}
export interface UnitOptions {
    items: string[];
    hasNext: boolean;
    nextAfter: string | null;
}
export type UnitFacetKind = "code" | "projectIds" | "housingType" | "status";
export interface UnitFacet {
    value: string;
    count: number;
}

function unitQuery(filter: UnitFilter, moduleCode: string): URLSearchParams {
    const query = new URLSearchParams({ moduleCode, projectIds: filter.projectIds.join(","), limit: String(filter.limit) });
    for (const key of ["status", "housingType", "code", "codeMatch", "cursor"] as const) if (filter[key]) query.set(key, filter[key]);
    for (const key of ["codes", "housingTypes", "statuses", "paneProjectIds"] as const) if (filter[key]?.length) query.set(key, JSON.stringify(filter[key]));
    return query;
}
/** Counts cover all matching records, independently of the currently loaded inventory page. */
export function listUnitFacets(filter: UnitFilter, kind: UnitFacetKind, after: string | undefined, moduleCode: string): Promise<{ items: UnitFacet[]; nextAfter: string | null }> {
    const query = unitQuery({ ...filter, cursor: undefined, limit: 100 }, moduleCode);
    query.set("kind", kind);
    if (after !== undefined) query.set("after", after);
    return apiRequest(`/unit-files/facets?${query}`);
}
/** Searchable choices remain project-scoped and bounded, never a full inventory download. */
export function listUnitOptions(filter: UnitFilter, options: { kind: "housingType" | "code"; search: string; after?: string | undefined }, moduleCode: string): Promise<UnitOptions> {
    const { kind, search, after } = options;
    const query = new URLSearchParams({ moduleCode, projectIds: filter.projectIds.join(","), limit: "50", kind, search });
    if (filter.status) query.set("status", filter.status);
    if (filter.codeMatch) query.set("codeMatch", filter.codeMatch);
    if (kind === "code" && filter.housingType) query.set("housingType", filter.housingType);
    if (after) query.set("after", after);
    return apiRequest<UnitOptions>(`/unit-files/options?${query}`);
}

/** Unit Files owns its read contract; it never calls generic catalog persistence. */
export async function listUnitProjects(moduleCode: string): Promise<UnitProject[]> {
    const response = await apiRequest<{ items: UnitProject[] }>(`/unit-files/projects?moduleCode=${encodeURIComponent(moduleCode)}`);
    return response.items;
}
/** Criteria are transmitted before any inventory query; cursors bind the complete search. */
export function listUnitFiles(filter: UnitFilter, moduleCode: string): Promise<UnitPage> {
    const query = unitQuery(filter, moduleCode);
    return apiRequest<UnitPage>(`/unit-files?${query}`);
}
/** Full business values and provider references are fetched only for requested records. */
export function getUnitFile(id: string, moduleCode: string): Promise<UnitDetail> {
    return apiRequest<UnitDetail>(`/unit-files/${encodeURIComponent(id)}?moduleCode=${encodeURIComponent(moduleCode)}`);
}
