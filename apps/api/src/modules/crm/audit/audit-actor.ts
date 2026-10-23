import type { Kysely } from "kysely";

import type { CrmDatabase } from "../../../database/database.types.js";

/** Trusted server-side identity captured before the business mutation, never credentials. */
/** Name and roles are frozen at capture time so later renames or role changes do not rewrite history. */
export interface AuditActorSnapshot {
    publicId: string;
    name: string;
    roles: { code: string; name: string }[];
}

// Only objects produced by a database capture can authorize commercial attribution.
// The detached value preserves pre-mutation roles even if a caller later mutates its copy.
const capturedActors = new WeakMap<object, AuditActorSnapshot>();

/** Client JSON and copied/lookalike snapshots deliberately have no trusted provenance. */
export function getCapturedAuditActor(value: unknown): AuditActorSnapshot | undefined {
    if (value === null || typeof value !== "object") return undefined;
    const actor = capturedActors.get(value);
    return actor ? { publicId: actor.publicId, name: actor.name, roles: actor.roles.map((role) => ({ ...role })) } : undefined;
}

/** Shared actor capture; activeOnly is used by new commercial mutations. */
export async function readAuditActor(executor: Pick<Kysely<CrmDatabase>, "selectFrom">, actorUserId: number, activeOnly = false): Promise<AuditActorSnapshot | undefined> {
    let query = executor.selectFrom("sec_user").select(["public_id_user as publicId", "display_name_user as name", "status_user as status", "deleted_at_user as deleted"]).where("id_user", "=", actorUserId);
    if (activeOnly) query = query.where("status_user", "=", "active").where("deleted_at_user", "is", null);
    const actor = await query.executeTakeFirst();
    if (!actor) return undefined;
    const roles = await executor.selectFrom("sec_user_role as assignment").innerJoin("sec_role as role", "role.id_role", "assignment.role_id_user_role").select(["role.code_role as code", "role.name_role as name"]).where("assignment.user_id_user_role", "=", actorUserId).where("assignment.status_user_role", "=", "active").where("assignment.revoked_at_user_role", "is", null).where("role.status_role", "=", "active").where("role.deleted_at_role", "is", null).orderBy("role.code_role").execute();
    const snapshot = { publicId: actor.publicId, name: actor.name, roles };
    if (actor.status === "active" && actor.deleted === null) capturedActors.set(snapshot, { publicId: actor.publicId, name: actor.name, roles: roles.map((role) => ({ ...role })) });
    return snapshot;
}
