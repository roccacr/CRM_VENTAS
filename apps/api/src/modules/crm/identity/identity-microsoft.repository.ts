import { createHash } from "node:crypto";

import { Inject, Injectable } from "@nestjs/common";

import { normalizeCaseInsensitiveIdentifier } from "../../../common/security/identifier-normalization.js";
import type { EncryptedMicrosoftCache } from "../../../common/security/microsoft-msal-cache-crypto.service.js";
import { DatabaseService } from "../../../database/database.service.js";
import type { MicrosoftAccountCache, MicrosoftIdentityInput, MicrosoftLoginIdentity, ProfileImageRecord } from "./identity.repository.js";
import { MICROSOFT_PROVIDER_CODE } from "./identity-microsoft.constants.js";
import { ACTIVE_STATUS, type IdentityTransaction } from "./identity-repository.shared.js";
import { IdentitySessionRepository } from "./identity-session.repository.js";

/**
 * Persistencia exclusiva de identidad Microsoft 365.
 *
 * Guarda solo metadata segura y cache MSAL cifrada en servidor. La foto de
 * perfil se sirve despues desde CRM para no depender de URLs ni tokens de Graph
 * en el frontend.
 */
@Injectable()
export class IdentityMicrosoftRepository {
    /**
     * Inyecta persistencia CRM y gestor de sesiones para revocaciones Microsoft.
     */
    constructor(
        @Inject(DatabaseService) private readonly database: DatabaseService,
        @Inject(IdentitySessionRepository) private readonly sessions: IdentitySessionRepository,
    ) {}

    /**
     * Busca una identidad Microsoft pre-provisionada.
     *
     * El callback no crea usuarios automaticamente: Microsoft autentica, pero
     * CRM decide si esa persona existe y esta activa.
     */
    async findActiveMicrosoftIdentity(input: { normalizedEmail: string; subject: string }): Promise<MicrosoftLoginIdentity | null> {
        const row = await this.database.db
            .selectFrom("sec_auth_identity as identity")
            .innerJoin("sec_user as user", "user.id_user", "identity.user_id_auth_identity")
            .select(["identity.id_auth_identity as authIdentityId", "user.id_user as userId", "user.permission_version_user as permissionVersion"])
            .where("identity.provider_code_auth_identity", "=", MICROSOFT_PROVIDER_CODE)
            .where("identity.provider_subject_auth_identity", "=", input.subject)
            .where("identity.status_auth_identity", "=", ACTIVE_STATUS)
            .where("identity.deleted_at_auth_identity", "is", null)
            .where("user.status_user", "=", ACTIVE_STATUS)
            .where("user.deleted_at_user", "is", null)
            .executeTakeFirst();

        return row ?? null;
    }

    /**
     * Persiste metadata Microsoft y cache MSAL cifrada. Nunca recibe tokens en claro.
     */
    async saveMicrosoftAccount(input: MicrosoftIdentityInput & MicrosoftLoginIdentity): Promise<void> {
        await this.database.db.transaction().execute(async (transaction) => {
            const now = new Date();

            await transaction
                .updateTable("sec_auth_identity")
                .set({
                    email_auth_identity: input.email,
                    last_used_at_auth_identity: now,
                    normalized_email_auth_identity: normalizeCaseInsensitiveIdentifier(input.email),
                    provider_subject_auth_identity: input.subject,
                    updated_at_auth_identity: now,
                })
                .where("id_auth_identity", "=", input.authIdentityId)
                .executeTakeFirst();

            await transaction
                .insertInto("sec_microsoft_account")
                .values({
                    auth_identity_id_microsoft_account: input.authIdentityId,
                    cache_ciphertext_microsoft_account: input.cache.ciphertext,
                    cache_iv_microsoft_account: input.cache.iv,
                    cache_key_version_microsoft_account: input.cache.keyVersion,
                    cache_synced_at_microsoft_account: now,
                    cache_tag_microsoft_account: input.cache.tag,
                    created_at_microsoft_account: now,
                    graph_synced_at_microsoft_account: input.graphSyncedAt,
                    home_account_id_microsoft_account: input.homeAccountId,
                    interaction_required_at_microsoft_account: null,
                    last_silent_token_at_microsoft_account: now,
                    oid_microsoft_account: input.oid,
                    status_microsoft_account: ACTIVE_STATUS,
                    subject_microsoft_account: input.subject,
                    tenant_id_microsoft_account: input.tenantId,
                    updated_at_microsoft_account: now,
                })
                .onDuplicateKeyUpdate({
                    cache_ciphertext_microsoft_account: input.cache.ciphertext,
                    cache_iv_microsoft_account: input.cache.iv,
                    cache_key_version_microsoft_account: input.cache.keyVersion,
                    cache_synced_at_microsoft_account: now,
                    cache_tag_microsoft_account: input.cache.tag,
                    graph_synced_at_microsoft_account: input.graphSyncedAt,
                    home_account_id_microsoft_account: input.homeAccountId,
                    interaction_required_at_microsoft_account: null,
                    last_silent_token_at_microsoft_account: now,
                    oid_microsoft_account: input.oid,
                    status_microsoft_account: ACTIVE_STATUS,
                    subject_microsoft_account: input.subject,
                    tenant_id_microsoft_account: input.tenantId,
                    updated_at_microsoft_account: now,
                })
                .executeTakeFirstOrThrow();

            if (input.profileImage) {
                await this.upsertProfileImage(transaction, input.userId, input.profileImage);
            }
        });
    }

    /**
     * Lee cache MSAL cifrada para una identidad Microsoft.
     */
    async findMicrosoftAccountCache(authIdentityId: number): Promise<MicrosoftAccountCache | null> {
        const row = await this.database.db
            .selectFrom("sec_microsoft_account")
            .select(["auth_identity_id_microsoft_account as authIdentityId", "cache_ciphertext_microsoft_account as ciphertext", "cache_iv_microsoft_account as iv", "cache_key_version_microsoft_account as keyVersion", "cache_tag_microsoft_account as tag", "home_account_id_microsoft_account as homeAccountId"])
            .where("auth_identity_id_microsoft_account", "=", authIdentityId)
            .where("status_microsoft_account", "=", ACTIVE_STATUS)
            .executeTakeFirst();

        if (!row) {
            return null;
        }

        return {
            authIdentityId: row.authIdentityId,
            cache: {
                ciphertext: row.ciphertext,
                iv: row.iv,
                keyVersion: row.keyVersion,
                tag: row.tag,
            },
            homeAccountId: row.homeAccountId,
        };
    }

    /**
     * Lee la foto cacheada asociada a una sesion activa.
     *
     * El API sirve bytes internos del CRM; no devuelve ni firma URLs de Graph.
     */
    async findProfileImageBySessionTokenHash(sessionTokenHash: string): Promise<ProfileImageRecord | null> {
        const now = new Date();
        const row = await this.database.db
            .selectFrom("sec_auth_session as session")
            .innerJoin("sec_user as user", "user.id_user", "session.user_id_auth_session")
            .innerJoin("sec_user_profile_image as profileImage", "profileImage.user_id_user_profile_image", "user.id_user")
            .select(["profileImage.image_bytes_user_profile_image as bytes", "profileImage.mime_type_user_profile_image as mimeType"])
            .where("session.token_hash_auth_session", "=", sessionTokenHash)
            .where("session.status_auth_session", "=", ACTIVE_STATUS)
            .where("session.expires_at_auth_session", ">", now)
            .where("user.status_user", "=", ACTIVE_STATUS)
            .where("user.deleted_at_user", "is", null)
            .where("profileImage.status_user_profile_image", "=", ACTIVE_STATUS)
            .where((expression) => expression.or([expression("profileImage.expires_at_user_profile_image", "is", null), expression("profileImage.expires_at_user_profile_image", ">", now)]))
            .executeTakeFirst();

        return row ?? null;
    }

    /**
     * Actualiza cache MSAL luego de una renovacion silenciosa exitosa.
     */
    async updateMicrosoftCache(authIdentityId: number, cache: EncryptedMicrosoftCache): Promise<void> {
        await this.database.db
            .updateTable("sec_microsoft_account")
            .set({
                cache_ciphertext_microsoft_account: cache.ciphertext,
                cache_iv_microsoft_account: cache.iv,
                cache_key_version_microsoft_account: cache.keyVersion,
                cache_synced_at_microsoft_account: new Date(),
                cache_tag_microsoft_account: cache.tag,
                interaction_required_at_microsoft_account: null,
                last_silent_token_at_microsoft_account: new Date(),
                updated_at_microsoft_account: new Date(),
            })
            .where("auth_identity_id_microsoft_account", "=", authIdentityId)
            .where("status_microsoft_account", "=", ACTIVE_STATUS)
            .executeTakeFirst();
    }

    /**
     * Marca Microsoft como requiere login y revoca solo sesiones CRM de esa identidad.
     */
    async markMicrosoftInteractionRequiredAndRevokeSessions(authIdentityId: number, userId: number): Promise<void> {
        await this.database.db.transaction().execute(async (transaction) => {
            const now = new Date();
            await transaction
                .updateTable("sec_microsoft_account")
                .set({
                    interaction_required_at_microsoft_account: now,
                    updated_at_microsoft_account: now,
                })
                .where("auth_identity_id_microsoft_account", "=", authIdentityId)
                .where("status_microsoft_account", "=", ACTIVE_STATUS)
                .executeTakeFirst();

            await this.sessions.revokeActiveSessionsForAuthIdentity(authIdentityId, userId, "microsoft_interaction_required", transaction);
        });
    }

    /**
     * Guarda la foto de perfil como cache interna controlada por CRM.
     */
    private async upsertProfileImage(transaction: IdentityTransaction, userId: number, profileImage: NonNullable<MicrosoftIdentityInput["profileImage"]>): Promise<void> {
        const now = new Date();
        const imageHash = createHash("sha256").update(profileImage.bytes).digest("hex");

        await transaction
            .insertInto("sec_user_profile_image")
            .values({
                created_at_user_profile_image: now,
                expires_at_user_profile_image: null,
                fetched_at_user_profile_image: now,
                image_bytes_user_profile_image: profileImage.bytes,
                image_sha256_user_profile_image: imageHash,
                mime_type_user_profile_image: profileImage.mimeType,
                provider_code_user_profile_image: MICROSOFT_PROVIDER_CODE,
                public_url_user_profile_image: profileImage.publicUrl,
                source_subject_user_profile_image: profileImage.sourceSubject,
                status_user_profile_image: ACTIVE_STATUS,
                updated_at_user_profile_image: now,
                user_id_user_profile_image: userId,
            })
            .onDuplicateKeyUpdate({
                expires_at_user_profile_image: null,
                fetched_at_user_profile_image: now,
                image_bytes_user_profile_image: profileImage.bytes,
                image_sha256_user_profile_image: imageHash,
                mime_type_user_profile_image: profileImage.mimeType,
                provider_code_user_profile_image: MICROSOFT_PROVIDER_CODE,
                public_url_user_profile_image: profileImage.publicUrl,
                source_subject_user_profile_image: profileImage.sourceSubject,
                status_user_profile_image: ACTIVE_STATUS,
                updated_at_user_profile_image: now,
            })
            .executeTakeFirstOrThrow();
    }
}
