import { SetMetadata } from "@nestjs/common";

import type { CatalogPermissionAction, CatalogRouteCode } from "../../modules/crm/catalogs/catalogs.constants.js";
import type { NoteAction } from "../../modules/crm/notes/notes.permissions.js";

export const REQUIRE_PERMISSION_METADATA = "crm:require-permission";

/** Descriptors select existing grants only. Resource and conditional assignment checks stay in services. */
export type PermissionRequirement =
    | { kind: "calendar"; action: "read" | "create" | "update" }
    | { kind: "formalization-order-read" }
    | { kind: "formalization-read" }
    | { kind: "all"; codes: readonly string[] }
    | { kind: "active-role"; code: "formalizacion"; permissionCodes?: readonly string[] }
    | { kind: "catalog"; catalog?: CatalogRouteCode; action: CatalogPermissionAction | "status" }
    | { kind: "user-status" }
    | { kind: "unit-files" }
    | { kind: "audit" }
    | { kind: "notes"; action: NoteAction; source?: "query" | "body"; allowCrossModuleRead?: boolean };

/** Method-local metadata: permission handlers without a supported descriptor fail closed. */
export const RequirePermission = (requirement: PermissionRequirement): MethodDecorator => SetMetadata(REQUIRE_PERMISSION_METADATA, requirement);
