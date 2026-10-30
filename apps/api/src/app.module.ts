import { type MiddlewareConsumer, Module, type NestModule } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { APP_GUARD } from "@nestjs/core";
import { LoggerModule } from "nestjs-pino";

import { HealthModule } from "./common/health/health.module.js";
import { AuthGuard } from "./common/security/auth.guard.js";
import { AuthenticatedReadRateLimit } from "./common/security/authenticated-read-rate-limit.js";
import { CsrfGuard } from "./common/security/csrf.guard.js";
import { APP_LOG_REDACT_PATHS, appLogPresentation } from "./config/app-logging.constants.js";
import { validateEnv } from "./config/env.validation.js";
import { DatabaseModule } from "./database/database.module.js";
import { LegacyCrmModule } from "./integrations/legacy-crm/legacy-crm.module.js";
import { Microsoft365Module } from "./integrations/microsoft365/microsoft365.module.js";
import { NetsuiteModule } from "./integrations/netsuite/netsuite.module.js";
import { AuditModule } from "./modules/crm/audit/audit.module.js";
import { BrokersModule } from "./modules/crm/brokers/brokers.module.js";
import { CalendarModule } from "./modules/crm/calendar/calendar.module.js";
import { CampaignsModule } from "./modules/crm/campaigns/campaigns.module.js";
import { CatalogsModule } from "./modules/crm/catalogs/catalogs.module.js";
import { ClassesModule } from "./modules/crm/classes/classes.module.js";
import { IdentityModule } from "./modules/crm/identity/identity.module.js";
import { identityRequestContextMiddleware } from "./modules/crm/identity/identity-request-context.js";
import { LocationsModule } from "./modules/crm/locations/locations.module.js";
import { MarketingHomeModule } from "./modules/crm/marketing/marketing-home.module.js";
import { NotesModule } from "./modules/crm/notes/notes.module.js";
import { PermissionsModule } from "./modules/crm/permissions/permissions.module.js";
import { ProjectsModule } from "./modules/crm/projects/projects.module.js";
import { ApprovalSummaryModule } from "./modules/crm/sales/sales-orders/approval-summary.module.js";
import { ContractSummaryModule } from "./modules/crm/sales/sales-orders/contract-summary.module.js";
import { ContractTransitionModule } from "./modules/crm/sales/sales-orders/contract-transition.module.js";
import { HomeSummaryModule } from "./modules/crm/sales/sales-orders/home-summary.module.js";
import { SubsidiariesModule } from "./modules/crm/subsidiaries/subsidiaries.module.js";
import { UnitFilesModule } from "./modules/crm/unit-files/unit-files.module.js";

/**
 * Modulo raiz del runtime de identidad aprobado.
 *
 * Incluye identidad, catalogos, resumenes y seguimiento. Los comandos de
 * Formalizacion registrados exigen permisos propios, aprobaciones y auditoria.
 */
@Module({
    imports: [
        ConfigModule.forRoot({
            isGlobal: true,
            // Los tests configuran process.env manualmente; no deben leer el .env real.
            ignoreEnvFile: process.env.NODE_ENV === "test",
            validate: validateEnv,
        }),
        LoggerModule.forRoot({
            pinoHttp: {
                level: process.env.LOG_LEVEL ?? (process.env.NODE_ENV === "test" ? "silent" : "info"),
                name: "crm-tink-api",
                ...appLogPresentation(process.env.NODE_ENV),
                redact: {
                    paths: APP_LOG_REDACT_PATHS,
                    censor: "[REDACTED]",
                },
            },
        }),
        DatabaseModule,
        HealthModule,
        LegacyCrmModule,
        Microsoft365Module,
        NetsuiteModule,
        AuditModule,
        PermissionsModule,
        NotesModule,
        CalendarModule,
        IdentityModule,
        CatalogsModule,
        ProjectsModule,
        CampaignsModule,
        ClassesModule,
        LocationsModule,
        SubsidiariesModule,
        BrokersModule,
        UnitFilesModule,
        ApprovalSummaryModule,
        ContractSummaryModule,
        HomeSummaryModule,
        ContractTransitionModule,
        MarketingHomeModule,
    ],
    providers: [
        AuthenticatedReadRateLimit,
        {
            provide: APP_GUARD,
            useClass: CsrfGuard,
        },
        {
            provide: APP_GUARD,
            useClass: AuthGuard,
        },
    ],
})
export class AppModule implements NestModule {
    /** Context starts before guards; CSRF remains the first global guard. */
    configure(consumer: MiddlewareConsumer): void {
        consumer.apply(identityRequestContextMiddleware).forRoutes("{*path}");
    }
}
