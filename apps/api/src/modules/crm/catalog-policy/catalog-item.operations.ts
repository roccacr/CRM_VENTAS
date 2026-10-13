/**
 * Autorización y normalización compartidas por los catálogos.
 *
 * No escribe SQL. Comprueba sesión, módulo de contexto y permiso efectivo, y
 * deja la persistencia en el repositorio de cada agregado. Un id `legacy:` no
 * se edita por aquí: primero tiene que promoverse a una fila nativa.
 */
import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from "@nestjs/common";

import { type CatalogFallbackReader, type PrimaryCatalogReader, readCatalogWithFallback } from "../catalogs/catalog-fallback.js";
import { type CatalogContextModuleCode, type CatalogDefinition, findCatalogDefinition, getCatalogPermissionCode, isCatalogContextModuleCode } from "../catalogs/catalogs.constants.js";
import type { CatalogExternalReferenceInput, CatalogItem, CatalogMutationInput, CatalogStatusMutationInput } from "../catalogs/catalogs.types.js";
import type { CreateCatalogItemDto, ListCatalogItemsQueryDto, UpdateCatalogItemDto, UpdateCatalogItemStatusDto } from "../catalogs/dto/catalog-items.dto.js";
import { type IdentityRequestAuditContext, type IdentityService } from "../identity/identity.service.js";
import type { IdentityProfile } from "../identity/identity.types.js";

/** Owner skips context membership only; every operation still requires its effective grant. */
const OWNER_ROLE_CODE = "owner";

/** Lo que cualquier repositorio de catálogo debe ofrecer. No nombra tablas ni sistemas externos. */
interface CatalogItemPersistence extends PrimaryCatalogReader {
    createCatalogItem(input: CatalogMutationInput): Promise<CatalogItem>;
    updateCatalogItem(publicId: string, input: CatalogMutationInput): Promise<CatalogItem | null>;
    updateCatalogItemStatus(input: CatalogStatusMutationInput): Promise<CatalogItem | null>;
}

/**
 * Impide mutar una vista previa del CRM viejo.
 *
 * Ese `publicId` no es una fila nativa. Guardarlo aquí crearía un valor distinto del que el usuario está viendo.
 */
const assertNativeIdentity = (publicId: string): void => {
    if (publicId.startsWith("legacy:")) throw new ForbiddenException("Legacy catalog records are read-only. Import the record before editing.");
};

/**
 * Quita referencias sin id y rechaza pares repetidos.
 *
 * Un campo opcional vacío no debe buscar un sistema externo ni guardar una fila en blanco.
 */
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

/** Acepta el límite ya numérico o el que llegó como query string. Fuera de 1 a 200 no se consulta. */
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

/** El desplazamiento tiene que caber en un entero de MySQL. Un valor ausente significa la primera página. */
const normalizeQueryOffset = (offset: ListCatalogItemsQueryDto["offset"]): number | undefined => {
    if (offset === undefined) return undefined;
    const normalized = typeof offset === "number" ? offset : Number(offset);
    if (!Number.isInteger(normalized) || normalized < 0 || normalized > 2147483647) {
        throw new BadRequestException("Desplazamiento de catálogo inválido.");
    }
    return normalized;
};

/**
 * Caso de uso base de listar, crear, editar y cambiar estado.
 *
 * Cada catálogo concreto lo extiende y le pasa su repositorio. El permiso se
 * arma con el módulo de contexto del request, no con el módulo dueño de la tabla.
 */
export class CatalogItemOperations {
    /**
     * @param identity - Perfil efectivo de la cookie. No se confía en un permiso enviado por el cliente
     * @param repository - Persistencia del agregado
     * @param fallback - Lector legacy opcional para completar listados vacíos
     */
    constructor(
        private readonly identity: IdentityService,
        private readonly repository: CatalogItemPersistence,
        private readonly fallback?: CatalogFallbackReader,
    ) {}

    /**
     * Lista si el perfil puede leer ese catálogo desde el módulo indicado.
     *
     * La respuesta puede completarse con el CRM viejo. Eso no concede permiso de edición.
     */
    async listCatalogItems(sessionToken: string | undefined, catalogCode: string, query: ListCatalogItemsQueryDto) {
        const definition = this.resolveCatalog(catalogCode);
        const moduleCode = this.resolveContextModule(query.moduleCode);
        const profile = await this.identity.getCurrentUser(sessionToken);
        this.assertCan(profile, moduleCode, getCatalogPermissionCode(moduleCode, definition, "read"));
        const limit = normalizeQueryLimit(query.limit);
        const offset = normalizeQueryOffset(query.offset);

        return readCatalogWithFallback(
            this.repository,
            {
                catalogCode: definition.routeCode,
                ...(limit === undefined ? {} : { limit }),
                ...(offset === undefined ? {} : { offset }),
                ...(query.search === undefined ? {} : { search: query.search }),
                ...(query.status === undefined ? {} : { status: query.status }),
            },
            this.fallback,
        );
    }

    /**
     * Crea un valor nativo.
     *
     * El actor de la auditoría es el usuario de la sesión, no un id recibido en el cuerpo.
     */
    async createCatalogItem(sessionToken: string | undefined, catalogCode: string, payload: CreateCatalogItemDto, context: IdentityRequestAuditContext = {}) {
        const definition = this.resolveCatalog(catalogCode);
        const moduleCode = this.resolveContextModule(payload.moduleCode);
        const profile = await this.identity.getCurrentUser(sessionToken);
        this.assertCan(profile, moduleCode, getCatalogPermissionCode(moduleCode, definition, "create"));

        return this.repository.createCatalogItem({
            moduleCode,
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
     * Edita un valor nativo.
     *
     * Un `publicId` legacy se rechaza antes de abrir la transacción. Proyectos puede ampliar esa regla para promover la fila.
     */
    // eslint-disable-next-line max-params -- Caso de uso HTTP: itemPublicId y payload se mantienen explicitos para claridad del controller.
    async updateCatalogItem(sessionToken: string | undefined, catalogCode: string, itemPublicId: string, payload: UpdateCatalogItemDto, context: IdentityRequestAuditContext = {}) {
        const definition = this.resolveCatalog(catalogCode);
        const moduleCode = this.resolveContextModule(payload.moduleCode);
        const profile = await this.identity.getCurrentUser(sessionToken);
        this.assertCan(profile, moduleCode, getCatalogPermissionCode(moduleCode, definition, "update"));
        this.assertMutableIdentity(itemPublicId);

        const item = await this.repository.updateCatalogItem(itemPublicId, {
            moduleCode,
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
     * Cambia el estado.
     *
     * Inactivar exige `inactivate`. Volver a activo exige `update`, porque no es la misma acción.
     */
    // eslint-disable-next-line max-params -- Caso de uso HTTP: itemPublicId y payload se mantienen explicitos para claridad del controller.
    async updateCatalogItemStatus(sessionToken: string | undefined, catalogCode: string, itemPublicId: string, payload: UpdateCatalogItemStatusDto, context: IdentityRequestAuditContext = {}) {
        const definition = this.resolveCatalog(catalogCode);
        const moduleCode = this.resolveContextModule(payload.moduleCode);
        const profile = await this.identity.getCurrentUser(sessionToken);
        this.assertCan(profile, moduleCode, getCatalogPermissionCode(moduleCode, definition, payload.status === "inactive" ? "inactivate" : "update"));
        this.assertMutableIdentity(itemPublicId);

        const item = await this.repository.updateCatalogItemStatus({
            moduleCode,
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

    /** Punto de extensión. El caso base solo acepta identidad nativa. */
    protected assertMutableIdentity(publicId: string): void {
        assertNativeIdentity(publicId);
    }

    /** Traduce el segmento de la URL a la definición. Un código fuera de la lista no se adivina. */
    protected resolveCatalog(catalogCode: string): CatalogDefinition {
        const definition = findCatalogDefinition(catalogCode);

        if (!definition) {
            throw new BadRequestException("Catálogo no soportado.");
        }

        return definition;
    }

    /** Normaliza el módulo de contexto. No forma parte del filtro de filas: elige el permiso. */
    private resolveContextModule(moduleCode: string): CatalogContextModuleCode {
        const normalizedModuleCode = moduleCode.trim().toLowerCase();

        if (!isCatalogContextModuleCode(normalizedModuleCode)) {
            throw new BadRequestException("Módulo de catálogo no soportado.");
        }

        return normalizedModuleCode;
    }

    /**
     * Autoriza con el perfil que acaba de devolver identidad.
     *
     * Every profile needs an exact allow without deny. Active Owner only skips
     * module membership; other profiles also need the active context area.
     */
    private assertCan(profile: IdentityProfile, moduleCode: CatalogContextModuleCode, permissionCode: string): void {
        if (profile.permissions.some((permission) => permission.code === permissionCode && permission.effect === "deny") || !profile.permissions.some((permission) => permission.code === permissionCode && permission.effect === "allow")) {
            throw new ForbiddenException("Permiso insuficiente.");
        }

        const owner = profile.roles.some((role) => role.code === OWNER_ROLE_CODE && role.status === "active");
        if (!owner && !profile.orgUnits.some((orgUnit) => orgUnit.code === moduleCode && orgUnit.status === "active")) {
            throw new ForbiddenException("Permiso insuficiente.");
        }
    }
}
