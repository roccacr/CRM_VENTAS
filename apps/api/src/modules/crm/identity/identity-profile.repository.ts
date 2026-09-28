import { Inject, Injectable } from "@nestjs/common";

import { DatabaseService } from "../../../database/database.service.js";
import { DEFAULT_DIRECT_OVERRIDE_SCOPE, EffectivePermissionService } from "../permissions/effective-permission.service.js";
import type { PermissionEffect, PermissionInput, PermissionOverrideInput } from "../permissions/permission.types.js";
import { resolveHighestPermissionScope } from "../permissions/permission-scope.js";
import type { IdentityAuthSummary, IdentityOrgUnit, IdentityProfile, IdentityRole } from "./identity.types.js";
import { MICROSOFT_PROVIDER_CODE } from "./identity-microsoft.constants.js";
import { ACTIVE_STATUS, LOCAL_PROVIDER_AVAILABLE_STATUSES, LOCAL_PROVIDER_CODE, PENDING_LOCAL_STATUS } from "./identity-repository.shared.js";

type ActiveSessionRow = {
    authIdentityStatus: string;
    currentProvider: string;
    sessionPublicId: string;
    sessionStatus: string;
    sessionExpiresAt: Date | string;
    sessionPermissionVersion: number;
    userId: number;
    userPublicId: string;
    displayName: string;
    email: string;
    userStatus: string;
    permissionVersion: number;
    profileImageUrl: string | null;
    microsoftHomeAccountId: string | null;
    microsoftInteractionRequiredAt: Date | string | null;
    microsoftSyncedAt: Date | string | null;
    microsoftTenantId: string | null;
};

type RolePermissionRow = {
    code: string;
};

type PermissionOverrideRow = {
    code: string;
    effect: string;
    expiresAt: Date | string | null;
};

/**
 * Lecturas de perfil autenticado y permisos efectivos.
 *
 * Esta clase no crea sesiones ni modifica credenciales. Solo arma la vista
 * canónica que consumen `/identity/me` y `/identity/session`.
 */
@Injectable()
export class IdentityProfileRepository {
    /**
     * Inyecta dependencias de lectura para perfil y permisos.
     */
    constructor(
        @Inject(DatabaseService) private readonly database: DatabaseService,
        @Inject(EffectivePermissionService) private readonly permissions: EffectivePermissionService,
    ) {}

    /**
     * Carga identidad desde hash de token opaco de sesion.
     */
    async findBySessionTokenHash(sessionTokenHash: string): Promise<IdentityProfile | null> {
        return this.buildProfileFromSession(await this.findActiveSessionByTokenHash(sessionTokenHash));
    }

    /**
     * Arma perfil completo solo cuando usuario, identidad y sesion siguen activos.
     */
    private async buildProfileFromSession(session: ActiveSessionRow | null): Promise<IdentityProfile | null> {
        if (!session || session.userStatus !== ACTIVE_STATUS || session.authIdentityStatus !== ACTIVE_STATUS || session.sessionStatus !== ACTIVE_STATUS) {
            return null;
        }

        if (session.sessionPermissionVersion !== session.permissionVersion) {
            return null;
        }

        const [roles, orgUnits, localStatus] = await Promise.all([this.findRoles(session.userId), this.findOrgUnits(session.userId), this.findLocalAuthStatus(session.userId)]);
        const scope = orgUnits.length ? resolveHighestPermissionScope(orgUnits.map((unit) => unit.scope)) : DEFAULT_DIRECT_OVERRIDE_SCOPE;
        const [rolePermissions, overrides] = await Promise.all([this.findRolePermissions(session.userId, scope), this.findOverrides(session.userId)]);
        const effectivePermissions = this.permissions.calculate({ rolePermissions, overrides });

        return this.buildIdentityProfile({
            localStatus,
            orgUnits,
            permissions: effectivePermissions.permissions,
            roles,
            session,
        });
    }

    /**
     * Busca sesion activa por hash opaco.
     */
    private async findActiveSessionByTokenHash(sessionTokenHash: string): Promise<ActiveSessionRow | null> {
        return this.findActiveSession("session.token_hash_auth_session", sessionTokenHash);
    }

    /**
     * Busca sesion activa por columna controlada.
     */
    private async findActiveSession(column: "session.public_id_auth_session" | "session.token_hash_auth_session", value: string): Promise<ActiveSessionRow | null> {
        const now = new Date();

        const row = await this.database.db
            .selectFrom("sec_auth_session as session")
            .innerJoin("sec_user as user", "user.id_user", "session.user_id_auth_session")
            .innerJoin("sec_auth_identity as identity", "identity.id_auth_identity", "session.auth_identity_id_auth_session")
            .leftJoin("sec_microsoft_account as microsoft", "microsoft.auth_identity_id_microsoft_account", "identity.id_auth_identity")
            .leftJoin("sec_user_profile_image as profileImage", (join) =>
                join
                    .onRef("profileImage.user_id_user_profile_image", "=", "user.id_user")
                    .on("profileImage.status_user_profile_image", "=", ACTIVE_STATUS)
                    .on((expression) => expression.or([expression("profileImage.expires_at_user_profile_image", "is", null), expression("profileImage.expires_at_user_profile_image", ">", now)])),
            )
            .select([
                "identity.status_auth_identity as authIdentityStatus",
                "microsoft.cache_synced_at_microsoft_account as microsoftSyncedAt",
                "microsoft.home_account_id_microsoft_account as microsoftHomeAccountId",
                "microsoft.interaction_required_at_microsoft_account as microsoftInteractionRequiredAt",
                "microsoft.tenant_id_microsoft_account as microsoftTenantId",
                "profileImage.public_url_user_profile_image as profileImageUrl",
                "session.expires_at_auth_session as sessionExpiresAt",
                "session.permission_version_auth_session as sessionPermissionVersion",
                "session.provider_code_auth_session as currentProvider",
                "session.public_id_auth_session as sessionPublicId",
                "session.status_auth_session as sessionStatus",
                "user.display_name_user as displayName",
                "user.email_user as email",
                "user.id_user as userId",
                "user.permission_version_user as permissionVersion",
                "user.public_id_user as userPublicId",
                "user.status_user as userStatus",
            ])
            .where(column, "=", value)
            .where("session.expires_at_auth_session", ">", now)
            .where("user.deleted_at_user", "is", null)
            .where("identity.deleted_at_auth_identity", "is", null)
            .executeTakeFirst();

        return row ?? null;
    }

    /**
     * Traduce filas internas a contrato de identidad.
     */
    private buildIdentityProfile(input: { session: ActiveSessionRow; roles: IdentityRole[]; orgUnits: IdentityOrgUnit[]; localStatus: string | null; permissions: IdentityProfile["permissions"] }): IdentityProfile {
        const { session } = input;

        return {
            auth: this.buildAuthSummary(session, input.localStatus),
            orgUnits: input.orgUnits,
            permissions: input.permissions,
            roles: input.roles,
            session: {
                expiresAt: this.toDate(session.sessionExpiresAt).toISOString(),
                expiresInSeconds: this.calculateExpiresInSeconds(session.sessionExpiresAt),
                permissionVersion: session.permissionVersion,
                publicId: session.sessionPublicId,
                status: session.sessionStatus,
            },
            user: {
                displayName: session.displayName,
                email: session.email,
                permissionVersion: session.permissionVersion,
                profileImageUrl: session.profileImageUrl,
                publicId: session.userPublicId,
                status: session.userStatus,
            },
        };
    }

    /**
     * Resume proveedores disponibles sin exponer tokens ni hashes.
     */
    private buildAuthSummary(session: ActiveSessionRow, localStatus: string | null): IdentityAuthSummary {
        const resolvedLocalStatus = localStatus ?? PENDING_LOCAL_STATUS;
        const availableProviders = LOCAL_PROVIDER_AVAILABLE_STATUSES.has(resolvedLocalStatus) ? [MICROSOFT_PROVIDER_CODE, LOCAL_PROVIDER_CODE] : [MICROSOFT_PROVIDER_CODE];

        return {
            availableProviders,
            currentProvider: session.currentProvider,
            localStatus: resolvedLocalStatus,
            microsoft: {
                homeAccountId: session.microsoftHomeAccountId,
                interactionRequired: Boolean(session.microsoftInteractionRequiredAt),
                lastSyncedAt: session.microsoftSyncedAt ? this.toDate(session.microsoftSyncedAt).toISOString() : null,
                tenantId: session.microsoftTenantId,
            },
            primaryProvider: MICROSOFT_PROVIDER_CODE,
        };
    }

    /**
     * Normaliza fechas devueltas por mysql2.
     */
    private toDate(value: Date | string): Date {
        return value instanceof Date ? value : new Date(value);
    }

    /**
     * Calcula expiracion relativa sin permitir valores negativos.
     */
    private calculateExpiresInSeconds(expiresAt: Date | string): number {
        return Math.max(0, Math.floor((this.toDate(expiresAt).getTime() - Date.now()) / 1000));
    }

    /**
     * Retorna roles activos asignados directamente al usuario canonico CRM.
     */
    private async findRoles(userId: number): Promise<IdentityRole[]> {
        return this.database.db.selectFrom("sec_user_role as userRole").innerJoin("sec_role as role", "role.id_role", "userRole.role_id_user_role").select(["role.code_role as code", "role.name_role as name", "role.status_role as status"]).where("userRole.user_id_user_role", "=", userId).where("userRole.status_user_role", "=", ACTIVE_STATUS).where("role.status_role", "=", ACTIVE_STATUS).where("role.deleted_at_role", "is", null).execute();
    }

    /**
     * Retorna areas activas donde el usuario tiene membresia vigente.
     */
    private async findOrgUnits(userId: number): Promise<IdentityOrgUnit[]> {
        return this.database.db
            .selectFrom("sec_user_org_unit as membership")
            .innerJoin("sec_org_unit as orgUnit", "orgUnit.id_org_unit", "membership.org_unit_id_user_org_unit")
            .select(["membership.membership_code_user_org_unit as membership", "membership.scope_code_user_org_unit as scope", "membership.status_user_org_unit as status", "orgUnit.code_org_unit as code", "orgUnit.name_org_unit as name", "orgUnit.public_id_org_unit as publicId"])
            .where("membership.user_id_user_org_unit", "=", userId)
            .where("membership.status_user_org_unit", "=", ACTIVE_STATUS)
            .where("orgUnit.status_org_unit", "=", ACTIVE_STATUS)
            .where("orgUnit.deleted_at_org_unit", "is", null)
            .execute();
    }

    /**
     * Lee permisos activos concedidos por roles activos.
     */
    private async findRolePermissions(userId: number, scope: string): Promise<PermissionInput[]> {
        const rows: RolePermissionRow[] = await this.database.db
            .selectFrom("sec_user_role as userRole")
            .innerJoin("sec_role as role", "role.id_role", "userRole.role_id_user_role")
            .innerJoin("sec_role_permission as rolePermission", "rolePermission.role_id_role_permission", "role.id_role")
            .innerJoin("sec_permission as permission", "permission.id_permission", "rolePermission.permission_id_role_permission")
            .select("permission.code_permission as code")
            .where("userRole.user_id_user_role", "=", userId)
            .where("userRole.status_user_role", "=", ACTIVE_STATUS)
            .where("role.status_role", "=", ACTIVE_STATUS)
            .where("role.deleted_at_role", "is", null)
            .where("rolePermission.status_role_permission", "=", ACTIVE_STATUS)
            .where("permission.status_permission", "=", ACTIVE_STATUS)
            .execute();

        return rows.map((row) => ({
            code: row.code,
            scope,
        }));
    }

    /**
     * Lee overrides directos vigentes y descarta permisos inactivos.
     */
    private async findOverrides(userId: number): Promise<PermissionOverrideInput[]> {
        const now = new Date();
        const rows: PermissionOverrideRow[] = await this.database.db
            .selectFrom("sec_user_permission_override as override")
            .innerJoin("sec_permission as permission", "permission.id_permission", "override.permission_id_user_permission_override")
            .select(["override.effect_user_permission_override as effect", "override.ends_at_user_permission_override as expiresAt", "permission.code_permission as code"])
            .where("override.user_id_user_permission_override", "=", userId)
            .where("override.status_user_permission_override", "=", ACTIVE_STATUS)
            .where("override.starts_at_user_permission_override", "<=", now)
            .where("override.revoked_at_user_permission_override", "is", null)
            .where("permission.status_permission", "=", ACTIVE_STATUS)
            .where((expression) => expression.or([expression("override.ends_at_user_permission_override", "is", null), expression("override.ends_at_user_permission_override", ">", now)]))
            .execute();

        return rows.map((row) => ({
            code: row.code,
            effect: row.effect as PermissionEffect,
            expiresAt: row.expiresAt ? this.toDate(row.expiresAt) : null,
            scope: DEFAULT_DIRECT_OVERRIDE_SCOPE,
        }));
    }

    /**
     * Lee estado de la identidad local para informar disponibilidad de login local.
     */
    private async findLocalAuthStatus(userId: number): Promise<string | null> {
        const row = await this.database.db.selectFrom("sec_auth_identity").select("status_auth_identity").where("user_id_auth_identity", "=", userId).where("provider_code_auth_identity", "=", LOCAL_PROVIDER_CODE).where("deleted_at_auth_identity", "is", null).executeTakeFirst();

        return row?.status_auth_identity ?? null;
    }
}
