import { ConflictException, ForbiddenException, Inject, Injectable, NotFoundException } from "@nestjs/common";

import { normalizeCaseInsensitiveIdentifier } from "../../../common/security/identifier-normalization.js";
import { getCatalogPermissionCodesForContext } from "../catalogs/catalogs.constants.js";
import type { ReplaceIdentityRolePermissionsDto, ReplaceIdentityUserAccessDto, UpdateIdentityRoleDto } from "./dto/access-management.dto.js";
import { IdentityService } from "./identity.service.js";
import type { IdentityProfile } from "./identity.types.js";
import { IdentityAccessManagementRepository, type IdentityRoleCatalogItem, type IdentitySecurityCatalog } from "./identity-access-management.repository.js";

const OWNER_ROLE_CODE = "owner";
const ROLE_ASSIGN_PERMISSION = "role.assign";
const ADMINISTRATION_PERMISSION_CODES = new Set(["org.manage", "role.assign", "user.activate", "user.create", "user.deactivate", "user.update", "user.view_detail", "user.view_list", ...getCatalogPermissionCodesForContext("administration")]);

/** Role-level request: payload plus the role and network metadata for the audit. */
interface AccessRequestContext<TPayload> {
    ipAddress?: string | undefined;
    payload: TPayload;
    roleCode: string;
    userAgent?: string | undefined;
}

/** User-level request: payload plus network metadata for the audit. */
interface UserAccessRequestContext<TPayload> {
    ipAddress?: string | undefined;
    payload: TPayload;
    userAgent?: string | undefined;
    userPublicId: string;
}

/**
 * Casos de uso para administrar catalogos de roles y modulos operativos.
 */
@Injectable()
export class IdentityAccessManagementService {
    /**
     * Inyecta identidad para validar sesion/permisos y el repositorio de catalogos.
     */
    constructor(
        @Inject(IdentityService) private readonly identity: IdentityService,
        @Inject(IdentityAccessManagementRepository) private readonly repository: IdentityAccessManagementRepository,
    ) {}

    /**
     * Actualiza nombre y politica opcional sin modificar el codigo estable del rol.
     */
    async updateRole(sessionToken: string | undefined, context: AccessRequestContext<UpdateIdentityRoleDto>): Promise<IdentityRoleCatalogItem> {
        const profile = await this.identity.getCurrentUser(sessionToken);
        this.assertCan(profile, ROLE_ASSIGN_PERMISSION);

        const roleCode = context.roleCode.trim().toLowerCase();
        this.assertTemplateEditor(profile, roleCode, context.payload);

        return this.repository.updateRole({
            actorPublicId: profile.user.publicId,
            code: roleCode,
            ...(roleCode === "jefe_general" ? { actorProfile: profile } : {}),
            description: context.payload.description?.trim() || undefined,
            ipAddress: context.ipAddress,
            name: context.payload.name.trim(),
            ...(context.payload.moduleCodes === undefined ? {} : { moduleCodes: context.payload.moduleCodes }),
            ...(context.payload.permissionInheritance === undefined ? {} : { permissionInheritance: context.payload.permissionInheritance }),
            reason: context.payload.reason.trim(),
            userAgent: context.userAgent,
        });
    }

    /**
     * Lee catalogo persistido de roles, modulos, permisos y auditoria reciente.
     */
    async readSecurityCatalog(sessionToken: string | undefined): Promise<IdentitySecurityCatalog> {
        const profile = await this.identity.getCurrentUser(sessionToken);
        this.assertCan(profile, ROLE_ASSIGN_PERMISSION);

        return this.repository.readSecurityCatalog();
    }

    /**
     * Lee la matriz persistida para un rol.
     */
    async readRolePermissions(sessionToken: string | undefined, roleCode: string) {
        const profile = await this.identity.getCurrentUser(sessionToken);
        this.assertCan(profile, ROLE_ASSIGN_PERMISSION);

        return this.repository.readRolePermissions(roleCode.trim().toLowerCase());
    }

    /**
     * Guarda la matriz de permisos activa para un rol.
     */
    async replaceRolePermissions(sessionToken: string | undefined, context: AccessRequestContext<ReplaceIdentityRolePermissionsDto>) {
        const profile = await this.identity.getCurrentUser(sessionToken);
        this.assertCan(profile, ROLE_ASSIGN_PERMISSION);
        const roleCode = context.roleCode.trim().toLowerCase();

        if (roleCode === OWNER_ROLE_CODE) {
            throw new ConflictException("La matriz base de este rol es dinamica y esta protegida.");
        }
        this.assertTemplateEditor(profile, roleCode, context.payload);
        this.assertOnlyOwnerReceivesAdministrationPermissions(roleCode, context.payload.permissionCodes);
        if (!profile.roles.some((role) => role.code === OWNER_ROLE_CODE && role.status === "active") && context.payload.permissionCodes.some((code) => !profile.permissions.some((permission) => permission.code === code && permission.effect === "allow") || profile.permissions.some((permission) => permission.code === code && permission.effect === "deny"))) throw new ForbiddenException("No puedes conceder permisos fuera de tu autoridad efectiva.");

        return this.repository.replaceRolePermissions({
            actorPublicId: profile.user.publicId,
            code: roleCode,
            ...(roleCode === "jefe_general" ? { actorProfile: profile } : {}),
            ...(context.payload.moduleCodes === undefined ? {} : { moduleCodes: context.payload.moduleCodes }),
            ipAddress: context.ipAddress,
            permissionCodes: context.payload.permissionCodes.map((code) => code.trim().toLowerCase()),
            reason: context.payload.reason.trim(),
            userAgent: context.userAgent,
        });
    }

    private assertTemplateEditor(profile: IdentityProfile, roleCode: string, payload: { moduleCodes?: string[]; permissionInheritance?: string }): void {
        const ownerRequired = roleCode === "jefe_general" || payload.moduleCodes !== undefined || payload.permissionInheritance !== undefined;
        if (ownerRequired && !profile.roles.some((role) => role.code === OWNER_ROLE_CODE && role.status === "active")) throw new ForbiddenException("Solo Owner puede configurar la plantilla y sus modulos.");
    }

    /**
     * Lee roles, modulos y overrides activos de un usuario.
     */
    async readUserAccess(sessionToken: string | undefined, userPublicId: string) {
        const profile = await this.identity.getCurrentUser(sessionToken);
        this.assertCan(profile, ROLE_ASSIGN_PERMISSION);

        return this.repository.readUserAccess(userPublicId.trim());
    }

    /**
     * Reemplaza acceso directo de usuario: roles, modulos visibles y overrides.
     */
    async replaceUserAccess(sessionToken: string | undefined, context: UserAccessRequestContext<ReplaceIdentityUserAccessDto>) {
        const profile = await this.identity.getCurrentUser(sessionToken);
        this.assertCan(profile, ROLE_ASSIGN_PERMISSION);
        this.assertOwnerSelfProtection(profile, context.userPublicId, context.payload);
        this.assertUserAdministrationScope(context.payload);
        const roleCodes = context.payload.roleCodes.map((code) => code.trim().toLowerCase());
        const orgUnitCodes = context.payload.orgUnitCodes.map((code) => code.trim().toLowerCase());
        const permissionOverrides = context.payload.permissionOverrides.map((override) => ({ code: override.code.trim().toLowerCase(), effect: override.effect }));
        await this.repository.assertDelegableAccess(profile, roleCodes, orgUnitCodes, permissionOverrides);

        return this.repository.replaceUserAccess({
            validateAccess: (transaction) => this.repository.validateAssignmentInTransaction(transaction, { profile, roleCodes, moduleCodes: orgUnitCodes, overrides: permissionOverrides }),
            actorPublicId: profile.user.publicId,
            ipAddress: context.ipAddress,
            orgUnitCodes,
            permissionOverrides,
            reason: context.payload.reason.trim(),
            roleCodes,
            userAgent: context.userAgent,
            userPublicId: context.userPublicId.trim(),
        });
    }

    /**
     * Elimina logicamente un rol solo cuando no tiene asignaciones activas.
     */
    async deleteRole(sessionToken: string | undefined, roleCode: string, ipAddress?: string, userAgent?: string): Promise<{ deleted: true; role: IdentityRoleCatalogItem }> {
        const profile = await this.identity.getCurrentUser(sessionToken);
        this.assertCan(profile, ROLE_ASSIGN_PERMISSION);
        if (["owner", "jefe_general"].includes(roleCode.trim().toLowerCase())) throw new ConflictException("La plantilla base de este rol esta protegida.");
        const result = await this.repository.deleteRole({
            actorPublicId: profile.user.publicId,
            code: roleCode.trim().toLowerCase(),
            ipAddress,
            userAgent,
        });

        if (result.status === "not_found") {
            throw new NotFoundException("Rol no encontrado.");
        }

        if (result.status === "in_use") {
            throw new ConflictException(`No se puede eliminar el rol porque ${String(result.activeAssignments)} usuario(s) lo tienen asignado.`);
        }

        return {
            deleted: true,
            role: result.role,
        };
    }

    /** El permiso cuenta solo con allow y sin deny. Un deny y la falta de allow responden igual. */
    private assertCan(profile: IdentityProfile, permissionCode: string): void {
        if (profile.permissions.some((permission) => permission.code === permissionCode && permission.effect === "deny") || !profile.permissions.some((permission) => permission.code === permissionCode && permission.effect === "allow")) {
            throw new ForbiddenException("Permiso insuficiente.");
        }
    }

    /** Un Owner activo no puede quitarse ese rol ni denegarse permisos. Si no, el sistema se queda sin quien administre. */
    private assertOwnerSelfProtection(profile: IdentityProfile, targetPublicId: string, payload: ReplaceIdentityUserAccessDto): void {
        const isActiveOwner = profile.roles.some((role) => role.code === OWNER_ROLE_CODE && role.status === "active");
        const isSelfChange = normalizeCaseInsensitiveIdentifier(profile.user.publicId) === normalizeCaseInsensitiveIdentifier(targetPublicId);

        if (!isActiveOwner || !isSelfChange) {
            return;
        }

        if (!payload.roleCodes.map((code) => code.trim().toLowerCase()).includes(OWNER_ROLE_CODE)) {
            throw new ConflictException("No puedes quitarte el rol Owner a ti mismo.");
        }

        if (payload.permissionOverrides.some((override) => override.effect === "deny")) {
            throw new ConflictException("Owner no puede denegarse permisos directos a si mismo.");
        }
    }

    /** Los permisos administrativos solo se entregan al rol Owner. Otro rol no los recibe. */
    private assertOnlyOwnerReceivesAdministrationPermissions(roleCode: string, permissionCodes: readonly string[]): void {
        if (roleCode === OWNER_ROLE_CODE) {
            return;
        }

        if (permissionCodes.some((code) => ADMINISTRATION_PERMISSION_CODES.has(code.trim().toLowerCase()))) {
            throw new ConflictException("Los permisos administrativos solo pertenecen al rol Owner.");
        }
    }

    /** Un allow administrativo directo exige la unidad Administración, salvo que la persona sea Owner. */
    private assertUserAdministrationScope(payload: ReplaceIdentityUserAccessDto): void {
        const roleCodes = payload.roleCodes.map((code) => code.trim().toLowerCase());

        if (roleCodes.includes(OWNER_ROLE_CODE)) {
            return;
        }

        if (!payload.orgUnitCodes.some((code) => code.trim().toLowerCase() === "administration") && payload.permissionOverrides.some((override) => override.effect === "allow" && /^(?:user|role|org|administration)\./u.test(override.code.trim().toLowerCase()))) {
            throw new ConflictException("Los permisos administrativos directos requieren seleccionar Administracion.");
        }
    }
}
