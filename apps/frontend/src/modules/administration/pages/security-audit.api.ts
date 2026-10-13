import { apiRequest } from "../../../services/api/api-client";
export interface AuditOptions {
    modules: { code: string; name: string; sections: { code: string; name: string }[] }[];
    catalogs: { code: string; name: string }[];
}
export interface AuditFilter {
    moduleCode: string;
    sectionCode: string;
    catalogCode?: string | undefined;
    search?: string | undefined;
    limit: number;
    cursor?: string | undefined;
}
export interface AuditEvent {
    publicId: string;
    eventType: string;
    summary: string;
    reason: string | null;
    actorName: string | null;
    targetName: string | null;
    recordedModule: string | null;
    catalogCode: string | null;
    contextKnown: boolean;
    createdAt: string;
    actorPublicId: string | null;
    actorRoles: { code: string; name: string }[] | null;
    recordedSection: string | null;
    moduleName: string | null;
    sectionName: string | null;
    catalogName: string | null;
    record: { id: string | null; entity: string | null; name: string | null };
    action: string;
    actionLabel: string;
}
export interface AuditPage {
    items: AuditEvent[];
    pagination: { limit: number; returned: number; hasNext: boolean; nextCursor: string | null };
}
export interface AuditChangeSet {
    version: 1;
    entity: string;
    recordId: string;
    action: "create" | "update" | "deactivate" | "reactivate" | "delete";
    before: Record<string, unknown> | null;
    after: Record<string, unknown> | null;
    changes: { field: string; before: unknown; after: unknown }[];
}
export type AuditDetail = AuditEvent & { changeSet: AuditChangeSet | null };
/** Detail snapshots are fetched only when an event is opened. */
export const getAuditDetail = (publicId: string): Promise<AuditDetail> => apiRequest(`/audit/${encodeURIComponent(publicId)}`);
/** Choices do not download log rows. */
export const getAuditOptions = (): Promise<AuditOptions> => apiRequest("/audit/options");
/** Required server scope; matching and pagination happen before rows reach the browser. */
export function getAuditPage(filter: AuditFilter): Promise<AuditPage> {
    const query = new URLSearchParams({ moduleCode: filter.moduleCode, sectionCode: filter.sectionCode, limit: String(filter.limit) });
    for (const key of ["catalogCode", "search", "cursor"] as const) if (filter[key]) query.set(key, filter[key]);
    return apiRequest(`/audit?${query}`);
}
