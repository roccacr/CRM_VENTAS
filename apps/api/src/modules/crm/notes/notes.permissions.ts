import { CATALOG_CONTEXT_MODULES, type CatalogContextModuleCode } from "../catalogs/catalogs.constants.js";
import type { IdentityProfile } from "../identity/identity.types.js";

export const NOTE_ACTIONS = ["read", "create", "edit_own", "resolve_own", "archive_own", "share_own", "reply", "edit_reply_own", "withdraw_reply_own"] as const;
export type NoteAction = (typeof NOTE_ACTIONS)[number];
export type NoteModule = CatalogContextModuleCode;
const scopes = ["self", "assigned", "own_area", "own_area_and_children", "all_areas"];
/** El techo del módulo y un deny explícito se aplican antes de la ACL de la nota. Un alcance desconocido no cuenta como allow. */
export function canUseNotes(profile: Pick<IdentityProfile, "permissions">, moduleCode: unknown, action: NoteAction): boolean {
    if (typeof moduleCode !== "string" || !CATALOG_CONTEXT_MODULES.includes(moduleCode as NoteModule)) return false;
    const entries = profile.permissions.filter((p) => p.code === `${moduleCode}.notes.${action}`);
    return !entries.some((p) => p.effect === "deny") && entries.some((p) => p.effect === "allow" && scopes.includes(p.scope));
}
/** Un permiso solo propio no convierte al invitado en autor. */
export function notesReadOwnOnly(profile: Pick<IdentityProfile, "permissions">, moduleCode: NoteModule): boolean {
    return profile.permissions.filter((p) => p.code === `${moduleCode}.notes.read` && p.effect === "allow").every((p) => p.scope === "self");
}

/** Una invitación puede usar la capacidad de notas de otro módulo. No presta el acceso al recurso. Un deny del módulo de origen gana. */
export function canUseCollaboration(profile: Pick<IdentityProfile, "permissions">, module: NoteModule, action: NoteAction, allowCrossModule: boolean): boolean {
    if (profile.permissions.some((p) => p.code === `${module}.notes.${action}` && p.effect === "deny")) return false;
    return canUseNotes(profile, module, action) || (allowCrossModule && CATALOG_CONTEXT_MODULES.some((candidate) => canUseNotes(profile, candidate, action)));
}
