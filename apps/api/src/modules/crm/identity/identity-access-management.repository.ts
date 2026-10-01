import { BadRequestException, Inject, Injectable } from "@nestjs/common";
import { type Kysely, sql } from "kysely";

import { DatabaseService } from "../../../database/database.service.js";
import type { CrmDatabase } from "../../../database/database.types.js";
import { SecurityAuditService } from "../audit/security-audit.service.js";
import { ACTIVE_STATUS } from "./identity-repository.shared.js";

const INACTIVE_STATUS = "inactive";
const VISIBLE_SECURITY_MODULE_CODES = ["contabilidad", "formalizacion", "mercadeo", "role", "user", "ventas"] as const;

type AccessManagementExecutor = Pick<Kysely<CrmDatabase>, "insertInto" | "selectFrom" | "updateTable">;

interface ActorRow {
    id: number;
}

interface RoleRow {
    code: string;
    description: string | null;
    id: number;
    name: string;
    status: string;
}

interface CountRow {
    total: string | number | bigint;
}

interface UserRow {
    email: string;
    id: number;
    name: string;
    publicId: string;
    status: string;
}

interface PermissionOverrideRow {
    code: string;
    effect: "allow" | "deny";
}

interface PermissionCatalogRow {
    actionCode: string;
    code: string;
    description: string | null;
    moduleCode: string;
}

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

interface UserRoleReplacementContext {
    actorUserId: number;
    executor: AccessManagementExecutor;
    now: Date;
    roles: readonly { id: number }[];
    userId: number;
}

interface UserOrgUnitReplacementContext {
    actorUserId: number;
    executor: AccessManagementExecutor;
    now: Date;
    orgUnits: readonly { id: number }[];
    roleCodes: readonly string[];
    userId: number;
}

interface UserPermissionOverrideReplacementContext {
    actorUserId: number;
    executor: AccessManagementExecutor;
    now: Date;
    overrides: readonly PermissionOverrideRow[];
    permissions: readonly { code: string; id: number }[];
    reason: string;
    userId: number;
}

export interface IdentityRoleCatalogItem {
    code: string;
    description: string | null;
    locked?: boolean;
    name: string;
    status: string;
    users?: number;
}

export interface IdentityPermissionCatalogItem {
    code: string;
    description: string;
    name: string;
    sensitive: boolean;
}

export interface IdentityModuleViewCatalogItem {
    code: string;
    name: string;
    permissions: readonly IdentityPermissionCatalogItem[];
}

export interface IdentityModuleCatalogItem {
    code: string;
    name: string;
    views: readonly IdentityModuleViewCatalogItem[];
}

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

export interface IdentitySecurityCatalog {
    auditEvents: readonly IdentitySecurityAuditItem[];
    modules: readonly IdentityModuleCatalogItem[];
    rolePermissions: Record<string, readonly string[]>;
    roles: readonly IdentityRoleCatalogItem[];
}

export interface IdentityAccessRoleItem {
    code: string;
    name: string;
    status: string;
}

export interface IdentityAccessOrgUnitItem {
    code: string;
    name: string;
    publicId: string;
}

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

export interface DeleteIdentityRoleInput {
    actorPublicId: string;
    code: string;
    ipAddress?: string | undefined;
    reason?: string | undefined;
    userAgent?: string | undefined;
}

export interface UpdateIdentityRoleInput {
    actorPublicId: string;
    code: string;
    description?: string | undefined;
    ipAddress?: string | undefined;
    name: string;
    reason: string;
    userAgent?: string | undefined;
}

export interface ReplaceIdentityRolePermissionsInput {
    actorPublicId: string;
    code: string;
    ipAddress?: string | undefined;
    permissionCodes: readonly string[];
    reason: string;
    userAgent?: string | undefined;
}

export interface ReplaceIdentityUserAccessInput {
    actorPublicId: string;
    ipAddress?: string | undefined;
    orgUnitCodes: readonly string[];
    permissionOverrides: readonly PermissionOverrideRow[];
    reason: string;
    roleCodes: readonly string[];
    userAgent?: string | undefined;
    userPublicId: string;
}

export interface IdentityRolePermissionsUpdateResult {
    permissionCodes: readonly string[];
    role: IdentityRoleCatalogItem;
}

export type IdentityRolePermissionsReadResult = IdentityRolePermissionsUpdateResult;

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
    ) {}

    /**
     * Lee los roles, modulos y overrides activos de un usuario.
     */
    async readUserAccess(userPublicId: string): Promise<IdentityUserAccessSummary> {
        const user = await this.findUserRowByPublicId(this.database.db, userPublicId);

        if (!user) {
            throw new BadRequestException("Usuario no disponible.");
        }

        return this.readUserAccessByRow(this.database.db, user);
    }

    /**
     * Reemplaza acceso directo de un usuario sin tocar el catalogo base.
     */
    async replaceUserAccess(input: ReplaceIdentityUserAccessInput): Promise<IdentityUserAccessSummary> {
        return this.database.db.transaction().execute(async (transaction) => {
            const actor = await this.readActor(transaction, input.actorPublicId);
            const targetUser = await this.findUserRowByPublicId(transaction, input.userPublicId);

            if (!targetUser) {
                throw new BadRequestException("Usuario no disponible.");
            }

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
            const now = new Date();
            await this.replaceUserRoles({ actorUserId: actor.id, executor: transaction, now, roles, userId: targetUser.id });
            await this.replaceUserOrgUnits({ actorUserId: actor.id, executor: transaction, now, orgUnits, roleCodes: roles.map((role) => role.code), userId: targetUser.id });
            await this.replaceUserPermissionOverrides({ actorUserId: actor.id, executor: transaction, now, overrides, permissions, reason: input.reason, userId: targetUser.id });

            await transaction
                .updateTable("sec_user")
                .set({ permission_version_user: sql<number>`permission_version_user + 1`, updated_at_user: now, updated_by_user_id_user: actor.id })
                .where("id_user", "=", targetUser.id)
                .executeTakeFirst();
            await this.audit.record(
                {
                    actorUserId: actor.id,
                    eventType: "user_access_replaced",
                    ipAddress: input.ipAddress ?? null,
                    metadata: {
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

            return this.readUserAccessByRow(transaction, targetUser);
        });
    }

    /**
     * Desactiva un rol solamente cuando no conserva usuarios activos.
     */
    async deleteRole(input: DeleteIdentityRoleInput): Promise<DeleteIdentityRoleResult> {
        return this.database.db.transaction().execute(async (transaction) => {
            const actor = await this.readActor(transaction, input.actorPublicId);
            const role = await this.findRoleRowByCode(transaction, input.code);

            if (!role) {
                return { status: "not_found" };
            }

            const activeAssignments = await this.countActiveRoleAssignments(transaction, role.id);

            if (activeAssignments > 0) {
                return {
                    activeAssignments,
                    role: this.mapRole(role),
                    status: "in_use",
                };
            }

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
                    actorUserId: actor.id,
                    eventType: "role_deleted",
                    ipAddress: input.ipAddress ?? null,
                    metadata: {
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
     * Actualiza datos visibles del rol y audita el cambio.
     */
    async updateRole(input: UpdateIdentityRoleInput): Promise<IdentityRoleCatalogItem> {
        return this.database.db.transaction().execute(async (transaction) => {
            const actor = await this.readActor(transaction, input.actorPublicId);
            const role = await this.findRoleRowByCode(transaction, input.code);

            if (!role) {
                throw new BadRequestException("Rol no disponible.");
            }

            const now = new Date();

            await transaction
                .updateTable("sec_role")
                .set({
                    description_role: input.description ?? null,
                    name_role: input.name,
                    updated_at_role: now,
                })
                .where("id_role", "=", role.id)
                .executeTakeFirstOrThrow();

            await this.bumpUsersWithRolePermissionVersion(transaction, role.id, now);
            await this.audit.record(
                {
                    actorUserId: actor.id,
                    eventType: "role_updated",
                    ipAddress: input.ipAddress ?? null,
                    metadata: {
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

            return this.mapRole({
                ...role,
                description: input.description ?? null,
                name: input.name,
            });
        });
    }

    /**
     * Reemplaza los permisos activos de un rol usando `sec_role_permission`.
     */
    async replaceRolePermissions(input: ReplaceIdentityRolePermissionsInput): Promise<IdentityRolePermissionsUpdateResult> {
        return this.database.db.transaction().execute(async (transaction) => {
            const actor = await this.readActor(transaction, input.actorPublicId);
            const role = await this.findRoleRowByCode(transaction, input.code);

            if (!role) {
                throw new BadRequestException("Rol no disponible.");
            }

            const permissionCodes = [...new Set(input.permissionCodes)].sort();
            const permissions = await this.findActivePermissionsByCode(transaction, permissionCodes);

            if (permissions.length !== permissionCodes.length) {
                throw new BadRequestException("Uno o más permisos no existen o no están activos.");
            }

            const currentPermissions = await this.findActiveRolePermissions(transaction, role.id);
            const nextPermissionIds = new Set(permissions.map((permission) => permission.id));
            const currentPermissionIds = new Set(currentPermissions.map((permission) => permission.id));
            const removedPermissionIds = currentPermissions.filter((permission) => !nextPermissionIds.has(permission.id)).map((permission) => permission.id);
            const permissionsToInsert = permissions.filter((permission) => !currentPermissionIds.has(permission.id));

            if (removedPermissionIds.length > 0) {
                await transaction.updateTable("sec_role_permission").set({ status_role_permission: INACTIVE_STATUS }).where("role_id_role_permission", "=", role.id).where("permission_id_role_permission", "in", removedPermissionIds).where("status_role_permission", "=", ACTIVE_STATUS).executeTakeFirst();
            }

            const now = new Date();

            if (permissionsToInsert.length > 0) {
                await transaction
                    .insertInto("sec_role_permission")
                    .values(permissionsToInsert.map((permission) => ({ created_at_role_permission: now, permission_id_role_permission: permission.id, role_id_role_permission: role.id, status_role_permission: ACTIVE_STATUS })))
                    .execute();
            }

            await this.bumpUsersWithRolePermissionVersion(transaction, role.id, now);
            await this.audit.record(
                {
                    actorUserId: actor.id,
                    eventType: "role_permissions_replaced",
                    ipAddress: input.ipAddress ?? null,
                    metadata: {
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
                role: this.mapRole(role),
            };
        });
    }

    /**
     * Lee los permisos activos de un rol desde base de datos.
     */
    async readRolePermissions(roleCode: string): Promise<IdentityRolePermissionsReadResult> {
        const role = await this.findRoleRowByCode(this.database.db, roleCode);

        if (!role) {
            throw new BadRequestException("Rol no disponible.");
        }

        const permissions = await this.findActiveRolePermissions(this.database.db, role.id);

        return {
            permissionCodes: permissions.map((permission) => permission.code).sort(),
            role: this.mapRole(role),
        };
    }

    /**
     * Devuelve la matriz operativa persistida: roles, modulos, acciones y auditoria.
     */
    async readSecurityCatalog(): Promise<IdentitySecurityCatalog> {
        const roles = await this.database.db.selectFrom("sec_role").select(["code_role as code", "description_role as description", "id_role as id", "name_role as name", "status_role as status"]).where("status_role", "=", ACTIVE_STATUS).where("deleted_at_role", "is", null).orderBy("id_role", "asc").execute();
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
                const activePermissions = await this.findActiveRolePermissions(this.database.db, role.id);

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

    private async findUserRowByPublicId(executor: AccessManagementExecutor, publicId: string): Promise<UserRow | null> {
        const user = await executor.selectFrom("sec_user").select(["display_name_user as name", "email_user as email", "id_user as id", "public_id_user as publicId", "status_user as status"]).where("public_id_user", "=", publicId).where("deleted_at_user", "is", null).executeTakeFirst();

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

    private async findActivePermissionsByCode(executor: AccessManagementExecutor, codes: readonly string[]): Promise<Array<{ code: string; id: number }>> {
        if (codes.length === 0) {
            return [];
        }

        return executor
            .selectFrom("sec_permission")
            .select(["code_permission as code", "id_permission as id"])
            .where("code_permission", "in", [...codes])
            .where("status_permission", "=", ACTIVE_STATUS)
            .execute();
    }

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

    private resolveMembershipForRoleCodes(roleCodes: readonly string[]): string {
        if (roleCodes.includes("jefe_general")) {
            return "leader";
        }

        if (roleCodes.includes("subjefe_area")) {
            return "assistant_leader";
        }

        return "member";
    }

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

    private async findRoleRowByCode(executor: AccessManagementExecutor, code: string): Promise<RoleRow | null> {
        const role = await executor.selectFrom("sec_role").select(["code_role as code", "description_role as description", "id_role as id", "name_role as name", "status_role as status"]).where("code_role", "=", code).where("deleted_at_role", "is", null).executeTakeFirst();

        return role ?? null;
    }

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

    private mapPermissionCatalog(permissions: readonly PermissionCatalogRow[]): IdentityModuleCatalogItem[] {
        const modules = new Map<string, Map<string, IdentityModuleViewCatalogItem & { permissions: IdentityPermissionCatalogItem[] }>>();

        for (const permission of permissions) {
            const viewCode = this.resolvePermissionViewCode(permission.code);
            const moduleViews = modules.get(permission.moduleCode) ?? new Map<string, IdentityModuleViewCatalogItem & { permissions: IdentityPermissionCatalogItem[] }>();
            const view = moduleViews.get(viewCode) ?? {
                code: viewCode,
                name: this.resolvePermissionViewName(viewCode),
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

        return [...modules.entries()].map(([moduleCode, views]) => ({
            code: moduleCode,
            name: this.resolveModuleName(moduleCode),
            views: [...views.values()],
        }));
    }

    private resolveModuleName(moduleCode: string): string {
        const names: Record<string, string> = {
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

    private resolvePermissionViewCode(permissionCode: string): string {
        return permissionCode.split(".")[0] ?? permissionCode;
    }

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

    private isVisibleSecurityModule(moduleCode: string): boolean {
        return VISIBLE_SECURITY_MODULE_CODES.includes(moduleCode as (typeof VISIBLE_SECURITY_MODULE_CODES)[number]);
    }

    private resolveModuleCodeForPermissionCode(permissionCode: string): string {
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
        const prefix = permissionCode.split(".")[0] ?? permissionCode;

        return moduleByPrefix[prefix] ?? prefix;
    }

    private resolvePermissionViewName(viewCode: string): string {
        const names: Record<string, string> = {
            campaign: "Campanas",
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
            source: "Fuentes",
            user: "Usuarios",
            wallet: "Cartera",
        };

        return names[viewCode] ?? viewCode;
    }

    private resolvePermissionName(permissionCode: string, actionCode: string): string {
        const names: Record<string, string> = {
            "campaign.create": "Crear campana",
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
            "user.deactivate": "Desactivar usuario",
            "user.update": "Editar usuario",
            "user.view_detail": "Ver detalle de usuario",
            "user.view_list": "Ver lista de usuarios",
            "wallet.read": "Ver cartera",
        };

        return names[permissionCode] ?? actionCode.replace(/_/gu, " ");
    }

    private isSensitivePermission(permissionCode: string): boolean {
        return permissionCode.includes("approve") || permissionCode.includes("reconcile") || permissionCode === "role.assign";
    }
}
