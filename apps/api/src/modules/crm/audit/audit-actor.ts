import type { Kysely } from "kysely";

import type { CrmDatabase } from "../../../database/database.types.js";

/** Nombre y roles quedan congelados. Un cambio posterior de nombre o de rol no reescribe esta fila. */
export interface AuditActorSnapshot {
    kind?: "service";
    publicId: string;
    name: string;
    roles: { code: string; name: string }[];
}

// Solo el objeto que salio de una captura en base queda como procedencia. Una copia o un JSON igual no esta en este mapa.
const capturedActors = new WeakMap<object, AuditActorSnapshot>();

/** Devuelve una copia. Mutar el objeto que se devolvio no cambia lo que la bitacora atribuye. */
export function getCapturedAuditActor(value: unknown): AuditActorSnapshot | undefined {
    if (value === null || typeof value !== "object") return undefined;
    const actor = capturedActors.get(value);
    return actor ? { ...actor, roles: actor.roles.map((role) => ({ ...role })) } : undefined;
}

/**
 * Lee el actor antes de mutar. `activeOnly` exige usuario activo y no borrado.
 * El mapa de confianza solo registra esa captura activa: un inactivo puede
 * leerse, pero no autoriza una bitacora comercial.
 */
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

/** Un servicio interno. El objeto que sale queda registrado; una copia o un JSON recibido no adquiere esa procedencia. No tiene roles de persona. */
export function captureIntegrationAuditActor(identity: { publicId: string; name: string }): AuditActorSnapshot {
    const snapshot: AuditActorSnapshot = { ...identity, kind: "service", roles: [] };
    capturedActors.set(snapshot, { ...snapshot, roles: [] });
    return snapshot;
}
