import { Module } from "@nestjs/common";

import { AuditModule } from "../audit/audit.module.js";
import { PermissionsModule } from "../permissions/permissions.module.js";
import { IdentityController } from "./identity.controller.js";
import { IdentityRepository } from "./identity.repository.js";
import { IdentityService } from "./identity.service.js";

/**
 * Modulo feature de identidad para P0-S1A.
 *
 * Expone endpoints HTTP de identidad y mantiene calculo de permisos como
 * colaborador importado. No incluye concerns de leads, ERP ni CRM comercial.
 */
@Module({
    imports: [AuditModule, PermissionsModule],
    controllers: [IdentityController],
    providers: [IdentityService, IdentityRepository],
})
export class IdentityModule {}
