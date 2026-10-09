import type { CatalogRouteCode, CatalogStatus } from "./catalogs.constants.js";

export interface CatalogExternalReference {
    externalId: string;
    status: string;
    systemCode: string;
    systemName: string;
}

export interface CatalogItem {
    detail: string | null;
    externalReferences: readonly CatalogExternalReference[];
    name: string;
    nativeCode: string;
    publicId: string;
    status: CatalogStatus;
    updatedAt: string;
}

export interface CatalogItemsResponse {
    catalog: {
        code: CatalogRouteCode;
        label: string;
        moduleCode: string;
    };
    items: readonly CatalogItem[];
    total: number;
}

export interface CatalogExternalReferenceInput {
    externalId: string;
    systemCode: string;
}

export interface CatalogMutationInput {
    actorPublicId: string;
    catalogCode: CatalogRouteCode;
    detail?: string | undefined;
    externalReferences: readonly CatalogExternalReferenceInput[];
    ipAddress?: string | undefined;
    name: string;
    reason: string;
    userAgent?: string | undefined;
}

export interface CatalogStatusMutationInput {
    actorPublicId: string;
    catalogCode: CatalogRouteCode;
    ipAddress?: string | undefined;
    itemPublicId: string;
    reason: string;
    status: CatalogStatus;
    userAgent?: string | undefined;
}
