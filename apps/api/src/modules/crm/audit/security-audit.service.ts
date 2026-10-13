import { Inject, Injectable } from "@nestjs/common";
import type { Kysely } from "kysely";
import { ulid } from "ulid";

import { DatabaseService } from "../../../database/database.service.js";
import type { CrmDatabase } from "../../../database/database.types.js";

// ============================================================================
// Auditoria de seguridad: registra eventos append-only del runtime de identidad.
//
// SRP: los casos de uso deciden que paso; este servicio solo normaliza el
// payload y lo persiste en la tabla canonica de auditoria.
// ============================================================================

/**
 * Identidad canonica y roles activos capturados antes de la accion.
 * No contiene credenciales ni infiere un unico rol cuando hay varios asignados.
 */
export interface AuditActorSnapshot {
    publicId: string;
    name: string;
    roles: { code: string; name: string }[];
}

/** Event context supplied only by trusted server-side business operations. */
export interface SecurityAuditEvent {
    eventType: string;
    summary: string;
    actorUserId?: number | null;
    actorSnapshot?: AuditActorSnapshot | undefined;
    targetUserId?: number | null;
    reason?: string | null;
    ipAddress?: string | null;
    userAgent?: string | null;
    metadata?: Record<string, unknown> | null;
}

type AuditWriteExecutor = Pick<Kysely<CrmDatabase>, "insertInto" | "selectFrom">;

/** Longitud maxima real de `audit_security_event.ip_address_security_event`. */
export const SECURITY_AUDIT_IP_ADDRESS_MAX_LENGTH = 80;

/** Longitud maxima real de `audit_security_event.user_agent_security_event`. */
export const SECURITY_AUDIT_USER_AGENT_MAX_LENGTH = 500;

/**
 * Normaliza metadata opcional para columnas JSON de MySQL.
 *
 * mysql2/Kysely reciben JSON como string parametrizado. Centralizarlo aqui
 * evita raw SQL en callers y mantiene una sola forma de serializar auditoria.
 */
const serializeAuditMetadata = (metadata: SecurityAuditEvent["metadata"]): string | null => {
    if (!metadata) {
        return null;
    }

    return JSON.stringify(metadata);
};

/**
 * Ajusta texto opcional al largo fisico de la columna.
 *
 * La auditoria no debe fallar por un User-Agent largo o por una IP/proxy chain
 * extensa. Se conserva el prefijo recibido, que es suficiente para rastreo, y
 * se evita que MySQL rechace toda la transaccion sensible.
 */
const truncateNullableAuditText = (value: string | null | undefined, maxLength: number): string | null => {
    if (!value) {
        return null;
    }

    return value.slice(0, maxLength);
};

/**
 * Escribe eventos de auditoria append-only.
 *
 * Este servicio es deliberadamente pequeño: los callers deciden la accion de
 * negocio y esta frontera persiste una fila normalizada con columnas canonicas
 * del CRM.
 */
@Injectable()
export class SecurityAuditService {
    /**
     * Inyecta el acceso a datos aprobado para persistir auditoria.
     */
    constructor(@Inject(DatabaseService) private readonly database: DatabaseService) {}

    /** Capture before changing access, so a self-edit cannot rewrite its own authorizing roles. */
    async captureActor(actorUserId: number, executor: Pick<Kysely<CrmDatabase>, "selectFrom"> = this.database.db): Promise<AuditActorSnapshot | undefined> {
        const actor = await executor.selectFrom("sec_user").select(["public_id_user as publicId", "display_name_user as name"]).where("id_user", "=", actorUserId).executeTakeFirst();
        if (!actor) return undefined;
        const roles = await executor.selectFrom("sec_user_role as assignment").innerJoin("sec_role as role", "role.id_role", "assignment.role_id_user_role").select(["role.code_role as code", "role.name_role as name"]).where("assignment.user_id_user_role", "=", actorUserId).where("assignment.status_user_role", "=", "active").where("assignment.revoked_at_user_role", "is", null).where("role.status_role", "=", "active").where("role.deleted_at_role", "is", null).orderBy("role.code_role").execute();
        return { publicId: actor.publicId, name: actor.name, roles };
    }

    /**
     * Persiste un evento de auditoria.
     *
     * Las columnas JSON de MySQL reciben un string JSON via mysql2/Kysely. Usar
     * `JSON.stringify` aqui evita casts raw SQL en callers y mantiene el write
     * path de auditoria parametrizado.
     */
    async record(event: SecurityAuditEvent, executor: AuditWriteExecutor = this.database.db): Promise<void> {
        // Preserve attribution after an actor is renamed, without copying authentication data.
        const actor = event.actorSnapshot ?? (event.actorUserId ? await this.captureActor(event.actorUserId, executor) : undefined);
        const metadata = actor ? { ...event.metadata, actor: { publicId: actor.publicId, name: actor.name, roles: actor.roles.map(({ code, name }) => ({ code, name })) } } : event.metadata;
        await executor
            .insertInto("audit_security_event")
            .values({
                public_id_security_event: ulid(),
                event_type_security_event: event.eventType,
                actor_user_id_security_event: event.actorUserId ?? null,
                target_user_id_security_event: event.targetUserId ?? null,
                summary_security_event: event.summary,
                reason_security_event: event.reason ?? null,
                ip_address_security_event: truncateNullableAuditText(event.ipAddress, SECURITY_AUDIT_IP_ADDRESS_MAX_LENGTH),
                user_agent_security_event: truncateNullableAuditText(event.userAgent, SECURITY_AUDIT_USER_AGENT_MAX_LENGTH),
                metadata_security_event: serializeAuditMetadata(metadata),
                created_at_security_event: new Date(),
            })
            .execute();
    }
}
