import { ConflictException, ForbiddenException, Inject, Injectable, NotFoundException } from "@nestjs/common";

import type { ReplaceIdentityRolePermissionsDto, ReplaceIdentityUserAccessDto, UpdateIdentityRoleDto } from "./dto/access-management.dto.js";
import { IdentityService } from "./identity.service.js";
import type { IdentityProfile } from "./identity.types.js";
import { IdentityAccessManagementRepository, type IdentityRoleCatalogItem, type IdentitySecurityCatalog } from "./identity-access-management.repository.js";

const OWNER_ROLE_CODE = "owner";
const ROLE_ASSIGN_PERMISSION = "role.assign";
const ADMINISTRATION_PERMISSION_CODES = new Set(["org.manage", "role.assign", "user.activate", "user.create", "user.deactivate", "user.update", "user.view_detail", "user.view_list"]);

interface AccessRequestContext<TPayload> {
    ipAddress?: string | undefined;
    payload: TPayload;
    roleCode: string;
    userAgent?: string | undefined;
}

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
     * Renombra un rol sin modificar su codigo estable.
     */
    async updateRole(sessionToken: string | undefined, context: AccessRequestContext<UpdateIdentityRoleDto>): Promise<IdentityRoleCatalogItem> {
        const profile = await this.identity.getCurrentUser(sessionToken);
        this.assertCan(profile, ROLE_ASSIGN_PERMISSION);

        return this.repository.updateRole({
            actorPublicId: profile.user.publicId,
            code: context.roleCode.trim().toLowerCase(),
            description: context.payload.description?.trim() || undefined,
            ipAddress: context.ipAddress,
            name: context.payload.name.trim(),
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
            throw new ConflictException("El rol Owner conserva sus permisos base y no se puede degradar.");
        }
        this.assertOnlyOwnerReceivesAdministrationPermissions(roleCode, context.payload.permissionCodes);

        return this.repository.replaceRolePermissions({
            actorPublicId: profile.user.publicId,
            code: roleCode,
            ipAddress: context.ipAddress,
            permissionCodes: context.payload.permissionCodes.map((code) => code.trim().toLowerCase()),
            reason: context.payload.reason.trim(),
            userAgent: context.userAgent,
        });
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

        return this.repository.replaceUserAccess({
            actorPublicId: profile.user.publicId,
            ipAddress: context.ipAddress,
            orgUnitCodes: context.payload.orgUnitCodes.map((code) => code.trim().toLowerCase()),
            permissionOverrides: context.payload.permissionOverrides.map((override) => ({
                code: override.code.trim().toLowerCase(),
                effect: override.effect,
            })),
            reason: context.payload.reason.trim(),
            roleCodes: context.payload.roleCodes.map((code) => code.trim().toLowerCase()),
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

    private assertCan(profile: IdentityProfile, permissionCode: string): void {
        if (profile.roles.some((role) => role.code === OWNER_ROLE_CODE && role.status === "active")) {
            return;
        }

        if (!profile.permissions.some((permission) => permission.code === permissionCode && permission.effect === "allow")) {
            throw new ForbiddenException("Permiso insuficiente.");
        }
    }

    private assertOwnerSelfProtection(profile: IdentityProfile, targetPublicId: string, payload: ReplaceIdentityUserAccessDto): void {
        const isActiveOwner = profile.roles.some((role) => role.code === OWNER_ROLE_CODE && role.status === "active");
        const isSelfChange = profile.user.publicId === targetPublicId.trim();

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

    private assertOnlyOwnerReceivesAdministrationPermissions(roleCode: string, permissionCodes: readonly string[]): void {
        if (roleCode === OWNER_ROLE_CODE) {
            return;
        }

        if (permissionCodes.some((code) => ADMINISTRATION_PERMISSION_CODES.has(code.trim().toLowerCase()))) {
            throw new ConflictException("Los permisos administrativos solo pertenecen al rol Owner.");
        }
    }

    private assertUserAdministrationScope(payload: ReplaceIdentityUserAccessDto): void {
        const roleCodes = payload.roleCodes.map((code) => code.trim().toLowerCase());

        if (roleCodes.includes(OWNER_ROLE_CODE)) {
            return;
        }

        if (payload.permissionOverrides.some((override) => ADMINISTRATION_PERMISSION_CODES.has(override.code.trim().toLowerCase()))) {
            throw new ConflictException("Los permisos administrativos directos solo pueden asignarse a usuarios Owner.");
        }
    }
}
