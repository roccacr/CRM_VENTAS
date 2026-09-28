import { Inject, Injectable } from "@nestjs/common";

import { DatabaseService } from "../../../database/database.service.js";
import { LOGOUT_REQUESTED_EVENT, SESSION_REVOKED_EVENT } from "../audit/security-audit.events.js";
import { SecurityAuditService } from "../audit/security-audit.service.js";
import type { CreateIdentitySessionInput, RevokeOwnSessionResult, RotateRefreshSessionInput, RotateRefreshSessionResult } from "./identity.repository.js";
import type { IdentityActiveSession } from "./identity.types.js";
import { ACTIVE_STATUS, earliestDate, EXPIRED_STATUS, hasUpdatedRows, IDENTITY_RUNTIME_AUDIT_SOURCE, type IdentityTransaction, REUSED_STATUS, REVOKED_STATUS, ROTATED_STATUS } from "./identity-repository.shared.js";

type RefreshRotationFailureStatus = "expired" | "invalid" | "permission_stale" | "reused";

type RefreshRotationRow = {
    authIdentityId: number;
    providerCode: string;
    identityStatus: string;
    refreshExpiresAt: Date | string;
    refreshFamilyId: string;
    refreshStatus: string;
    refreshTokenId: number;
    sessionExpiresAt: Date | string;
    sessionId: number;
    sessionPermissionVersion: number;
    sessionPublicId: string;
    sessionStatus: string;
    userId: number;
    userPermissionVersion: number;
    userStatus: string;
};

/**
 * Persistencia de sesiones BFF, refresh tokens y revocaciones.
 *
 * Esta clase encapsula el bloque mas sensible del repositorio: rotacion de
 * refresh, reuso, logout idempotente y revocacion de sesiones. Mantenerlo
 * separado evita que reglas de Microsoft o login local mezclen escrituras de
 * seguridad de sesion.
 */
@Injectable()
export class IdentitySessionRepository {
    /**
     * Inyecta base de datos y auditoria atomica de seguridad.
     */
    constructor(
        @Inject(DatabaseService) private readonly database: DatabaseService,
        @Inject(SecurityAuditService) private readonly audit: SecurityAuditService,
    ) {}

    /**
     * Crea sesion backend y refresh token inicial en una sola transaccion.
     */
    async createSession(input: CreateIdentitySessionInput): Promise<void> {
        await this.database.db.transaction().execute(async (transaction) => {
            const now = new Date();

            await transaction
                .insertInto("sec_auth_session")
                .values({
                    auth_identity_id_auth_session: input.authIdentityId,
                    created_at_auth_session: now,
                    expires_at_auth_session: input.sessionExpiresAt,
                    ip_address_auth_session: input.ipAddress ?? null,
                    permission_version_auth_session: input.permissionVersion,
                    provider_code_auth_session: input.providerCode,
                    public_id_auth_session: input.sessionPublicId,
                    status_auth_session: ACTIVE_STATUS,
                    token_hash_auth_session: input.sessionTokenHash,
                    user_agent_auth_session: input.userAgent ?? null,
                    user_id_auth_session: input.userId,
                })
                .executeTakeFirstOrThrow();

            const session = await transaction.selectFrom("sec_auth_session").select("id_auth_session").where("token_hash_auth_session", "=", input.sessionTokenHash).executeTakeFirstOrThrow();

            await transaction
                .insertInto("sec_refresh_token")
                .values({
                    auth_session_id_refresh_token: session.id_auth_session,
                    expires_at_refresh_token: input.refreshExpiresAt,
                    issued_at_refresh_token: now,
                    revoked_at_refresh_token: null,
                    revoked_reason_refresh_token: null,
                    rotated_at_refresh_token: null,
                    status_refresh_token: ACTIVE_STATUS,
                    token_family_id_refresh_token: input.refreshFamilyId,
                    token_hash_refresh_token: input.refreshTokenHash,
                })
                .executeTakeFirstOrThrow();
        });
    }

    /**
     * Rota refresh token y token de sesion en una transaccion.
     */
    async rotateRefreshSession(input: RotateRefreshSessionInput): Promise<RotateRefreshSessionResult> {
        return this.database.db.transaction().execute(async (transaction) => {
            const now = new Date();
            const refresh = await transaction
                .selectFrom("sec_refresh_token as refresh")
                .innerJoin("sec_auth_session as session", "session.id_auth_session", "refresh.auth_session_id_refresh_token")
                .innerJoin("sec_user as user", "user.id_user", "session.user_id_auth_session")
                .innerJoin("sec_auth_identity as identity", "identity.id_auth_identity", "session.auth_identity_id_auth_session")
                .select([
                    "refresh.id_refresh_token as refreshTokenId",
                    "refresh.status_refresh_token as refreshStatus",
                    "refresh.expires_at_refresh_token as refreshExpiresAt",
                    "refresh.token_family_id_refresh_token as refreshFamilyId",
                    "session.id_auth_session as sessionId",
                    "session.status_auth_session as sessionStatus",
                    "session.expires_at_auth_session as sessionExpiresAt",
                    "session.auth_identity_id_auth_session as authIdentityId",
                    "session.provider_code_auth_session as providerCode",
                    "session.public_id_auth_session as sessionPublicId",
                    "session.permission_version_auth_session as sessionPermissionVersion",
                    "user.id_user as userId",
                    "user.permission_version_user as userPermissionVersion",
                    "user.status_user as userStatus",
                    "identity.status_auth_identity as identityStatus",
                ])
                .where("refresh.token_hash_refresh_token", "=", input.refreshTokenHash)
                .executeTakeFirst();

            if (!refresh) {
                return { status: "not_found" };
            }

            const failureStatus = this.resolveRefreshRotationFailure(refresh, now);
            if (failureStatus) {
                return this.applyRefreshRotationFailure(transaction, refresh, failureStatus);
            }

            const consumeRefreshResult = await transaction.updateTable("sec_refresh_token").set({ rotated_at_refresh_token: now, status_refresh_token: ROTATED_STATUS }).where("id_refresh_token", "=", refresh.refreshTokenId).where("status_refresh_token", "=", ACTIVE_STATUS).executeTakeFirst();

            if (!hasUpdatedRows(consumeRefreshResult)) {
                return this.applyRefreshRotationFailure(transaction, refresh, "reused");
            }

            const absoluteSessionExpiresAt = new Date(refresh.sessionExpiresAt);
            const nextSessionExpiresAt = earliestDate(input.nextSessionExpiresAt, absoluteSessionExpiresAt);
            const nextRefreshExpiresAt = earliestDate(input.nextRefreshExpiresAt, absoluteSessionExpiresAt);

            await transaction.updateTable("sec_auth_session").set({ expires_at_auth_session: nextSessionExpiresAt, token_hash_auth_session: input.nextSessionTokenHash }).where("id_auth_session", "=", refresh.sessionId).where("status_auth_session", "=", ACTIVE_STATUS).executeTakeFirst();
            await transaction
                .insertInto("sec_refresh_token")
                .values({
                    auth_session_id_refresh_token: refresh.sessionId,
                    expires_at_refresh_token: nextRefreshExpiresAt,
                    issued_at_refresh_token: now,
                    revoked_at_refresh_token: null,
                    revoked_reason_refresh_token: null,
                    rotated_at_refresh_token: null,
                    status_refresh_token: ACTIVE_STATUS,
                    token_family_id_refresh_token: refresh.refreshFamilyId,
                    token_hash_refresh_token: input.nextRefreshTokenHash,
                })
                .executeTakeFirstOrThrow();

            return { authIdentityId: refresh.authIdentityId, providerCode: refresh.providerCode, sessionPublicId: refresh.sessionPublicId, status: "rotated", userId: refresh.userId };
        });
    }

    /**
     * Lista sesiones activas del usuario asociado a la sesion actual.
     */
    async listActiveSessions(currentSessionTokenHash: string): Promise<IdentityActiveSession[] | null> {
        const current = await this.database.db.selectFrom("sec_auth_session").select(["id_auth_session", "user_id_auth_session"]).where("token_hash_auth_session", "=", currentSessionTokenHash).where("status_auth_session", "=", ACTIVE_STATUS).where("expires_at_auth_session", ">", new Date()).executeTakeFirst();

        if (!current) {
            return null;
        }

        const rows = await this.database.db.selectFrom("sec_auth_session").select(["created_at_auth_session", "expires_at_auth_session", "id_auth_session", "ip_address_auth_session", "public_id_auth_session", "user_agent_auth_session"]).where("user_id_auth_session", "=", current.user_id_auth_session).where("status_auth_session", "=", ACTIVE_STATUS).where("expires_at_auth_session", ">", new Date()).orderBy("created_at_auth_session", "desc").execute();

        return rows.map((row) => ({
            createdAt: new Date(row.created_at_auth_session).toISOString(),
            expiresAt: new Date(row.expires_at_auth_session).toISOString(),
            ipAddress: row.ip_address_auth_session,
            isCurrent: row.id_auth_session === current.id_auth_session,
            publicId: row.public_id_auth_session,
            userAgent: row.user_agent_auth_session,
        }));
    }

    /**
     * Revoca una sesion activa del mismo usuario que posee la sesion actual.
     */
    async revokeOwnSessionByPublicId(currentSessionTokenHash: string, targetSessionPublicId: string, ipAddress?: string, userAgent?: string): Promise<RevokeOwnSessionResult> {
        return this.database.db.transaction().execute(async (transaction) => {
            const current = await transaction.selectFrom("sec_auth_session").select(["id_auth_session", "user_id_auth_session"]).where("token_hash_auth_session", "=", currentSessionTokenHash).where("status_auth_session", "=", ACTIVE_STATUS).where("expires_at_auth_session", ">", new Date()).executeTakeFirst();

            if (!current) {
                return { status: "not_authenticated" };
            }

            const target = await transaction.selectFrom("sec_auth_session").select(["id_auth_session", "user_id_auth_session"]).where("public_id_auth_session", "=", targetSessionPublicId).where("user_id_auth_session", "=", current.user_id_auth_session).where("status_auth_session", "=", ACTIVE_STATUS).executeTakeFirst();

            if (!target) {
                return { status: "not_found" };
            }

            await this.revokeSessionById(transaction, target.id_auth_session, current.user_id_auth_session);
            await transaction.updateTable("sec_refresh_token").set({ revoked_at_refresh_token: new Date(), revoked_reason_refresh_token: SESSION_REVOKED_EVENT.reason, status_refresh_token: REVOKED_STATUS }).where("auth_session_id_refresh_token", "=", target.id_auth_session).where("status_refresh_token", "=", ACTIVE_STATUS).executeTakeFirst();
            await this.audit.record(
                {
                    eventType: SESSION_REVOKED_EVENT.eventType,
                    actorUserId: current.user_id_auth_session,
                    targetUserId: current.user_id_auth_session,
                    summary: SESSION_REVOKED_EVENT.summary,
                    reason: SESSION_REVOKED_EVENT.reason,
                    ...(ipAddress ? { ipAddress } : {}),
                    ...(userAgent ? { userAgent } : {}),
                    metadata: {
                        revokedSessionPublicId: targetSessionPublicId,
                        source: IDENTITY_RUNTIME_AUDIT_SOURCE,
                    },
                },
                transaction,
            );

            return { status: "revoked" };
        });
    }

    /**
     * Revoca una sesion por hash del token opaco.
     */
    async revokeSessionByTokenHash(sessionTokenHash: string, ipAddress?: string, userAgent?: string): Promise<void> {
        await this.revokeSession("token_hash_auth_session", sessionTokenHash, ipAddress, userAgent);
    }

    /**
     * Revoca sesiones de una identidad externa sin cerrar otras sesiones validas del usuario.
     */
    async revokeActiveSessionsForAuthIdentity(authIdentityId: number, userId: number, reason: string, transaction: IdentityTransaction): Promise<void> {
        const sessions = await transaction.selectFrom("sec_auth_session").select("id_auth_session").where("auth_identity_id_auth_session", "=", authIdentityId).where("user_id_auth_session", "=", userId).where("status_auth_session", "=", ACTIVE_STATUS).execute();
        const sessionIds = sessions.map((session) => session.id_auth_session);

        if (sessionIds.length === 0) {
            return;
        }

        await transaction
            .updateTable("sec_auth_session")
            .set({
                revoked_at_auth_session: new Date(),
                revoked_by_user_id_auth_session: userId,
                status_auth_session: REVOKED_STATUS,
            })
            .where("id_auth_session", "in", sessionIds)
            .executeTakeFirst();

        await transaction
            .updateTable("sec_refresh_token")
            .set({
                revoked_at_refresh_token: new Date(),
                revoked_reason_refresh_token: reason,
                status_refresh_token: REVOKED_STATUS,
            })
            .where("auth_session_id_refresh_token", "in", sessionIds)
            .where("status_refresh_token", "=", ACTIVE_STATUS)
            .executeTakeFirst();
    }

    /**
     * Decide si un refresh puede rotar sin mezclar la decision con escrituras.
     */
    private resolveRefreshRotationFailure(refresh: RefreshRotationRow, now: Date): RefreshRotationFailureStatus | null {
        if (refresh.refreshStatus !== ACTIVE_STATUS) {
            return "reused";
        }

        if (new Date(refresh.refreshExpiresAt) <= now) {
            return "expired";
        }

        if (refresh.sessionStatus !== ACTIVE_STATUS || new Date(refresh.sessionExpiresAt) <= now || refresh.userStatus !== ACTIVE_STATUS || refresh.identityStatus !== ACTIVE_STATUS) {
            return "invalid";
        }

        if (refresh.sessionPermissionVersion !== refresh.userPermissionVersion) {
            return "permission_stale";
        }

        return null;
    }

    /**
     * Aplica la reaccion transaccional para cada fallo de rotacion.
     */
    private async applyRefreshRotationFailure(transaction: IdentityTransaction, refresh: RefreshRotationRow, status: RefreshRotationFailureStatus): Promise<RotateRefreshSessionResult> {
        if (status === "reused") {
            await this.revokeRefreshFamily(transaction, refresh.refreshFamilyId, REUSED_STATUS);
            await this.revokeAllActiveSessionsForUser(transaction, refresh.userId, REUSED_STATUS);
            return { sessionPublicId: refresh.sessionPublicId, status, userId: refresh.userId };
        }

        if (status === "expired") {
            await this.expireRefreshToken(transaction, refresh.refreshTokenId);
            return { status };
        }

        if (status === "invalid") {
            await this.revokeRefreshFamily(transaction, refresh.refreshFamilyId, REVOKED_STATUS);
            await this.revokeSessionById(transaction, refresh.sessionId, refresh.userId);
            return { sessionPublicId: refresh.sessionPublicId, status, userId: refresh.userId };
        }

        return { sessionPublicId: refresh.sessionPublicId, status, userId: refresh.userId };
    }

    /**
     * Revoca sesion activa y sus refresh tokens activos.
     */
    private async revokeSession(column: "public_id_auth_session" | "token_hash_auth_session", value: string, ipAddress?: string, userAgent?: string): Promise<void> {
        await this.database.db.transaction().execute(async (transaction) => {
            const session = await transaction.selectFrom("sec_auth_session").select(["id_auth_session", "user_id_auth_session"]).where(column, "=", value).where("status_auth_session", "=", ACTIVE_STATUS).executeTakeFirst();

            if (!session) {
                return;
            }

            const updateResult = await transaction
                .updateTable("sec_auth_session")
                .set({
                    status_auth_session: REVOKED_STATUS,
                    revoked_at_auth_session: new Date(),
                    revoked_by_user_id_auth_session: session.user_id_auth_session,
                })
                .where("id_auth_session", "=", session.id_auth_session)
                .where("status_auth_session", "=", ACTIVE_STATUS)
                .executeTakeFirst();

            if (!hasUpdatedRows(updateResult)) {
                return;
            }

            await transaction.updateTable("sec_refresh_token").set({ revoked_at_refresh_token: new Date(), revoked_reason_refresh_token: LOGOUT_REQUESTED_EVENT.reason, status_refresh_token: REVOKED_STATUS }).where("auth_session_id_refresh_token", "=", session.id_auth_session).where("status_refresh_token", "=", ACTIVE_STATUS).executeTakeFirst();

            await this.audit.record(
                {
                    eventType: LOGOUT_REQUESTED_EVENT.eventType,
                    actorUserId: session.user_id_auth_session,
                    targetUserId: session.user_id_auth_session,
                    summary: LOGOUT_REQUESTED_EVENT.summary,
                    reason: LOGOUT_REQUESTED_EVENT.reason,
                    ...(ipAddress ? { ipAddress } : {}),
                    ...(userAgent ? { userAgent } : {}),
                    metadata: {
                        source: IDENTITY_RUNTIME_AUDIT_SOURCE,
                    },
                },
                transaction,
            );
        });
    }

    /**
     * Marca un refresh token como expirado.
     */
    private async expireRefreshToken(transaction: IdentityTransaction, refreshTokenId: number): Promise<void> {
        await transaction.updateTable("sec_refresh_token").set({ revoked_reason_refresh_token: EXPIRED_STATUS, status_refresh_token: EXPIRED_STATUS }).where("id_refresh_token", "=", refreshTokenId).executeTakeFirst();
    }

    /**
     * Revoca toda una familia de refresh tokens.
     */
    private async revokeRefreshFamily(transaction: IdentityTransaction, refreshFamilyId: string, reason: string): Promise<void> {
        await transaction.updateTable("sec_refresh_token").set({ revoked_at_refresh_token: new Date(), revoked_reason_refresh_token: reason, status_refresh_token: reason }).where("token_family_id_refresh_token", "=", refreshFamilyId).where("status_refresh_token", "=", ACTIVE_STATUS).executeTakeFirst();
    }

    /**
     * Revoca una sesion por id interno dentro de transacciones de seguridad.
     */
    private async revokeSessionById(transaction: IdentityTransaction, sessionId: number, revokedByUserId?: number): Promise<void> {
        await transaction
            .updateTable("sec_auth_session")
            .set({
                revoked_at_auth_session: new Date(),
                revoked_by_user_id_auth_session: revokedByUserId ?? null,
                status_auth_session: REVOKED_STATUS,
            })
            .where("id_auth_session", "=", sessionId)
            .where("status_auth_session", "=", ACTIVE_STATUS)
            .executeTakeFirst();
    }

    /**
     * Revoca todas las sesiones activas de un usuario ante senales de robo.
     */
    private async revokeAllActiveSessionsForUser(transaction: IdentityTransaction, userId: number, reason: string): Promise<void> {
        const sessions = await transaction.selectFrom("sec_auth_session").select("id_auth_session").where("user_id_auth_session", "=", userId).where("status_auth_session", "=", ACTIVE_STATUS).execute();
        const sessionIds = sessions.map((session) => session.id_auth_session);

        if (sessionIds.length === 0) {
            return;
        }

        await transaction
            .updateTable("sec_auth_session")
            .set({
                revoked_at_auth_session: new Date(),
                revoked_by_user_id_auth_session: userId,
                status_auth_session: REVOKED_STATUS,
            })
            .where("id_auth_session", "in", sessionIds)
            .executeTakeFirst();

        await transaction
            .updateTable("sec_refresh_token")
            .set({
                revoked_at_refresh_token: new Date(),
                revoked_reason_refresh_token: reason,
                status_refresh_token: reason,
            })
            .where("auth_session_id_refresh_token", "in", sessionIds)
            .where("status_refresh_token", "=", ACTIVE_STATUS)
            .executeTakeFirst();
    }
}
