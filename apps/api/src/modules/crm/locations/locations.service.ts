/**
 * Caso de uso de ubicaciones.
 *
 * Reutiliza la autorización y la normalización de los catálogos. No guarda en
 * una tabla genérica: el repositorio es el de `crm_location`. Un id
 * `legacy:locations:N` sí se puede editar, porque esa edición lo promueve al CRM nuevo.
 */
import { BadRequestException, Inject, Injectable, Optional } from "@nestjs/common";

import { CatalogItemOperations } from "../catalog-policy/catalog-item.operations.js";
import { CATALOG_FALLBACK_READER, type CatalogFallbackReader } from "../catalogs/catalog-fallback.js";
import type { CatalogDefinition } from "../catalogs/catalogs.constants.js";
import { IdentityService } from "../identity/identity.service.js";
import { LocationsRepository } from "./locations.repository.js";

/**
 * Applies Locations authorization and mutation rules through shared operations.
 */
@Injectable()
export class LocationsService extends CatalogItemOperations {
    /**
     * @param identity - Sesión y permisos efectivos. Este servicio no los calcula.
     * @param repository - Persistencia propia de ubicaciones
     * @param fallback - Lector legacy opcional para completar el listado
     */
    constructor(@Inject(IdentityService) identity: IdentityService, @Inject(LocationsRepository) repository: LocationsRepository, @Optional() @Inject(CATALOG_FALLBACK_READER) fallback?: CatalogFallbackReader) {
        super(identity, repository, fallback);
    }

    /**
     * Solo acepta el código `locations`.
     *
     * Esta ruta no administra el resto de catálogos, aunque compartan el caso de uso base.
     */
    protected override resolveCatalog(code: string): CatalogDefinition {
        if (code !== "locations") throw new BadRequestException("Unsupported location domain.");
        return super.resolveCatalog(code);
    }

    /**
     * Deja pasar el id sintético del CRM viejo.
     *
     * El caso de uso base rechaza todo lo que no sea identidad nativa. Aquí esa
     * forma es la señal para promover la fila, no para editar el legado en seco.
     */
    protected override assertMutableIdentity(publicId: string): void {
        if (/^legacy:locations:[1-9]\d*$/.test(publicId)) return;
        super.assertMutableIdentity(publicId);
    }
}
