/**
 * Caso de uso de los catálogos de tabla compartida.
 *
 * La autorización, el módulo de contexto y el rechazo de ids `legacy:` viven
 * en `CatalogItemOperations`. Este servicio solo ata identidad, repositorio y
 * el lector opcional del CRM viejo.
 */
import { Inject, Injectable, Optional } from "@nestjs/common";

import { CatalogItemOperations } from "../catalog-policy/catalog-item.operations.js";
import { IdentityService } from "../identity/identity.service.js";
import { CATALOG_FALLBACK_READER, type CatalogFallbackReader } from "./catalog-fallback.js";
import { CatalogsRepository } from "./catalogs.repository.js";

@Injectable()
export class CatalogsService extends CatalogItemOperations {
    /**
     * @param identity - Sesión y permisos efectivos. Este servicio no los calcula.
     * @param repository - Persistencia de `crm_catalog_item`
     * @param fallback - Lector legacy. Si no está registrado, el listado queda solo en el CRM nuevo
     */
    constructor(@Inject(IdentityService) identity: IdentityService, @Inject(CatalogsRepository) repository: CatalogsRepository, @Optional() @Inject(CATALOG_FALLBACK_READER) fallback?: CatalogFallbackReader) {
        super(identity, repository, fallback);
    }
}
