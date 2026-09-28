import { Inject, Injectable } from "@nestjs/common";
import { sql } from "kysely";

import { DatabaseService } from "../../../database/database.service.js";
import { LOCAL_RESET_COMPLETED_EVENT } from "../audit/security-audit.events.js";
import { SecurityAuditService } from "../audit/security-audit.service.js";
import type { CompleteLocalPasswordResetInput, CompleteLocalPasswordResetResult, CreateLocalPasswordResetTokenInput, FailedLocalLoginRecord, LocalLoginIdentity, ResettableLocalIdentity } from "./identity.repository.js";
import { ACTIVE_STATUS, EXPIRED_STATUS, hasUpdatedRows, IDENTITY_RUNTIME_AUDIT_SOURCE, LOCAL_PROVIDER_AVAILABLE_STATUSES, LOCAL_PROVIDER_CODE, PENDING_LOCAL_STATUS, REVOKED_STATUS, USED_STATUS } from "./identity-repository.shared.js";

type LocalPasswordResetRow = {
    authIdentityId: number;
    identityStatus: string;
    resetExpiresAt: Date | string;
    resetStatus: string;
    resetTokenId: number;
    userId: number;
    userStatus: string;
};

/**
 * Persistencia exclusiva de credenciales locales.
 *
 * Mantiene en un solo borde las reglas sensibles de password local: busqueda
 * por correo normalizado, lockout atomico y consumo transaccional de tokens de
 * activacion/reset. No maneja sesiones ni permisos.
 */
@Injectable()
export class IdentityLocalRepository {
    /**
     * Inyecta base de datos y auditoria para operaciones locales transaccionales.
     */
    constructor(
        @Inject(DatabaseService) private readonly database: DatabaseService,
        @Inject(SecurityAuditService) private readonly audit: SecurityAuditService,
    ) {}

    /**
     * Busca una identidad local activa por correo normalizado para login.
     */
    async findActiveLocalIdentity(normalizedEmail: string): Promise<LocalLoginIdentity | null> {
        const row = await this.database.db
            .selectFrom("sec_auth_identity as identity")
            .innerJoin("sec_user as user", "user.id_user", "identity.user_id_auth_identity")
            .select(["identity.failed_login_count_auth_identity as failedLoginCount", "identity.id_auth_identity as authIdentityId", "identity.locked_until_auth_identity as lockedUntil", "identity.password_hash_auth_identity as passwordHash", "user.id_user as userId", "user.permission_version_user as permissionVersion"])
            .where("identity.provider_code_auth_identity", "=", LOCAL_PROVIDER_CODE)
            .where("identity.normalized_email_auth_identity", "=", normalizedEmail)
            .where("identity.status_auth_identity", "=", ACTIVE_STATUS)
            .where("identity.deleted_at_auth_identity", "is", null)
            .where("identity.password_hash_auth_identity", "is not", null)
            .where("user.status_user", "=", ACTIVE_STATUS)
            .where("user.deleted_at_user", "is", null)
            .executeTakeFirst();

        if (!row?.passwordHash) {
            return null;
        }

        return {
            authIdentityId: row.authIdentityId,
            failedLoginCount: row.failedLoginCount,
            lockedUntil: row.lockedUntil ? new Date(row.lockedUntil) : null,
            passwordHash: row.passwordHash,
            permissionVersion: row.permissionVersion,
            userId: row.userId,
        };
    }

    /**
     * Busca una identidad local activa o pendiente para emitir reset neutral.
     */
    async findResettableLocalIdentity(normalizedEmail: string): Promise<ResettableLocalIdentity | null> {
        const row = await this.database.db
            .selectFrom("sec_auth_identity as identity")
            .innerJoin("sec_user as user", "user.id_user", "identity.user_id_auth_identity")
            .select(["identity.id_auth_identity as authIdentityId", "user.id_user as userId"])
            .where("identity.provider_code_auth_identity", "=", LOCAL_PROVIDER_CODE)
            .where("identity.normalized_email_auth_identity", "=", normalizedEmail)
            .where("identity.status_auth_identity", "in", [ACTIVE_STATUS, PENDING_LOCAL_STATUS])
            .where("identity.deleted_at_auth_identity", "is", null)
            .where("user.status_user", "=", ACTIVE_STATUS)
            .where("user.deleted_at_user", "is", null)
            .executeTakeFirst();

        return row ?? null;
    }

    /**
     * Incrementa contador persistente de intentos fallidos de forma atomica.
     *
     * El conteo no se calcula en memoria porque varios intentos paralelos
     * podrian pisarse. MySQL incrementa con `columna + 1` y decide el lockout
     * en el mismo UPDATE; luego se lee el estado resultante para auditarlo.
     */
    async recordFailedLocalLogin(authIdentityId: number, lockoutMaxFailures: number, lockUntil: Date): Promise<FailedLocalLoginRecord> {
        const updatedIdentity = await this.database.db.transaction().execute(async (transaction) => {
            const now = new Date();

            await transaction
                .updateTable("sec_auth_identity")
                .set({
                    failed_login_count_auth_identity: sql<number>`failed_login_count_auth_identity + 1`,
                    last_failed_login_at_auth_identity: now,
                    locked_until_auth_identity: sql<Date | null>`CASE WHEN failed_login_count_auth_identity + 1 >= ${lockoutMaxFailures} THEN ${lockUntil} ELSE locked_until_auth_identity END`,
                    updated_at_auth_identity: now,
                })
                .where("id_auth_identity", "=", authIdentityId)
                .executeTakeFirst();

            return transaction.selectFrom("sec_auth_identity").select(["failed_login_count_auth_identity as failedLoginCount", "locked_until_auth_identity as lockedUntil"]).where("id_auth_identity", "=", authIdentityId).executeTakeFirstOrThrow();
        });

        return {
            failedLoginCount: updatedIdentity.failedLoginCount,
            lockedUntil: updatedIdentity.lockedUntil ? new Date(updatedIdentity.lockedUntil) : null,
        };
    }

    /**
     * Limpia lockout y contador de intentos despues de autenticacion correcta.
     */
    async recordSuccessfulLocalLogin(authIdentityId: number, userId: number): Promise<void> {
        const now = new Date();

        await this.database.db.transaction().execute(async (transaction) => {
            await transaction
                .updateTable("sec_auth_identity")
                .set({
                    failed_login_count_auth_identity: 0,
                    last_failed_login_at_auth_identity: null,
                    last_used_at_auth_identity: now,
                    locked_until_auth_identity: null,
                    updated_at_auth_identity: now,
                })
                .where("id_auth_identity", "=", authIdentityId)
                .executeTakeFirst();

            await transaction.updateTable("sec_user").set({ last_login_at_user: now, updated_at_user: now }).where("id_user", "=", userId).executeTakeFirst();
        });
    }

    /**
     * Emite un token opaco de activacion/reset guardando solo su HMAC.
     *
     * Cualquier token anterior activo de la misma identidad se revoca antes de
     * insertar el nuevo para que el flujo tenga una sola credencial viva.
     */
    async createLocalPasswordResetToken(input: CreateLocalPasswordResetTokenInput): Promise<void> {
        await this.database.db.transaction().execute(async (transaction) => {
            const now = new Date();

            await transaction
                .updateTable("sec_local_password_reset_token")
                .set({
                    revoked_at_local_password_reset_token: now,
                    status_local_password_reset_token: REVOKED_STATUS,
                })
                .where("auth_identity_id_local_password_reset_token", "=", input.authIdentityId)
                .where("status_local_password_reset_token", "=", ACTIVE_STATUS)
                .executeTakeFirst();

            await transaction
                .insertInto("sec_local_password_reset_token")
                .values({
                    auth_identity_id_local_password_reset_token: input.authIdentityId,
                    expires_at_local_password_reset_token: input.expiresAt,
                    ip_address_local_password_reset_token: input.ipAddress ?? null,
                    requested_at_local_password_reset_token: now,
                    revoked_at_local_password_reset_token: null,
                    status_local_password_reset_token: ACTIVE_STATUS,
                    token_hash_local_password_reset_token: input.tokenHash,
                    used_at_local_password_reset_token: null,
                    user_agent_local_password_reset_token: input.userAgent ?? null,
                })
                .executeTakeFirstOrThrow();
        });
    }

    /**
     * Verifica si un token de reset puede consumirse antes de gastar Argon2id.
     *
     * Esta lectura no reemplaza la validacion transaccional final en
     * `completeLocalPasswordReset`; solo evita que un token falso dispare hashing
     * caro en un endpoint publico.
     */
    async hasUsableLocalPasswordResetToken(tokenHash: string): Promise<boolean> {
        const now = new Date();
        const row = await this.database.db
            .selectFrom("sec_local_password_reset_token as reset")
            .innerJoin("sec_auth_identity as identity", "identity.id_auth_identity", "reset.auth_identity_id_local_password_reset_token")
            .innerJoin("sec_user as user", "user.id_user", "identity.user_id_auth_identity")
            .select("reset.id_local_password_reset_token")
            .where("reset.token_hash_local_password_reset_token", "=", tokenHash)
            .where("reset.status_local_password_reset_token", "=", ACTIVE_STATUS)
            .where("reset.expires_at_local_password_reset_token", ">", now)
            .where("identity.status_auth_identity", "in", [ACTIVE_STATUS, PENDING_LOCAL_STATUS])
            .where("identity.deleted_at_auth_identity", "is", null)
            .where("user.status_user", "=", ACTIVE_STATUS)
            .where("user.deleted_at_user", "is", null)
            .executeTakeFirst();

        return Boolean(row);
    }

    /**
     * Consume un token de activacion/reset y actualiza la clave local con Argon2id.
     */
    async completeLocalPasswordReset(input: CompleteLocalPasswordResetInput): Promise<CompleteLocalPasswordResetResult> {
        return this.database.db.transaction().execute(async (transaction) => {
            const now = new Date();
            const reset = await transaction
                .selectFrom("sec_local_password_reset_token as reset")
                .innerJoin("sec_auth_identity as identity", "identity.id_auth_identity", "reset.auth_identity_id_local_password_reset_token")
                .innerJoin("sec_user as user", "user.id_user", "identity.user_id_auth_identity")
                .select(["identity.id_auth_identity as authIdentityId", "identity.status_auth_identity as identityStatus", "reset.expires_at_local_password_reset_token as resetExpiresAt", "reset.id_local_password_reset_token as resetTokenId", "reset.status_local_password_reset_token as resetStatus", "user.id_user as userId", "user.status_user as userStatus"])
                .where("reset.token_hash_local_password_reset_token", "=", input.tokenHash)
                .executeTakeFirst();

            if (!reset) {
                return { status: "not_found" };
            }

            const failureStatus = this.resolveLocalPasswordResetFailure(reset, now);
            if (failureStatus === "expired") {
                await transaction.updateTable("sec_local_password_reset_token").set({ status_local_password_reset_token: EXPIRED_STATUS }).where("id_local_password_reset_token", "=", reset.resetTokenId).executeTakeFirst();
                return { status: "expired" };
            }

            if (failureStatus) {
                return { status: failureStatus };
            }

            const consumeTokenResult = await transaction
                .updateTable("sec_local_password_reset_token")
                .set({
                    status_local_password_reset_token: USED_STATUS,
                    used_at_local_password_reset_token: now,
                })
                .where("id_local_password_reset_token", "=", reset.resetTokenId)
                .where("status_local_password_reset_token", "=", ACTIVE_STATUS)
                .executeTakeFirst();

            if (!hasUpdatedRows(consumeTokenResult)) {
                return { status: "invalid" };
            }

            await transaction
                .updateTable("sec_auth_identity")
                .set({
                    failed_login_count_auth_identity: 0,
                    last_failed_login_at_auth_identity: null,
                    locked_until_auth_identity: null,
                    password_hash_auth_identity: input.passwordHash,
                    status_auth_identity: ACTIVE_STATUS,
                    updated_at_auth_identity: now,
                })
                .where("id_auth_identity", "=", reset.authIdentityId)
                .executeTakeFirst();

            await this.audit.record(
                {
                    eventType: LOCAL_RESET_COMPLETED_EVENT.eventType,
                    actorUserId: reset.userId,
                    targetUserId: reset.userId,
                    summary: LOCAL_RESET_COMPLETED_EVENT.summary,
                    reason: LOCAL_RESET_COMPLETED_EVENT.reason,
                    ...(input.ipAddress ? { ipAddress: input.ipAddress } : {}),
                    ...(input.userAgent ? { userAgent: input.userAgent } : {}),
                    metadata: {
                        source: IDENTITY_RUNTIME_AUDIT_SOURCE,
                    },
                },
                transaction,
            );

            return { status: "completed", userId: reset.userId };
        });
    }

    /**
     * Decide si un token de reset puede consumirse sin mezclar la decision con escrituras.
     */
    private resolveLocalPasswordResetFailure(reset: LocalPasswordResetRow, now: Date): "expired" | "invalid" | null {
        if (reset.resetStatus !== ACTIVE_STATUS || !LOCAL_PROVIDER_AVAILABLE_STATUSES.has(reset.identityStatus) || reset.userStatus !== ACTIVE_STATUS) {
            return "invalid";
        }

        if (new Date(reset.resetExpiresAt) <= now) {
            return "expired";
        }

        return null;
    }
}
