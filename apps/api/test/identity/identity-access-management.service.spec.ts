import { ConflictException, ForbiddenException, NotFoundException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";

import type { IdentityService } from "../../src/modules/crm/identity/identity.service.js";
import type { IdentityProfile } from "../../src/modules/crm/identity/identity.types.js";
import type { IdentityAccessManagementRepository } from "../../src/modules/crm/identity/identity-access-management.repository.js";
import { IdentityAccessManagementService } from "../../src/modules/crm/identity/identity-access-management.service.js";

const createProfile = (input: { permissions?: string[]; roles?: string[] } = {}): IdentityProfile => ({
    auth: {
        availableProviders: ["local"],
        currentProvider: "local",
        localStatus: "active",
        microsoft: null,
        primaryProvider: "microsoft",
    },
    orgUnits: [],
    permissions: (input.permissions ?? []).map((code) => ({
        code,
        effect: "allow",
        scope: "all_areas",
        source: "role",
    })),
    roles: (input.roles ?? []).map((code) => ({
        code,
        name: code,
        status: "active",
    })),
    session: {
        expiresAt: new Date(Date.now() + 60_000).toISOString(),
        expiresInSeconds: 60,
        permissionVersion: 1,
        publicId: "session-public-id",
        status: "active",
    },
    user: {
        displayName: "Usuario Seguridad",
        email: "seguridad@roccacr.com",
        permissionVersion: 1,
        profileImageUrl: null,
        publicId: "user-public-id",
        status: "active",
    },
});

const createService = (profile: IdentityProfile = createProfile({ roles: ["owner"], permissions: ["role.assign"] })) => {
    const identity = {
        getCurrentUser: vi.fn().mockResolvedValue(profile),
    } as unknown as IdentityService;
    const repository = {
        validateAssignmentInTransaction: vi.fn().mockResolvedValue(undefined),
        assertDelegableAccess: vi.fn().mockResolvedValue(undefined),
        deleteRole: vi.fn().mockResolvedValue({
            role: {
                code: "auditor",
                description: "Auditoria interna",
                name: "Auditor",
                status: "inactive",
            },
            status: "deleted",
        }),
        replaceRolePermissions: vi.fn().mockResolvedValue({
            permissionCodes: ["lead.read", "lead.create"],
            role: {
                code: "ventas",
                description: null,
                name: "Ventas",
                status: "active",
            },
        }),
        readSecurityCatalog: vi.fn().mockResolvedValue({
            auditEvents: [],
            modules: [],
            rolePermissions: {},
            roles: [],
        }),
        readUserAccess: vi.fn().mockResolvedValue({
            orgUnits: [{ code: "ventas", name: "Ventas", publicId: "org-public-id" }],
            permissionOverrides: [{ code: "lead.create", effect: "deny" }],
            roles: [{ code: "ventas", name: "Ventas", status: "active" }],
            user: {
                email: "ventas@roccacr.com",
                name: "Usuario Ventas",
                publicId: "target-user-public-id",
                status: "active",
            },
        }),
        replaceUserAccess: vi.fn().mockResolvedValue({
            orgUnits: [{ code: "ventas", name: "Ventas", publicId: "org-public-id" }],
            permissionOverrides: [{ code: "lead.create", effect: "deny" }],
            roles: [{ code: "ventas", name: "Ventas", status: "active" }],
            user: {
                email: "ventas@roccacr.com",
                name: "Usuario Ventas",
                publicId: "target-user-public-id",
                status: "active",
            },
        }),
        updateRole: vi.fn().mockResolvedValue({
            code: "ventas",
            description: null,
            name: "Ventas senior",
            status: "active",
        }),
    } as unknown as IdentityAccessManagementRepository;

    return {
        identity: identity as unknown as {
            getCurrentUser: ReturnType<typeof vi.fn>;
        },
        repository: repository as unknown as {
            validateAssignmentInTransaction: ReturnType<typeof vi.fn>;
            assertDelegableAccess: ReturnType<typeof vi.fn>;
            deleteRole: ReturnType<typeof vi.fn>;
            replaceRolePermissions: ReturnType<typeof vi.fn>;
            readSecurityCatalog: ReturnType<typeof vi.fn>;
            readUserAccess: ReturnType<typeof vi.fn>;
            replaceUserAccess: ReturnType<typeof vi.fn>;
            updateRole: ReturnType<typeof vi.fn>;
        },
        service: new IdentityAccessManagementService(identity, repository),
    };
};

describe("IdentityAccessManagementService", () => {
    it("passes a trusted normalized revalidation closure to the access writer", async () => {
        const { repository, service } = createService();
        await service.replaceUserAccess("token", { userPublicId: "target", payload: { roleCodes: [" VENTAS "], orgUnitCodes: [" Ventas "], permissionOverrides: [], reason: "Writer revalidation wiring" } });
        const input = repository.replaceUserAccess.mock.calls[0]?.[0] as Parameters<IdentityAccessManagementRepository["replaceUserAccess"]>[0];
        const tx = {} as Parameters<typeof input.validateAccess>[0];
        await input.validateAccess(tx);
        expect(repository.validateAssignmentInTransaction.mock.calls[0]?.[0]).toBe(tx);
        expect(repository.validateAssignmentInTransaction.mock.calls[0]?.[1]).toMatchObject({ profile: { user: { publicId: "user-public-id" } }, roleCodes: ["ventas"], moduleCodes: ["ventas"], overrides: [] });
    });
    it.each(["owner", "jefe_general"])("rejects deleting protected template %s", async (roleCode) => {
        const { repository, service } = createService();
        await expect(service.deleteRole("token", roleCode)).rejects.toBeInstanceOf(ConflictException);
        expect(repository.deleteRole).not.toHaveBeenCalled();
    });
    it("does not write user access when delegation is rejected", async () => {
        const { repository, service } = createService(createProfile({ permissions: ["role.assign"] }));
        repository.assertDelegableAccess.mockRejectedValue(new ForbiddenException("Outside authority"));
        await expect(service.replaceUserAccess("token", { userPublicId: "target", payload: { roleCodes: ["owner"], orgUnitCodes: ["ventas"], permissionOverrides: [], reason: "Escalation regression" } })).rejects.toBeInstanceOf(ForbiddenException);
        expect(repository.replaceUserAccess).not.toHaveBeenCalled();
    });
    it("allows individual administrative denies without granting administration", async () => {
        const { repository, service } = createService();
        await service.replaceUserAccess("token", { userPublicId: "target", payload: { roleCodes: ["ventas"], orgUnitCodes: ["ventas"], permissionOverrides: [{ code: "role.assign", effect: "deny" }], reason: "Explicit exception deny" } });
        expect(repository.replaceUserAccess).toHaveBeenCalledOnce();
    });
    it("allows Owner to atomically edit General modules and stored grants", async () => {
        const { repository, service } = createService();
        await service.replaceRolePermissions("token", { roleCode: "jefe_general", payload: { permissionCodes: ["lead.read"], moduleCodes: ["ventas"], reason: "Edit General template" } });
        expect(repository.replaceRolePermissions).toHaveBeenCalledWith(expect.objectContaining({ code: "jefe_general", moduleCodes: ["ventas"], permissionCodes: ["lead.read"] }));
    });
    it("rejects General template edits by a non-Owner even with role.assign and the requested grants", async () => {
        const { repository, service } = createService(createProfile({ roles: ["jefe_general"], permissions: ["role.assign", "lead.read"] }));
        await expect(service.replaceRolePermissions("token", { roleCode: "jefe_general", payload: { permissionCodes: ["lead.read"], reason: "Non Owner template edit" } })).rejects.toBeInstanceOf(ForbiddenException);
        await expect(service.updateRole("token", { roleCode: "jefe_general", payload: { name: "General", reason: "Non Owner template edit" } })).rejects.toBeInstanceOf(ForbiddenException);
        expect(repository.replaceRolePermissions).not.toHaveBeenCalled();
        expect(repository.updateRole).not.toHaveBeenCalled();
    });
    it("preserves role.assign deny precedence when Owner edits General", async () => {
        const profile = createProfile({ roles: ["owner"], permissions: ["role.assign"] });
        profile.permissions.push({ code: "role.assign", effect: "deny", scope: null, source: "override" });
        const { repository, service } = createService(profile);
        await expect(service.replaceRolePermissions("token", { roleCode: "jefe_general", payload: { permissionCodes: [], moduleCodes: [], reason: "Denied template edit" } })).rejects.toBeInstanceOf(ForbiddenException);
        expect(repository.replaceRolePermissions).not.toHaveBeenCalled();
    });
    it("forwards optional role module metadata without inventing absent values", async () => {
        const { repository, service } = createService();
        await service.updateRole("token", { roleCode: "auditor", payload: { name: "Auditor", reason: "Scope custom role", moduleCodes: ["ventas"], permissionInheritance: "assigned" } });
        expect(repository.updateRole).toHaveBeenCalledWith(expect.objectContaining({ moduleCodes: ["ventas"], permissionInheritance: "assigned" }));
    });
    it("does not authorize an Owner label without the exact effective grant", async () => {
        const { repository, service } = createService(createProfile({ roles: ["owner"] }));
        await expect(service.readSecurityCatalog("token")).rejects.toBeInstanceOf(ForbiddenException);
        expect(repository.readSecurityCatalog).not.toHaveBeenCalled();
    });

    it("an exact deny wins over an allow even for Owner", async () => {
        const profile = createProfile({ roles: ["owner"], permissions: ["role.assign"] });
        profile.permissions.push({ code: "role.assign", effect: "deny", scope: null, source: "override" });
        const { repository, service } = createService(profile);
        await expect(service.readSecurityCatalog("token")).rejects.toBeInstanceOf(ForbiddenException);
        expect(repository.readSecurityCatalog).not.toHaveBeenCalled();
    });

    it("does not delegate the initial-password privilege without the actor's own effective grant", async () => {
        const { repository, service } = createService(createProfile({ permissions: ["role.assign"] }));
        await expect(service.replaceRolePermissions("token", { roleCode: "ventas", payload: { permissionCodes: ["user.assign_password"], reason: "Delegated password privilege" } })).rejects.toBeInstanceOf(ForbiddenException);
        expect(repository.replaceRolePermissions).not.toHaveBeenCalled();
    });

    it("resolves authorization again on the next request after an Owner downgrade", async () => {
        const { identity, repository, service } = createService();
        await service.readSecurityCatalog("same-session-token");
        identity.getCurrentUser.mockResolvedValue(createProfile({ roles: ["ventas"], permissions: ["lead.read"] }));

        await expect(service.readSecurityCatalog("same-session-token")).rejects.toThrow(ForbiddenException);
        expect(identity.getCurrentUser).toHaveBeenCalledTimes(2);
        expect(repository.readSecurityCatalog).toHaveBeenCalledTimes(1);
    });

    it("renombra roles con permiso role.assign", async () => {
        const { repository, service } = createService(createProfile({ permissions: ["role.assign"] }));

        await service.updateRole("session-token", {
            payload: {
                name: " Ventas senior ",
                reason: "Cambio autorizado por TI",
            },
            roleCode: "ventas",
        });

        expect(repository.updateRole).toHaveBeenCalledWith(
            expect.objectContaining({
                actorPublicId: "user-public-id",
                code: "ventas",
                name: "Ventas senior",
                reason: "Cambio autorizado por TI",
            }),
        );
    });

    it("guarda permisos de rol normalizados", async () => {
        const { repository, service } = createService(createProfile({ roles: ["owner"], permissions: ["role.assign"] }));

        await service.replaceRolePermissions("session-token", {
            payload: {
                permissionCodes: [" LEAD.READ ", "lead.create"],
                reason: "Ajuste aprobado por jefatura",
            },
            roleCode: "ventas",
        });

        expect(repository.replaceRolePermissions).toHaveBeenCalledWith(
            expect.objectContaining({
                actorPublicId: "user-public-id",
                code: "ventas",
                permissionCodes: ["lead.read", "lead.create"],
                reason: "Ajuste aprobado por jefatura",
            }),
        );
    });

    it("bloquea permisos administrativos en roles que no son Owner", async () => {
        const { repository, service } = createService(createProfile({ roles: ["owner"], permissions: ["role.assign"] }));

        await expect(
            service.replaceRolePermissions("session-token", {
                payload: {
                    permissionCodes: ["lead.read", "role.assign"],
                    reason: "Ajuste solicitado por seguridad",
                },
                roleCode: "jefe_general",
            }),
        ).rejects.toThrow(ConflictException);
        expect(repository.replaceRolePermissions).not.toHaveBeenCalled();
    });

    it("lee el catalogo persistido de seguridad con permiso role.assign", async () => {
        const { repository, service } = createService(createProfile({ permissions: ["role.assign"] }));

        await service.readSecurityCatalog("session-token");

        expect(repository.readSecurityCatalog).toHaveBeenCalledOnce();
    });

    it("bloquea cambios a la matriz base del rol Owner", async () => {
        const { repository, service } = createService(createProfile({ permissions: ["role.assign"] }));

        await expect(
            service.replaceRolePermissions("session-token", {
                payload: {
                    permissionCodes: ["lead.read"],
                    reason: "Ajuste solicitado por soporte",
                },
                roleCode: "owner",
            }),
        ).rejects.toThrow(ConflictException);
        expect(repository.replaceRolePermissions).not.toHaveBeenCalled();
    });

    it("lee acceso de usuario con permiso role.assign", async () => {
        const { repository, service } = createService(createProfile({ permissions: ["role.assign"] }));

        await service.readUserAccess("session-token", " target-user-public-id ");

        expect(repository.readUserAccess).toHaveBeenCalledWith("target-user-public-id");
    });

    it("guarda acceso de usuario normalizado", async () => {
        const { repository, service } = createService(createProfile({ permissions: ["role.assign"] }));

        await service.replaceUserAccess("session-token", {
            payload: {
                orgUnitCodes: [" Ventas "],
                permissionOverrides: [{ code: " LEAD.CREATE ", effect: "deny" }],
                reason: "Ajuste aprobado por jefatura",
                roleCodes: [" VENTAS "],
            },
            userPublicId: " target-user-public-id ",
        });

        expect(repository.replaceUserAccess).toHaveBeenCalledWith(
            expect.objectContaining({
                actorPublicId: "user-public-id",
                orgUnitCodes: ["ventas"],
                permissionOverrides: [{ code: "lead.create", effect: "deny" }],
                reason: "Ajuste aprobado por jefatura",
                roleCodes: ["ventas"],
                userPublicId: "target-user-public-id",
            }),
        );
    });

    it("bloquea permisos administrativos directos en usuarios que no son Owner", async () => {
        const { repository, service } = createService(createProfile({ permissions: ["role.assign"] }));

        await expect(
            service.replaceUserAccess("session-token", {
                payload: {
                    orgUnitCodes: ["ventas"],
                    permissionOverrides: [{ code: "role.assign", effect: "allow" }],
                    reason: "Ajuste solicitado por seguridad",
                    roleCodes: ["jefe_general"],
                },
                userPublicId: "target-user-public-id",
            }),
        ).rejects.toThrow(ConflictException);
        expect(repository.replaceUserAccess).not.toHaveBeenCalled();
    });

    it("bloquea que un Owner se quite su propio rol Owner", async () => {
        const { repository, service } = createService(createProfile({ roles: ["owner"], permissions: ["role.assign"] }));

        await expect(
            service.replaceUserAccess("session-token", {
                payload: {
                    orgUnitCodes: ["ventas"],
                    permissionOverrides: [],
                    reason: "Ajuste solicitado por soporte",
                    roleCodes: ["ventas"],
                },
                userPublicId: "USER-PUBLIC-ID",
            }),
        ).rejects.toThrow(ConflictException);
        expect(repository.replaceUserAccess).not.toHaveBeenCalled();
    });

    it("bloquea que un Owner se deniegue permisos directos a si mismo", async () => {
        const { repository, service } = createService(createProfile({ roles: ["owner"], permissions: ["role.assign"] }));

        await expect(
            service.replaceUserAccess("session-token", {
                payload: {
                    orgUnitCodes: ["ventas"],
                    permissionOverrides: [{ code: "lead.read", effect: "deny" }],
                    reason: "Ajuste solicitado por soporte",
                    roleCodes: ["owner"],
                },
                userPublicId: "user-public-id",
            }),
        ).rejects.toThrow(ConflictException);
        expect(repository.replaceUserAccess).not.toHaveBeenCalled();
    });

    it("rechaza eliminar roles activos en usuarios", async () => {
        const { repository, service } = createService(createProfile({ permissions: ["role.assign"] }));
        repository.deleteRole.mockResolvedValue({
            activeAssignments: 2,
            role: {
                code: "ventas",
                description: null,
                name: "Ventas",
                status: "active",
            },
            status: "in_use",
        });

        await expect(service.deleteRole("session-token", "ventas")).rejects.toThrow(ConflictException);
    });

    it("devuelve 404 al eliminar un rol inexistente", async () => {
        const { repository, service } = createService(createProfile({ permissions: ["role.assign"] }));
        repository.deleteRole.mockResolvedValue({ status: "not_found" });

        await expect(service.deleteRole("session-token", "desconocido")).rejects.toThrow(NotFoundException);
    });
});
