/**
 * Módulo NestJS de integración Kapso (WhatsApp / Meta).
 *
 * Registra controladores HTTP, cola BullMQ, health checks, repositorios y
 * servicios del dominio: sync de números, automatización de leads, media firmada
 * e integraciones admin↔número.
 */

import { HttpModule } from "@nestjs/axios";
import { BullModule } from "@nestjs/bullmq";
import { Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { MulterModule } from "@nestjs/platform-express";
import { TerminusModule } from "@nestjs/terminus";
import { TypeOrmModule } from "@nestjs/typeorm";
import { memoryStorage } from "multer";

import { KAPSO_JOBS_QUEUE } from "./common/kapso-jobs.constants";
import { AdminKapsoIntegrationsController } from "./controllers/admin-kapso-integrations.controller";
import { KapsoHealthController } from "./controllers/kapso-health.controller";
import { KapsoController } from "./controllers/kapso.controller";
import { KapsoWebhooksController } from "./controllers/kapso-webhooks.controller";
import { AdminKapsoIntegrationEntity } from "./entities/admin-kapso-integration.entity";
import { KapsoPhoneNumberEntity } from "./entities/kapso-phone-number.entity";
import { AdminKapsoIntegrationsRepository } from "./repositories/admin-kapso-integrations.repository";
import { KapsoFlowProjectMediaRepository } from "./repositories/kapso-flow-project-media.repository";
import { KapsoLeadAutomationRepository } from "./repositories/kapso-lead-automation.repository";
import { KapsoRepository } from "./repositories/kapso.repository";
import { AdminKapsoIntegrationsService } from "./services/admin-kapso-integrations.service";
import { KapsoJobsProcessor } from "./services/kapso-jobs.processor";
import { KapsoJobsSchedulerService } from "./services/kapso-jobs-scheduler.service";
import { KapsoLeadAutomationService } from "./services/kapso-lead-automation.service";
import { KapsoMediaUrlSignerService } from "./services/kapso-media-url-signer.service";
import { KapsoPhoneNumberSyncService } from "./services/kapso-phone-number-sync.service";
import { KapsoPlatformApiService } from "./services/kapso-platform-api.service";
import { KapsoSignatureService } from "./services/kapso-signature.service";
import { KapsoSyncService } from "./services/kapso-sync.service";

/**
 * Dominio Kapso completo: REST admin, webhooks firmados, jobs distribuidos y probes.
 */
@Module({
  imports: [
    HttpModule,
    TerminusModule,
    TypeOrmModule.forFeature([AdminKapsoIntegrationEntity, KapsoPhoneNumberEntity]),
    BullModule.registerQueue({
      name: KAPSO_JOBS_QUEUE,
    }),
    MulterModule.registerAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const maxFileSizeMb = configService.get<number>("kapso.mediaMaxFileSizeMb", 50);

        return {
          // memoryStorage: el servicio valida magic bytes sobre el buffer completo.
          storage: memoryStorage(),
          limits: {
            fileSize: maxFileSizeMb * 1024 * 1024,
            files: 1,
            fields: 20,
            parts: 25,
            headerPairs: 40,
          },
        };
      },
    }),
  ],
  controllers: [AdminKapsoIntegrationsController, KapsoController, KapsoWebhooksController, KapsoHealthController],
  providers: [
    AdminKapsoIntegrationsRepository,
    KapsoFlowProjectMediaRepository,
    KapsoLeadAutomationRepository,
    KapsoRepository,
    AdminKapsoIntegrationsService,
    KapsoMediaUrlSignerService,
    KapsoPlatformApiService,
    KapsoSignatureService,
    KapsoPhoneNumberSyncService,
    KapsoLeadAutomationService,
    KapsoSyncService,
    KapsoJobsSchedulerService,
    KapsoJobsProcessor,
  ],
})
export class KapsoModule {}
