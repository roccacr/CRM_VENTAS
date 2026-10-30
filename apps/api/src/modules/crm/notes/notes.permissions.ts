import { CATALOG_CONTEXT_MODULES, type CatalogContextModuleCode } from "../catalogs/catalogs.constants.js";
import type { IdentityProfile } from "../identity/identity.types.js";

export const NOTE_ACTIONS = ["read", "create", "edit_own", "resolve_own", "archive_own", "share_own", "reply", "edit_reply_own", "withdraw_reply_own"] as const;
export type NoteAction = (typeof NOTE_ACTIONS)[number];
export type NoteModule = CatalogContextModuleCode;
const scopes = ["self", "assigned", "own_area", "own_area_and_children", "all_areas"];
/** Existing module ceilings and explicit denies apply before note-level ACL. */
export function canUseNotes(profile: Pick<IdentityProfile, "permissions">, moduleCode: unknown, action: NoteAction): boolean {
    if (typeof moduleCode !== "string" || !CATALOG_CONTEXT_MODULES.includes(moduleCode as NoteModule)) return false;
    const entries = profile.permissions.filter((p) => p.code === `${moduleCode}.notes.${action}`);
    return !entries.some((p) => p.effect === "deny") && entries.some((p) => p.effect === "allow" && scopes.includes(p.scope));
}
/** A self-only grant never turns a participant into the author. */
export function notesReadOwnOnly(profile: Pick<IdentityProfile, "permissions">, moduleCode: NoteModule): boolean {
    return profile.permissions.filter((p) => p.code === `${moduleCode}.notes.read` && p.effect === "allow").every((p) => p.scope === "self");
}

/** Authorized invitations may borrow a notes capability, never resource access; origin deny wins. */
export function canUseCollaboration(profile: Pick<IdentityProfile, "permissions">, module: NoteModule, action: NoteAction, allowCrossModule: boolean): boolean {
    if (profile.permissions.some((p) => p.code === `${module}.notes.${action}` && p.effect === "deny")) return false;
    return canUseNotes(profile, module, action) || (allowCrossModule && CATALOG_CONTEXT_MODULES.some((candidate) => canUseNotes(profile, candidate, action)));
}
