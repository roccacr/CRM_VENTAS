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

import { BROKERS_LEGACY_ACCESS } from "../../modules/crm/brokers/brokers-legacy.port.js";
import { CAMPAIGNS_LEGACY_ACCESS } from "../../modules/crm/campaigns/campaigns-legacy.port.js";
import { CATALOG_FALLBACK_READER } from "../../modules/crm/catalogs/catalog-fallback.js";
import { CLASSES_LEGACY_ACCESS } from "../../modules/crm/classes/classes-legacy.port.js";
import { LOCATIONS_LEGACY_ACCESS } from "../../modules/crm/locations/locations-legacy.port.js";
import { PROJECTS_LEGACY_ACCESS } from "../../modules/crm/projects/projects-legacy.port.js";
import { SUBSIDIARIES_LEGACY_ACCESS } from "../../modules/crm/subsidiaries/subsidiaries-legacy.port.js";
import { UNIT_FILES_LEGACY } from "../../modules/crm/unit-files/unit-files-legacy.port.js";
import { LegacyBrokersWriter } from "./brokers/legacy-brokers.writer.js";
import { LegacyCampaignsWriter } from "./campaigns/legacy-campaigns.writer.js";
import { LegacyClassesWriter } from "./classes/legacy-classes.writer.js";
import { LegacyCatalogReader } from "./legacy-catalog.reader.js";
import { createLegacyCrmDatabase, LEGACY_CRM_DATABASE } from "./legacy-crm.config.js";
import { isLegacyCrmEnabled } from "./legacy-crm-access.js";
import { LegacyCrmDatabaseService } from "./legacy-crm-database.service.js";
import { LegacyLocationsWriter } from "./locations/legacy-locations.writer.js";
import { LegacyProjectsWriter } from "./projects/legacy-projects.writer.js";
import { LegacySubsidiariesWriter } from "./subsidiaries/legacy-subsidiaries.writer.js";
import { LegacyUnitFilesReader } from "./unit-files/legacy-unit-files.reader.js";

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
        { provide: CAMPAIGNS_LEGACY_ACCESS, useClass: LegacyCampaignsWriter },
        { provide: CLASSES_LEGACY_ACCESS, useClass: LegacyClassesWriter },
        { provide: LOCATIONS_LEGACY_ACCESS, useClass: LegacyLocationsWriter },
        { provide: SUBSIDIARIES_LEGACY_ACCESS, useClass: LegacySubsidiariesWriter },
        { provide: BROKERS_LEGACY_ACCESS, useClass: LegacyBrokersWriter },
        { provide: UNIT_FILES_LEGACY, useClass: LegacyUnitFilesReader },
    ],
    exports: [LegacyCrmDatabaseService, CATALOG_FALLBACK_READER, PROJECTS_LEGACY_ACCESS, CAMPAIGNS_LEGACY_ACCESS, CLASSES_LEGACY_ACCESS, LOCATIONS_LEGACY_ACCESS, SUBSIDIARIES_LEGACY_ACCESS, BROKERS_LEGACY_ACCESS, UNIT_FILES_LEGACY],
})
export class LegacyCrmModule {}
