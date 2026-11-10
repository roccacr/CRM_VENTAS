import { Inject, Injectable } from "@nestjs/common";

import { DatabaseService } from "../../../database/database.service.js";
import { CATALOG_CONTEXT_MODULES } from "../catalogs/catalogs.constants.js";
import { LEAD_PROFILE_PERMISSION } from "../leads/lead-profile.contract.js";
import { NOTE_ACTIONS } from "../notes/notes.permissions.js";
import { DEFAULT_DIRECT_OVERRIDE_SCOPE, EffectivePermissionService } from "../permissions/effective-permission.service.js";
import type { PermissionEffect, PermissionInput, PermissionOverrideInput } from "../permissions/permission.types.js";
import { resolveHighestPermissionScope } from "../permissions/permission-scope.js";
import type { IdentityAuthorizationProfile, IdentityAuthSummary, IdentityOrgUnit, IdentityProfile, IdentityRole } from "./identity.types.js";
import { MICROSOFT_PROVIDER_CODE } from "./identity-microsoft.constants.js";
import { type ModuleRoleAccess, normalizePermissionModule, resolveModuleRoleAccess } from "./identity-module-policy.js";
import { ACTIVE_STATUS, ADDENDUM_MARK_PENDING_PERMISSION, LOCAL_PROVIDER_AVAILABLE_STATUSES, LOCAL_PROVIDER_CODE, PENDING_LOCAL_STATUS } from "./identity-repository.shared.js";

const OWNER_ROLE_CODE = "owner";

/** Active session joined with its user and identity. */
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

/** Permission granted through a role. */
type RolePermissionRow = {
    code: string;
    moduleCode?: string;
    roleCode?: string;
};

/** Active permission definition. */
type ActivePermissionRow = {
    code: string;
    moduleCode?: string;
};

/** Direct per-user permission exception. */
type PermissionOverrideRow = {
    code: string;
    moduleCode?: string;
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

    /** Política persistida del usuario para comprobaciones internas. No fabrica una sesión ni suplanta a la persona. */
    async findAuthorizationByUserPublicId(publicId: string): Promise<IdentityAuthorizationProfile | null> {
        const user = await this.database.db.selectFrom("sec_user").select(["id_user as id", "public_id_user as publicId", "display_name_user as displayName", "email_user as email", "status_user as status", "permission_version_user as permissionVersion"]).where("public_id_user", "=", publicId).where("status_user", "=", ACTIVE_STATUS).where("deleted_at_user", "is", null).executeTakeFirst();
        if (!user) return null;
        const assigned = await this.findOrgUnits(user.id);
        const access = await this.findRoles(user.id, assigned);
        const orgUnits = await this.effectiveOrgUnits(access, assigned);
        const scope = orgUnits.length ? resolveHighestPermissionScope(orgUnits.map((unit) => unit.scope)) : DEFAULT_DIRECT_OVERRIDE_SCOPE;
        const inputs = await this.findEffectivePermissionInputs(user.id, scope, access, orgUnits);
        const { id: _internal, ...identityUser } = user;
        return { user: { ...identityUser, profileImageUrl: null }, roles: access.roles, orgUnits, permissions: this.permissions.calculate(inputs).permissions };
    }

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

        const [assignedOrgUnits, localStatus] = await Promise.all([this.findOrgUnits(session.userId), this.findLocalAuthStatus(session.userId)]);
        const access = await this.findRoles(session.userId, assignedOrgUnits);
        const orgUnits = await this.effectiveOrgUnits(access, assignedOrgUnits);
        const scope = orgUnits.length ? resolveHighestPermissionScope(orgUnits.map((unit) => unit.scope)) : DEFAULT_DIRECT_OVERRIDE_SCOPE;
        const { rolePermissions, overrides } = await this.findEffectivePermissionInputs(session.userId, scope, access, orgUnits);
        const effectivePermissions = this.permissions.calculate({ rolePermissions, overrides });

        return this.buildIdentityProfile({
            localStatus,
            orgUnits,
            permissions: effectivePermissions.permissions,
            roles: access.roles,
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
     * Owner inherits active roles from its persisted policy; direct assignments stay unchanged.
     */
    private async findRoles(userId: number, orgUnits: readonly IdentityOrgUnit[] = []): Promise<ModuleRoleAccess> {
        const assigned = await this.database.db
            .selectFrom("sec_user_role as userRole")
            .innerJoin("sec_role as role", "role.id_role", "userRole.role_id_user_role")
            .select(["role.code_role as code", "role.name_role as name", "role.status_role as status", "role.role_inheritance_mode_role as inheritanceMode", "role.permission_inheritance_mode_role as permissionInheritance"])
            .where("userRole.user_id_user_role", "=", userId)
            .where("userRole.status_user_role", "=", ACTIVE_STATUS)
            .where("userRole.revoked_at_user_role", "is", null)
            .where("role.status_role", "=", ACTIVE_STATUS)
            .where("role.deleted_at_role", "is", null)
            .execute();
        const inherits = assigned.some((role) => role.code === OWNER_ROLE_CODE && role.status === ACTIVE_STATUS && role.inheritanceMode === "all_active_roles");
        if (assigned.some((role) => role.code === OWNER_ROLE_CODE)) {
            const roles = inherits ? await this.database.db.selectFrom("sec_role as role").select(["role.code_role as code", "role.name_role as name", "role.status_role as status"]).where("role.status_role", "=", ACTIVE_STATUS).where("role.deleted_at_role", "is", null).orderBy("role.id_role", "asc").execute() : assigned;
            return { roles: roles.map(({ code, name, status }) => ({ code, name, status })), moduleCodes: null, permissionInheritance: "assigned" };
        }
        const mappings = await this.database.db
            .selectFrom("sec_role_module as mapping")
            .innerJoin("sec_role as role", "role.id_role", "mapping.role_id_role_module")
            .innerJoin("sec_org_unit as orgUnit", "orgUnit.id_org_unit", "mapping.org_unit_id_role_module")
            .select(["role.code_role as code", "role.name_role as name", "role.status_role as status", "orgUnit.code_org_unit as moduleCode", "mapping.status_role_module as mappingStatus", "orgUnit.status_org_unit as moduleStatus", "orgUnit.deleted_at_org_unit as moduleDeleted"])
            .where("role.status_role", "=", ACTIVE_STATUS)
            .where("role.deleted_at_role", "is", null)
            .orderBy("role.id_role", "asc")
            .execute();
        return resolveModuleRoleAccess(
            assigned,
            mappings,
            orgUnits.map((unit) => unit.code),
        );
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
            .where("membership.revoked_at_user_org_unit", "is", null)
            .where("orgUnit.status_org_unit", "=", ACTIVE_STATUS)
            .where("orgUnit.deleted_at_org_unit", "is", null)
            .execute();
    }

    /** El acceso global de Owner es virtual. La membresía de raíz no esconde los menús operativos. */
    private async effectiveOrgUnits(access: ModuleRoleAccess, assigned: readonly IdentityOrgUnit[]): Promise<IdentityOrgUnit[]> {
        if (!access.roles.some((role) => role.code === OWNER_ROLE_CODE && role.status === ACTIVE_STATUS)) return assigned.filter((unit) => access.moduleCodes === null || access.moduleCodes.includes(unit.code));
        const modules = await this.database.db.selectFrom("sec_org_unit").select(["code_org_unit as code", "name_org_unit as name", "public_id_org_unit as publicId", "status_org_unit as status"]).where("status_org_unit", "=", ACTIVE_STATUS).where("deleted_at_org_unit", "is", null).orderBy("sort_order_org_unit", "asc").execute();
        return modules.map((module) => ({ ...module, membership: "leader", scope: "all_areas" }));
    }

    /**
     * Lee permisos activos concedidos por roles activos.
     */
    private async findRolePermissions(userId: number, scope: string): Promise<Array<PermissionInput & { moduleCode?: string; roleCode?: string }>> {
        const rows: RolePermissionRow[] = await this.database.db
            .selectFrom("sec_user_role as userRole")
            .innerJoin("sec_role as role", "role.id_role", "userRole.role_id_user_role")
            .innerJoin("sec_role_permission as rolePermission", "rolePermission.role_id_role_permission", "role.id_role")
            .innerJoin("sec_permission as permission", "permission.id_permission", "rolePermission.permission_id_role_permission")
            .select(["permission.code_permission as code", "permission.module_code_permission as moduleCode", "role.code_role as roleCode"])
            .where("userRole.user_id_user_role", "=", userId)
            .where("userRole.status_user_role", "=", ACTIVE_STATUS)
            .where("userRole.revoked_at_user_role", "is", null)
            .where("role.status_role", "=", ACTIVE_STATUS)
            .where("role.deleted_at_role", "is", null)
            .where("rolePermission.status_role_permission", "=", ACTIVE_STATUS)
            .where("permission.status_permission", "=", ACTIVE_STATUS)
            .execute();

        return rows.map((row) => ({
            code: row.code,
            scope,
            ...(row.moduleCode === undefined ? {} : { moduleCode: row.moduleCode }),
            ...(row.roleCode === undefined ? {} : { roleCode: row.roleCode }),
        }));
    }

    /**
     * Owner conserva su base global salvo el marcado manual de adéndum, que exige asignación real.
     */
    private async findEffectivePermissionInputs(
        userId: number,
        scope: string,
        access: ModuleRoleAccess,
        orgUnits: readonly IdentityOrgUnit[],
    ): Promise<{
        rolePermissions: PermissionInput[];
        overrides: PermissionOverrideInput[];
    }> {
        if (access.roles.some((role) => role.code === OWNER_ROLE_CODE && role.status === ACTIVE_STATUS)) {
            const [rolePermissions, overrides, assigned] = await Promise.all([this.findAllActivePermissions(scope), this.findOverrides(userId), this.findRolePermissions(userId, scope)]);
            return {
                overrides,
                rolePermissions: [...rolePermissions, ...assigned.filter((permission) => permission.code === ADDENDUM_MARK_PENDING_PERMISSION)],
            };
        }

        const [rolePermissions, overrides, personalNotes] = await Promise.all([this.findRolePermissions(userId, scope), this.findOverrides(userId), this.findPersonalNotesPermissions(orgUnits)]);

        return {
            overrides: [...this.restrictToModules(overrides, access.moduleCodes, orgUnits), ...overrides.filter((entry) => entry.effect === "deny" && CATALOG_CONTEXT_MODULES.some((module) => NOTE_ACTIONS.some((action) => entry.code === `${module}.notes.${action}`)) && !this.restrictToModules([entry], access.moduleCodes, orgUnits).length)],
            rolePermissions: [...personalNotes, ...this.restrictToModules(this.restrictGrantingRoles(rolePermissions, access), access.moduleCodes, orgUnits)],
        };
    }

    /** Las notas personales quedan en alcance propio y solo en los módulos efectivos. Un override vivo sigue ganando. */
    private async findPersonalNotesPermissions(orgUnits: readonly IdentityOrgUnit[]): Promise<PermissionInput[]> {
        const modules = orgUnits.map((unit) => unit.code).filter((code) => CATALOG_CONTEXT_MODULES.some((module) => module === code));
        if (modules.length === 0) return [];
        const codes = modules.flatMap((module) => NOTE_ACTIONS.map((action) => `${module}.notes.${action}`));
        const rows = await this.database.db.selectFrom("sec_permission").select(["code_permission as code", "module_code_permission as moduleCode"]).where("status_permission", "=", ACTIVE_STATUS).where("code_permission", "in", codes).where("module_code_permission", "in", modules).execute();
        // La coincidencia exacta evita que una definición mal armada tome el permiso de otro módulo.
        return rows.filter((row) => modules.includes(row.moduleCode) && NOTE_ACTIONS.some((action) => row.code === `${row.moduleCode}.notes.${action}`)).map((row) => ({ code: row.code, scope: DEFAULT_DIRECT_OVERRIDE_SCOPE }));
    }

    /** Un permiso no toma el techo de otro rol ni sobrevive a la revocación del suyo. */
    private restrictGrantingRoles<T extends { code: string; roleCode?: string; moduleCode?: string }>(inputs: readonly T[], access: ModuleRoleAccess): T[] {
        if (access.moduleCodes === null) return [...inputs];
        const roles = new Set(access.roles.map((role) => role.code));
        return inputs.filter((input) => {
            if (input.roleCode === undefined || input.moduleCode === undefined || !roles.has(input.roleCode)) return false;
            const ceiling = access.roleModuleCodes?.get(input.roleCode) ?? access.moduleCodes ?? [];
            // El perfil del lead es una capacidad global; sigue exigiendo rol efectivo y deny vigente.
            return input.code === LEAD_PROFILE_PERMISSION || ceiling.includes(normalizePermissionModule(input.moduleCode));
        });
    }

    /** El mismo recorte vale para HTTP, servicios y llamadores internos. */
    private restrictToModules<T extends { code: string; scope: string; moduleCode?: string }>(inputs: readonly T[], modules: readonly string[] | null, orgUnits: readonly IdentityOrgUnit[]): T[] {
        if (modules === null) return [...inputs];
        return inputs
            .filter((input) => input.code === LEAD_PROFILE_PERMISSION || (input.moduleCode !== undefined && modules.includes(normalizePermissionModule(input.moduleCode))))
            .map((input) => {
                const membership = orgUnits.find((unit) => unit.code === normalizePermissionModule(input.moduleCode ?? ""));
                // Un allow directo conserva su alcance estrecho. No ensancha el permiso del rol.
                return { ...input, scope: input.scope === DEFAULT_DIRECT_OVERRIDE_SCOPE ? input.scope : (membership?.scope ?? DEFAULT_DIRECT_OVERRIDE_SCOPE) };
            });
    }

    /**
     * Owner conserva acceso administrativo global; únicamente marcar adéndum pendiente queda fuera del comodín.
     */
    private async findAllActivePermissions(scope: string): Promise<Array<PermissionInput & { moduleCode?: string }>> {
        const rows: ActivePermissionRow[] = await this.database.db.selectFrom("sec_permission as permission").select(["permission.code_permission as code", "permission.module_code_permission as moduleCode"]).where("permission.status_permission", "=", ACTIVE_STATUS).execute();

        return rows
            .filter((row) => row.code !== ADDENDUM_MARK_PENDING_PERMISSION)
            .map((row) => ({
                code: row.code,
                scope,
                ...(row.moduleCode === undefined ? {} : { moduleCode: row.moduleCode }),
            }));
    }

    /**
     * Lee overrides directos vigentes y descarta permisos inactivos.
     */
    private async findOverrides(userId: number): Promise<Array<PermissionOverrideInput & { moduleCode?: string }>> {
        const now = new Date();
        const rows: PermissionOverrideRow[] = await this.database.db
            .selectFrom("sec_user_permission_override as override")
            .innerJoin("sec_permission as permission", "permission.id_permission", "override.permission_id_user_permission_override")
            .select(["override.effect_user_permission_override as effect", "override.ends_at_user_permission_override as expiresAt", "permission.code_permission as code", "permission.module_code_permission as moduleCode"])
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
            ...(row.moduleCode === undefined ? {} : { moduleCode: row.moduleCode }),
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
