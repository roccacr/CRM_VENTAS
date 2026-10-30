import { calendarRouteAccess } from "../../modules/crm/calendar/calendar-access.js";
import { type CatalogPermissionAction, findCatalogDefinition, getCatalogPermissionCode, isCatalogContextModuleCode } from "../../modules/crm/catalogs/catalogs.constants.js";
import type { IdentityProfile } from "../../modules/crm/identity/identity.types.js";
import { canUseCollaboration, canUseNotes } from "../../modules/crm/notes/notes.permissions.js";
import type { CookieRequest } from "./cookie-request.type.js";
import type { PermissionRequirement } from "./require-permission.decorator.js";

/** Reads an own property from an untrusted body without touching the prototype chain. */
const field = (input: unknown, key: string): unknown => (typeof input === "object" && input !== null && Object.hasOwn(input, key) ? Reflect.get(input, key) : undefined);

/** Effective permission: an allow exists and no deny overrides it. */
const can = (profile: Pick<IdentityProfile, "permissions">, code: string): boolean => profile.permissions.some((entry) => entry.code === code && entry.effect === "allow") && !profile.permissions.some((entry) => entry.code === code && entry.effect === "deny");

/** Same check for an optional code; a missing code never authorizes. */
const canSelected = (profile: IdentityProfile, code: string | undefined): boolean => code !== undefined && can(profile, code);

/** Permission implied by the requested status: activating needs activate, inactive or blocked need deactivate. */
function userStatusPermission(body: unknown): string | undefined {
    const status = field(body, "status");
    if (status === "active") return "user.activate";
    if (status === "inactive" || status === "blocked") return "user.deactivate";
    return undefined;
}

/** Maps a catalog route action to a permission action; a status change decides update or inactivate from the body. */
function catalogAction(action: CatalogPermissionAction | "status", body: unknown): CatalogPermissionAction | undefined {
    if (action !== "status") return ["read", "create", "update", "inactivate"].includes(action) ? action : undefined;
    const status = field(body, "status");
    if (status === "active") return "update";
    if (status === "inactive") return "inactivate";
    return undefined;
}

/** Permission code for a catalog in a context module; unknown module, catalog or action yields none. */
function catalogGrant(moduleCode: unknown, catalog: unknown, action: CatalogPermissionAction | undefined): string | undefined {
    if (typeof moduleCode !== "string" || !isCatalogContextModuleCode(moduleCode) || !action) return undefined;
    const definition = typeof catalog === "string" ? findCatalogDefinition(catalog) : undefined;
    return definition ? getCatalogPermissionCode(moduleCode, definition, action) : undefined;
}

/** Permission required by a catalog route; reads take the module from the query, writes from the body. */
function catalogPermission(requirement: Extract<PermissionRequirement, { kind: "catalog" }>, request: CookieRequest): string | undefined {
    const source = requirement.action === "read" ? request.query : request.body;
    const rawModule = field(source, "moduleCode");
    // Catalog DTOs trim only. Unit Files below accepts exact values without a transform.
    const moduleCode = typeof rawModule === "string" ? rawModule.trim() : undefined;
    return catalogGrant(moduleCode, requirement.catalog ?? field(request.params, "catalogCode"), catalogAction(requirement.action, request.body));
}

/** Shared audit-read policy: an explicit deny overrides both grants and active Owner. */
export function canReadAudit(profile: IdentityProfile): boolean {
    if (profile.permissions.some((entry) => entry.code === "role.assign" && entry.effect === "deny")) return false;
    return can(profile, "role.assign") || profile.roles.some((role) => role.code === "owner" && role.status === "active");
}

/** Requires either effective operational role; Owner alone never substitutes for profile resolution. */
export const hasFormalizationRole = (profile: Pick<IdentityProfile, "roles">): boolean => profile.roles.some((role) => ["formalizacion", "jefe_formalizaciones"].includes(role.code) && role.status === "active");

/** Detail permission is independent of banner membership; effective role and explicit denies remain mandatory. */
export const canReadFormalizationOrder = (profile: Pick<IdentityProfile, "roles" | "permissions">): boolean => hasFormalizationRole(profile) && can(profile, "formalizacion.orders.read");

export const FORMALIZATION_STAGE_READ_PERMISSION = "formalizacion.home.stages.read";

/** Inherited membership is not a permission bypass; individual stage denies still win. */
export const FORMALIZATION_READ_PERMISSIONS = {
    approvals: "formalizacion.home.approvals.read",
    contracts: "formalizacion.home.contracts.read",
    bank: "formalizacion.home.banking.read",
    balance: "formalizacion.home.balance.read",
    transfer: "formalizacion.home.transfer_pending.read",
    signed: "formalizacion.home.transfer_signed.read",
    closed: "formalizacion.home.closed.read",
} as const;
/** Read scopes cover every seller; the legacy fallback is disabled by any granular entry. */
export function formalizationReadAccess(profile: Pick<IdentityProfile, "roles" | "permissions">) {
    const granular = Object.values(FORMALIZATION_READ_PERMISSIONS).filter((code) => code !== FORMALIZATION_READ_PERMISSIONS.approvals);
    const fallback = !profile.permissions.some((entry) => granular.includes(entry.code as never)) && can(profile, FORMALIZATION_STAGE_READ_PERMISSION);
    const allowed = (code: string) => hasFormalizationRole(profile) && (can(profile, code) || (code !== FORMALIZATION_READ_PERMISSIONS.approvals && fallback));
    return Object.fromEntries(Object.entries(FORMALIZATION_READ_PERMISSIONS).map(([queue, code]) => [queue, allowed(code)])) as Record<keyof typeof FORMALIZATION_READ_PERMISSIONS, boolean>;
}
/** All is the union of granted banner memberships. */
export function canReadFormalizationQueue(profile: Pick<IdentityProfile, "roles" | "permissions">, queue: string): boolean {
    const access = formalizationReadAccess(profile);
    if (queue === "all") return Object.values(access).some(Boolean);
    return Object.entries(access).some(([key, allowed]) => key === (["send", "signature"].includes(queue) ? "contracts" : queue) && allowed);
}
export const canReadFormalizationStages = (profile: Pick<IdentityProfile, "roles" | "permissions">): boolean => canReadFormalizationQueue(profile, "all");

/** Role membership and any declared permissions are cumulative requirements. */
function hasActiveRoleRequirement(profile: IdentityProfile, requirement: Extract<PermissionRequirement, { kind: "active-role" }>): boolean {
    return hasFormalizationRole(profile) && (requirement.permissionCodes === undefined || hasAllPermissions(profile, requirement.permissionCodes));
}

/** Resolves only bounded server-declared mappings, before pipes or handler execution. */
export function hasRoutePermission(profile: IdentityProfile, requirement: PermissionRequirement | undefined, request: CookieRequest): boolean {
    if (!requirement) return false;
    if (requirement.kind === "formalization-order-read") return canReadFormalizationOrder(profile);
    if (requirement.kind === "formalization-read") return canReadFormalizationStages(profile);
    if (requirement.kind === "calendar") return calendarRouteAccess(profile, requirement.action);
    return hasDeclaredRoutePermission(profile, requirement, request);
}

function notesRoutePermission(profile: IdentityProfile, requirement: Extract<PermissionRequirement, { kind: "notes" }>, request: CookieRequest): boolean {
    const source = requirement.source ?? (requirement.action === "read" ? "query" : "body");
    const moduleCode = field(request[source], "moduleCode");
    if (requirement.action === "read" && requirement.allowCrossModuleRead === true && typeof moduleCode === "string" && isCatalogContextModuleCode(moduleCode)) return canUseCollaboration(profile, moduleCode, "read", true);
    return canUseNotes(profile, moduleCode, "read") && canUseNotes(profile, moduleCode, requirement.action);
}

function hasDeclaredRoutePermission(profile: IdentityProfile, requirement: PermissionRequirement, request: CookieRequest): boolean {
    switch (requirement.kind) {
        case "active-role":
            return hasActiveRoleRequirement(profile, requirement);
        case "all":
            return hasAllPermissions(profile, requirement.codes);
        case "notes":
            return notesRoutePermission(profile, requirement, request);
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

/** True only for a non-empty list of well-formed codes that are all effectively allowed. */
function hasAllPermissions(profile: IdentityProfile, codes: readonly string[]): boolean {
    return Array.isArray(codes) && codes.length > 0 && codes.every((code) => typeof code === "string" && code.length > 0 && can(profile, code));
}
