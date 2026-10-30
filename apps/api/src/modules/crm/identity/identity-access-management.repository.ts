import { BadRequestException, ConflictException, ForbiddenException, Inject, Injectable } from "@nestjs/common";
import { type Kysely, sql } from "kysely";

import { DatabaseService } from "../../../database/database.service.js";
import type { CrmDatabase } from "../../../database/database.types.js";
import { buildAuditChangeSet } from "../audit/audit-change-set.js";
import { SecurityAuditService } from "../audit/security-audit.service.js";
import { CATALOG_CONTEXT_MODULES, CATALOG_PERMISSION_ACTIONS, type CatalogPermissionAction, findCatalogDefinitionByModuleCode, getCatalogPermissionName } from "../catalogs/catalogs.constants.js";
import type { IdentityProfile } from "./identity.types.js";
import { normalizePermissionModule, OPERATIONAL_MODULE_CODES, permissionModuleCodes } from "./identity-module-policy.js";
import { ACTIVE_STATUS, type IdentityTransaction } from "./identity-repository.shared.js";
import { IdentitySessionRepository } from "./identity-session.repository.js";

const INACTIVE_STATUS = "inactive";
const VISIBLE_SECURITY_MODULE_CODES = [...CATALOG_CONTEXT_MODULES, "role", "user"] as const;

/** Database handle or transaction, so the same queries run inside or outside a unit of work. */
type AccessManagementExecutor = Pick<Kysely<CrmDatabase>, "insertInto" | "selectFrom" | "updateTable">;

/** Acting user as read from the database. */
interface ActorRow {
    id: number;
}

/** Role row with its lifecycle status. */
interface RoleRow {
    code: string;
    description: string | null;
    id: number;
    name: string;
    status: string;
    permissionInheritance: "assigned" | "selected_modules";
}

/** Result of a COUNT query; mysql2 may return it as a string. */
interface CountRow {
    total: string | number | bigint;
}

/** User row used by access management. */
interface UserRow {
    email: string;
    id: number;
    name: string;
    publicId: string;
    status: string;
}

/** Direct per-user permission exception (allow or deny) over the role baseline. */
interface PermissionOverrideRow {
    code: string;
    effect: "allow" | "deny";
}

/** Permission definition plus the module it belongs to. */
interface PermissionCatalogRow {
    actionCode: string;
    code: string;
    description: string | null;
    moduleCode: string;
}

/** Security audit event as stored, with raw JSON metadata. */
interface SecurityAuditRow {
    actorName: string | null;
    createdAt: Date | string;
    eventType: string;
    metadata: string | null;
    publicId: string;
    reason: string | null;
    summary: string;
    targetName: string | null;
}

/** Inputs for replacing a user's roles inside one transaction. */
interface UserRoleReplacementContext {
    actorUserId: number;
    executor: AccessManagementExecutor;
    now: Date;
    roles: readonly { id: number }[];
    userId: number;
}

/** Inputs for replacing a user's organizational units (modules) inside one transaction. */
interface UserOrgUnitReplacementContext {
    actorUserId: number;
    executor: AccessManagementExecutor;
    now: Date;
    orgUnits: readonly { id: number }[];
    roleCodes: readonly string[];
    userId: number;
}

/** Inputs for replacing a user's permission exceptions inside one transaction. */
interface UserPermissionOverrideReplacementContext {
    actorUserId: number;
    executor: AccessManagementExecutor;
    now: Date;
    overrides: readonly PermissionOverrideRow[];
    permissions: readonly { code: string; id: number }[];
    reason: string;
    userId: number;
}

/** Role as exposed by the security catalog. */
export interface IdentityRoleCatalogItem {
    code: string;
    description: string | null;
    locked?: boolean;
    name: string;
    status: string;
    users?: number;
    moduleCodes?: string[];
    moduleScoped?: boolean;
    permissionInheritance?: "assigned" | "selected_modules";
}

/** Permission as exposed by the security catalog; `sensitive` flags risky actions. */
export interface IdentityPermissionCatalogItem {
    code: string;
    description: string;
    name: string;
    sensitive: boolean;
}

/** A screen of a module and the permissions that govern it. */
export interface IdentityModuleViewCatalogItem {
    code: string;
    name: string;
    permissions: readonly IdentityPermissionCatalogItem[];
}

/** A module and its views in the security catalog. */
export interface IdentityModuleCatalogItem {
    code: string;
    name: string;
    views: readonly IdentityModuleViewCatalogItem[];
}

/** Security audit entry reduced to what the UI may show. */
export interface IdentitySecurityAuditItem {
    actorName: string | null;
    createdAt: string;
    eventType: string;
    moduleCodes: readonly string[];
    publicId: string;
    reason: string | null;
    roleCode: string | null;
    summary: string;
    targetName: string | null;
}

/** Everything the roles screen needs: roles, modules and recent audit. */
export interface IdentitySecurityCatalog {
    auditEvents: readonly IdentitySecurityAuditItem[];
    modules: readonly IdentityModuleCatalogItem[];
    rolePermissions: Record<string, readonly string[]>;
    roles: readonly IdentityRoleCatalogItem[];
}

/** Role assigned to a user. */
export interface IdentityAccessRoleItem {
    code: string;
    name: string;
    status: string;
}

/** Organizational unit (module) assigned to a user. */
export interface IdentityAccessOrgUnitItem {
    code: string;
    name: string;
    publicId: string;
}

/** A user's roles, modules and permission exceptions. */
export interface IdentityUserAccessSummary {
    orgUnits: readonly IdentityAccessOrgUnitItem[];
    permissionOverrides: readonly PermissionOverrideRow[];
    roles: readonly IdentityAccessRoleItem[];
    user: {
        email: string;
        name: string;
        publicId: string;
        status: string;
    };
}

/** Input to delete a role; the reason is stored in the audit trail. */
export interface DeleteIdentityRoleInput {
    actorPublicId: string;
    code: string;
    ipAddress?: string | undefined;
    reason?: string | undefined;
    userAgent?: string | undefined;
}

/** Input to rename a role; the reason is stored in the audit trail. */
export interface UpdateIdentityRoleInput {
    /** General edits require a trusted service profile for transaction-local authorization. */
    actorProfile?: IdentityProfile;
    actorPublicId: string;
    code: string;
    description?: string | undefined;
    ipAddress?: string | undefined;
    name: string;
    reason: string;
    userAgent?: string | undefined;
    moduleCodes?: readonly string[] | undefined;
    permissionInheritance?: "assigned" | "selected_modules" | undefined;
}

/** Input to replace the full permission set of a role. */
export interface ReplaceIdentityRolePermissionsInput {
    /** General edits require a trusted service profile, never a client field. */
    actorProfile?: IdentityProfile;
    moduleCodes?: readonly string[];
    actorPublicId: string;
    code: string;
    ipAddress?: string | undefined;
    permissionCodes: readonly string[];
    reason: string;
    userAgent?: string | undefined;
}

/** Input to replace a user's roles, modules and permission exceptions. */
export interface ReplaceIdentityUserAccessInput {
    /** Trusted service closure carrying the session profile; never accepted from HTTP. */
    validateAccess: (transaction: IdentityTransaction) => Promise<void>;
    actorPublicId: string;
    ipAddress?: string | undefined;
    orgUnitCodes: readonly string[];
    permissionOverrides: readonly PermissionOverrideRow[];
    reason: string;
    roleCodes: readonly string[];
    userAgent?: string | undefined;
    userPublicId: string;
}

/** Role permissions after a read or replacement. */
export interface IdentityRolePermissionsUpdateResult {
    permissionCodes: readonly string[];
    role: IdentityRoleCatalogItem;
}

/** Read result shares the shape of the update result. */
export type IdentityRolePermissionsReadResult = IdentityRolePermissionsUpdateResult;

/** Outcome of a role deletion: deleted, blocked because it still has active assignments, or not found. */
export type DeleteIdentityRoleResult =
    | {
          activeAssignments: number;
          role: IdentityRoleCatalogItem;
          status: "in_use";
      }
    | {
          role: IdentityRoleCatalogItem;
          status: "deleted";
      }
    | {
          status: "not_found";
      };

/**
 * Persistencia de administracion de roles y modulos operativos.
 */
@Injectable()
export class IdentityAccessManagementRepository {
    /**
     * Inyecta MySQL tipado y auditoria compartida de seguridad.
     */
    constructor(
        @Inject(DatabaseService) private readonly database: DatabaseService,
        @Inject(SecurityAuditService) private readonly audit: SecurityAuditService,
        @Inject(IdentitySessionRepository) _sessions: IdentitySessionRepository,
    ) {}

    /**
     * Lee los roles, modulos y overrides activos de un usuario.
     */
    async readUserAccess(userPublicId: string, executor: AccessManagementExecutor = this.database.db): Promise<IdentityUserAccessSummary> {
        const user = await this.findUserRowByPublicId(executor, userPublicId);

        if (!user) {
            throw new BadRequestException("Usuario no disponible.");
        }

        return this.readUserAccessByRow(executor, user);
    }

    /**
     * Reemplaza acceso directo de un usuario sin tocar el catalogo base.
     */
    async replaceUserAccess(input: ReplaceIdentityUserAccessInput): Promise<IdentityUserAccessSummary> {
        return this.database.db.transaction().execute(async (transaction) => {
            // Lock before snapshot reads so concurrent access edits see the committed predecessor.
            const targetUser = await this.findUserRowByPublicId(transaction, input.userPublicId, true);

            if (!targetUser) {
                throw new BadRequestException("Usuario no disponible.");
            }

            await input.validateAccess(transaction);
            const actor = await this.readActor(transaction, input.actorPublicId);
            const roleCodes = [...new Set(input.roleCodes)].sort();
            const orgUnitCodes = [...new Set(input.orgUnitCodes)].sort();
            const overrides = this.normalizePermissionOverrides(input.permissionOverrides);
            const [roles, orgUnits, permissions] = await Promise.all([
                this.findActiveRolesByCode(transaction, roleCodes),
                this.findActiveOrgUnitsByCode(transaction, orgUnitCodes),
                this.findActivePermissionsByCode(
                    transaction,
                    overrides.map((override) => override.code),
                ),
            ]);

            if (roles.length !== roleCodes.length) {
                throw new BadRequestException("Uno o más roles no existen o no están activos.");
            }

            if (orgUnits.length !== orgUnitCodes.length) {
                throw new BadRequestException("Uno o más módulos no existen o no están activos.");
            }

            if (permissions.length !== overrides.length) {
                throw new BadRequestException("Uno o más permisos directos no existen o no están activos.");
            }

            const previousAccess = await this.readUserAccessByRow(transaction, targetUser);
            const before = await this.readUserAuditSnapshot(transaction, targetUser, previousAccess);
            const actorSnapshot = await this.audit.captureActor(actor.id, transaction);
            const now = new Date();
            await this.replaceUserRoles({ actorUserId: actor.id, executor: transaction, now, roles, userId: targetUser.id });
            await this.replaceUserOrgUnits({ actorUserId: actor.id, executor: transaction, now, orgUnits, roleCodes: roles.map((role) => role.code), userId: targetUser.id });
            await this.replaceUserPermissionOverrides({ actorUserId: actor.id, executor: transaction, now, overrides, permissions, reason: input.reason, userId: targetUser.id });

            await transaction
                .updateTable("sec_user")
                .set({ permission_version_user: sql<number>`permission_version_user + 1`, updated_at_user: now, updated_by_user_id_user: actor.id })
                .where("id_user", "=", targetUser.id)
                .executeTakeFirst();
            // Version mismatch rejects old access; a valid refresh reloads the new effective grants.
            const nextAccess = await this.readUserAccessByRow(transaction, targetUser);
            await this.audit.record(
                {
                    actorSnapshot,
                    actorUserId: actor.id,
                    eventType: "user_access_replaced",
                    ipAddress: input.ipAddress ?? null,
                    metadata: {
                        moduleCode: "administration",
                        sectionCode: "roles",
                        changeSet: buildAuditChangeSet({ entity: "user", recordId: targetUser.publicId, action: "update", before, after: await this.readUserAuditSnapshot(transaction, targetUser, nextAccess) }),
                        nextOrgUnitCodes: orgUnitCodes,
                        nextOverrides: overrides,
                        nextRoleCodes: roleCodes,
                        previousOrgUnitCodes: previousAccess.orgUnits.map((orgUnit) => orgUnit.code),
                        previousOverrides: previousAccess.permissionOverrides,
                        previousRoleCodes: previousAccess.roles.map((role) => role.code),
                    },
                    reason: input.reason,
                    summary: "Acceso directo de usuario reemplazado.",
                    targetUserId: targetUser.id,
                    userAgent: input.userAgent ?? null,
                },
                transaction,
            );

            return nextAccess;
        });
    }

    /**
     * Desactiva un rol solamente cuando no conserva usuarios activos.
     */
    async deleteRole(input: DeleteIdentityRoleInput): Promise<DeleteIdentityRoleResult> {
        return this.database.db.transaction().execute(async (transaction) => {
            const role = await this.findRoleRowByCode(transaction, input.code, true);
            const actor = await this.readActor(transaction, input.actorPublicId);

            if (!role) {
                return { status: "not_found" };
            }
            if (["owner", "jefe_general"].includes(role.code) || role.permissionInheritance === "selected_modules") throw new ConflictException("La plantilla base de este rol esta protegida.");

            const activeAssignments = await this.countActiveRoleAssignments(transaction, role.id);

            if (activeAssignments > 0) {
                return {
                    activeAssignments,
                    role: this.mapRole(role),
                    status: "in_use",
                };
            }

            const before = await this.readRoleAuditSnapshot(transaction, role);
            const actorSnapshot = await this.audit.captureActor(actor.id, transaction);
            const now = new Date();

            await transaction
                .updateTable("sec_role")
                .set({
                    deleted_at_role: now,
                    status_role: INACTIVE_STATUS,
                    updated_at_role: now,
                })
                .where("id_role", "=", role.id)
                .where("deleted_at_role", "is", null)
                .executeTakeFirst();

            await this.audit.record(
                {
                    actorSnapshot,
                    actorUserId: actor.id,
                    eventType: "role_deleted",
                    ipAddress: input.ipAddress ?? null,
                    metadata: {
                        moduleCode: "administration",
                        sectionCode: "roles",
                        changeSet: buildAuditChangeSet({ entity: "role", recordId: role.code, action: "delete", before, after: { ...before, status: INACTIVE_STATUS, deleted: true } }),
                        roleCode: role.code,
                    },
                    reason: input.reason ?? "Rol eliminado por administracion.",
                    summary: "Rol de identidad eliminado logicamente.",
                    userAgent: input.userAgent ?? null,
                },
                transaction,
            );

            return {
                role: this.mapRole({ ...role, status: INACTIVE_STATUS }),
                status: "deleted",
            };
        });
    }

    /**
     * Actualiza datos visibles y techo opcional del rol en la misma transaccion auditada.
     */
    async updateRole(input: UpdateIdentityRoleInput): Promise<IdentityRoleCatalogItem> {
        return this.database.db.transaction().execute(async (transaction) => {
            const role = await this.findRoleRowByCode(transaction, input.code, true);

            if (!role) {
                throw new BadRequestException("Rol no disponible.");
            }
            await this.assertGeneralTemplateOwner(transaction, role, input);
            const actor = await this.readActor(transaction, input.actorPublicId);

            const before = await this.readRoleAuditSnapshot(transaction, role);
            const actorSnapshot = await this.audit.captureActor(actor.id, transaction);
            const now = new Date();
            const policy = await this.applyRolePolicyUpdate(transaction, role, input, now);

            await transaction
                .updateTable("sec_role")
                .set({
                    description_role: input.description ?? null,
                    name_role: input.name,
                    updated_at_role: now,
                    permission_inheritance_mode_role: policy.permissionInheritance,
                })
                .where("id_role", "=", role.id)
                .executeTakeFirstOrThrow();

            await this.bumpUsersWithRolePermissionVersion(transaction, role.id, now);
            await this.audit.record(
                {
                    actorSnapshot,
                    actorUserId: actor.id,
                    eventType: "role_updated",
                    ipAddress: input.ipAddress ?? null,
                    metadata: {
                        moduleCode: "administration",
                        sectionCode: "roles",
                        changeSet: buildAuditChangeSet({ entity: "role", recordId: role.code, action: "update", before, after: { ...before, ...policy, name: input.name, description: input.description ?? null } }),
                        nextName: input.name,
                        previousName: role.name,
                        roleCode: role.code,
                    },
                    reason: input.reason,
                    summary: "Rol de identidad renombrado.",
                    userAgent: input.userAgent ?? null,
                },
                transaction,
            );

            return {
                ...this.mapRole({
                    ...role,
                    description: input.description ?? null,
                    name: input.name,
                }),
                ...policy,
            };
        });
    }

    /**
     * Reemplaza los permisos activos de un rol usando `sec_role_permission`.
     */
    async replaceRolePermissions(input: ReplaceIdentityRolePermissionsInput): Promise<IdentityRolePermissionsUpdateResult> {
        return this.database.db.transaction().execute(async (transaction) => {
            const role = await this.findRoleRowByCode(transaction, input.code, true);

            if (!role) {
                throw new BadRequestException("Rol no disponible.");
            }
            await this.assertGeneralTemplateOwner(transaction, role, input);
            const actor = await this.readActor(transaction, input.actorPublicId);

            const permissionCodes = [...new Set(input.permissionCodes)].sort();
            const permissions = await this.findActivePermissionsByCode(transaction, permissionCodes);

            if (permissions.length !== permissionCodes.length) {
                throw new BadRequestException("Uno o más permisos no existen o no están activos.");
            }
            const before = await this.readRoleAuditSnapshot(transaction, role);
            const now = new Date();
            const actorSnapshot = await this.audit.captureActor(actor.id, transaction);
            if (input.moduleCodes !== undefined) {
                this.assertOperationalTemplateModules(role, input.moduleCodes);
                await this.replaceRoleModules(transaction, role.id, input.moduleCodes, now);
            }
            await this.assertRolePermissionReplacement(transaction, role, permissions);
            const currentPermissions = await this.findActiveRolePermissions(transaction, role.id);
            const nextPermissionIds = new Set(permissions.map((permission) => permission.id));
            const currentPermissionIds = new Set(currentPermissions.map((permission) => permission.id));
            const removedPermissionIds = currentPermissions.filter((permission) => !nextPermissionIds.has(permission.id)).map((permission) => permission.id);
            const permissionsToInsert = permissions.filter((permission) => !currentPermissionIds.has(permission.id));

            if (removedPermissionIds.length > 0) {
                await transaction.updateTable("sec_role_permission").set({ status_role_permission: INACTIVE_STATUS }).where("role_id_role_permission", "=", role.id).where("permission_id_role_permission", "in", removedPermissionIds).where("status_role_permission", "=", ACTIVE_STATUS).executeTakeFirst();
            }

            if (permissionsToInsert.length > 0) {
                await transaction
                    .insertInto("sec_role_permission")
                    .values(permissionsToInsert.map((permission) => ({ created_at_role_permission: now, permission_id_role_permission: permission.id, role_id_role_permission: role.id, status_role_permission: ACTIVE_STATUS })))
                    .execute();
            }

            await this.bumpUsersWithRolePermissionVersion(transaction, role.id, now);
            await this.audit.record(
                {
                    actorSnapshot,
                    actorUserId: actor.id,
                    eventType: "role_permissions_replaced",
                    ipAddress: input.ipAddress ?? null,
                    metadata: {
                        moduleCode: "administration",
                        sectionCode: "roles",
                        changeSet: buildAuditChangeSet({ entity: "role", recordId: role.code, action: "update", before, after: { ...before, ...(await this.rolePolicy(transaction, role)), permissionCodes } }),
                        nextPermissionCodes: permissionCodes,
                        previousPermissionCodes: currentPermissions.map((permission) => permission.code).sort(),
                        roleCode: role.code,
                    },
                    reason: input.reason,
                    summary: "Permisos activos del rol reemplazados.",
                    userAgent: input.userAgent ?? null,
                },
                transaction,
            );

            return {
                permissionCodes,
                role: { ...this.mapRole(role), ...(await this.rolePolicy(transaction, role)), locked: role.code === "owner" },
            };
        });
    }

    /**
     * Lee los permisos activos de un rol desde base de datos.
     */
    async readRolePermissions(roleCode: string, executor: AccessManagementExecutor = this.database.db): Promise<IdentityRolePermissionsReadResult> {
        const role = await this.findRoleRowByCode(executor, roleCode);

        if (!role) {
            throw new BadRequestException("Rol no disponible.");
        }

        const policy = await this.rolePolicy(executor, role);
        const permissions = await this.roleBasePermissions(executor, role, policy);

        return {
            permissionCodes: permissions.map((permission) => permission.code).sort(),
            role: { ...this.mapRole(role), ...policy, locked: role.code === "owner" },
        };
    }

    /**
     * Devuelve la matriz operativa persistida: roles, modulos, acciones y auditoria.
     */
    async readSecurityCatalog(): Promise<IdentitySecurityCatalog> {
        const roles = await this.database.db.selectFrom("sec_role").select(["code_role as code", "description_role as description", "id_role as id", "name_role as name", "status_role as status", "permission_inheritance_mode_role as permissionInheritance"]).where("status_role", "=", ACTIVE_STATUS).where("deleted_at_role", "is", null).orderBy("id_role", "asc").execute();
        const policies = new Map(await Promise.all(roles.map(async (role) => [role.id, await this.rolePolicy(this.database.db, role)] as const)));
        const permissions = (await this.database.db
            .selectFrom("sec_permission")
            .select(["action_code_permission as actionCode", "code_permission as code", "description_permission as description", "module_code_permission as moduleCode"])
            .where("status_permission", "=", ACTIVE_STATUS)
            .where("module_code_permission", "in", [...VISIBLE_SECURITY_MODULE_CODES])
            .orderBy("module_code_permission", "asc")
            .orderBy("code_permission", "asc")
            .execute()) as PermissionCatalogRow[];
        const rolePermissionEntries = await Promise.all(
            roles.map(async (role) => {
                if (role.code === "owner") return [role.code, permissions.map((permission) => permission.code).sort()] as const;
                const policy = policies.get(role.id);
                if (!policy) throw new BadRequestException("Politica del rol no disponible.");
                const activePermissions = await this.roleBasePermissions(this.database.db, role, policy);

                return [
                    role.code,
                    activePermissions
                        .filter((permission) => this.isVisibleSecurityModule(permission.moduleCode))
                        .map((permission) => permission.code)
                        .sort(),
                ] as const;
            }),
        );
        const roleCounts = await Promise.all(
            roles.map(async (role) => {
                const count = await this.countActiveRoleAssignments(this.database.db, role.id);

                return [role.code, count] as const;
            }),
        );
        const auditEvents = await this.readRecentSecurityAuditEvents();
        const countByRole = new Map(roleCounts);

        return {
            auditEvents,
            modules: this.mapPermissionCatalog(permissions),
            rolePermissions: Object.fromEntries(rolePermissionEntries),
            roles: roles.map((role) => ({
                ...this.mapRole(role),
                ...policies.get(role.id),
                locked: role.code === "owner",
                users: countByRole.get(role.code) ?? 0,
            })),
        };
    }

    private async readActor(executor: AccessManagementExecutor, actorPublicId: string): Promise<ActorRow> {
        const actor = await executor.selectFrom("sec_user").select("id_user as id").where("public_id_user", "=", actorPublicId).where("deleted_at_user", "is", null).executeTakeFirst();

        if (!actor) {
            throw new BadRequestException("Actor no disponible para administrar seguridad.");
        }

        return actor;
    }

    private async findUserRowByPublicId(executor: AccessManagementExecutor, publicId: string, lock = false): Promise<UserRow | null> {
        const user = await executor
            .selectFrom("sec_user")
            .select(["display_name_user as name", "email_user as email", "id_user as id", "public_id_user as publicId", "status_user as status"])
            .where("public_id_user", "=", publicId)
            .where("deleted_at_user", "is", null)
            .$if(lock, (query) => query.forUpdate())
            .executeTakeFirst();

        return user ?? null;
    }

    private async readUserAccessByRow(executor: AccessManagementExecutor, user: UserRow): Promise<IdentityUserAccessSummary> {
        const [roles, orgUnits, overrides] = await Promise.all([this.findActiveUserRoles(executor, user.id), this.findActiveUserOrgUnits(executor, user.id), this.findActiveUserPermissionOverrides(executor, user.id)]);

        return {
            orgUnits,
            permissionOverrides: overrides,
            roles,
            user: {
                email: user.email,
                name: user.name,
                publicId: user.publicId,
                status: user.status,
            },
        };
    }

    private async findActiveUserRoles(executor: AccessManagementExecutor, userId: number): Promise<IdentityAccessRoleItem[]> {
        return executor.selectFrom("sec_user_role as userRole").innerJoin("sec_role as role", "role.id_role", "userRole.role_id_user_role").select(["role.code_role as code", "role.name_role as name", "role.status_role as status"]).where("userRole.user_id_user_role", "=", userId).where("userRole.status_user_role", "=", ACTIVE_STATUS).where("userRole.revoked_at_user_role", "is", null).where("role.status_role", "=", ACTIVE_STATUS).where("role.deleted_at_role", "is", null).execute();
    }

    private async findActiveUserOrgUnits(executor: AccessManagementExecutor, userId: number): Promise<IdentityAccessOrgUnitItem[]> {
        return executor
            .selectFrom("sec_user_org_unit as membership")
            .innerJoin("sec_org_unit as orgUnit", "orgUnit.id_org_unit", "membership.org_unit_id_user_org_unit")
            .select(["orgUnit.code_org_unit as code", "orgUnit.name_org_unit as name", "orgUnit.public_id_org_unit as publicId"])
            .where("membership.user_id_user_org_unit", "=", userId)
            .where("membership.status_user_org_unit", "=", ACTIVE_STATUS)
            .where("membership.revoked_at_user_org_unit", "is", null)
            .where("orgUnit.status_org_unit", "=", ACTIVE_STATUS)
            .where("orgUnit.deleted_at_org_unit", "is", null)
            .execute();
    }

    private async findActiveUserPermissionOverrides(executor: AccessManagementExecutor, userId: number): Promise<PermissionOverrideRow[]> {
        const now = new Date();

        return executor
            .selectFrom("sec_user_permission_override as override")
            .innerJoin("sec_permission as permission", "permission.id_permission", "override.permission_id_user_permission_override")
            .select(["override.effect_user_permission_override as effect", "permission.code_permission as code"])
            .where("override.user_id_user_permission_override", "=", userId)
            .where("override.status_user_permission_override", "=", ACTIVE_STATUS)
            .where("override.starts_at_user_permission_override", "<=", now)
            .where("override.revoked_at_user_permission_override", "is", null)
            .where("permission.status_permission", "=", ACTIVE_STATUS)
            .where((expression) => expression.or([expression("override.ends_at_user_permission_override", "is", null), expression("override.ends_at_user_permission_override", ">", now)]))
            .execute() as Promise<PermissionOverrideRow[]>;
    }

    private async countActiveRoleAssignments(executor: AccessManagementExecutor, roleId: number): Promise<number> {
        const row = await executor
            .selectFrom("sec_user_role")
            .select(sql<number>`COUNT(*)`.as("total"))
            .where("role_id_user_role", "=", roleId)
            .where("status_user_role", "=", ACTIVE_STATUS)
            .where("revoked_at_user_role", "is", null)
            .executeTakeFirst();

        return Number((row as CountRow | undefined)?.total ?? 0);
    }

    private async bumpUsersWithRolePermissionVersion(executor: AccessManagementExecutor, roleId: number, now: Date): Promise<void> {
        await executor
            .updateTable("sec_user")
            .set({
                permission_version_user: sql<number>`permission_version_user + 1`,
                updated_at_user: now,
            })
            .where("id_user", "in", (expression) => expression.selectFrom("sec_user_role").select("user_id_user_role").where("role_id_user_role", "=", roleId).where("status_user_role", "=", ACTIVE_STATUS).where("revoked_at_user_role", "is", null))
            .executeTakeFirst();
    }

    private async findActiveRolesByCode(executor: AccessManagementExecutor, codes: readonly string[]): Promise<Array<{ code: string; id: number }>> {
        if (codes.length === 0) {
            return [];
        }

        return executor
            .selectFrom("sec_role")
            .select(["code_role as code", "id_role as id"])
            .where("code_role", "in", [...codes])
            .where("status_role", "=", ACTIVE_STATUS)
            .where("deleted_at_role", "is", null)
            .execute();
    }

    private async findActiveOrgUnitsByCode(executor: AccessManagementExecutor, codes: readonly string[]): Promise<Array<{ code: string; id: number }>> {
        if (codes.length === 0) {
            return [];
        }

        return executor
            .selectFrom("sec_org_unit")
            .select(["code_org_unit as code", "id_org_unit as id"])
            .where("code_org_unit", "in", [...codes])
            .where("status_org_unit", "=", ACTIVE_STATUS)
            .where("deleted_at_org_unit", "is", null)
            .execute();
    }

    private async findActivePermissionsByCode(executor: AccessManagementExecutor, codes: readonly string[]): Promise<Array<{ code: string; id: number; moduleCode: string }>> {
        if (codes.length === 0) {
            return [];
        }

        return executor
            .selectFrom("sec_permission")
            .select(["code_permission as code", "id_permission as id", "module_code_permission as moduleCode"])
            .where("code_permission", "in", [...codes])
            .where("status_permission", "=", ACTIVE_STATUS)
            .execute();
    }

    /** Lower-cases codes and rejects duplicates so one permission cannot carry two exceptions. */
    private normalizePermissionOverrides(overrides: readonly PermissionOverrideRow[]): PermissionOverrideRow[] {
        const byCode = new Map<string, PermissionOverrideRow>();

        for (const override of overrides) {
            const code = override.code.trim().toLowerCase();

            if (byCode.has(code)) {
                throw new BadRequestException("No se puede repetir un permiso directo en el mismo usuario.");
            }

            byCode.set(code, {
                code,
                effect: override.effect,
            });
        }

        return [...byCode.values()].sort((first, second) => first.code.localeCompare(second.code));
    }

    private async replaceUserRoles({ actorUserId, executor, now, roles, userId }: UserRoleReplacementContext): Promise<void> {
        const roleIds = roles.map((role) => role.id);

        await executor
            .updateTable("sec_user_role")
            .set({ revoked_at_user_role: now, revoked_by_user_id_user_role: actorUserId, status_user_role: INACTIVE_STATUS })
            .where("user_id_user_role", "=", userId)
            .where("status_user_role", "=", ACTIVE_STATUS)
            .$if(roleIds.length > 0, (query) => query.where("role_id_user_role", "not in", roleIds))
            .executeTakeFirst();

        if (roleIds.length === 0) {
            return;
        }

        const currentRoles = await executor.selectFrom("sec_user_role").select("role_id_user_role as roleId").where("user_id_user_role", "=", userId).where("status_user_role", "=", ACTIVE_STATUS).where("revoked_at_user_role", "is", null).execute();
        const currentRoleIds = new Set(currentRoles.map((role) => role.roleId));
        const missingRoleIds = roleIds.filter((roleId) => !currentRoleIds.has(roleId));

        if (missingRoleIds.length > 0) {
            await executor
                .insertInto("sec_user_role")
                .values(missingRoleIds.map((roleId) => ({ assigned_at_user_role: now, assigned_by_user_id_user_role: actorUserId, revoked_at_user_role: null, revoked_by_user_id_user_role: null, role_id_user_role: roleId, status_user_role: ACTIVE_STATUS, user_id_user_role: userId })))
                .execute();
        }
    }

    private async replaceUserOrgUnits({ actorUserId, executor, now, orgUnits, roleCodes, userId }: UserOrgUnitReplacementContext): Promise<void> {
        await executor.updateTable("sec_user_org_unit").set({ revoked_at_user_org_unit: now, revoked_by_user_id_user_org_unit: actorUserId, status_user_org_unit: INACTIVE_STATUS }).where("user_id_user_org_unit", "=", userId).where("status_user_org_unit", "=", ACTIVE_STATUS).executeTakeFirst();

        if (orgUnits.length === 0) {
            return;
        }

        const membership = this.resolveMembershipForRoleCodes(roleCodes);
        const scope = this.resolveScopeForRoleCodes(roleCodes);
        await executor
            .insertInto("sec_user_org_unit")
            .values(orgUnits.map((orgUnit) => ({ assigned_at_user_org_unit: now, assigned_by_user_id_user_org_unit: actorUserId, membership_code_user_org_unit: membership, org_unit_id_user_org_unit: orgUnit.id, revoked_at_user_org_unit: null, revoked_by_user_id_user_org_unit: null, scope_code_user_org_unit: scope, status_user_org_unit: ACTIVE_STATUS, user_id_user_org_unit: userId })))
            .execute();
    }

    private async replaceUserPermissionOverrides({ actorUserId, executor, now, overrides, permissions, reason, userId }: UserPermissionOverrideReplacementContext): Promise<void> {
        await executor.updateTable("sec_user_permission_override").set({ revoked_at_user_permission_override: now, revoked_by_user_id_user_permission_override: actorUserId, status_user_permission_override: INACTIVE_STATUS }).where("user_id_user_permission_override", "=", userId).where("status_user_permission_override", "=", ACTIVE_STATUS).executeTakeFirst();

        if (overrides.length === 0) {
            return;
        }

        const permissionIdByCode = new Map(permissions.map((permission) => [permission.code, permission.id]));
        await executor
            .insertInto("sec_user_permission_override")
            .values(
                overrides.map((override) => ({
                    created_at_user_permission_override: now,
                    created_by_user_id_user_permission_override: actorUserId,
                    effect_user_permission_override: override.effect,
                    ends_at_user_permission_override: null,
                    permission_id_user_permission_override: permissionIdByCode.get(override.code) as number,
                    reason_user_permission_override: reason,
                    revoked_at_user_permission_override: null,
                    revoked_by_user_id_user_permission_override: null,
                    starts_at_user_permission_override: now,
                    status_user_permission_override: ACTIVE_STATUS,
                    user_id_user_permission_override: userId,
                })),
            )
            .execute();
    }

    /** Organizational membership implied by roles: general head leads, area sub-head assists, anyone else is a member. */
    private resolveMembershipForRoleCodes(roleCodes: readonly string[]): string {
        if (roleCodes.includes("jefe_general")) {
            return "leader";
        }

        if (roleCodes.includes("subjefe_area")) {
            return "assistant_leader";
        }

        return "member";
    }

    /** Area scope implied by roles: owner sees all areas, heads see their area and its children. */
    private resolveScopeForRoleCodes(roleCodes: readonly string[]): string {
        if (roleCodes.includes("owner")) {
            return "all_areas";
        }

        if (roleCodes.includes("jefe_general") || roleCodes.includes("subjefe_area")) {
            return "own_area_and_children";
        }

        return "self";
    }

    private async findActiveRolePermissions(executor: AccessManagementExecutor, roleId: number): Promise<Array<{ code: string; id: number; moduleCode: string }>> {
        return executor
            .selectFrom("sec_role_permission as rolePermission")
            .innerJoin("sec_permission as permission", "permission.id_permission", "rolePermission.permission_id_role_permission")
            .select(["permission.code_permission as code", "permission.id_permission as id", "permission.module_code_permission as moduleCode"])
            .where("rolePermission.role_id_role_permission", "=", roleId)
            .where("rolePermission.status_role_permission", "=", ACTIVE_STATUS)
            .where("permission.status_permission", "=", ACTIVE_STATUS)
            .execute();
    }

    private async findRoleRowByCode(executor: AccessManagementExecutor, code: string, lock = false): Promise<RoleRow | null> {
        const role = await executor
            .selectFrom("sec_role")
            .select(["code_role as code", "description_role as description", "id_role as id", "name_role as name", "status_role as status", "permission_inheritance_mode_role as permissionInheritance"])
            .where("code_role", "=", code)
            .where("deleted_at_role", "is", null)
            .$if(lock, (query) => query.forUpdate())
            .executeTakeFirst();

        return role ?? null;
    }

    private async readRoleAuditSnapshot(executor: AccessManagementExecutor, role: RoleRow): Promise<Record<string, unknown>> {
        const permissions = await this.findActiveRolePermissions(executor, role.id);
        return { ...this.mapRole(role), ...(await this.rolePolicy(executor, role)), deleted: false, permissionCodes: permissions.map((permission) => permission.code).sort() };
    }

    /** Inactive mapping rows retain the ceiling when its last active module is removed. */
    private async rolePolicy(executor: AccessManagementExecutor, role: RoleRow) {
        const rows = await executor.selectFrom("sec_role_module as mapping").innerJoin("sec_org_unit as unit", "unit.id_org_unit", "mapping.org_unit_id_role_module").select(["unit.code_org_unit as code", "mapping.status_role_module as status", "unit.status_org_unit as unitStatus", "unit.deleted_at_org_unit as deletedAt"]).where("mapping.role_id_role_module", "=", role.id).execute();
        return {
            moduleCodes: rows
                .filter((row) => row.status === ACTIVE_STATUS && row.unitStatus === ACTIVE_STATUS && row.deletedAt === null)
                .map((row) => row.code)
                .sort(),
            moduleScoped: rows.length > 0,
            permissionInheritance: role.permissionInheritance,
        };
    }

    private async applyRolePolicyUpdate(executor: AccessManagementExecutor, role: RoleRow, input: UpdateIdentityRoleInput, now: Date) {
        this.assertRolePolicyUpdate(role, input);
        if (input.moduleCodes !== undefined) {
            this.assertOperationalTemplateModules(role, input.moduleCodes);
            await this.replaceRoleModules(executor, role.id, input.moduleCodes, now);
        }
        return this.rolePolicy(executor, { ...role, permissionInheritance: input.permissionInheritance ?? role.permissionInheritance });
    }

    private assertRolePolicyUpdate(role: RoleRow, input: UpdateIdentityRoleInput): void {
        if (role.code === "owner" && (input.moduleCodes !== undefined || input.permissionInheritance !== undefined)) throw new ConflictException("La politica base de este rol esta protegida.");
        if (role.code === "jefe_general" && ![undefined, role.permissionInheritance].includes(input.permissionInheritance)) throw new ConflictException("La politica selected_modules de Jefe General no se puede cambiar.");
        if (input.permissionInheritance === "selected_modules" && role.code !== "jefe_general") throw new BadRequestException("La herencia dinamica corresponde a Jefe General.");
    }

    private async assertRolePermissionReplacement(executor: AccessManagementExecutor, role: RoleRow, permissions: readonly { moduleCode: string }[]): Promise<void> {
        if (role.code === "owner") throw new ConflictException("La matriz base de este rol esta protegida.");
        this.assertOperationalTemplateModules(
            role,
            permissions.map((permission) => normalizePermissionModule(permission.moduleCode)),
        );
        const policy = await this.rolePolicy(executor, role);
        if (!policy.moduleScoped && policy.permissionInheritance !== "selected_modules") return;
        const allowed = new Set(permissionModuleCodes(policy.moduleCodes));
        if (permissions.some((permission) => !allowed.has(permission.moduleCode))) throw new BadRequestException("Permisos fuera de los modulos del rol.");
    }

    private async roleBasePermissions(executor: AccessManagementExecutor, role: RoleRow, policy: { moduleCodes: string[]; moduleScoped: boolean; permissionInheritance: string }) {
        if (role.code === "owner") return executor.selectFrom("sec_permission").select(["code_permission as code", "module_code_permission as moduleCode"]).where("status_permission", "=", ACTIVE_STATUS).execute();
        const permissions = await this.findActiveRolePermissions(executor, role.id);
        const allowed = new Set(permissionModuleCodes(policy.moduleCodes));
        const scoped = policy.moduleScoped || policy.permissionInheritance === "selected_modules";
        const operational = new Set<string>(OPERATIONAL_MODULE_CODES);
        return permissions.filter((permission) => (!scoped || allowed.has(permission.moduleCode)) && (policy.permissionInheritance !== "selected_modules" || operational.has(permission.moduleCode)));
    }

    private assertOperationalTemplateModules(role: RoleRow, codes: readonly string[]): void {
        if (role.code !== "jefe_general") return;
        const operational = new Set<string>(OPERATIONAL_MODULE_CODES);
        if (codes.some((code) => !operational.has(code.trim().toLowerCase()))) throw new BadRequestException("La plantilla Jefe General solo admite modulos y permisos operativos.");
    }

    /** Lock actor authority before ordinary reads so revoked ownership/denies cannot be hidden by an older snapshot. */
    private async assertGeneralTemplateOwner(executor: AccessManagementExecutor, role: RoleRow, input: { actorPublicId: string; actorProfile?: IdentityProfile }): Promise<void> {
        if (role.code !== "jefe_general") return;
        const profile = input.actorProfile;
        if (!profile || profile.user.publicId.toLowerCase() !== input.actorPublicId.toLowerCase()) throw new ForbiddenException("Se requiere el perfil autenticado de Owner.");
        const actor = await executor.selectFrom("sec_user").select(["id_user as id", "status_user as status", "permission_version_user as permissionVersion"]).where("public_id_user", "=", input.actorPublicId).where("deleted_at_user", "is", null).forUpdate().executeTakeFirst();
        if (!actor || actor.status !== ACTIVE_STATUS || actor.permissionVersion !== profile.user.permissionVersion) throw new ForbiddenException("La autoridad del actor cambio.");
        const owner = await executor
            .selectFrom("sec_user_role as assignment")
            .innerJoin("sec_role as actorRole", "actorRole.id_role", "assignment.role_id_user_role")
            .select("actorRole.id_role")
            .where("assignment.user_id_user_role", "=", actor.id)
            .where("assignment.status_user_role", "=", ACTIVE_STATUS)
            .where("assignment.revoked_at_user_role", "is", null)
            .where("actorRole.code_role", "=", "owner")
            .where("actorRole.status_role", "=", ACTIVE_STATUS)
            .where("actorRole.deleted_at_role", "is", null)
            .forUpdate()
            .executeTakeFirst();
        if (!owner) throw new ForbiddenException("Solo Owner puede editar la plantilla Jefe General.");
        await this.assertLiveRoleAssignmentPermission(executor, actor.id);
    }

    private async assertLiveRoleAssignmentPermission(executor: AccessManagementExecutor, actorId: number): Promise<void> {
        const permission = await executor.selectFrom("sec_permission").select("id_permission").where("code_permission", "=", "role.assign").where("status_permission", "=", ACTIVE_STATUS).executeTakeFirst();
        if (!permission) throw new ForbiddenException("Permiso role.assign no disponible.");
        const now = new Date();
        const deny = await executor
            .selectFrom("sec_user_permission_override as override")
            .innerJoin("sec_permission as permission", "permission.id_permission", "override.permission_id_user_permission_override")
            .select("permission.id_permission")
            .where("override.user_id_user_permission_override", "=", actorId)
            .where("permission.code_permission", "=", "role.assign")
            .where("permission.status_permission", "=", ACTIVE_STATUS)
            .where("override.effect_user_permission_override", "=", "deny")
            .where("override.status_user_permission_override", "=", ACTIVE_STATUS)
            .where("override.revoked_at_user_permission_override", "is", null)
            .where("override.starts_at_user_permission_override", "<=", now)
            .where((expression) => expression.or([expression("override.ends_at_user_permission_override", "is", null), expression("override.ends_at_user_permission_override", ">", now)]))
            .executeTakeFirst();
        if (deny) throw new ForbiddenException("role.assign esta denegado para el actor.");
    }

    private async replaceRoleModules(executor: AccessManagementExecutor, roleId: number, moduleCodes: readonly string[], now: Date): Promise<void> {
        const codes = [...new Set(moduleCodes.map((code) => code.trim().toLowerCase()))].sort();
        if (codes.length === 0) {
            const existing = await executor.selectFrom("sec_role_module").select("role_id_role_module").where("role_id_role_module", "=", roleId).executeTakeFirst();
            if (!existing) throw new BadRequestException("No se puede vaciar un techo de modulos que nunca fue definido.");
        }
        const units = await this.findActiveOrgUnitsByCode(executor, codes);
        if (units.length !== codes.length) throw new BadRequestException("Modulo del rol no disponible.");
        await executor.updateTable("sec_role_module").set({ status_role_module: INACTIVE_STATUS, updated_at_role_module: now }).where("role_id_role_module", "=", roleId).execute();
        if (units.length)
            await executor
                .insertInto("sec_role_module")
                .values(units.map((unit) => ({ role_id_role_module: roleId, org_unit_id_role_module: unit.id, status_role_module: ACTIVE_STATUS, created_at_role_module: now, updated_at_role_module: now })))
                .onDuplicateKeyUpdate({ status_role_module: ACTIVE_STATUS, updated_at_role_module: now })
                .execute();
    }

    /** Delegation is bounded by live effective authority; deny wins even over a role grant. */
    // The executor keeps writer revalidation on the same locked transaction as assignment.
    // eslint-disable-next-line max-params
    async assertDelegableAccess(profile: IdentityProfile, roleCodes: readonly string[], moduleCodes: readonly string[], overrides: readonly PermissionOverrideRow[], executor: AccessManagementExecutor = this.database.db): Promise<void> {
        await this.assertGeneralOperationalCeiling(roleCodes, moduleCodes, overrides, executor);
        if (profile.roles.some((role) => role.code === "owner" && role.status === ACTIVE_STATUS)) return;
        const ownRoles = new Set(profile.roles.filter((role) => role.status === ACTIVE_STATUS).map((role) => role.code));
        const ownModules = new Set(profile.orgUnits.filter((unit) => unit.status === ACTIVE_STATUS).map((unit) => unit.code));
        /** Effective permission check where any deny wins over allow. */
        const can = (code: string) => profile.permissions.some((permission) => permission.code === code && permission.effect === "allow") && !profile.permissions.some((permission) => permission.code === code && permission.effect === "deny");
        const outsideAuthority = [roleCodes.some((code) => code === "owner" || !ownRoles.has(code)), moduleCodes.some((code) => !ownModules.has(code)), overrides.some((override) => override.effect === "allow" && !can(override.code))].includes(true);
        if (outsideAuthority) throw new ForbiddenException("No puedes delegar acceso fuera de tu autoridad efectiva.");
        const selected = new Set(moduleCodes);
        for (const code of roleCodes) {
            const base = await this.readRolePermissions(code, executor);
            const definitions = await this.findActivePermissionsByCode(executor, base.permissionCodes);
            if (definitions.length !== base.permissionCodes.length) throw new ForbiddenException("La autoridad del rol no esta disponible.");
            const permissions = definitions.filter((permission) => (!base.role.moduleScoped && base.role.permissionInheritance !== "selected_modules") || selected.has(normalizePermissionModule(permission.moduleCode))).map((permission) => permission.code);
            if (permissions.some((permission) => !can(permission))) throw new ForbiddenException("El rol concede permisos fuera de tu autoridad efectiva.");
        }
    }

    private async assertGeneralOperationalCeiling(roleCodes: readonly string[], moduleCodes: readonly string[], overrides: readonly PermissionOverrideRow[], executor: AccessManagementExecutor): Promise<void> {
        const roles = roleCodes.map((code) => code.trim().toLowerCase());
        if (roles.includes("owner") || !roles.includes("jefe_general")) return;
        const operational = new Set<string>(OPERATIONAL_MODULE_CODES);
        if (moduleCodes.some((code) => !operational.has(code.trim().toLowerCase()))) throw new ForbiddenException("Jefe General solo admite modulos operativos.");
        const allows = overrides.filter((override) => override.effect === "allow");
        const permissions = await this.findActivePermissionsByCode(
            executor,
            allows.map((override) => override.code),
        );
        if (permissions.length !== allows.length || permissions.some((permission) => !operational.has(normalizePermissionModule(permission.moduleCode)))) throw new ForbiddenException("Jefe General no admite permisos administrativos directos.");
    }

    /** Runs before snapshot reads; role policy/grant writers lock these same rows. */
    async validateAssignmentInTransaction(executor: AccessManagementExecutor, input: { profile: IdentityProfile; roleCodes: readonly string[]; moduleCodes: readonly string[]; overrides?: readonly PermissionOverrideRow[]; userPublicId?: string; validateAssignments?: boolean }): Promise<void> {
        const roles = [...new Set(input.roleCodes.map((code) => code.trim().toLowerCase()))].sort();
        const locked = await executor.selectFrom("sec_role").select("id_role").where("code_role", "in", roles).where("status_role", "=", ACTIVE_STATUS).where("deleted_at_role", "is", null).orderBy("id_role", "asc").forUpdate().execute();
        if (locked.length !== roles.length) throw new ForbiddenException("Los roles seleccionados ya no estan disponibles.");
        const actor = await executor.selectFrom("sec_user").select(["permission_version_user as permissionVersion", "status_user as status"]).where("public_id_user", "=", input.profile.user.publicId).where("deleted_at_user", "is", null).forUpdate().executeTakeFirst();
        if (!actor || actor.status !== ACTIVE_STATUS || actor.permissionVersion !== input.profile.user.permissionVersion) throw new ForbiddenException("La autoridad del actor cambio; vuelve a consultar tu sesion.");
        if (input.validateAssignments === false) return;
        const overrides = input.overrides ?? (input.userPublicId ? (await this.readUserAccess(input.userPublicId, executor)).permissionOverrides : []);
        await this.assertDelegableAccess(input.profile, roles, input.moduleCodes, overrides, executor);
    }

    /** Keep provider credentials and external metadata outside the business audit projection. */
    private async readUserAuditSnapshot(executor: AccessManagementExecutor, user: UserRow, access: IdentityUserAccessSummary): Promise<Record<string, unknown>> {
        const accessMethods = await executor.selectFrom("sec_auth_identity").select(["provider_code_auth_identity as code", "status_auth_identity as status"]).where("user_id_auth_identity", "=", user.id).where("deleted_at_auth_identity", "is", null).orderBy("provider_code_auth_identity").execute();
        const externalReferences = await executor
            .selectFrom("int_user_external_identity as reference")
            .innerJoin("int_external_system as system", "system.id_external_system", "reference.external_system_id_user_external_identity")
            .select(["system.code_external_system as systemCode", "reference.external_user_id_user_external_identity as externalUserId", "reference.external_username_user_external_identity as externalUsername", "reference.status_user_external_identity as status"])
            .where("reference.user_id_user_external_identity", "=", user.id)
            .where("reference.deleted_at_user_external_identity", "is", null)
            .orderBy("system.code_external_system")
            .orderBy("reference.external_user_id_user_external_identity")
            .execute();
        return { name: access.user.name, email: access.user.email, status: access.user.status, roleCodes: access.roles.map(({ code }) => code).sort(), orgUnitCodes: access.orgUnits.map(({ code }) => code).sort(), permissionOverrides: [...access.permissionOverrides].sort((a, b) => a.code.localeCompare(b.code)), accessMethods, externalReferences };
    }

    /** Reduces a role row to its public catalog shape. */
    private mapRole(role: Pick<RoleRow, "code" | "description" | "name" | "status">): IdentityRoleCatalogItem {
        return {
            code: role.code,
            description: role.description,
            name: role.name,
            status: role.status,
        };
    }

    private async readRecentSecurityAuditEvents(): Promise<IdentitySecurityAuditItem[]> {
        const rows = (await this.database.db
            .selectFrom("audit_security_event as event")
            .leftJoin("sec_user as actor", "actor.id_user", "event.actor_user_id_security_event")
            .leftJoin("sec_user as target", "target.id_user", "event.target_user_id_security_event")
            .select(["actor.display_name_user as actorName", "event.created_at_security_event as createdAt", "event.event_type_security_event as eventType", "event.metadata_security_event as metadata", "event.public_id_security_event as publicId", "event.reason_security_event as reason", "event.summary_security_event as summary", "target.display_name_user as targetName"])
            .where("event.event_type_security_event", "in", ["role_updated", "role_permissions_replaced", "user_access_replaced"])
            .orderBy("event.created_at_security_event", "desc")
            .limit(25)
            .execute()) as SecurityAuditRow[];

        return rows.map((row) => {
            const metadata = this.parseAuditMetadata(row.metadata);

            return {
                actorName: row.actorName,
                createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : new Date(row.createdAt).toISOString(),
                eventType: row.eventType,
                moduleCodes: this.extractAuditModuleCodes(metadata),
                publicId: row.publicId,
                reason: row.reason,
                roleCode: this.extractAuditRoleCode(metadata),
                summary: row.summary,
                targetName: row.targetName,
            };
        });
    }

    /** Groups flat permission rows into module -> view -> permission for the UI. */
    private mapPermissionCatalog(permissions: readonly PermissionCatalogRow[]): IdentityModuleCatalogItem[] {
        const modules = new Map<string, Map<string, IdentityModuleViewCatalogItem & { permissions: IdentityPermissionCatalogItem[] }>>();

        for (const permission of permissions) {
            if (permission.code === "mercadeo.appointments.read") continue;
            const viewCode = this.resolvePermissionViewCode(permission.code, permission.moduleCode);
            const moduleViews = modules.get(permission.moduleCode) ?? new Map<string, IdentityModuleViewCatalogItem & { permissions: IdentityPermissionCatalogItem[] }>();
            const view = moduleViews.get(viewCode) ?? {
                code: viewCode,
                name: permission.moduleCode === "formalizacion" && viewCode === "home" ? "Pantalla de inicio" : this.resolvePermissionViewName(viewCode),
                permissions: [],
            };

            view.permissions.push({
                code: permission.code,
                description: permission.description ?? "Permiso operativo del modulo.",
                name: this.resolvePermissionName(permission.code, permission.actionCode),
                sensitive: this.isSensitivePermission(permission.code),
            });
            moduleViews.set(viewCode, view);
            modules.set(permission.moduleCode, moduleViews);
        }

        const moduleViewOrder: Record<string, Readonly<Record<string, number>>> = { formalizacion: { home: 0, sales_order: 1 }, mercadeo: { home: 0, leads: 1, calendar: 2 } };
        return [...modules.entries()].map(([moduleCode, views]) => {
            const orderedViews = [...views.values()];
            const order = moduleViewOrder[moduleCode];
            if (order) orderedViews.sort((left, right) => (order[left.code] ?? Object.keys(order).length) - (order[right.code] ?? Object.keys(order).length));
            return { code: moduleCode, name: this.resolveModuleName(moduleCode), views: orderedViews };
        });
    }

    /** Display name of a module; unknown codes fall back to the code itself. */
    private resolveModuleName(moduleCode: string): string {
        const catalogDefinition = findCatalogDefinitionByModuleCode(moduleCode);
        if (catalogDefinition) {
            return catalogDefinition.label;
        }

        const names: Record<string, string> = {
            administration: "Administracion",
            contabilidad: "Contabilidad",
            formalizacion: "Formalizacion",
            mercadeo: "Mercadeo",
            org: "Organizacion",
            role: "Roles y seguridad",
            user: "Usuarios",
            ventas: "Ventas",
        };

        return names[moduleCode] ?? moduleCode;
    }

    /** Decides which view a permission belongs to, keeping existing permission codes unchanged. */
    private resolvePermissionViewCode(permissionCode: string, moduleCode: string): string {
        const parts = permissionCode.split(".");
        if (/^(?:[^.]+\.notes\.|formalizacion\.home\.|mercadeo\.(?:home|leads|calendar)\.read$)/u.test(permissionCode)) return parts[1] as string;
        // One order workspace, preserving the exact existing permission codes and grants.
        if (moduleCode === "formalizacion" && /^(contract\.|file\.|signature\.|formalizacion\.(?:contracts|orders)\.)/u.test(permissionCode)) return "sales_order";

        return parts.length >= 3 && findCatalogDefinitionByModuleCode(parts[1] ?? "") ? (parts[1] as string) : (parts[0] ?? permissionCode);
    }

    /** Audit metadata is stored as JSON text; anything that is not a plain object is treated as empty. */
    private parseAuditMetadata(metadata: string | null): Record<string, unknown> {
        if (!metadata) {
            return {};
        }

        try {
            const parsed = JSON.parse(metadata) as unknown;

            return typeof parsed === "object" && parsed !== null && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : {};
        } catch {
            return {};
        }
    }

    /** Role code(s) mentioned by an audit event. */
    private extractAuditRoleCode(metadata: Record<string, unknown>): string | null {
        if (typeof metadata.roleCode === "string") {
            return metadata.roleCode;
        }

        const nextRoleCodes = metadata.nextRoleCodes;

        if (Array.isArray(nextRoleCodes) && nextRoleCodes.every((code): code is string => typeof code === "string")) {
            return nextRoleCodes.join(", ");
        }

        return null;
    }

    /** Modules touched by an audit event, from its unit and permission changes; hidden modules are dropped. */
    private extractAuditModuleCodes(metadata: Record<string, unknown>): readonly string[] {
        const moduleCodes = new Set<string>();

        for (const key of ["nextOrgUnitCodes", "previousOrgUnitCodes"]) {
            const value = metadata[key];

            if (Array.isArray(value)) {
                value.filter((code): code is string => typeof code === "string").forEach((code) => moduleCodes.add(code));
            }
        }

        for (const key of ["nextPermissionCodes", "previousPermissionCodes"]) {
            const value = metadata[key];

            if (Array.isArray(value)) {
                value
                    .filter((code): code is string => typeof code === "string")
                    .map((code) => this.resolveModuleCodeForPermissionCode(code))
                    .forEach((code) => moduleCodes.add(code));
            }
        }

        return [...moduleCodes].filter((code) => this.isVisibleSecurityModule(code)).sort();
    }

    /** Only modules in the visible list are shown in security screens. */
    private isVisibleSecurityModule(moduleCode: string): boolean {
        return VISIBLE_SECURITY_MODULE_CODES.includes(moduleCode as (typeof VISIBLE_SECURITY_MODULE_CODES)[number]);
    }

    /** Module a permission code belongs to, from its prefix. */
    private resolveModuleCodeForPermissionCode(permissionCode: string): string {
        const prefix = permissionCode.split(".")[0] ?? permissionCode;
        if (this.isVisibleSecurityModule(prefix)) {
            return prefix;
        }

        const moduleByPrefix: Record<string, string> = {
            campaign: "mercadeo",
            contract: "formalizacion",
            estimate: "ventas",
            file: "formalizacion",
            invoice: "contabilidad",
            lead: "ventas",
            opportunity: "ventas",
            payment: "contabilidad",
            role: "role",
            signature: "formalizacion",
            source: "mercadeo",
            user: "user",
            wallet: "contabilidad",
        };

        return moduleByPrefix[prefix] ?? prefix;
    }

    /** Display name of a view. */
    private resolvePermissionViewName(viewCode: string): string {
        const catalogDefinition = findCatalogDefinitionByModuleCode(viewCode);
        if (catalogDefinition) {
            return catalogDefinition.label;
        }

        const names: Record<string, string> = {
            campaign: "Campanas",
            notes: "Notas",
            leads: "Captación de leads",
            reports: "Informes",
            calendar: "Calendario",
            home: "Inicio",
            contract: "Contratos",
            estimate: "Estimaciones",
            file: "Expedientes",
            invoice: "Facturas",
            lead: "Leads",
            opportunity: "Oportunidades",
            org: "Organizacion",
            payment: "Pagos",
            role: "Roles",
            signature: "Firmas",
            sales_order: "Orden de venta",
            source: "Fuentes",
            user: "Usuarios",
            wallet: "Cartera",
        };

        return names[viewCode] ?? viewCode;
    }

    /** Display name of a permission; catalog permissions use the standard action wording. */
    private resolvePermissionName(permissionCode: string, actionCode: string): string {
        if (permissionCode.split(".")[1] === "notes") return ({ read: "Ver notas", create: "Crear notas", edit_own: "Editar notas propias", resolve_own: "Completar y reabrir notas propias", archive_own: "Archivar notas propias" } as Record<string, string>)[actionCode] ?? permissionCode;
        const parts = permissionCode.split(".");
        const catalogModuleCode = parts.length >= 3 ? parts[1] : parts[0];
        const catalogDefinition = catalogModuleCode ? findCatalogDefinitionByModuleCode(catalogModuleCode) : undefined;
        if (catalogDefinition && this.isCatalogPermissionAction(actionCode)) {
            return getCatalogPermissionName(catalogDefinition, actionCode);
        }

        const names: Record<string, string> = {
            "campaign.create": "Crear campana",
            "mercadeo.home.read": "Ver Inicio",
            "mercadeo.reports.read_all": "Consultar todos los vendedores de Mercadeo",
            "mercadeo.leads.read": "Ver Captación de leads",
            "mercadeo.calendar.read": "Ver Calendario",
            "formalizacion.home.approvals.read": "Banner pendiente de aprobaci\u00f3n de Formalizaci\u00f3n",
            "formalizacion.home.stages.read": "Banners de etapas de Formalizaci\u00f3n",
            "formalizacion.home.contracts.read": "Ver contratos de Formalización",
            "formalizacion.home.banking.read": "Ver gestión bancaria de Formalización",
            "formalizacion.home.balance.read": "Ver pendientes de saldo de Formalización",
            "formalizacion.home.transfer_pending.read": "Ver traspasos pendientes de Formalización",
            "formalizacion.home.transfer_signed.read": "Ver traspasos firmados de Formalización",
            "formalizacion.home.closed.read": "Ver cierres anuales de Formalización",
            "formalizacion.orders.approve": "Aprobar Formalización",
            "formalizacion.orders.read": "Ver orden de venta",
            "formalizacion.contracts.send": "Registrar envio de contrato",
            "formalizacion.contracts.revert": "Revertir envio de contrato",
            "formalizacion.orders.stage.pending_approval": "Devolver a pendientes de aprobación",
            "formalizacion.orders.stage.contract_pending_send": "Pasar a Por enviar",
            "formalizacion.orders.stage.contract_pending_signature": "Pasar a Pendiente de firma",
            "formalizacion.orders.stage.bank_management": "Pasar a Gestión bancaria",
            "formalizacion.orders.stage.pending_balance": "Pasar a Pendiente de saldo",
            "formalizacion.orders.stage.pending_transfer": "Pasar a Traspaso pendiente",
            "formalizacion.orders.stage.transfer_signed": "Pasar a Traspaso firmado",
            "formalizacion.orders.stage.closed": "Cerrar Formalización",
            "formalizacion.orders.stage.skip": "Saltar etapas de Formalización",
            "formalizacion.orders.stage.update": "Cambiar etapa de Formalizacion",
            "campaign.read": "Ver campanas",
            "contract.review": "Revisar contrato",
            "estimate.approve": "Aprobar estimacion",
            "estimate.create": "Crear estimacion",
            "estimate.read": "Ver estimaciones",
            "file.read": "Ver expedientes",
            "invoice.read": "Ver facturas",
            "lead.assign": "Asignar responsable",
            "lead.create": "Crear lead",
            "lead.read": "Ver lista de leads",
            "lead.status": "Cambiar estado",
            "lead.update": "Editar lead",
            "org.manage": "Administrar organizacion",
            "opportunity.close": "Cerrar oportunidad",
            "opportunity.create": "Crear oportunidad",
            "opportunity.read": "Ver oportunidades",
            "payment.reconcile": "Conciliar pago",
            "role.assign": "Administrar roles",
            "signature.manage": "Gestionar firmas",
            "source.update": "Editar fuentes",
            "user.activate": "Activar usuario",
            "user.create": "Crear usuario",
            "user.assign_password": "Asignar contrase\u00f1a inicial",
            "user.deactivate": "Desactivar usuario",
            "user.update": "Editar usuario",
            "user.view_detail": "Ver detalle de usuario",
            "user.view_list": "Ver lista de usuarios",
            "wallet.read": "Ver cartera",
        };

        return names[permissionCode] ?? actionCode.replace(/_/gu, " ");
    }

    /** Narrows an action code to the standard catalog actions. */
    private isCatalogPermissionAction(actionCode: string): actionCode is CatalogPermissionAction {
        return CATALOG_PERMISSION_ACTIONS.includes(actionCode as CatalogPermissionAction);
    }

    /** Flags approve, inactivate, reconcile and role administration permissions as sensitive in the UI. */
    private isSensitivePermission(permissionCode: string): boolean {
        return permissionCode.includes("approve") || permissionCode.includes("inactivate") || permissionCode.includes("reconcile") || permissionCode === "role.assign" || permissionCode === "user.assign_password" || permissionCode === "formalizacion.orders.stage.update";
    }
}
