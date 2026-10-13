/**
 * Caso de uso de clases.
 *
 * Reutiliza la autorización y la normalización de los catálogos. No guarda en
 * una tabla genérica: el repositorio es el de `crm_class`. Un id
 * `legacy:classes:N` sí se puede editar, porque esa edición lo promueve al CRM nuevo.
 */
import { BadRequestException, Inject, Injectable, Optional } from "@nestjs/common";

import { CatalogItemOperations } from "../catalog-policy/catalog-item.operations.js";
import { CATALOG_FALLBACK_READER, type CatalogFallbackReader } from "../catalogs/catalog-fallback.js";
import type { CatalogDefinition } from "../catalogs/catalogs.constants.js";
import { IdentityService } from "../identity/identity.service.js";
import { ClassesRepository } from "./classes.repository.js";

/**
 * Applies Classes authorization and mutation rules through shared operations.
 */
@Injectable()
export class ClassesService extends CatalogItemOperations {
    /**
     * @param identity - Sesión y permisos efectivos. Este servicio no los calcula.
     * @param repository - Persistencia propia de clases
     * @param fallback - Lector legacy opcional para completar el listado
     */
    constructor(@Inject(IdentityService) identity: IdentityService, @Inject(ClassesRepository) repository: ClassesRepository, @Optional() @Inject(CATALOG_FALLBACK_READER) fallback?: CatalogFallbackReader) {
        super(identity, repository, fallback);
    }

    /**
     * Solo acepta el código `classes`.
     *
     * Esta ruta no administra el resto de catálogos, aunque compartan el caso de uso base.
     */
    protected override resolveCatalog(code: string): CatalogDefinition {
        if (code !== "classes") throw new BadRequestException("Unsupported class domain.");
        return super.resolveCatalog(code);
    }

    /**
     * Deja pasar el id sintético del CRM viejo.
     *
     * El caso de uso base rechaza todo lo que no sea identidad nativa. Aquí esa
     * forma es la señal para promover la fila, no para editar el legado en seco.
     */
    protected override assertMutableIdentity(publicId: string): void {
        if (/^legacy:classes:[1-9]\d*$/.test(publicId)) return;
        super.assertMutableIdentity(publicId);
    }
}
