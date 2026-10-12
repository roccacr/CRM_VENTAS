/**
 * Módulo opcional del CRM viejo.
 *
 * El core pide catálogos por el puerto `CATALOG_FALLBACK_READER`. No importa
 * este pool ni las tablas viejas. Si `ENABLE_LEGACY_FALLBACK` no es `true`,
 * la fábrica devuelve `null` y no abre conexiones. Antes de borrar esta
 * carpeta hay que quitar el registro del módulo en `AppModule`.
 */
import { Global, Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

import { CATALOG_FALLBACK_READER } from "../../modules/crm/catalogs/catalog-fallback.js";
import { PROJECTS_LEGACY_ACCESS } from "../../modules/crm/projects/projects-legacy.port.js";
import { LegacyCatalogReader } from "./legacy-catalog.reader.js";
import { createLegacyCrmDatabase, LEGACY_CRM_DATABASE } from "./legacy-crm.config.js";
import { isLegacyCrmEnabled } from "./legacy-crm-access.js";
import { LegacyCrmDatabaseService } from "./legacy-crm-database.service.js";
import { LegacyProjectsWriter } from "./projects/legacy-projects.writer.js";

/**
 *
 */
@Global()
@Module({
    providers: [
        {
            provide: LEGACY_CRM_DATABASE,
            inject: [ConfigService],
            useFactory: (config: ConfigService) => (isLegacyCrmEnabled(config) ? createLegacyCrmDatabase(config) : null),
        },
        LegacyCrmDatabaseService,
        { provide: CATALOG_FALLBACK_READER, useClass: LegacyCatalogReader },
        { provide: PROJECTS_LEGACY_ACCESS, useClass: LegacyProjectsWriter },
    ],
    exports: [LegacyCrmDatabaseService, CATALOG_FALLBACK_READER, PROJECTS_LEGACY_ACCESS],
})
export class LegacyCrmModule {}
