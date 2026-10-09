import { BadRequestException, ConflictException, ForbiddenException, NotFoundException, ValidationPipe } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";

import { type CatalogsRepository } from "../../src/modules/crm/catalogs/catalogs.repository.js";
import { CatalogsService } from "../../src/modules/crm/catalogs/catalogs.service.js";
import { CreateCatalogItemDto, ListCatalogItemsQueryDto, UpdateCatalogItemDto } from "../../src/modules/crm/catalogs/dto/catalog-items.dto.js";
import type { IdentityService } from "../../src/modules/crm/identity/identity.service.js";
import type { IdentityProfile } from "../../src/modules/crm/identity/identity.types.js";

const createProfile = (input: { deniedPermissions?: string[]; orgUnits?: string[]; permissions?: string[]; roles?: string[] } = {}): IdentityProfile => ({
    auth: {
        availableProviders: ["local"],
        currentProvider: "local",
        localStatus: "active",
        microsoft: null,
        primaryProvider: "microsoft",
    },
    orgUnits: (input.orgUnits ?? []).map((code) => ({
        code,
        membership: "member",
        name: code,
        publicId: `${code}-public-id`,
        scope: "self",
        status: "active",
    })),
    permissions: [
        ...(input.permissions ?? []).map((code) => ({
            code,
            effect: "allow" as const,
            scope: "all_areas",
            source: "role" as const,
        })),
        ...(input.deniedPermissions ?? []).map((code) => ({
            code,
            effect: "deny" as const,
            scope: null,
            source: "override" as const,
        })),
    ],
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
        displayName: "Usuario Catalogos",
        email: "catalogos@roccacr.com",
        permissionVersion: 1,
        profileImageUrl: null,
        publicId: "actor-public-id",
        status: "active",
    },
});

const catalogItem = {
    detail: "Detalle",
    externalReferences: [{ externalId: "88", status: "active", systemCode: "netsuite", systemName: "NetSuite" }],
    name: "Proyecto Norte",
    nativeCode: "projects_01",
    publicId: "CAT-001",
    status: "active" as const,
    updatedAt: "2026-10-03T18:00:00.000Z",
};

const createService = (profile: IdentityProfile) => {
    const identity = {
        getCurrentUser: vi.fn().mockResolvedValue(profile),
    } as unknown as IdentityService;
    const repository = {
        createCatalogItem: vi.fn().mockResolvedValue(catalogItem),
        listCatalogItems: vi.fn().mockResolvedValue({
            catalog: { code: "projects", label: "Proyectos", moduleCode: "catalog_project" },
            items: [catalogItem],
            total: 1,
        }),
        updateCatalogItem: vi.fn().mockResolvedValue(catalogItem),
        updateCatalogItemStatus: vi.fn().mockResolvedValue(catalogItem),
    } as unknown as CatalogsRepository;

    return {
        repository: repository as unknown as {
            createCatalogItem: ReturnType<typeof vi.fn>;
            listCatalogItems: ReturnType<typeof vi.fn>;
            updateCatalogItem: ReturnType<typeof vi.fn>;
            updateCatalogItemStatus: ReturnType<typeof vi.fn>;
        },
        service: new CatalogsService(identity, repository),
    };
};

describe("CatalogsService", () => {
    it("validates and forwards catalog pagination offsets", async () => {
        const { repository, service } = createService(createProfile({ roles: ["owner"] }));
        const pipe = new ValidationPipe({ transform: true, whitelist: true });
        const query = (await pipe.transform({ moduleCode: "administration", offset: "100", limit: "100" }, { type: "query", metatype: ListCatalogItemsQueryDto })) as ListCatalogItemsQueryDto;
        await service.listCatalogItems("session", "projects", query);
        expect(repository.listCatalogItems).toHaveBeenCalledWith({ catalogCode: "projects", offset: 100, limit: 100 });
        await expect(pipe.transform({ moduleCode: "administration", offset: "-1" }, { type: "query", metatype: ListCatalogItemsQueryDto })).rejects.toBeInstanceOf(BadRequestException);
    });
    it.each([undefined, null, "", "   "])("omits unassigned Odoo references on create and update (%s)", async (externalId) => {
        const { repository, service } = createService(createProfile({ roles: ["owner"] }));
        const payload = {
            moduleCode: "administration" as const,
            name: "Proyecto Sur",
            reason: "Cambio autorizado",
            externalReferences: [
                { systemCode: "odoo", externalId },
                { systemCode: "netsuite", externalId: " 88 " },
            ],
        };
        const pipe = new ValidationPipe({ transform: true, whitelist: true });
        for (const metatype of [CreateCatalogItemDto, UpdateCatalogItemDto]) {
            const transformed = (await pipe.transform(payload, { type: "body", metatype })) as CreateCatalogItemDto;
            await service.createCatalogItem("session-token", "projects", transformed);
            await service.updateCatalogItem("session-token", "projects", "CAT-001", transformed);
        }
        for (const mutation of [repository.createCatalogItem, repository.updateCatalogItem]) {
            expect(mutation.mock.calls[0]?.at(-1)).toMatchObject({ externalReferences: [{ systemCode: "netsuite", externalId: "88" }] });
        }
    });

    it("rejects duplicate assigned references with 409 before repository calls", async () => {
        const { repository, service } = createService(createProfile({ roles: ["owner"] }));
        const payload = {
            moduleCode: "administration" as const,
            name: "Proyecto Sur",
            reason: "Cambio autorizado",
            externalReferences: [
                { systemCode: "netsuite", externalId: "88" },
                { systemCode: "netsuite", externalId: " 88 " },
            ],
        };
        await expect(service.createCatalogItem("session-token", "projects", payload)).rejects.toBeInstanceOf(ConflictException);
        await expect(service.updateCatalogItem("session-token", "projects", "CAT-001", payload)).rejects.toMatchObject({ status: 409 });
        expect(repository.createCatalogItem).not.toHaveBeenCalled();
        expect(repository.updateCatalogItem).not.toHaveBeenCalled();
    });

    it("lista un catalogo administrativo cuando el usuario tiene modulo y permiso scoped de lectura", async () => {
        const { repository, service } = createService(createProfile({ orgUnits: ["administration"], permissions: ["administration.catalog_project.read"] }));

        await expect(service.listCatalogItems("session-token", "projects", { moduleCode: "administration", search: "norte" })).resolves.toEqual({
            catalog: { code: "projects", label: "Proyectos", moduleCode: "catalog_project" },
            items: [catalogItem],
            total: 1,
        });
        expect(repository.listCatalogItems).toHaveBeenCalledWith({ catalogCode: "projects", search: "norte" });
    });

    it("bloquea el permiso global anterior aunque el codigo de catalogo coincida", async () => {
        const { repository, service } = createService(createProfile({ orgUnits: ["administration"], permissions: ["catalog_project.read"] }));

        await expect(service.listCatalogItems("session-token", "projects", { moduleCode: "administration" })).rejects.toThrow(ForbiddenException);
        expect(repository.listCatalogItems).not.toHaveBeenCalled();
    });

    it("bloquea el permiso scoped si el usuario no tiene el modulo asignado", async () => {
        const { repository, service } = createService(createProfile({ permissions: ["administration.catalog_project.read"] }));

        await expect(service.listCatalogItems("session-token", "projects", { moduleCode: "administration" })).rejects.toThrow(ForbiddenException);
        expect(repository.listCatalogItems).not.toHaveBeenCalled();
    });

    it("bloquea usar el permiso de mercadeo desde formalizacion", async () => {
        const { repository, service } = createService(createProfile({ orgUnits: ["formalizacion", "mercadeo"], permissions: ["mercadeo.catalog_project.read"] }));

        await expect(service.listCatalogItems("session-token", "projects", { moduleCode: "formalizacion" })).rejects.toThrow(ForbiddenException);
        expect(repository.listCatalogItems).not.toHaveBeenCalled();
    });

    it("bloquea el permiso scoped cuando existe una denegacion directa del mismo codigo", async () => {
        const { repository, service } = createService(createProfile({ deniedPermissions: ["administration.catalog_project.read"], orgUnits: ["administration"], permissions: ["administration.catalog_project.read"] }));

        await expect(service.listCatalogItems("session-token", "projects", { moduleCode: "administration" })).rejects.toThrow(ForbiddenException);
        expect(repository.listCatalogItems).not.toHaveBeenCalled();
    });

    it("normaliza el limite recibido como texto desde querystring antes de consultar el repositorio", async () => {
        const { repository, service } = createService(createProfile({ orgUnits: ["administration"], permissions: ["administration.catalog_project.read"] }));

        await service.listCatalogItems("session-token", "projects", { limit: "100" as unknown as number, moduleCode: "administration" });

        expect(repository.listCatalogItems).toHaveBeenCalledWith({ catalogCode: "projects", limit: 100 });
    });

    it("rechaza limite invalido antes de consultar el repositorio", async () => {
        const { repository, service } = createService(createProfile({ orgUnits: ["administration"], permissions: ["administration.catalog_project.read"] }));

        await expect(service.listCatalogItems("session-token", "projects", { limit: "abc" as unknown as number, moduleCode: "administration" })).rejects.toThrow(BadRequestException);
        expect(repository.listCatalogItems).not.toHaveBeenCalled();
    });

    it("permite al Owner administrar catalogos aunque no traiga permisos explicitos", async () => {
        const { repository, service } = createService(createProfile({ roles: ["owner"] }));

        await service.createCatalogItem(
            "session-token",
            "campaigns",
            {
                externalReferences: [{ externalId: "ODOO-1", systemCode: "odoo" }],
                moduleCode: "administration",
                name: "Campaña referidos",
                reason: "Alta aprobada por gerencia",
            },
            { ipAddress: "127.0.0.1", userAgent: "vitest" },
        );

        expect(repository.createCatalogItem).toHaveBeenCalledWith(
            expect.objectContaining({
                actorPublicId: "actor-public-id",
                catalogCode: "campaigns",
                externalReferences: [{ externalId: "ODOO-1", systemCode: "odoo" }],
                name: "Campaña referidos",
                reason: "Alta aprobada por gerencia",
            }),
        );
    });

    it("bloquea crear catalogos sin permiso de creacion", async () => {
        const { repository, service } = createService(createProfile({ orgUnits: ["administration"], permissions: ["administration.catalog_project.read"] }));

        await expect(service.createCatalogItem("session-token", "projects", { moduleCode: "administration", name: "Proyecto Sur", reason: "Alta aprobada por gerencia" })).rejects.toThrow(ForbiddenException);
        expect(repository.createCatalogItem).not.toHaveBeenCalled();
    });

    it("bloquea editar catalogos sin permiso de edicion", async () => {
        const { repository, service } = createService(createProfile({ orgUnits: ["administration"], permissions: ["administration.catalog_project.read"] }));

        await expect(service.updateCatalogItem("session-token", "projects", "CAT-001", { moduleCode: "administration", name: "Proyecto Sur", reason: "Ajuste aprobado por gerencia" })).rejects.toThrow(ForbiddenException);
        expect(repository.updateCatalogItem).not.toHaveBeenCalled();
    });

    it("exige permiso de inactivar para cambiar a inactivo", async () => {
        const { repository, service } = createService(createProfile({ orgUnits: ["administration"], permissions: ["administration.catalog_project.update"] }));

        await expect(service.updateCatalogItemStatus("session-token", "projects", "CAT-001", { moduleCode: "administration", reason: "Cierre operativo aprobado", status: "inactive" })).rejects.toThrow(ForbiddenException);
        expect(repository.updateCatalogItemStatus).not.toHaveBeenCalled();
    });

    it("retorna 404 cuando el repositorio no encuentra el valor al editar", async () => {
        const { repository, service } = createService(createProfile({ orgUnits: ["administration"], permissions: ["administration.catalog_project.update"] }));
        repository.updateCatalogItem.mockResolvedValueOnce(null);

        await expect(service.updateCatalogItem("session-token", "projects", "CAT-NO", { moduleCode: "administration", name: "Proyecto", reason: "Ajuste aprobado por jefatura" })).rejects.toThrow(NotFoundException);
    });
});
