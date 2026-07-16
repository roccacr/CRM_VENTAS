// ============================================================================
// IMPORTS
// ============================================================================

// Module: decorador de Nest para registrar el modulo de dominio.
import { HttpModule } from "@nestjs/axios";
import { Module } from "@nestjs/common";

// TypeOrmModule: habilita la inyeccion de los repositorios TypeORM del dominio.
import { TypeOrmModule } from "@nestjs/typeorm";

// Controladores HTTP del modulo Kapso.
import { AdminKapsoIntegrationsController } from "./controllers/admin-kapso-integrations.controller";
import { KapsoController } from "./controllers/kapso.controller";
import { KapsoWebhooksController } from "./controllers/kapso-webhooks.controller";

// Entidades persistidas en MySQL.
import { AdminKapsoIntegrationEntity } from "./entities/admin-kapso-integration.entity";
import { KapsoPhoneNumberEntity } from "./entities/kapso-phone-number.entity";

// Servicios y repositorios propios del modulo.
import { AdminKapsoIntegrationsRepository } from "./repositories/admin-kapso-integrations.repository";
import { KapsoRepository } from "./repositories/kapso.repository";
import { AdminKapsoIntegrationsService } from "./services/admin-kapso-integrations.service";
import { KapsoPlatformApiService } from "./services/kapso-platform-api.service";
import { KapsoSignatureService } from "./services/kapso-signature.service";
import { KapsoSyncService } from "./services/kapso-sync.service";

// ============================================================================
// MODULO
// ============================================================================

/**
 * Modulo de dominio Kapso / WhatsApp.
 *
 * Expone:
 * - consulta local de customers y numeros;
 * - endpoints de setup success/failure;
 * - recepcion de webhooks platform / kapso / meta;
 * - sincronizacion manual y automatica contra Kapso Platform API;
 * - configuracion de relaciones entre administradores del CRM e integraciones Kapso.
 */
@Module({
  // Las entidades se registran aqui para que los repositorios del modulo puedan
  // inyectar `Repository<...>` via `@InjectRepository(...)`.
  imports: [HttpModule, TypeOrmModule.forFeature([AdminKapsoIntegrationEntity, KapsoPhoneNumberEntity])],

  // Superficie HTTP del dominio.
  controllers: [AdminKapsoIntegrationsController, KapsoController, KapsoWebhooksController],

  // Servicios internos que implementan la logica del modulo.
  providers: [
    AdminKapsoIntegrationsRepository,
    AdminKapsoIntegrationsService,
    KapsoPlatformApiService,
    KapsoRepository,
    KapsoSignatureService,
    KapsoSyncService,
  ],
})
export class KapsoModule {}
