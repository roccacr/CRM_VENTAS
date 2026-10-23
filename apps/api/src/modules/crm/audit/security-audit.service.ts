import { BadRequestException, ForbiddenException, Inject, Injectable } from "@nestjs/common";
import type { Kysely, Transaction } from "kysely";
import { ulid } from "ulid";

import { DatabaseService } from "../../../database/database.service.js";
import type { CrmDatabase } from "../../../database/database.types.js";
import { type AuditActorSnapshot, getCapturedAuditActor, readAuditActor } from "./audit-actor.js";
import { RecordAuditService } from "./record-audit.service.js";
import { appendSecurityBusinessChange } from "./record-audit-bridge.js";

/** Re-exported for callers of the audit service. */
export type { AuditActorSnapshot } from "./audit-actor.js";

// ============================================================================
// Auditoria de seguridad: registra eventos append-only del runtime de identidad.
//
// SRP: los casos de uso deciden que paso; este servicio solo normaliza el
// payload y lo persiste en la tabla canonica de auditoria.
// ============================================================================

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

/** Handle or transaction; `isTransaction` lets commercial audit insist on the business transaction. */
type AuditWriteExecutor = Pick<Kysely<CrmDatabase>, "insertInto" | "selectFrom"> & { readonly isTransaction?: boolean };

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

/** Column values of a security event row. */
const securityEventValues = (event: SecurityAuditEvent, publicId: string, metadata: SecurityAuditEvent["metadata"]) => ({
    public_id_security_event: publicId,
    event_type_security_event: event.eventType,
    actor_user_id_security_event: event.actorUserId ?? null,
    target_user_id_security_event: event.targetUserId ?? null,
    summary_security_event: event.summary,
    reason_security_event: event.reason ?? null,
    ip_address_security_event: truncateNullableAuditText(event.ipAddress, SECURITY_AUDIT_IP_ADDRESS_MAX_LENGTH),
    user_agent_security_event: truncateNullableAuditText(event.userAgent, SECURITY_AUDIT_USER_AGENT_MAX_LENGTH),
    metadata_security_event: serializeAuditMetadata(metadata),
    created_at_security_event: new Date(),
});

/** Adds the captured actor snapshot to the event metadata. */
const metadataWithActor = (event: SecurityAuditEvent, actor: AuditActorSnapshot | undefined): SecurityAuditEvent["metadata"] => (actor ? { ...event.metadata, actor: { publicId: actor.publicId, name: actor.name, roles: actor.roles.map(({ code, name }) => ({ code, name })) } } : event.metadata);

/** Commercial audit needs the business transaction and an actor captured by the server before mutation. */
function commercialActor(executor: AuditWriteExecutor, actor: AuditActorSnapshot | undefined, captured: AuditActorSnapshot | undefined): AuditActorSnapshot {
    if (!executor.isTransaction) throw new BadRequestException("Commercial audit requires the business transaction");
    if (!actor) throw new BadRequestException("Commercial audit requires a captured actor");
    if (!captured) throw new ForbiddenException("Commercial audit requires an actor captured by the server before mutation");
    return actor;
}

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
    constructor(
        @Inject(DatabaseService) private readonly database: DatabaseService,
        @Inject(RecordAuditService) private readonly records: RecordAuditService = new RecordAuditService(database),
    ) {}

    /** Capture before changing access, so a self-edit cannot rewrite its own authorizing roles. */
    async captureActor(actorUserId: number, executor: Pick<Kysely<CrmDatabase>, "selectFrom"> = this.database.db): Promise<AuditActorSnapshot | undefined> {
        return readAuditActor(executor, actorUserId);
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
        const actor = await this.resolveActor(event, executor);
        const captured = this.records.enabled ? getCapturedAuditActor(actor) : undefined;
        const publicId = ulid();
        if (this.records.enabled && event.metadata?.changeSet !== undefined) {
            const verified = commercialActor(executor, actor, captured);
            await appendSecurityBusinessChange(this.records, executor as Transaction<CrmDatabase>, { event, actor: verified, operationId: publicId });
        }
        await executor
            .insertInto("audit_security_event")
            .values(securityEventValues(event, publicId, metadataWithActor(event, captured ?? actor)))
            .execute();
    }

    private async resolveActor(event: SecurityAuditEvent, executor: AuditWriteExecutor): Promise<AuditActorSnapshot | undefined> {
        if (event.actorSnapshot) return event.actorSnapshot;
        return event.actorUserId ? this.captureActor(event.actorUserId, executor) : undefined;
    }
}
