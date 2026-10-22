import { type CatalogPermissionAction, findCatalogDefinition, getCatalogPermissionCode, isCatalogContextModuleCode } from "../../modules/crm/catalogs/catalogs.constants.js";
import type { IdentityProfile } from "../../modules/crm/identity/identity.types.js";
import type { CookieRequest } from "./cookie-request.type.js";
import type { PermissionRequirement } from "./require-permission.decorator.js";

const field = (input: unknown, key: string): unknown => (typeof input === "object" && input !== null && Object.hasOwn(input, key) ? Reflect.get(input, key) : undefined);

const can = (profile: IdentityProfile, code: string): boolean => profile.permissions.some((entry) => entry.code === code && entry.effect === "allow") && !profile.permissions.some((entry) => entry.code === code && entry.effect === "deny");

const canSelected = (profile: IdentityProfile, code: string | undefined): boolean => code !== undefined && can(profile, code);

function userStatusPermission(body: unknown): string | undefined {
    const status = field(body, "status");
    if (status === "active") return "user.activate";
    if (status === "inactive" || status === "blocked") return "user.deactivate";
    return undefined;
}

function catalogAction(action: CatalogPermissionAction | "status", body: unknown): CatalogPermissionAction | undefined {
    if (action !== "status") return ["read", "create", "update", "inactivate"].includes(action) ? action : undefined;
    const status = field(body, "status");
    if (status === "active") return "update";
    if (status === "inactive") return "inactivate";
    return undefined;
}

function catalogGrant(moduleCode: unknown, catalog: unknown, action: CatalogPermissionAction | undefined): string | undefined {
    if (typeof moduleCode !== "string" || !isCatalogContextModuleCode(moduleCode) || !action) return undefined;
    const definition = typeof catalog === "string" ? findCatalogDefinition(catalog) : undefined;
    return definition ? getCatalogPermissionCode(moduleCode, definition, action) : undefined;
}

function catalogPermission(requirement: Extract<PermissionRequirement, { kind: "catalog" }>, request: CookieRequest): string | undefined {
    const source = requirement.action === "read" ? request.query : request.body;
    const rawModule = field(source, "moduleCode");
    // Catalog DTOs trim only. Unit Files below accepts exact values without a transform.
    const moduleCode = typeof rawModule === "string" ? rawModule.trim() : undefined;
    return catalogGrant(moduleCode, requirement.catalog ?? field(request.params, "catalogCode"), catalogAction(requirement.action, request.body));
}

function canReadAudit(profile: IdentityProfile): boolean {
    // Deliberate HTTP hardening: retain the existing Owner exception, unless role.assign is denied.
    if (profile.permissions.some((entry) => entry.code === "role.assign" && entry.effect === "deny")) return false;
    return can(profile, "role.assign") || profile.roles.some((role) => role.code === "owner" && role.status === "active");
}

/** Resolves only bounded server-declared mappings, before pipes or handler execution. */
export function hasRoutePermission(profile: IdentityProfile, requirement: PermissionRequirement | undefined, request: CookieRequest): boolean {
    if (!requirement) return false;
    switch (requirement.kind) {
        case "all":
            return hasAllPermissions(profile, requirement.codes);
        case "audit":
            return canReadAudit(profile);
        case "user-status":
            return canSelected(profile, userStatusPermission(request.body));
        case "unit-files":
            return canSelected(profile, catalogGrant(field(request.query, "moduleCode"), "files", "read"));
        case "catalog":
            return canSelected(profile, catalogPermission(requirement, request));
        default:
            return false;
    }
}

function hasAllPermissions(profile: IdentityProfile, codes: readonly string[]): boolean {
    return Array.isArray(codes) && codes.length > 0 && codes.every((code) => typeof code === "string" && code.length > 0 && can(profile, code));
}
