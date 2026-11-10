import { SetMetadata } from "@nestjs/common";

import type { CatalogPermissionAction, CatalogRouteCode } from "../../modules/crm/catalogs/catalogs.constants.js";
import type { NoteAction } from "../../modules/crm/notes/notes.permissions.js";

export const REQUIRE_PERMISSION_METADATA = "crm:require-permission";

/**
 * Descriptor de grants que la ruta ya conoce. No autoriza un codigo armado por
 * el cliente ni una fila concreta: eso queda en el servicio.
 *
 * Cada `kind` es un mapeo cerrado. Un valor fuera de la union no compila, y un
 * descriptor ausente en una ruta `permission` se niega en el guard.
 */
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

/** Metadato del metodo. Pegarlo en la clase no alcanza: el guard lee el handler. */
export const RequirePermission = (requirement: PermissionRequirement): MethodDecorator => SetMetadata(REQUIRE_PERMISSION_METADATA, requirement);
