import { z } from "zod";

import { CATALOG_DEFINITIONS } from "../catalogs/catalogs.constants.js";
import { AUDIT_MODULES } from "./audit-read.contract.js";

export interface AuditContextRow {
    eventType?: string;
    actorRoles?: unknown;
    actorPublicId?: unknown;
    recordedModule?: unknown;
    recordedSection?: unknown;
    catalogCode?: unknown;
    recordVersion?: unknown;
    recordId?: unknown;
    recordEntity?: unknown;
    recordName?: unknown;
    recordAction?: unknown;
    legacyItemId?: unknown;
    legacyRoleCode?: unknown;
    targetPublicId?: unknown;
}
const rolesSchema = z.array(z.object({ code: z.string().min(1), name: z.string().min(1) }));
const ACTION_LABELS: Readonly<Record<string, string>> = {
    create: "Creación",
    update: "Edición",
    deactivate: "Desactivación",
    reactivate: "Reactivación",
    delete: "Eliminación",
    user_created: "Creación de usuario",
    user_updated: "Edición de usuario",
    user_status_updated: "Cambio de estado",
    user_access_replaced: "Cambio de acceso",
    role_updated: "Edición de rol",
    role_deleted: "Eliminación de rol",
    role_permissions_replaced: "Cambio de permisos",
    catalog_item_created: "Creación de registro",
    catalog_item_updated: "Edición de registro",
    catalog_item_status_updated: "Cambio de estado",
    catalog_item_status_changed: "Cambio de estado",
    logout: "Cierre de sesión",
    local_login_succeeded: "Inicio de sesión local",
    microsoft_login_succeeded: "Inicio de sesión Microsoft",
    local_login_failed: "Intento de acceso rechazado",
    local_reset_requested: "Solicitud de restablecimiento",
    local_reset_completed: "Restablecimiento completado",
    local_identity_locked: "Bloqueo de identidad",
    session_revoked: "Revocación de sesión",
    refresh_rotated: "Renovación de sesión",
    refresh_reuse_detected: "Reuso de sesión detectado",
    microsoft_interaction_required: "Autenticación Microsoft requerida",
    unit_file_project_identity_prepared: "Preparación de identidad de proyecto",
};
const MUTATIONS = new Set(["create", "update", "deactivate", "reactivate", "delete"]);
const text = (value: unknown): string | null => (typeof value === "string" && value.length > 0 && value !== "null" ? value : null);

/** Only recorded role code/name pairs are returned; current role memberships are never consulted. */
function historicalRoles(value: unknown) {
    try {
        const parsed = rolesSchema.safeParse(typeof value === "string" ? JSON.parse(value) : value);
        return parsed.success ? parsed.data : null;
    } catch {
        return null;
    }
}

function historicalRecord(row: AuditContextRow, hasSnapshot: boolean) {
    if (hasSnapshot) return { id: text(row.recordId), entity: text(row.recordEntity), name: text(row.recordName) };
    switch (row.eventType?.split("_")[0]) {
        case "catalog":
            if (text(row.legacyItemId)) return { id: text(row.legacyItemId), entity: "catalog", name: null };
            break;
        case "role":
            if (text(row.legacyRoleCode)) return { id: text(row.legacyRoleCode), entity: "role", name: null };
            break;
    }
    if (text(row.targetPublicId)) return { id: text(row.targetPublicId), entity: "user", name: null };
    return { id: null, entity: null, name: null };
}

function locationContext(row: AuditContextRow) {
    const recordedModule = text(row.recordedModule);
    const recordedSection = text(row.recordedSection);
    const module = AUDIT_MODULES.find((item) => item.code === recordedModule);
    const section = module?.sections.find((item) => item.code === recordedSection);
    const catalogCode = text(row.catalogCode);
    return {
        recordedModule,
        recordedSection,
        moduleName: module?.name ?? null,
        sectionName: section?.name ?? null,
        catalogCode,
        catalogName: CATALOG_DEFINITIONS.find((item) => item.routeCode === catalogCode)?.label ?? null,
        contextKnown: Boolean(section),
    };
}

function recordedAction(row: AuditContextRow, versioned: boolean) {
    const mutation = text(row.recordAction);
    const action = versioned && mutation && MUTATIONS.has(mutation) ? mutation : (row.eventType ?? "unknown");
    return { action, actionLabel: ACTION_LABELS[action] ?? "Acción no registrada" };
}

/** Shared list/detail context from scalar projections, never guessed from filters or mutable record names. */
export function buildAuditReadContext(row: AuditContextRow) {
    const versioned = row.recordVersion === 1 || row.recordVersion === "1";
    return { actorPublicId: text(row.actorPublicId), actorRoles: historicalRoles(row.actorRoles), ...locationContext(row), record: historicalRecord(row, versioned && Boolean(text(row.recordId))), ...recordedAction(row, versioned) };
}
