import { BadRequestException, ConflictException, ForbiddenException, Inject, Injectable, NotFoundException } from "@nestjs/common";

import { type IdentityRequestAuditContext, IdentityService } from "../identity/identity.service.js";
import type { IdentityProfile } from "../identity/identity.types.js";
import { type CatalogContextModuleCode, type CatalogDefinition, findCatalogDefinition, getCatalogPermissionCode, isCatalogContextModuleCode } from "./catalogs.constants.js";
import { CatalogsRepository } from "./catalogs.repository.js";
import type { CatalogExternalReferenceInput } from "./catalogs.types.js";
import type { CreateCatalogItemDto, ListCatalogItemsQueryDto, UpdateCatalogItemDto, UpdateCatalogItemStatusDto } from "./dto/catalog-items.dto.js";

const OWNER_ROLE_CODE = "owner";

/** Blank optional provider fields never reach configuration lookup or persistence. */
const normalizeExternalReferences = (references: CreateCatalogItemDto["externalReferences"]): CatalogExternalReferenceInput[] => {
    const assigned = (references ?? []).flatMap((reference) => {
        const externalId = reference.externalId?.trim();
        return externalId ? [{ systemCode: reference.systemCode.trim(), externalId }] : [];
    });
    const keys = assigned.map((reference) => `${reference.systemCode}:${reference.externalId}`);
    if (new Set(keys).size !== keys.length) {
        throw new ConflictException("Hay referencias externas duplicadas en el formulario.");
    }
    return assigned;
};

const normalizeQueryLimit = (limit: ListCatalogItemsQueryDto["limit"]): number | undefined => {
    if (limit === undefined) {
        return undefined;
    }

    const normalizedLimit = typeof limit === "number" ? limit : Number(limit);

    if (!Number.isInteger(normalizedLimit) || normalizedLimit < 1 || normalizedLimit > 200) {
        throw new BadRequestException("Límite de catálogos inválido.");
    }

    return normalizedLimit;
};

const normalizeQueryOffset = (offset: ListCatalogItemsQueryDto["offset"]): number | undefined => {
    if (offset === undefined) return undefined;
    const normalized = typeof offset === "number" ? offset : Number(offset);
    if (!Number.isInteger(normalized) || normalized < 0 || normalized > 2147483647) {
        throw new BadRequestException("Desplazamiento de catálogo inválido.");
    }
    return normalized;
};

/**
 *
 */
@Injectable()
export class CatalogsService {
    /**
     *
     */
    constructor(
        @Inject(IdentityService) private readonly identity: IdentityService,
        @Inject(CatalogsRepository) private readonly repository: CatalogsRepository,
    ) {}

    /**
     *
     */
    async listCatalogItems(sessionToken: string | undefined, catalogCode: string, query: ListCatalogItemsQueryDto) {
        const definition = this.resolveCatalog(catalogCode);
        const moduleCode = this.resolveContextModule(query.moduleCode);
        const profile = await this.identity.getCurrentUser(sessionToken);
        this.assertCan(profile, moduleCode, getCatalogPermissionCode(moduleCode, definition, "read"));
        const limit = normalizeQueryLimit(query.limit);
        const offset = normalizeQueryOffset(query.offset);

        return this.repository.listCatalogItems({
            catalogCode: definition.routeCode,
            ...(limit === undefined ? {} : { limit }),
            ...(offset === undefined ? {} : { offset }),
            ...(query.search === undefined ? {} : { search: query.search }),
            ...(query.status === undefined ? {} : { status: query.status }),
        });
    }

    /**
     *
     */
    async createCatalogItem(sessionToken: string | undefined, catalogCode: string, payload: CreateCatalogItemDto, context: IdentityRequestAuditContext = {}) {
        const definition = this.resolveCatalog(catalogCode);
        const moduleCode = this.resolveContextModule(payload.moduleCode);
        const profile = await this.identity.getCurrentUser(sessionToken);
        this.assertCan(profile, moduleCode, getCatalogPermissionCode(moduleCode, definition, "create"));

        return this.repository.createCatalogItem({
            actorPublicId: profile.user.publicId,
            catalogCode: definition.routeCode,
            detail: payload.detail,
            externalReferences: normalizeExternalReferences(payload.externalReferences),
            ipAddress: context.ipAddress,
            name: payload.name.trim(),
            reason: payload.reason.trim(),
            userAgent: context.userAgent,
        });
    }

    /**
     *
     */
    // eslint-disable-next-line max-params -- Caso de uso HTTP: itemPublicId y payload se mantienen explicitos para claridad del controller.
    async updateCatalogItem(sessionToken: string | undefined, catalogCode: string, itemPublicId: string, payload: UpdateCatalogItemDto, context: IdentityRequestAuditContext = {}) {
        const definition = this.resolveCatalog(catalogCode);
        const moduleCode = this.resolveContextModule(payload.moduleCode);
        const profile = await this.identity.getCurrentUser(sessionToken);
        this.assertCan(profile, moduleCode, getCatalogPermissionCode(moduleCode, definition, "update"));

        const item = await this.repository.updateCatalogItem(itemPublicId, {
            actorPublicId: profile.user.publicId,
            catalogCode: definition.routeCode,
            detail: payload.detail,
            externalReferences: normalizeExternalReferences(payload.externalReferences),
            ipAddress: context.ipAddress,
            name: payload.name.trim(),
            reason: payload.reason.trim(),
            userAgent: context.userAgent,
        });

        if (!item) {
            throw new NotFoundException("Valor de catálogo no encontrado.");
        }

        return item;
    }

    /**
     *
     */
    // eslint-disable-next-line max-params -- Caso de uso HTTP: itemPublicId y payload se mantienen explicitos para claridad del controller.
    async updateCatalogItemStatus(sessionToken: string | undefined, catalogCode: string, itemPublicId: string, payload: UpdateCatalogItemStatusDto, context: IdentityRequestAuditContext = {}) {
        const definition = this.resolveCatalog(catalogCode);
        const moduleCode = this.resolveContextModule(payload.moduleCode);
        const profile = await this.identity.getCurrentUser(sessionToken);
        this.assertCan(profile, moduleCode, getCatalogPermissionCode(moduleCode, definition, payload.status === "inactive" ? "inactivate" : "update"));

        const item = await this.repository.updateCatalogItemStatus({
            actorPublicId: profile.user.publicId,
            catalogCode: definition.routeCode,
            ipAddress: context.ipAddress,
            itemPublicId,
            reason: payload.reason.trim(),
            status: payload.status,
            userAgent: context.userAgent,
        });

        if (!item) {
            throw new NotFoundException("Valor de catálogo no encontrado.");
        }

        return item;
    }

    private resolveCatalog(catalogCode: string): CatalogDefinition {
        const definition = findCatalogDefinition(catalogCode);

        if (!definition) {
            throw new BadRequestException("Catálogo no soportado.");
        }

        return definition;
    }

    private resolveContextModule(moduleCode: string): CatalogContextModuleCode {
        const normalizedModuleCode = moduleCode.trim().toLowerCase();

        if (!isCatalogContextModuleCode(normalizedModuleCode)) {
            throw new BadRequestException("Módulo de catálogo no soportado.");
        }

        return normalizedModuleCode;
    }

    private assertCan(profile: IdentityProfile, moduleCode: CatalogContextModuleCode, permissionCode: string): void {
        if (profile.roles.some((role) => role.code === OWNER_ROLE_CODE && role.status === "active")) {
            return;
        }

        if (!profile.orgUnits.some((orgUnit) => orgUnit.code === moduleCode && orgUnit.status === "active")) {
            throw new ForbiddenException("Permiso insuficiente.");
        }

        if (profile.permissions.some((permission) => permission.code === permissionCode && permission.effect === "deny") || !profile.permissions.some((permission) => permission.code === permissionCode && permission.effect === "allow")) {
            throw new ForbiddenException("Permiso insuficiente.");
        }
    }
}
