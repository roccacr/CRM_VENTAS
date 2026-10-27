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
import { MARKETING_HOME_LEGACY_READER } from "../../modules/crm/marketing/marketing-home.port.js";
import { MARKETING_LEADS_REPORT_LEGACY_READER } from "../../modules/crm/marketing/marketing-leads-report.port.js";
import { PROJECTS_LEGACY_ACCESS } from "../../modules/crm/projects/projects-legacy.port.js";
import { APPROVAL_LEGACY_READER } from "../../modules/crm/sales/sales-orders/approval-summary.port.js";
import { CONTRACT_SUMMARY_LEGACY_READER } from "../../modules/crm/sales/sales-orders/contract-summary.port.js";
import { CONTRACT_TRANSITION_LEGACY } from "../../modules/crm/sales/sales-orders/contract-transition.port.js";
import { FOLLOW_UP_LEGACY_READER } from "../../modules/crm/sales/sales-orders/follow-up.port.js";
import { HOME_SUMMARY_LEGACY_READER } from "../../modules/crm/sales/sales-orders/home-summary.port.js";
import { ORDER_TIMING_LEGACY_READER } from "../../modules/crm/sales/sales-orders/order-timing.port.js";
import { SUBSIDIARIES_LEGACY_ACCESS } from "../../modules/crm/subsidiaries/subsidiaries-legacy.port.js";
import { UNIT_FILES_LEGACY } from "../../modules/crm/unit-files/unit-files-legacy.port.js";
import { LegacyBrokersWriter } from "./brokers/legacy-brokers.writer.js";
import { LegacyCampaignsWriter } from "./campaigns/legacy-campaigns.writer.js";
import { LegacyClassesWriter } from "./classes/legacy-classes.writer.js";
import { LegacyApprovalReader } from "./legacy-approval.reader.js";
import { LegacyCatalogReader } from "./legacy-catalog.reader.js";
import { LegacyContractSummaryReader } from "./legacy-contract-summary.reader.js";
import { LegacyContractTransitionWriter } from "./legacy-contract-transition.writer.js";
import { createLegacyCrmDatabase, LEGACY_CRM_DATABASE } from "./legacy-crm.config.js";
import { isLegacyCrmEnabled } from "./legacy-crm-access.js";
import { LegacyCrmDatabaseService } from "./legacy-crm-database.service.js";
import { LegacyFollowUpReader } from "./legacy-follow-up.reader.js";
import { LegacyHomeSummaryReader } from "./legacy-home-summary.reader.js";
import { LegacyMarketingHomeReader } from "./legacy-marketing-home.reader.js";
import { LegacyMarketingLeadsReportReader } from "./legacy-marketing-leads-report.reader.js";
import { LegacyOrderTimingReader } from "./legacy-order-timing.reader.js";
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
        { provide: APPROVAL_LEGACY_READER, useClass: LegacyApprovalReader },
        { provide: CONTRACT_SUMMARY_LEGACY_READER, useClass: LegacyContractSummaryReader },
        { provide: HOME_SUMMARY_LEGACY_READER, useClass: LegacyHomeSummaryReader },
        { provide: FOLLOW_UP_LEGACY_READER, useClass: LegacyFollowUpReader },
        { provide: ORDER_TIMING_LEGACY_READER, useClass: LegacyOrderTimingReader },
        { provide: CONTRACT_TRANSITION_LEGACY, useClass: LegacyContractTransitionWriter },
        { provide: MARKETING_HOME_LEGACY_READER, useClass: LegacyMarketingHomeReader },
        { provide: MARKETING_LEADS_REPORT_LEGACY_READER, useClass: LegacyMarketingLeadsReportReader },
        { provide: CATALOG_FALLBACK_READER, useClass: LegacyCatalogReader },
        { provide: PROJECTS_LEGACY_ACCESS, useClass: LegacyProjectsWriter },
        { provide: CAMPAIGNS_LEGACY_ACCESS, useClass: LegacyCampaignsWriter },
        { provide: CLASSES_LEGACY_ACCESS, useClass: LegacyClassesWriter },
        { provide: LOCATIONS_LEGACY_ACCESS, useClass: LegacyLocationsWriter },
        { provide: SUBSIDIARIES_LEGACY_ACCESS, useClass: LegacySubsidiariesWriter },
        { provide: BROKERS_LEGACY_ACCESS, useClass: LegacyBrokersWriter },
        { provide: UNIT_FILES_LEGACY, useClass: LegacyUnitFilesReader },
    ],
    exports: [APPROVAL_LEGACY_READER, CONTRACT_SUMMARY_LEGACY_READER, HOME_SUMMARY_LEGACY_READER, FOLLOW_UP_LEGACY_READER, ORDER_TIMING_LEGACY_READER, CONTRACT_TRANSITION_LEGACY, MARKETING_HOME_LEGACY_READER, MARKETING_LEADS_REPORT_LEGACY_READER, LegacyCrmDatabaseService, CATALOG_FALLBACK_READER, PROJECTS_LEGACY_ACCESS, CAMPAIGNS_LEGACY_ACCESS, CLASSES_LEGACY_ACCESS, LOCATIONS_LEGACY_ACCESS, SUBSIDIARIES_LEGACY_ACCESS, BROKERS_LEGACY_ACCESS, UNIT_FILES_LEGACY],
})
export class LegacyCrmModule {}
